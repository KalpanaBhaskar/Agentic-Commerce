# Vortex Commerce

**Multi-vertical agentic commerce on Razorpay test-mode + SerpApi + Groq + LangChain.**

Ask in plain English for *anything* — retail products, hotels, flights,
Airbnb stays, restaurants, local services, apps — and a bounded AI agent
searches live SerpApi engines, shows each option as a card with **image, shop,
location, price, discount, rating, delivery + Buy button**, and on Buy creates a
**Razorpay test-mode order + payment link with little to no extra input**.
Every money action is explainable and audit-logged. Previously named
`RazorAgent`; v2 renames to **Vortex Commerce** (see `docs/VORTEX_ARCHITECTURE.md`).

## How it works (user view)

1. **Tell it anything:** "Sony mirrorless camera", "boutique hotel downtown
   Chicago", "sushi near me Friday night", "flight NYC→London".
2. **Agent understands:** Groq (`openai/gpt-oss-20b`) classifies the vertical,
   resolves entities via Knowledge Graph ("Apple Park" → address/coords), then
   routes to the right SerpApi engine(s).
3. **Compare cards:** each item renders markdown + a product card (image
   guaranteed, shop, location, rating/reviews, old price → discount %,
   delivery, View Details link) with its own **Buy Now**.
4. **One-click Buy:** Buy Now sends `I want to buy <name> (ID: <id>)` to
   `/chat`; the agent calls `create_order` (qty defaults 1) → real Razorpay
   TEST order → payment link. Pay via the link. No card data ever touches the agent.
5. **Verify everything:** Merchant Dashboard + `GET /audit` + `npm run audit`
   show the append-only trail; LangSmith/Langfuse show the agent trace.

## Architecture (see docs/VORTEX_ARCHITECTURE.md for the full diagram)

```
Browser → Express (/chat,/orders,/audit,/webhook) → LangChain Agent (ChatGroq)
  → IntentClassifier → KnowledgeGraph resolver → Router → Vertical SerpApi tools
  → ImageEnricher (≥1 image) → CreateOrderTool (Razorpay FROZEN) → markdown reply
  → audit.log + LangSmith/Langfuse trace
```

**Routing matrix (normative):**

| Intent | Engine |
|---|---|
| general shopping / price compare | `google_shopping` (fallback aggregator) |
| Amazon specs/reviews | `amazon` |
| groceries/essentials | `walmart` |
| hardware/tools | `home_depot` |
| unique/secondhand | `ebay` |
| hotels | `google_hotels` (+ `tripadvisor` reviews) |
| flights | `google_flights` |
| villas/apartments | `airbnb` |
| ratings/reviews lookup | `tripadvisor` |
| food delivery/services/menus | `yelp` |
| table booking | `opentable` |
| hours/address/storefront | `google_maps`/`local` |
| apps/ebooks/media | `apple_app_store`, `google_play` |
| disambiguation/brand verify ("near X") | `knowledge_graph` FIRST (context only) |
| item image | `google_images` enrichment, ≥1 per item |

**Tech stack:** Node 20, Express 4, `razorpay` SDK (frozen), `serpapi`,
LangChain (`langchain`, `@langchain/core`, `@langchain/groq` ChatGroq),
`langsmith`, `langfuse`, `zod`, React+Vite+Tailwind,
`react-markdown`+`remark-gfm`. **Grok/Groq is the only LLM.**
**Razorpay logic is never changed**, only wrapped.

## Setup

### 1. Clone + install
```bash
git clone <this-repo> vortex-commerce
cd vortex-commerce
npm install
cd client && npm install && cd ..
```

### 2. Env
```bash
cp .env.example .env
```
Fill in (existing keys keep working):
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Dashboard → Settings → API Keys → Test Mode
- `WEBHOOK_SECRET` — Dashboard → Webhooks → Add Webhook → copy secret
- `LLM_PROVIDER=groq`, `GROQ_API_KEY=gsk_…`, `GROQ_MODEL=openai/gpt-oss-20b`
- `SERPAPI_API_KEY` — https://serpapi.com/manage-api-key
- `PORT=3000`, `NGROK_URL=https://xxxx.ngrok.io` (after step 4)
- Observability (new, optional but recommended):
  `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_PROJECT=vortex-commerce`,
  `LANGSMITH_API_KEY=`, `LANGFUSE_PUBLIC_KEY=`, `LANGFUSE_SECRET_KEY=`

### 3. Run
```bash
npm run dev          # backend :3000
npm run client       # frontend (Vite) in second terminal
# or: npm run dev:all
```

### 4. Webhooks (test mode)
```bash
ngrok http 3000
```
Dashboard → Webhooks: URL `https://xxxx.ngrok.io/webhook`, events
`payment.captured`, `payment.failed`. Keep `server.js` order:
`/webhook` (raw body) BEFORE `express.json()` — load-bearing.

## API reference

| Method | Endpoint | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{status:"ok",timestamp}` |
| POST | `/chat` | `{message, session_id?, conversation_history?}` | `{reply, order_id?, payment_link?, tools_used, session_id, upsell_shown, upsell_products, product_image, search_results: Item[], trace_id?}` — `reply` is markdown; `search_results` follow `src/serp/types.js` Item contract (each has `image_url`, `shop_name`, `location`, `discount_pct`, …) |
| POST | `/orders` | `{product_id, quantity?}` qty 1..10 | `{order_id, amount_paise, amount_inr, product_name, razorpay_order}` |
| GET | `/audit` | — | audit entries newest-first |
| GET | `/simulate-failure` | `?product_id=&delay=` | demo failure→retry→link flow |

**One-click Buy contract:** frontend `Buy Now` on any card sends
`POST /chat {message:"I want to buy <name> (ID: <id>)", session_id}`; backend
matches the ID from cached search results, runs `create_order` + payment link,
returns `order_id` + `payment_link`. No extra user questions.

## Test commands

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/chat -H "Content-Type: application/json" \
  -d '{"message":"boutique hotel downtown Chicago"}'
curl -X POST http://localhost:3000/chat -H "Content-Type: application/json" \
  -d '{"message":"Sony mirrorless camera"}'
curl http://localhost:3000/audit
curl "http://localhost:3000/simulate-failure?product_id=prod_001&delay=200"
npm run audit
npm test
```

## Codebase map (what must be implemented — SOLID)

```
server.js                        # gateway; webhook-raw-first order FROZEN
src/api/razorpay.js              # FROZEN money core (paise, qty 1..10, receipt UUID, audit)
src/api/paymentLinks.js          # FROZEN link fallback
src/api/index.js                 # NEW: IPaymentService factory (D)
src/webhooks/handler.js          # FROZEN HMAC(raw body)→capture→audit
src/failures/handler.js          # FROZEN failed→2s backoff→retry→link
src/agent/llm.js                 # NEW: ChatGroq(openai/gpt-oss-20b) singleton
src/agent/run.js                 # NEW: LangChain ToolCallingAgent+Executor(maxIter 8); replaces checkout loop 1:1
src/agent/checkout.js            # KEEP 1 release as reference; hot path moves to run.js
src/agent/tools.js               # KEEP 1 release; new tools below are the hot path
src/agent/tools/*.js             # NEW: one StructuredTool file per vertical + ResolveEntity/CreateOrder/Status/Upsell (S/L)
  classifyIntent.js router.js(entity+vertical→engines) resolveEntity.js createOrderTool.js …
src/serp/types.js                # NEW: canonical Item contract (image_url guaranteed)
src/serp/base.js                 # NEW: BaseSerpTool abstract (engine,map,cache,log) (L)
src/serp/router.js               # NEW: pure vertical→engines table (§3) (O)
src/serp/<vertical>.js           # NEW: amazon,walmart,homeDepot,ebay,googleShopping,hotels,
                                 #   flights,airbnb,tripadvisor,yelp,openTable,maps,apps (1 file each)
src/serp/knowledgeGraph.js       # NEW: context-only resolver (address/coords/type)
src/serp/imageEnricher.js        # NEW: google_images fallback; logs image_hit/fallback
src/catalog/{index.js,serpapi.js,catalog.json}  # KEEP as fallback cache source
src/audit/logger.js              # EXTEND-ONLY: + vertical,engine,trace_id,image_url
src/observe/{langsmith.js,langfuse.js}          # NEW: tracing/scores wrappers
client/src/components/ChatWidget.jsx  # EXTEND-ONLY: full markdown, ProductCard w/ Buy Now per item
client/src/components/ProductCard.jsx # NEW: extract from ChatWidget (image,shop,loc,discount,…)
client/src/components/HomePage.jsx    # EXTEND-ONLY: Vortex hero + 4-vertical explainer; keep old sections
client/src/pages/Dashboard.jsx        # EXTEND-ONLY: + vertical/engine/trace columns; keep cards/table
```

**SOLID rules:** S — one file, one job; O — new vertical = new file + router
row; L — adapters/tools substitutable via base classes; I —
`ISerpAdapter/IPaymentService/IImageEnricher` small interfaces; D — agent
depends on interfaces, factories wire concretions.

## Task plan (Task 1 → Task N — implement in order)

- [ ] **Task 1 — Rename RazorAgent→Vortex Commerce (no logic).** `package.json`
  name `vortex-commerce`, server log string, frontend titles/headers/footers,
  docs headers, `.env.example` comments. Verify `npm test`, `/health`.
- [ ] **Task 2 — Freeze money core + extract interface.** Create
  `src/api/index.js` `IPaymentService` factory wrapping `razorpay.js`/
  `paymentLinks.js` without behavior change. Pin tests: paise math, qty 1..10,
  receipt UUID, `order_created`/`link_sent` audit lines.
- [ ] **Task 3 — SerpApi vertical adapters (routing matrix).** Create
  `src/serp/types.js` + `base.js` + `router.js` + one file per engine in §3
  table (amazon, walmart, home_depot, ebay, google_shopping fallback,
  google_hotels, google_flights, airbnb, tripadvisor, yelp, opentable,
  google_maps/local, app stores). Each maps raw JSON → Item. Google Shopping
  is fallback when merchant engine empty/errors.
- [ ] **Task 4 — Image guarantee.** `src/serp/imageEnricher.js` via
  `google_images`: `item.image_url ?? fetch(query) ?? placeholder`; log
  `image_hit`/`image_fallback`. No Item leaves without an image attempt.
- [ ] **Task 5 — Knowledge Graph resolver.** `src/serp/knowledgeGraph.js`:
  proper-noun/"near X"/brand signals → `{name,address,lat,lng,type}` injected
  as dispatcher context, never as a product.
- [ ] **Task 6 — Intent classifier (Groq).** `src/agent/tools/classifyIntent.js`
  StructuredTool on ChatGroq → `{vertical, confidence, signals}`; low
  confidence → `retail_general`.
- [ ] **Task 7 — LangChain migration.** `src/agent/llm.js` (ChatGroq) +
  `src/agent/tools/*.js` (StructuredTool+zod per vertical + order/status/
  upsell) + `src/agent/run.js` (agent+executor, maxIterations 8, system prompt
  = current + routing/image/markdown rules, memory via session_id). `/chat`
  switches to `run.js`; old files kept one release.
- [ ] **Task 8 — LangSmith + Langfuse.** `src/observe/*`: trace every run,
  return `trace_id` in `/chat`, write it into audit lines; Langfuse scores
  `buy_success/image_hit/disambiguation_hit`.
- [ ] **Task 9 — One-click Buy.** `CreateOrderTool` = `createOrder` +
  `createPaymentLink` (receipt UUID, qty default 1, ID matched from cached
  search results); returns `{order_id, payment_link}`. Frontend Buy Now posts
  the `I want to buy <name> (ID: <id>)` message — no follow-up questions.
- [ ] **Task 10 — Chat contract + cards.** Backend returns
  `{reply_markdown, items, order_id, payment_link, tools_used, trace_id}`;
  `ProductCard.jsx` shows image/shop/location/price/discount/rating/delivery/
  Buy Now/View Details; `ChatWidget` renders full `react-markdown`+`remark-gfm`.
- [ ] **Task 11 — Frontend makeover (additive-only).** New Vortex hero ("use it
  for anything": retail, travel, local, digital), 4-vertical How-It-Works,
  category shortcuts route to `/chat` with initial queries. **Do not delete**
  ChatWidget/Dashboard/cart/audit table — only add sections/columns/strings.
- [ ] **Task 12 — Audit + Dashboard extension.** Logger accepts
  `vertical/engine/trace_id/image_url` (old readers tolerant); Dashboard adds
  columns/filters, keeps existing cards + live feed + `npm run audit`.
- [ ] **Task 13 — Tests, docs, release.** Jest per adapter/tool/router/
  enricher/resolver + Buy flow + frozen-money pins; update `.env.example`,
  `docs/*`, this README; `npm test` green; tag `vortex-v2.0`.

## Audit trail

Append-only JSONL (`audit.log`), newest-first via `GET /audit`. Every money
action carries `agent_reasoning` (why) + `session_id` (+ new
`vertical/engine/trace_id`). Actions: `order_created, payment_captured,
upsell_shown, payment_failed, retry_attempted, link_sent` (+ `image_fallback`
observations). Never rewrite history — extend fields only.

## License

ISC
