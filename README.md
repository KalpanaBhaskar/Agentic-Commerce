# RazorAgent

An AI agent that acts as a merchant's autonomous commerce layer on Razorpay test-mode APIs.

## Why Now

Agentic Commerce Protocol (ACP) is emerging as the standard for AI-to-AI transactions, while NPCI's Unified Agent Platform (UAP) is building the local infrastructure for India. RazorAgent demonstrates a Razorpay-native implementation where merchants maintain control through bounded tool schemas and complete audit trails — exactly what judges need to see for agent-to-agent commerce.

## Architecture

```
Buyer (Human/AI)
    ↓ POST /chat {message}
Claude Agent (tool_use)
    ↓ bounded tool calls
┌─────────────────────────────────────┐
│  search_catalog  →  catalog.json   │
│  create_order    →  Razorpay API   │
│  get_upsells     →  catalog.json   │
│  get_order_status→  Razorpay API   │
└─────────────────────────────────────┘
    ↓ every money action
audit.log (JSONL, append-only)
```

## Features

| Feature | Endpoint | What it does |
|---------|----------|--------------|
| Catalog | `GET /catalog` | Returns agent-readable product catalog with upsell cross-references |
| Order Creation | `POST /orders` | Creates Razorpay test-mode orders with audit logging |
| Webhook Handler | `POST /webhook` | Verifies HMAC signatures, captures payments, handles failures |
| Conversational Checkout | `POST /chat` | Claude agent parses natural language → product → order via tool_use |
| Upsell Agent | `POST /chat` | Suggests related products with LLM reasoning after order creation |
| Failure Handler | `GET /simulate-failure` | Retries failed payments, falls back to payment links |

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/KalpanaBhaskar/Agentic-Commerce.git
cd Agentic-Commerce
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `RAZORPAY_KEY_ID`: Get from [Razorpay Dashboard](https://dashboard.razorpay.com) → Settings → API Keys → Test Mode
- `RAZORPAY_KEY_SECRET`: Get from the same place (never commit this)
- `WEBHOOK_SECRET`: From Dashboard → Webhooks → Add Webhook → copy secret
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude
- `PORT`: 3000 (default)
- `NGROK_URL`: Your ngrok URL (set after running ngrok in step 5)

### 4. Start the development server
```bash
npm run dev
```

### 5. Expose localhost with ngrok (separate terminal)
```bash
ngrok http 3000
```

Copy the https URL (e.g., `https://xxxx.ngrok.io`) and set it in `.env`:
```
NGROK_URL=https://xxxx.ngrok.io
```

### 6. Configure Razorpay webhook
In Razorpay Dashboard → Webhooks:
- Webhook URL: `https://xxxx.ngrok.io/webhook`
- Events to subscribe: `payment.captured`, `payment.failed`
- Webhook Secret: Copy to `.env` as `WEBHOOK_SECRET`

## API Reference

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/health` | None | `{status: "ok", timestamp: "..."}` |
| GET | `/catalog` | None | Array of 10 products with upsell_ids |
| POST | `/orders` | `{product_id, quantity}` | `{order_id, amount_paise, amount_inr, product_name, razorpay_order}` |
| POST | `/webhook` | Raw Razorpay webhook payload | `{status: "handled"}` (200) or error (400) |
| POST | `/chat` | `{message, session_id?}` | `{reply, order_id?, payment_link?, upsell_shown, upsell_products, tools_used}` |
| GET | `/audit` | None | Array of audit log entries (newest first) |
| GET | `/simulate-failure` | `?product_id=&delay=` | Demo of failure → retry → payment link flow |

## Test Commands

```bash
# Health check
curl http://localhost:3000/health

# Get catalog
curl http://localhost:3000/catalog

# Create order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"product_id":"prod_001","quantity":1}'

# Conversational checkout
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I want Sony noise-cancelling headphones"}'

# View audit trail
curl http://localhost:3000/audit

# Simulate failure (demo mode)
curl http://localhost:3000/simulate-failure?product_id=prod_001

# Run audit viewer CLI
npm run audit

# Run tests
npm test
```

## Audit Trail Example

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "action": "order_created",
  "order_id": "order_TX9yN7HZ7gasqE",
  "amount_paise": 2999900,
  "currency": "INR",
  "product_id": "prod_001",
  "status": "success",
  "agent_reasoning": "User asked for noise-cancelling headphones. Matched SKU prod_001. Created order.",
  "session_id": "sess_abc123"
}
```

The audit trail shows every money action with:
- **Explainable**: `agent_reasoning` field shows WHY the agent acted
- **Bounded**: Only 4 tools available, enforced by schemas
- **Immutable**: Append-only JSONL, never modified
- **Visible**: `npm run audit` pretty-prints the full trail

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js 20 LTS | Async-native, best for webhook handling |
| HTTP Server | Express 4 | Minimal, battle-tested, easy to reason about |
| Razorpay | `razorpay` npm SDK | Official SDK, handles Basic auth + webhook verification |
| AI/Agent | Anthropic SDK (`@anthropic-ai/sdk`) | Claude claude-sonnet-4-6 for tool_use (function calling) |
| Persistence | Flat files: `catalog.json`, `audit.log` (JSONL), `orders.json` | No DB for hackathon — portable, inspectable |
| Webhook Tunnel | ngrok | Exposes localhost:3000 to Razorpay in test mode |
| Dev Tooling | nodemon, dotenv, Jest | Auto-restart, env vars, unit tests |
| Version Control | Git + GitHub | Feature branches → PR → merge |

## Judging Criteria Checklist

✅ **Every money action explainable**
- Audit log includes `agent_reasoning` field for all agent-initiated actions
- `npm run audit` shows full trail with reasoning truncated to 40 chars

✅ **Bounded and gated**
- Agent can ONLY call 4 tools: `search_catalog`, `create_order`, `get_upsell_suggestions`, `get_order_status`
- Tool schemas enforce input validation (quantity 1-10, required fields)
- Agent never sees raw card data — only scoped payment links

✅ **Audit trail visible**
- `GET /audit` returns full audit log (newest first)
- `npm run audit` CLI renders formatted table with filters
- Actions: `order_created`, `payment_captured`, `upsell_shown`, `payment_failed`, `retry_attempted`, `link_sent`

✅ **One failure handled gracefully**
- `payment.failed` webhook → 2s backoff → retry → payment link fallback
- `GET /simulate-failure` demonstrates the full recovery flow
- All failure/retry actions logged to audit

## Project Structure

```
razoragent/
├── CLAUDE.md                        ← Source of truth for development
├── README.md                        ← This file
├── .env                             ← Never commit; copy from .env.example
├── .env.example                     ← Template for environment variables
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
│   │   ├── logger.js                ← Append-only JSONL writer
│   │   └── viewer.js                ← CLI pretty-printer: `npm run audit`
│   ├── webhooks/
│   │   └── handler.js               ← Express route: verify signature → dispatch → log → capture
│   └── failures/
│       └── handler.js               ← payment.failed → retry (2s backoff) → offer link
├── skills/
│   ├── razorpay-order/SKILL.md      ← Teaches agent the order lifecycle
│   ├── merchant-catalog/SKILL.md    ← Teaches agent catalog reading + upsell
│   └── audit-trail/SKILL.md         ← Teaches agent the audit logging pattern
├── tests/
│   ├── audit.test.js                ← Audit logger tests
│   ├── webhook.test.js              ← Webhook verification tests
│   └── failure.test.js               ← Failure handler tests
└── docs/
    ├── PROMPTS.md                   ← Log every Claude Code session prompt + outcome
    ├── DEMO_SCRIPT.md               ← Judge-facing demo walkthrough
    ├── ARCHITECTURE.md              ← Architectural decisions and rationale
    └── sessions/                    ← Exported .md session files
```

## Demo Script

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the complete 8-step demo walkthrough for judges.

## Architecture Decisions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed explanations of every architectural choice.

## License

ISC