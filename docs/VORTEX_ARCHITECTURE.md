# Vortex Commerce — Revised Architecture (v2.0)

> Rename note: `RazorAgent` → **Vortex Commerce**. Reason: scope grew from
> payment-simulation demo into a multi-vertical agentic commerce platform
> (retail + travel + local + digital). All code, docs, package name, and UI
> strings migrate to `vortex-commerce`. Razorpay test-mode behavior is FROZEN.

## 0. What "agentic commerce" means here

```
Human ──(natural language)──▶ Vortex Agent ──(bounded tools)──▶ Merchant APIs ──▶ Razorpay TEST order + payment link
                                     │                                     │
                                     └────── audit.log + LangSmith/Langfuse ┘
```

- **Transactional layer (hands/feet):** SerpApi vertical engines return
  buyable/bookable options with price, shop, image, rating, discount.
- **Contextual layer (dictionary):** Knowledge Graph resolves *what* the user
  means ("Apple Park" = place + coords, "Apple" = company vs fruit) BEFORE
  any transactional call.
- **Money layer (vault, frozen):** ONLY `src/api/razorpay.js` +
  `src/api/paymentLinks.js` + `src/webhooks/handler.js` +
  `src/failures/handler.js` touch money. LangChain tools call them; they are
  never rewritten, only wrapped.
- **Communication layer:** Groq (`openai/gpt-oss-20b` via `GROQ_API_KEY`) is
  the ONLY LLM. No Anthropic in the hot path (keep provider file for fallback).
- **Observability layer:** LangSmith (traces) + Langfuse (scores/costs) +
  local `audit.log` JSONL (money truth). Every agent run carries `trace_id`
  into the audit line.

## 1. Revised tech stack (no removals, only additions)

| Layer | v1 (keep) | v2 (add) | Why |
|---|---|---|---|
| Runtime/HTTP | Node 20, Express 4, `server.js` | unchanged | webhook raw-body ordering is load-bearing |
| Money | `razorpay` SDK, `src/api/*`, `src/webhooks/*`, `src/failures/*` | extract `IPaymentService` interface, same impl | SOLID-D; freeze behavior |
| LLM comms | `src/agent/providers/groq.js` (fetch) | `@langchain/groq` `ChatGroq(model=openai/gpt-oss-20b)` | user requirement: Grok/Groq is communication API |
| Agent orchestration | hand-rolled loop in `src/agent/checkout.js` | `langchain` `createToolCallingAgent` + `AgentExecutor(maxIterations=8)` | replaces loop 1:1, keeps bound |
| Tools | `src/agent/tools.js` 4 tools | `src/agent/tools/*.js` each a `StructuredTool` subclass | SOLID-S; one file per vertical |
| Catalog/search | `src/catalog/serpapi.js` (google_shopping only) | `src/serp/` router + adapters per engine | SOLID-O; add vertical without editing router |
| Context | none | `src/serp/knowledgeGraph.js` entity resolver | disambiguation before transactions |
| Images | `thumbnail` passthrough, nullable | `src/serp/imageEnricher.js` guarantees ≥1 image | `google_images` / `images` engine fallback |
| Tracing | console | `langsmith` + `langfuse` wrappers | run ids → audit lines |
| Frontend | React+Vite+Tailwind, `ChatWidget`, `Dashboard`, `HomePage`, cart | ADD: `react-markdown`+`remark-gfm` full render, `ProductCard` with Buy Now, Vortex hero/"use it for anything" section | additive-only; never delete existing routes/components |
| Persistence | `catalog.json` fallback, `audit.log` JSONL, `orders.json` | same + in-memory Serp cache w/ TTL | audit stays append-only |
| Config | `.env` | add `LANGCHAIN_*`, `LANGSMITH_*`, `LANGFUSE_*` keys (see §6) | — |

New npm deps (exact):
```
langchain @langchain/core @langchain/groq
langsmith langfuse
react-markdown remark-gfm
zod (tool schemas)
```

## 2. System diagram (read top-down)

```
┌──────────── CLIENT (React+Vite, additive makeover) ────────────┐
│ HomePage (NEW Vortex hero + 4-vertical explainer, keep old)     │
│ ChatWidget (markdown view + ProductCard[image,shop,loc,price,   │
│   discount,rating,delivery, Buy Now, View Details] + cart)      │
│ Dashboard (keep cards/table, ADD vertical/engine/trace cols)    │
└──────────────────────────┬────────────────────────────────────┘
                           │ POST /chat {message,session_id,history}
                           │ POST /orders / GET /audit / GET /health
                           ▼
┌──────────── API GATEWAY (Express, server.js — frozen order) ───┐
│ /webhook (raw body FIRST) → handler → capture → audit          │
│ /chat → agent/runCheckout → {reply_markdown, items, order…}    │
│ /orders → PaymentService.createOrder (same validation)        │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌──────────── AGENT (LangChain, Groq ChatGroq) ──────────────────┐
│ 1. IntentClassifier (StructuredTool, LLM-call)                  │
│    input {message} → {vertical, confidence, signals}            │
│    vertical ∈ retail_general|amazon|walmart|homedepot|ebay|     │
│      hotels|flights|airbnb|places_review|local_food|            │
│      restaurants_booking|maps_local|apps_digital|unknown        │
│ 2. EntityResolver (KnowledgeGraph tool, non-LLM)               │
│    "near Apple Park" → {name, address, lat/lng, type}          │
│    feeds dispatcher context; SKIPPED if no entity signal       │
│ 3. Dispatcher (pure function, src/serp/router.js)              │
│    vertical+entity → engine list (see routing matrix §3)       │
│ 4. Vertical Tools (one StructuredTool per engine, §3)          │
│    each returns Item[] {id,name,price_paise,…,image_url≥1}     │
│ 5. Checkout Tool (one-click Buy)                               │
│    createOrder + createPaymentLink, receipt=UUID, audit line   │
│ 6. Presenter (LLM-call, no tools) → reply_markdown             │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌──────────── SERP LAYER (src/serp/, SOLID) ─────────────────────┐
│ BaseSerpTool (abstract: engine, map(), validate, cache, log)   │
│ ├─ GoogleShoppingTool  engine=google_shopping (fallback agg)   │
│ ├─ AmazonTool          engine=amazon                            │
│ ├─ WalmartTool         engine=walmart                           │
│ ├─ HomeDepotTool       engine=home_depot                        │
│ ├─ EbayTool            engine=ebay                              │
│ ├─ HotelsTool          engine=google_hotels                     │
│ ├─ FlightsTool         engine=google_flights                    │
│ ├─ AirbnbTool          engine=airbnb                            │
│ ├─ TripadvisorTool     engine=tripadvisor (search+place)        │
│ ├─ YelpTool            engine=yelp (search+place)               │
│ ├─ OpenTableTool       engine=opentable (reviews/booking data)  │
│ ├─ MapsTool            engine=google_maps / local               │
│ ├─ AppsTool            engine=apple_app_store | google_play     │
│ ├─ KnowledgeGraphTool  engine=knowledge_graph (context only)    │
│ └─ ImageTool           engine=google_images (enrichment only)   │
│ ImageEnricher: item.image_url ?? ImageTool.fetch(query) ??      │
│   placeholder; NEVER return item without image attempt logged  │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌──────────── MONEY (FROZEN — do not change logic) ──────────────┐
│ PaymentService.createOrder({product_id,quantity 1..10,product, │
│   reasoning,session_id}) → paise math → receipt UUID → SDK →   │
│   audit order_created                                          │
│ createPaymentLink({order_id,amount_paise,description}) → audit │
│   link_sent                                                    │
│ webhook handler: verify HMAC(raw body) → capture → audit       │
│ failure handler: failed → backoff 2s → retry → link fallback   │
└───────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────── OBSERVABILITY ─────────────────────────────────────┐
│ audit.log JSONL (truth): + fields vertical, engine, trace_id,  │
│   image_url (old lines still valid; reader tolerant)           │
│ LangSmith: every AgentExecutor run traced (project=vortex-*)   │
│ Langfuse: scores (buy_success, image_hit, disambiguation_hit), │
│   cost/token dashboards                                        │
└───────────────────────────────────────────────────────────────┘
```

## 3. SerpApi routing matrix (normative — implement exactly)

| User intent example | `vertical` | Engine(s) in order | Adapter file |
|---|---|---|---|
| "Sony mirrorless camera" (no store) | `retail_general` | `google_shopping` | `googleShopping.js` |
| "buy … on Amazon / specs + reviews" | `amazon` | `amazon` → fallback `google_shopping` | `amazon.js` |
| "groceries / everyday essentials" | `walmart` | `walmart` → fallback `google_shopping` | `walmart.js` |
| "drill / tools / home improvement" | `homedepot` | `home_depot` → fallback `google_shopping` | `homeDepot.js` |
| "collectible / secondhand / unique tech" | `ebay` | `ebay` → fallback `google_shopping` | `ebay.js` |
| "boutique hotel downtown Chicago" | `hotels` | `google_hotels` (+ `tripadvisor` enrich reviews) | `hotels.js` |
| "flight NYC→London Fri" | `flights` | `google_flights` | `flights.js` |
| "villa / apartment / unique stay" | `airbnb` | `airbnb` | `airbnb.js` |
| "is X highly rated? reviews?" | `places_review` | `tripadvisor` | `tripadvisor.js` |
| "restaurant near me / delivery / menu" | `local_food` | `yelp` (+ `google_maps` hours) | `yelp.js` |
| "book a table / dining reservation" | `restaurants_booking` | `opentable` (+ `yelp` fallback) | `openTable.js` |
| "open now / address / hours / storefront" | `maps_local` | `google_maps`/`local` | `maps.js` |
| "app / ebook / digital download" | `apps_digital` | `apple_app_store`, `google_play` | `apps.js` |
| "near Apple Park / verify brand X" | *(context, any)* | `knowledge_graph` FIRST, then transactional | `knowledgeGraph.js` |
| image for any item | *(enrichment)* | `google_images` (or `images`) per item query | `imageEnricher.js` |

Rules:
1. Classifier NEVER calls a transactional engine directly; it only emits
   `vertical`. `router.js` maps vertical→engines.
2. Knowledge Graph runs BEFORE transactional tools when message contains a
   proper noun / "near X" / brand-verify signal; its output is injected as
   context (coords/address/entity type), not shown as a product.
3. Google Shopping is the fallback aggregator whenever a merchant engine
   returns 0 results or errors.
4. Every returned `Item` MUST have `image_url` (see §4). Log `image_hit` /
   `image_fallback` for Langfuse scoring.

## 4. Canonical `Item` contract (all adapters return this)

```js
// src/serp/types.js — the ONLY shape the agent and frontend accept
{
  id: string,            // engine product_id or serp_<ts>_<i>
  name: string,
  description: string,   // ≤500 chars
  price_paise: number,   // int; 0 if price-on-request (hotels/flights show "from")
  currency: "INR",
  category: string,      // vertical name
  vertical: string,      // classifier vertical
  engine: string,        // serp engine actually used
  shop_name: string|null,
  shop_icon: string|null,
  product_link: string|null,
  location: string|null, // hotels/restaurants/maps: address / area
  rating: number|null,
  reviews: number|null,
  delivery: string|null,
  old_price_paise: number|null,
  discount_pct: number|null,  // computed from old vs new
  image_url: string,     // GUARANTEED non-null after ImageEnricher
  source: "serpapi"
}
```

`slim()` in tools stays compatible: add `location`, `image_url`,
`discount_pct` alongside existing fields. Old frontend keeps working.

## 5. LangChain migration (Groq stays the brain)

- `src/agent/providers/groq.js` (raw fetch) is SUPERSEDED by
  `src/agent/llm.js`: `new ChatGroq({apiKey, model:"openai/gpt-oss-20b"})`.
  Keep old file for 1 release; hot path uses `llm.js`.
- `src/agent/tools.js` (4 closures) → `src/agent/tools/*.js`, each:
  ```js
  class SearchRetailTool extends StructuredTool {
    name="search_retail"; schema=z.object({query:z.string()});
    async _call({query}) { return router.search("retail_general",query); }
  }
  ```
  Same for each vertical + `ResolveEntityTool`, `CreateOrderTool`
  (quantity 1..10, zod min/max), `GetOrderStatusTool`, `UpsellTool`.
- `src/agent/checkout.js` loop → `src/agent/run.js`:
  `createToolCallingAgent({llm, tools, prompt})` +
  `new AgentExecutor({agent, tools, maxIterations:8})`.
  System prompt = current `buildSystemPrompt()` + vertical-routing + "always
  attach image, shop, discount; reply in markdown with a Buy affordance per
  item (frontend renders the button)".
- Conversation history: pass through LangChain `BufferMemory`/
  `RunnableWithMessageHistory(session_id)` instead of the current dropped
  history.
- Tracing: wrap `run.js` with `langsmith.traceable` and Langfuse
  `observe()`; put returned `trace_id` into every audit line this session.

## 6. Env (append-only — never rename existing keys)

```
# existing (keep): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, WEBHOOK_SECRET,
#   LLM_PROVIDER=groq, GROQ_API_KEY, GROQ_MODEL=openai/gpt-oss-20b,
#   SERPAPI_API_KEY, PORT, NGROK_URL
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=vortex-commerce
LANGSMITH_API_KEY=
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=
```

## 7. SOLID mapping (enforced in review)

- **S:** each adapter/tool/route/handler does one thing
  (`hotels.js` never touches Razorpay; `razorpay.js` never calls SerpApi).
- **O:** new vertical = new file + 1 router row. Router/agent closed for
  modification.
- **L:** every adapter `extends BaseSerpTool` and is substitutable in
  `router.search()`; every LangChain tool extends `StructuredTool`.
- **I:** `ISerpAdapter {search(q,ctx)}`, `IPaymentService
  {createOrder,fetchOrder,capturePayment}`, `IImageEnricher{enrich(item)}` —
  small, mocked in tests.
- **D:** agent depends on `ISerpAdapter`/`IPaymentService`, never on
  `getJson` or `Razorpay` concretions. Wire concretions in `src/serp/index.js`
  / `src/api/index.js` factories.

## 8. What is FROZEN vs what CHANGES

FROZEN (tests must pin): paise-only math, quantity 1..10, receipt UUID,
audit schema (extend-only), webhook raw-body order, failure backoff→retry→
link flow, `/orders` + `/simulate-failure` response shapes.
CHANGES: everything else is additive; frontend deletions are BANNED —
`ChatWidget`, `Dashboard`, cart drawer, audit table stay; new UI is new
sections/cards/columns.
