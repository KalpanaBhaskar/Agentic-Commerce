# CLAUDE.md — RazorAgent
## AI Growth & Agentic Commerce · Razorpay BuildSprint

> **Read this entire file before writing a single line of code.**
> Every session with Claude Code starts here. This is your source of truth.

---

## 0. What this project IS (30-second pitch for judges)

RazorAgent is an AI agent that acts as a merchant's autonomous commerce layer.
A buyer (human or AI) sends a plain-language message → the agent understands intent,
reads the merchant catalog, creates a Razorpay order, offers upsells, handles payment
webhooks, and gracefully recovers from failures — all with a full, immutable audit trail.

**Judging bar (non-negotiable — every demo must show all four):**
- 🔍 Every money action explainable
- 🔒 Bounded and gated (agent can't spend/create beyond its tool schemas)
- 📋 Audit trail visible (`npm run audit` shows the table live)
- ⚠️ One failure handled gracefully (payment.failed → retry → payment link)

---

## 1. Tech Stack (locked — do not change without a comment in the PR)

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Async-native, best for webhook handling |
| HTTP server | Express 4 | Minimal, battle-tested, easy to reason about |
| Razorpay | `razorpay` npm SDK | Official SDK, handles Basic auth + webhook verification |
| AI/Agent | Anthropic SDK (`@anthropic-ai/sdk`) | Claude claude-sonnet-4-6 for tool_use (function calling) |
| Persistence | Flat files: `catalog.json`, `audit.log` (JSONL), `orders.json` | No DB for hackathon — portable, inspectable |
| Webhook tunnel | ngrok | Exposes localhost:3000 to Razorpay in test mode |
| Dev tooling | nodemon, dotenv, Jest | Auto-restart, env vars, unit tests |
| Version control | Git + GitHub | Feature branches → PR → merge. Every feature is one PR. |

---

## 2. Exact File Structure

```
razoragent/
├── CLAUDE.md                        ← YOU ARE HERE
├── .env                             ← never commit; copy from .env.example
├── .env.example                     ← commit this
├── .gitignore
├── package.json
├── server.js                        ← Express entry point
├── src/
│   ├── api/
│   │   ├── razorpay.js              ← SDK wrapper: createOrder, capturePayment, verifyWebhook
│   │   └── paymentLinks.js          ← Creates payment links (failure fallback)
│   ├── agent/
│   │   ├── checkout.js              ← Conversational checkout: NLP → product → order
│   │   ├── upsell.js                ← Upsell engine: given product, return related + reasoning
│   │   └── tools.js                 ← Claude tool_use schemas (the "bounded" part)
│   ├── catalog/
│   │   ├── catalog.json             ← Merchant product data (agent-readable)
│   │   └── index.js                 ← Catalog loader, search, upsell resolver
│   ├── audit/
│   │   ├── logger.js                ← Append-only JSONL writer — called after EVERY money action
│   │   └── viewer.js                ← CLI pretty-printer: `npm run audit`
│   ├── webhooks/
│   │   └── handler.js               ← Express route: verify signature → dispatch → log → capture
│   └── failures/
│       └── handler.js               ← payment.failed → retry (2s backoff) → offer link
├── skills/
│   ├── razorpay-order/SKILL.md      ← teaches agent the order lifecycle
│   ├── merchant-catalog/SKILL.md    ← teaches agent catalog reading + upsell
│   └── audit-trail/SKILL.md         ← teaches agent the audit logging pattern
├── tests/
│   ├── audit.test.js
│   ├── webhook.test.js
│   └── failure.test.js
└── docs/
    ├── PROMPTS.md                   ← log every Claude Code session prompt + outcome
    └── sessions/                    ← exported .md session files
```

---

## 3. Environment Variables

```bash
# .env (never commit)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=your_webhook_signing_secret
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
PORT=3000
NGROK_URL=https://xxxx.ngrok.io
```

Get Razorpay test keys from: https://dashboard.razorpay.com → Settings → API Keys → Test Mode
Get webhook secret from: Dashboard → Webhooks → Add Webhook → copy secret

---

## 4. Feature Build Order (STRICT — do not skip ahead)

Each feature = one branch + one PR. Test locally before opening the PR.

### Feature 1: Project scaffold + catalog endpoint
**Branch:** `feat/01-scaffold-catalog`
**Deliverable:** `GET /catalog` returns structured JSON. `GET /health` returns `{status:"ok"}`.
**Test:** `curl http://localhost:3000/catalog` returns all products.
**Commit:** `feat: scaffold + agent-readable catalog endpoint`

### Feature 2: Razorpay order creation
**Branch:** `feat/02-razorpay-order`
**Deliverable:** `POST /orders` creates a real Razorpay test-mode order. Returns `order_id`, `amount`, `payment_link`.
**Test:** Call endpoint → check Razorpay dashboard for the order.
**Audit:** Every order creation writes one line to `audit.log`.
**Commit:** `feat: razorpay order creation + audit log`

### Feature 3: Webhook handler + payment capture
**Branch:** `feat/03-webhook-capture`
**Deliverable:** `POST /webhook` verifies HMAC signature, handles `payment.captured` event, captures the payment, logs to audit.
**Test:** Use Razorpay dashboard → Webhooks → send test event.
**ngrok required for this feature.**
**Commit:** `feat: webhook handler + payment capture`

### Feature 4: Conversational checkout (Claude agent)
**Branch:** `feat/04-conversational-checkout`
**Deliverable:** `POST /chat` accepts `{message: "I want to buy a blue t-shirt"}` → Claude parses intent via tool_use → finds product in catalog → creates order → returns payment link with natural language response.
**Test:** `curl -X POST /chat -d '{"message":"I want noise-cancelling headphones"}'`
**Commit:** `feat: conversational checkout agent with tool_use`

### Feature 5: Upsell agent
**Branch:** `feat/05-upsell-agent`
**Deliverable:** After product match, agent checks `upsell_ids[]` → suggests 1-2 related products → explains reasoning → logs `upsell_shown` to audit.
**Test:** Ask for a product with known upsell_ids → verify suggestion in response + audit log.
**Commit:** `feat: upsell agent with LLM reasoning + audit`

### Feature 6: Graceful failure handling
**Branch:** `feat/06-failure-handler`
**Deliverable:** `payment.failed` webhook → log failure → retry once after 2s → if still fails → create payment link → return user-friendly message. All logged to audit.
**Test:** Use Razorpay test card `4111111111111111` with CVV `123` (triggers failure in test mode).
**Commit:** `feat: graceful failure handler with retry + payment link fallback`

### Feature 7: Audit trail viewer + tests
**Branch:** `feat/07-audit-tests`
**Deliverable:** `npm run audit` pretty-prints the full audit.log as a table. Jest tests for logger, webhook verifier, failure handler all pass.
**Commit:** `test: audit viewer + Jest suite`

### Feature 8: README + demo script
**Branch:** `feat/08-docs-readme`
**Deliverable:** README with setup instructions, demo GIF/video script, judge-facing narrative (ACP context, NPCI UAP, why this matters).
**Commit:** `docs: README, demo script, judge narrative`

---

## 5. Razorpay API Cheatsheet (test-mode only)

Base URL: `https://api.razorpay.com/v1`
Auth: Basic — `key_id:key_secret` (SDK handles this automatically)
**All amounts in PAISE. ₹1 = 100 paise. Never use floats.**

| Endpoint | Method | When |
|---|---|---|
| `/orders` | POST | Create order before any payment |
| `/orders/:id` | GET | Check order status |
| `/orders/:id/payments` | GET | Get payments for an order |
| `/payments/:id/capture` | POST | Capture authorized payment |
| `/payments/:id` | GET | Fetch payment details |
| `/payment_links` | POST | Failure fallback — shareable link |
| `/webhook` (inbound) | POST | Receive payment.captured / payment.failed |

**Test cards:**
- Success: `4111 1111 1111 1111`, any future expiry, CVV `123`
- Failure: `4000 0000 0000 0002` (triggers payment.failed)

---

## 6. The Audit Log Schema (every money action MUST log this)

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "action": "order_created",
  "order_id": "order_xyz123",
  "amount_paise": 49900,
  "currency": "INR",
  "product_id": "prod_001",
  "status": "success",
  "agent_reasoning": "User asked for noise-cancelling headphones. Matched SKU prod_001. Created order.",
  "session_id": "sess_abc"
}
```

`action` values: `order_created | payment_captured | upsell_shown | payment_failed | retry_attempted | link_sent`

---

## 7. Claude Tool Schemas (the "bounded" part — critical for judges)

The agent can ONLY call these tools. Nothing else. This is what "bounded and gated" means.

```javascript
// src/agent/tools.js — define these exactly
const tools = [
  {
    name: "search_catalog",
    description: "Search the merchant catalog for products matching a user query",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the user wants to buy" }
      },
      required: ["query"]
    }
  },
  {
    name: "create_order",
    description: "Create a Razorpay order for a specific product",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        quantity: { type: "integer", minimum: 1, maximum: 10 }
      },
      required: ["product_id", "quantity"]
    }
  },
  {
    name: "get_upsell_suggestions",
    description: "Get upsell/cross-sell suggestions for a product",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "string" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "get_order_status",
    description: "Check the status of an existing order",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string" }
      },
      required: ["order_id"]
    }
  }
]
```

---

## 8. Catalog JSON Schema

```json
[
  {
    "id": "prod_001",
    "name": "Sony WH-1000XM5 Headphones",
    "description": "Industry-leading noise cancellation, 30hr battery, multipoint connection",
    "price_paise": 2999900,
    "currency": "INR",
    "category": "electronics",
    "stock": 15,
    "upsell_ids": ["prod_002", "prod_003"],
    "tags": ["headphones", "noise-cancelling", "wireless", "sony"]
  }
]
```

Add 8-10 products across 3 categories. Include real `upsell_ids` cross-references.

---

## 9. Commit Message Convention

```
feat:    new feature
fix:     bug fix
skill:   add or update SKILL.md
docs:    session export, PROMPTS.md, README
chore:   tooling, .env.example, .gitignore
test:    Jest tests
```

---

## 10. PR Checklist (before every merge)

- [ ] Feature works end-to-end locally
- [ ] Audit log has at least one entry for this feature's money actions
- [ ] No API keys in any committed file
- [ ] `npm test` passes
- [ ] PR description explains: what it does, how to test it, what the audit log shows

---

## 11. ngrok Setup (required for webhook testing)

```bash
# Terminal 1 — run server
npm run dev

# Terminal 2 — expose to internet
ngrok http 3000

# Copy the https URL, set in .env:
NGROK_URL=https://xxxx.ngrok.io

# Set webhook URL in Razorpay dashboard:
# https://xxxx.ngrok.io/webhook
# Events to subscribe: payment.captured, payment.failed
```

---

## 12. Demo Script for Judges (memorize this flow)

1. Show `GET /catalog` — "This is the agent-readable catalog. Any AI buyer can read it."
2. `POST /chat` with "I want Sony headphones" — "Agent parses intent, finds product, creates order."
3. Show upsell suggestion — "Agent proactively suggests related products, explains why."
4. Show payment link — "Buyer pays here. Razorpay processes."
5. Trigger `payment.captured` webhook — "Audit trail updates in real time."
6. Run `npm run audit` — "Every money action, explainable, immutable."
7. Trigger `payment.failed` — "Agent retries, then falls back gracefully."
8. Show `audit.log` with `agent_reasoning` field — "You can see WHY the agent did what it did."

---

## 13. Session Discipline (how to use Claude Code efficiently)

- **Start every session:** paste this CLAUDE.md + state which feature you're building
- **One feature per session** — don't mix features in one session
- **After each session:** run `npm test`, test the endpoint manually, then commit
- **Export session:** save to `docs/sessions/session-N.md`
- **Log the prompt:** add to `docs/PROMPTS.md`

---

## 14. ACP/Protocol Context (for judge Q&A)

- **ACP (Agentic Commerce Protocol):** OpenAI + Stripe standard (2025) — AI agents run checkout on behalf of buyers. RazorAgent is a Razorpay-native ACP-inspired implementation.
- **NPCI UAP:** India's Unified Agent Platform — Razorpay's in-app pilots make this locally relevant.
- **Shared Payment Token:** ACP concept — agent never sees raw card data, gets a scoped token. Our Razorpay payment link is the test-mode equivalent.
- **Merchant of record:** In ACP, merchant always stays in control. Our audit trail + bounded tool schemas enforce this.
