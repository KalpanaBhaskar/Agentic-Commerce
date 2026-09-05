# RazorAgent Demo Script

## 5-Minute Pitch Video Demo Walkthrough

This script guides you through the 8-step demo for judges, showing all four judging criteria: explainable actions, bounded/gated agent, visible audit trail, and graceful failure handling.

### Prerequisites
- Server running: `npm run dev` (Terminal 1)
- ngrok running: `ngrok http 3000` (Terminal 2)
- Razorpay webhook configured to ngrok URL
- Fresh audit.log (or truncate before demo: `> audit.log`)

---

## Step 1: Show Agent-Readable Catalog

**What to say:** "This is the agent-readable catalog. Any AI buyer can read this structured JSON to understand what products are available and their relationships."

**Command:**
```bash
curl http://localhost:3000/catalog | jq
```

**Expected output:** JSON array of 10 products with fields: `id`, `name`, `description`, `price_paise`, `upsell_ids`, `tags`, etc.

**Fallback if needed:** If jq not available, use `curl http://localhost:3000/catalog` alone.

---

## Step 2: Conversational Checkout - Intent to Order

**What to say:** "Watch the agent parse natural language intent, find the right product in the catalog, and create a Razorpay order - all through bounded tool calls."

**Command:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I want Sony noise-cancelling headphones"}' | jq
```

**Expected output:** 
```json
{
  "reply": "I've found Sony WH-1000XM5 Wireless Headphones for ₹29,999.00. Creating your order now...",
  "order_id": "order_XXXXXXXXXXXX",
  "payment_link": "https://rzp.io/XXXXXXXX",
  "upsell_shown": true,
  "upsell_products": [...],
  "tools_used": ["search_catalog", "create_order"]
}
```

**Key point to highlight:** The agent used `search_catalog` and `create_order` tools - nothing else.

---

## Step 3: Show Upsell Suggestion with Reasoning

**What to say:** "The agent proactively suggests related products based on the catalog's upsell_ids, and explains WHY using LLM reasoning - this is the 'explainable' part."

**Command:** (Output from Step 2 already shows this)

**Expected output:** `upsell_shown: true` with products like:
- Hard-Shell Headphone Carry Case (₹1,999)
- USB-C Fast-Charge Cable (₹799)

**Key point to highlight:** The reasoning is logged to audit trail.

---

## Step 4: Show Payment Link Creation

**What to say:** "The buyer receives a secure Razorpay payment link. The agent never sees raw card data - only this scoped token, exactly like the ACP shared payment token concept."

**Command:** (The `payment_link` field from Step 2 output)

**Expected output:** A real Razorpay payment link URL like `https://rzp.io/XXXXXXXX`

**Key point to highlight:** This is the test-mode equivalent of ACP's shared payment token.

---

## Step 5: Trigger Payment Captured Webhook

**What to say:** "When payment succeeds, Razorpay sends a webhook. Our system verifies the signature, captures the payment, and updates the audit trail in real time."

**Command:** (Two options)

**Option A - Use Razorpay Dashboard:**
1. Go to Razorpay Dashboard → Webhooks
2. Send test event: `payment.captured`
3. Use the order_id from Step 2

**Option B - Manual webhook trigger (if dashboard access limited):**
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: <calculated_hmac>" \
  -d '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_123","order_id":"order_XXXXXXXXXXXX","amount":2999900,"currency":"INR","status":"captured"}}}}'
```

**Expected output:** `{"status": "handled"}`

**Key point to highlight:** Webhook signature verification prevents fraud.

---

## Step 6: Show Audit Trail in Real Time

**What to say:** "Every money action is logged here - explainable, immutable, and visible. This is how merchants stay in control."

**Command:**
```bash
npm run audit
```

**Expected output:** Formatted table showing:
```
TIMESTAMP             | ACTION           | ORDER_ID        | AMOUNT_INR | STATUS | REASONING
2025-01-15 10:30:00  | order_created    | order_XXXXXXXXX | ₹29,999.00 | success | User asked for noise-cancelling...
2025-01-15 10:30:05  | upsell_shown     | order_XXXXXXXXX | —          | success | Customers who buy headphones...
2025-01-15 10:31:00  | payment_captured | order_XXXXXXXXX | ₹29,999.00 | success | Webhook received payment.captured
```

**Key point to highlight:** The `agent_reasoning` column shows WHY the agent acted.

---

## Step 7: Trigger Graceful Failure Handling

**What to say:** "When payments fail, the agent doesn't give up. It retries with backoff, then falls back to a payment link - all logged to audit."

**Command:**
```bash
curl http://localhost:3000/simulate-failure?product_id=prod_001 | jq
```

**Expected output:**
```json
{
  "recovered": true,
  "payment_link": "https://rzp.io/XXXXXXXX",
  "message": "Your payment didn't go through — Card declined by the issuing bank (simulated). No need to start over — use this secure payment link to complete your purchase."
}
```

**Key point to highlight:** The user gets a helpful message instead of an error.

---

## Step 8: Show Complete Audit Trail with Failure Recovery

**What to say:** "The full audit trail shows the failure recovery sequence - payment_failed, retry_attempted, link_sent. Every step explainable, every action bounded."

**Command:**
```bash
npm run audit -- --action=payment_failed
npm run audit -- --action=retry_attempted
npm run audit -- --action=link_sent
```

**Expected output:** Each filtered view shows the specific audit entries for the failure recovery flow.

**Key point to highlight:** Even failures are explainable and recoverable.

---

## Summary for Judges

"This is RazorAgent - an AI agent that acts as a merchant's autonomous commerce layer. It meets all four judging criteria:

1. **Explainable:** Every action has `agent_reasoning` in the audit log
2. **Bounded and Gated:** Only 4 tools available, enforced by schemas
3. **Audit Trail Visible:** `npm run audit` shows the full immutable trail
4. **Graceful Failure:** Retries with backoff, falls back to payment links

It's a Razorpay-native implementation of Agentic Commerce Protocol principles, ready for the NPCI UAP ecosystem."

---

## Backup Commands (if something breaks)

### If ngrok dies during demo:
```bash
# Kill and restart ngrok
ngrok http 3000
# Update .env with new URL
# Update Razorpay webhook URL in dashboard
```

### If webhook doesn't fire:
```bash
# Use the simulate-failure endpoint instead
curl http://localhost:3000/simulate-failure?product_id=prod_001
```

### If audit.log gets too long:
```bash
# Truncate for clean demo
> audit.log
```

### If server crashes:
```bash
# Restart
npm run dev
```

### If Claude API key issues:
```bash
# Set LLM_PROVIDER=groq in .env
# Add GROQ_API_KEY (free tier available)
# This uses a different LLM but same bounded tool architecture
```

---

## Timing Guide

- Steps 1-4 (Catalog to Payment Link): 2 minutes
- Steps 5-6 (Webhook to Audit): 1.5 minutes  
- Steps 7-8 (Failure to Summary): 1.5 minutes
- Total: ~5 minutes

Practice the flow once before the actual recording to ensure smooth transitions.