# RazorAgent — Prompt Log

Every Claude Code session prompt + outcome, per CLAUDE.md §13.
_Dates are intentionally omitted._

---

## Feature 1 — Project scaffold + catalog endpoint
- **Branch:** `feat/01-scaffold-catalog`
- **PR:** [#1](https://github.com/KalpanaBhaskar/Agentic-Commerce/pull/1) (merged)

**Prompt:**
> Build the complete project scaffold for RazorAgent — an AI agentic commerce system on Razorpay test-mode APIs.
> Create: (1) `package.json` with express, razorpay, @anthropic-ai/sdk, dotenv, nodemon (dev), jest (dev); (2) `.env.example` with RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, WEBHOOK_SECRET, ANTHROPIC_API_KEY, PORT=3000, NGROK_URL; (3) `.gitignore` (node_modules, .env, audit.log, *.log); (4) `server.js` — Express app mounting `/catalog` and `/health`; (5) `src/catalog/catalog.json` — 10 products across electronics/apparel/accessories with real cross-referenced `upsell_ids`; (6) `src/catalog/index.js` exporting `loadCatalog()`, `searchCatalog(query)`, `getProduct(id)`, `getUpsells(product_id)`; (7) `src/audit/logger.js` exporting `logAction(entry)` appending JSONL to audit.log; (8) `GET /catalog`; (9) `GET /health`.
> Constraints: no hardcoded API keys; `catalog.json` is the single source of truth; audit logger uses synchronous `fs.appendFileSync`.

**Outcome:** ✅
- Express 4 server with `GET /health` and `GET /catalog`.
- `src/catalog/` — catalog.json (10 products / 3 categories, validated cross-refs) + loader/search/getProduct/getUpsells.
- `src/audit/logger.js` — synchronous JSONL writer matching the §6 schema.
- Removed the old `index.js` hello-world stub; `npm test` green via `--passWithNoTests`.
- Verified: `/health` → 200 `{status:"ok",...}`; `/catalog` → 200 with 10 products.

---

## Feature 2 — Razorpay order creation
- **Branch:** `feat/02-razorpay-order`
- **PR:** [#2](https://github.com/KalpanaBhaskar/Agentic-Commerce/pull/2) (merged)

**Prompt:**
> Add Razorpay order creation.
> Create: (1) `src/api/razorpay.js` exporting `initRazorpay()` (lazy init, throws if env vars missing), `createOrder({product_id, quantity})` (validates product exists, computes `amount_paise = price_paise * quantity`, creates order via SDK with a `crypto.randomUUID()` idempotency key, logs `order_created`, returns `{order_id, amount_paise, currency, product, receipt}`), `fetchOrder(order_id)`, `capturePayment(payment_id, amount_paise)` (logs `payment_captured`); (2) `src/api/paymentLinks.js` exporting `createPaymentLink({order_id, amount_paise, description})` → `short_url`; (3) `POST /orders` route returning `{order_id, amount_paise, amount_inr, product_name, razorpay_order}`, 400 if product not found, 500 if Razorpay call fails.
> Constraints: all amounts in paise (never rupees/floats); every `createOrder` logs to audit before returning; SDK initialized lazily (not at module load).

**Outcome:** ✅
- `src/api/razorpay.js` — lazy SDK singleton; `createOrder` (qty bounded 1..10, paise math, UUID receipt as idempotency ref, logs `order_created`), `fetchOrder`, `capturePayment` (logs `payment_captured`).
- `src/api/paymentLinks.js` — `createPaymentLink` → `short_url`, logs `link_sent` (Feature 6 fallback).
- `server.js` — `POST /orders`: 201 happy path; 400 `product_not_found` / `invalid_quantity`; 500 `order_creation_failed`.
- Verified against Razorpay test mode: real orders created (`order_TX9yN7HZ7gasqE`, `order_TX9zwyIB5Uae9F`), paise math correct (`2999900`; `129900 × 2 = 259800`), audit lines appended.

---

## Feature 3 — Webhook handler + payment capture
- **Branch:** `feat/03-webhook-capture`
- **PR:** [#4](https://github.com/KalpanaBhaskar/Agentic-Commerce/pull/4)

**Prompt:**
> Build the webhook handler.
> Create/modify: (1) `src/webhooks/handler.js` — Express router for `POST /webhook`: read the RAW body (`express.raw()`, not `express.json()`); verify HMAC-SHA256 via the razorpay SDK's `validateWebhookSignature()`; invalid signature → 400 + warn; dispatch by event type — `payment.captured` → `capturePayment()` + log `payment_captured`, `payment.failed` → call the failure handler (stub: log `payment_failed`); always return 200 on handled events so Razorpay doesn't retry. (2) Update `server.js` to mount the webhook router BEFORE `express.json()` (raw body must be parsed before JSON). (3) `GET /audit` — read `audit.log`, parse JSONL, return the array sorted by timestamp desc.
> Constraints: raw-body preservation is critical for signature verification; log every webhook received (even invalid) with enough context to debug.

**Outcome:** ✅
- `src/webhooks/handler.js` — raw-body router: config guard (500 if no `WEBHOOK_SECRET`), missing/invalid signature → 400, then dispatch. `payment.captured` attempts an idempotent `capturePayment()` and guarantees exactly one `payment_captured` audit line (real "already captured" and dashboard dummy-id events both fall back to logging the confirmed payload). Every hit is console-logged (event, payment/order id, byte count); handled events always return 200.
- `src/failures/handler.js` — stub `handlePaymentFailed()` logs `payment_failed` (retry + payment-link fallback lands in Feature 6).
- `src/audit/logger.js` — added `readAudit()` (tolerates missing file, skips corrupt lines, sorts newest-first).
- `server.js` — mounts `/webhook` (raw) before `express.json()`; adds `GET /audit`.
- Verified locally: self-signed HMAC payload → 200 + `payment_captured` audit line; tampered body → 400 `invalid_signature`; missing header → 400 `missing_signature`; `GET /audit` returns newest-first JSON.

---

## Feature 4 — Conversational checkout agent (tool_use)
- **Branch:** `feat/04-conversational-checkout`
- **PR:** [#5](https://github.com/KalpanaBhaskar/Agentic-Commerce/pull/5)

**Prompt:**
> Build the conversational checkout agent.
> Create: (1) `src/agent/tools.js` — export a `TOOLS` array with the four schemas (`search_catalog {query}`, `create_order {product_id, quantity 1-10}`, `get_upsell_suggestions {product_id}`, `get_order_status {order_id}`) each wired to `searchCatalog` / `createOrder` / `getUpsells` / `fetchOrder`. (2) `src/agent/checkout.js` — export `async processCheckout(userMessage, sessionId)`: call Claude `claude-sonnet-4-6` with tool_use, run an agentic loop until `stop_reason` is `end_turn`, execute each `tool_use` block and feed back a `tool_result`, extract the payment link from the last `create_order`, log `agent_reasoning` for every order-creating call, and return `{response_text, order_id, payment_link, tools_used}`. (3) `POST /chat` route (body `{message, session_id?}`, response `{reply, order_id?, payment_link?, tools_used}`).
> Constraints: the agent MUST use tool_use (never plain text) to create orders — this is the "bounded and gated" guarantee; `session_id` auto-generated as a UUID when not provided; include the catalog content in the system prompt; tell me 3 test messages to verify all tool paths.

**Outcome:** ✅
- `src/agent/tools.js` — `TOOLS` (4 schemas matching §7 exactly) + `executeTool(name, input, ctx)` dispatcher; unknown tool name throws (nothing outside the schemas is reachable). `create_order` also mints a payment link (logs `link_sent`).
- `src/agent/checkout.js` — `processCheckout()` runs the bounded tool_use loop (lazy Anthropic client, model overridable via `ANTHROPIC_MODEL`, `MAX_TURNS` safety bound); embeds the live catalog in the system prompt; threads each turn's natural-language reasoning into the `create_order` audit line; tolerates tool errors by returning them as `tool_result` so Claude can recover.
- `src/api/razorpay.js` — `createOrder` now accepts optional `agent_reasoning` + `session_id` (backward compatible; `POST /orders` unchanged).
- `server.js` — `POST /chat`: 400 `invalid_message`; 503 when `ANTHROPIC_API_KEY` is missing; 500 otherwise.
- Verified with a fake-SDK harness (canned tool_use turns, real Razorpay test mode): all four tools exercised in one multi-turn loop, real order `order_TXQpIUbqSO9Bpu` + payment link created, `order_id`/`payment_link` extracted, and the `order_created` audit line carried the agent's reasoning + `session_id`. HTTP: `/chat {}` → 400; `/chat {message}` with the placeholder key → 500 `chat_failed` (`401 UNAUTHENTICATED`) — a real `ANTHROPIC_API_KEY` is required for the live Claude call.

**Update — pluggable LLM provider (free-tier testing):**
- The live Anthropic key available for this sprint is identity-linked and carries **$0 API credits** (the Anthropic API has no free tier — it is prepaid), and the workstation's shell `ANTHROPIC_BASE_URL` routes SDK calls through a third-party proxy. Both block a real Claude `tool_use` call during testing. Code is provably correct (fake-SDK harness above); the blocker is purely the account/credits/environment.
- Refactored the agent to a **provider abstraction** (`src/agent/providers/`): a neutral interface (`formatTools` / `initMessages` / `callModel` / `formatToolResults`) that `checkout.js`'s bounded loop drives unchanged. `LLM_PROVIDER=anthropic` (default, production) or `groq` (free, OpenAI-compatible Llama, for testing/demo). The four tool schemas, the bounded loop, and the audit trail are **identical** across providers — the "agent can only act through its tools" guarantee (§0) holds either way.
- Verified the Groq path with a fake-`fetch` harness (canned OpenAI-format `chat/completions`, real Razorpay test mode): full `search_catalog → get_upsell_suggestions → create_order → get_order_status` loop, real order `order_TXY1JuXPrweKTd` + payment link, `finish_reason` looping/stopping correct, `order_created` audit line carried the reasoning + `session_id`. Live Groq run pending a free `GROQ_API_KEY`.

---

