# RazorAgent — Claude Code Session Prompts
## Copy-paste these into Claude Code for each feature session

---

## SESSION 1 — Scaffold + Catalog

```
Read CLAUDE.md completely before doing anything.

I am building Feature 1: Project scaffold + catalog endpoint
Branch: feat/01-scaffold-catalog

This is a fresh repo. Nothing exists yet.

Task: Build the complete project scaffold for RazorAgent — an AI agentic commerce system
on Razorpay test-mode APIs.

Create:
1. package.json with these dependencies: express, razorpay, @anthropic-ai/sdk, dotenv, nodemon (dev), jest (dev)
2. .env.example with these vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, WEBHOOK_SECRET, ANTHROPIC_API_KEY, PORT=3000, NGROK_URL
3. .gitignore (node_modules, .env, audit.log, *.log)
4. server.js — Express app, mounts /catalog, /health routes, listens on PORT
5. src/catalog/catalog.json — 10 products across 3 categories (electronics, apparel, accessories).
   Each product must have: id, name, description, price_paise, currency, category, stock, upsell_ids[], tags[].
   Make real upsell_ids cross-references between products.
6. src/catalog/index.js — exports: loadCatalog(), searchCatalog(query), getProduct(id), getUpsells(product_id)
7. src/audit/logger.js — exports: logAction(entry) that appends to audit.log as JSONL. Entry schema:
   { timestamp, action, order_id, amount_paise, currency, product_id, status, agent_reasoning, session_id }
8. GET /catalog — returns full catalog JSON. No auth required.
9. GET /health — returns { status: "ok", timestamp: ISO8601 }

Constraints:
- No hardcoded API keys anywhere
- catalog.json must be the single source of truth — no duplicating product data
- audit logger must be synchronous append (fs.appendFileSync) to avoid race conditions
- Tell me how to test each endpoint when done
```

---

## SESSION 2 — Razorpay Order Creation

```
Read CLAUDE.md completely before doing anything.

I am building Feature 2: Razorpay order creation
Branch: feat/02-razorpay-order

Context: Feature 1 is complete. Server runs on port 3000. /catalog and /health work.
Files exist: src/catalog/index.js, src/audit/logger.js

Task: Add Razorpay order creation.

Create:
1. src/api/razorpay.js — Razorpay SDK wrapper. Export these functions:
   - initRazorpay() — initializes SDK with env vars, throws if vars missing
   - createOrder({ product_id, quantity }) — validates product exists in catalog,
     calculates amount_paise = price_paise * quantity,
     creates Razorpay order via SDK with idempotency key (use crypto.randomUUID()),
     logs to audit with action="order_created",
     returns { order_id, amount_paise, currency, product, receipt }
   - fetchOrder(order_id) — fetches order from Razorpay, returns status
   - capturePayment(payment_id, amount_paise) — captures authorized payment,
     logs to audit with action="payment_captured"

2. src/api/paymentLinks.js — export createPaymentLink({ order_id, amount_paise, description })
   Uses Razorpay payment_links API. Returns the short_url.

3. POST /orders route in server.js:
   Body: { product_id: string, quantity: number }
   Response: { order_id, amount_paise, amount_inr, product_name, razorpay_order: {...} }
   Error handling: 400 if product not found, 500 if Razorpay call fails

Constraints:
- All amounts in PAISE — never rupees, never floats
- Every createOrder call logs to audit before returning
- SDK must be initialized lazily (not at module load time, in case env vars aren't ready)
- Tell me the exact curl command to test this when done
```

---

## SESSION 3 — Webhook Handler + Payment Capture

```
Read CLAUDE.md completely before doing anything.

I am building Feature 3: Webhook handler + payment capture
Branch: feat/03-webhook-capture

Context: Features 1-2 complete and merged. /catalog, /health, POST /orders all work.
I have ngrok running and the URL is in .env as NGROK_URL.

Task: Build the webhook handler.

Create/modify:
1. src/webhooks/handler.js — Express router for POST /webhook:
   - Read raw body (IMPORTANT: must use express.raw() not express.json() for this route)
   - Verify HMAC-SHA256 signature using razorpay SDK's validateWebhookSignature()
   - If signature invalid: return 400, log warning
   - Dispatch on event type:
     * payment.captured → call capturePayment(), log action="payment_captured"
     * payment.failed → import and call failure handler (stub for now: just log action="payment_failed")
   - Always return 200 to Razorpay (even on handled errors) to prevent retries
   
2. Update server.js to mount webhook handler BEFORE express.json() middleware
   (raw body parsing must happen before json parsing for /webhook route)

3. GET /audit route — reads audit.log, parses JSONL, returns array sorted by timestamp desc

Constraints:
- Raw body preservation is critical — if HMAC verification fails on valid webhooks,
  it's almost always because the body was parsed before verification
- Log every webhook received (even if signature invalid) with enough context to debug
- Tell me how to send a test webhook from Razorpay dashboard
```

---

## SESSION 4 — Conversational Checkout (Claude Agent)

```
Read CLAUDE.md completely before doing anything.

I am building Feature 4: Conversational checkout (Claude agent)
Branch: feat/04-conversational-checkout

Context: Features 1-3 complete. Webhooks working. ngrok set up.

Task: Build the conversational checkout agent using Claude's tool_use.

Create:
1. src/agent/tools.js — Export TOOLS array with these Claude tool schemas:
   - search_catalog: { query: string } → calls searchCatalog()
   - create_order: { product_id: string, quantity: integer (1-10) } → calls createOrder()
   - get_upsell_suggestions: { product_id: string } → calls getUpsells()
   - get_order_status: { order_id: string } → calls fetchOrder()

2. src/agent/checkout.js — Export async function processCheckout(userMessage, sessionId):
   - Calls Claude claude-sonnet-4-6 with tool_use enabled
   - System prompt: "You are RazorAgent, an AI commerce assistant for a merchant. 
     Help customers find and purchase products. When a customer wants to buy something,
     search the catalog, suggest the right product, and create an order. Always explain
     what you're doing. After creating an order, check for upsell opportunities."
   - Agentic loop: keep calling Claude until it returns stop_reason="end_turn"
   - For each tool_use block: execute the real tool, return tool_result
   - Extract final payment_link from the last create_order call
   - Log agent_reasoning field in audit for every tool call that creates an order
   - Return { response_text, order_id, payment_link, tools_used[] }

3. POST /chat route:
   Body: { message: string, session_id?: string }
   Response: { reply: string, order_id?: string, payment_link?: string, tools_used: [] }

Constraints:
- The agent MUST use tool_use — do not use plain text responses from Claude to create orders
- tool_use is what makes the system "bounded and gated" — only defined tools can execute actions
- session_id should be auto-generated UUID if not provided
- Include the catalog content in the system prompt so Claude has context without a tool call
- Tell me 3 test messages I can send to verify all tool paths work
```

---

## SESSION 5 — Upsell Agent

```
Read CLAUDE.md completely before doing anything.

I am building Feature 5: Upsell agent
Branch: feat/05-upsell-agent

Context: Features 1-4 complete. /chat works end-to-end with tool_use.

Task: Enhance the checkout agent to actively upsell.

Modify/create:
1. src/agent/upsell.js — Export async function generateUpsellPitch(product, upsellProducts):
   Calls Claude to generate a 1-2 sentence upsell message that:
   - Names the upsell product naturally
   - Gives a reason ("customers who buy X often add Y because...")
   - Ends with a question ("Want to add it for ₹X?")
   Returns { pitch: string, reasoning: string }

2. Modify src/agent/checkout.js:
   After create_order tool call succeeds:
   - Call get_upsell_suggestions for the ordered product
   - If upsells exist: call generateUpsellPitch
   - Append upsell pitch to the response
   - Log to audit with action="upsell_shown", include agent_reasoning from generateUpsellPitch

3. Modify POST /chat response to include:
   { reply, order_id, payment_link, upsell_shown: bool, upsell_products: [] }

Test requirement: 
- Ask for a product that has upsell_ids — verify the upsell appears in the response
- Check audit.log for upsell_shown entry with agent_reasoning field populated
```

---

## SESSION 6 — Graceful Failure Handler

```
Read CLAUDE.md completely before doing anything.

I am building Feature 6: Graceful failure handling
Branch: feat/06-failure-handler

Context: Features 1-5 complete. Full checkout flow with upsell working.

Task: Build the payment failure handler.

Create/modify:
1. src/failures/handler.js — Export async function handlePaymentFailure(webhookPayload):
   - Extract: payment_id, order_id, error_description from payload
   - Log to audit: action="payment_failed", status="failed"
   - Wait 2000ms (exponential backoff step 1)
   - Attempt retry: fetch the order, check if a new payment exists (Razorpay sometimes retries internally)
   - Log retry attempt: action="retry_attempted"
   - If order is still not paid after retry:
     * Call createPaymentLink({ order_id, amount_paise, description: error_description })
     * Log: action="link_sent", status="success"
     * Return { recovered: true, payment_link, message: "user-friendly string" }
   - If retry succeeded:
     * Log: action="payment_captured", status="success"
     * Return { recovered: true, message: "Payment succeeded on retry" }

2. Update src/webhooks/handler.js to call handlePaymentFailure on payment.failed event

3. Add GET /simulate-failure route (for demo purposes only):
   Creates a test order then immediately calls handlePaymentFailure with a mock payload.
   Returns the full failure → retry → link flow for judges to see without needing a real failed payment.

Test: Hit GET /simulate-failure and verify:
- audit.log shows: payment_failed → retry_attempted → link_sent in sequence
- A real payment link URL is returned
- The user-friendly message is readable
```

---

## SESSION 7 — Audit Viewer + Tests

```
Read CLAUDE.md completely before doing anything.

I am building Feature 7: Audit trail viewer + Jest tests
Branch: feat/07-audit-tests

Context: All 6 features complete. Full end-to-end flow working.

Task: Build the audit viewer CLI and write Jest tests.

Create:
1. src/audit/viewer.js — CLI script that:
   - Reads audit.log
   - Parses each JSONL line
   - Prints a formatted table using console.table() or manual padding:
     | timestamp | action | order_id | amount_inr | status | reasoning (truncated 40 chars) |
   - Accepts optional filter: node src/audit/viewer.js --action=payment_captured
   Add "audit": "node src/audit/viewer.js" to package.json scripts

2. tests/audit.test.js — Jest tests:
   - logAction() creates audit.log if not exists
   - logAction() appends (not overwrites) on second call
   - logAction() writes valid JSON on each line
   - logAction() throws if required fields (timestamp, action, status) are missing

3. tests/webhook.test.js — Jest tests:
   - validateWebhookSignature() returns true for valid signature
   - validateWebhookSignature() returns false for tampered body
   - Handler returns 400 for invalid signature
   - Handler returns 200 for valid signature

4. tests/failure.test.js — Jest tests:
   - handlePaymentFailure() logs payment_failed to audit
   - handlePaymentFailure() logs retry_attempted to audit
   - handlePaymentFailure() returns a payment_link URL on failure
   - Mock the Razorpay SDK calls — do not make real API calls in tests

Add "test": "jest" and "test:watch": "jest --watch" to package.json scripts.
```

---

## SESSION 8 — README + Demo Script

```
Read CLAUDE.md completely before doing anything.

I am building Feature 8: README and demo documentation
Branch: feat/08-docs-readme

Context: All 7 features complete, tested, and merged to main.

Task: Write the final README and demo documentation.

Create:
1. README.md with these sections:
   - Project name + one-line description
   - Why this matters now (ACP, NPCI UAP — 3 sentences)
   - Architecture diagram (ASCII art is fine)
   - The 6 features with one sentence each
   - Setup instructions (clone, npm install, .env setup, Razorpay dashboard steps, ngrok)
   - API reference table (all endpoints)
   - How to run the demo (step by step)
   - Audit trail example (copy a real sample from audit.log)
   - Tech stack table
   - Project structure (tree)

2. docs/DEMO_SCRIPT.md — judge-facing demo walkthrough:
   - 8-step demo with exact commands to run
   - What to say to judges at each step
   - Expected output at each step
   - Backup if ngrok dies (use /simulate-failure endpoint)

3. Update all SKILL.md files in skills/ to reflect the final implementation.
```
