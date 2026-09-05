// server.js — Express entry point for RazorAgent
// Feature 1: scaffold + agent-readable catalog endpoint.
// Later features mount /orders, /chat, /webhook on this same app.

require('dotenv').config();

const express = require('express');
const { loadCatalog } = require('./src/catalog');
const { createOrder } = require('./src/api/razorpay');
const { readAudit } = require('./src/audit/logger');
const webhookRouter = require('./src/webhooks/handler');
const { processCheckout } = require('./src/agent/checkout');
const { handlePaymentFailure } = require('./src/failures/handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Feature 3: the /webhook route needs the RAW request body for HMAC signature
// verification, so it is mounted with its OWN express.raw() parser (inside the
// router) BEFORE the global express.json() below. For a POST /webhook request
// this router handles the response, so express.json() never runs on it; for
// every other path the mount is skipped and express.json() applies as usual.
// This ordering is load-bearing — do not move express.json() above it.
app.use('/webhook', webhookRouter);

// JSON body parsing for all other POST routes (/orders, /chat).
app.use(express.json());

// GET /health — liveness probe. No auth.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /catalog — the agent-readable merchant catalog. No auth.
// catalog.json is the single source of truth; we read it fresh each call.
app.get('/catalog', (req, res) => {
  try {
    res.json(loadCatalog());
  } catch (err) {
    console.error('Failed to load catalog:', err.message);
    res.status(500).json({ error: 'catalog_unavailable' });
  }
});

// GET /audit — the audit trail as JSON, newest first. Read-only view over
// audit.log (JSONL). This is the live, explainable money-action trail judges
// inspect, and what `npm run audit` will pretty-print as a table (Feature 7).
app.get('/audit', (req, res) => {
  try {
    res.json(readAudit());
  } catch (err) {
    console.error('Failed to read audit log:', err.message);
    res.status(500).json({ error: 'audit_unavailable' });
  }
});

// POST /orders — create a Razorpay order for { product_id, quantity }.
// 400 if the product isn't in the catalog or quantity is invalid;
// 500 if the Razorpay call fails. Amounts are paise; amount_inr is display-only.
app.post('/orders', async (req, res) => {
  const body = req.body || {};
  const product_id = body.product_id;
  const quantity = body.quantity ?? 1; // default to 1 when omitted

  try {
    const { order_id, amount_paise, currency, product, receipt } = await createOrder({
      product_id,
      quantity,
    });

    return res.status(201).json({
      order_id,
      amount_paise,
      amount_inr: amount_paise / 100,
      product_name: product.name,
      razorpay_order: {
        id: order_id,
        amount: amount_paise,
        currency,
        receipt,
        status: 'created',
      },
    });
  } catch (err) {
    if (err.code === 'PRODUCT_NOT_FOUND' || err.code === 'INVALID_QUANTITY') {
      return res.status(400).json({ error: err.code.toLowerCase(), message: err.message });
    }
    console.error('Order creation failed:', err.message);
    return res.status(500).json({ error: 'order_creation_failed', message: err.message });
  }
});

// POST /chat — conversational checkout (Features 4-5). Body: { message, session_id? }.
// Claude runs a BOUNDED tool_use loop (search -> order -> status) via
// src/agent/checkout.js; the agent can only act through the four tool schemas.
// After an order is placed, a tailored upsell is appended (Feature 5). Returns
// the natural-language reply, any order_id / payment_link, and the upsell shown.
app.post('/chat', async (req, res) => {
  const body = req.body || {};
  const message = body.message;
  if (!message || typeof message !== 'string') {
    return res
      .status(400)
      .json({ error: 'invalid_message', message: 'Body must include a non-empty "message" string.' });
  }

  try {
    const {
      response_text,
      order_id,
      payment_link,
      tools_used,
      session_id,
      upsell_shown,
      upsell_products,
    } = await processCheckout(message, body.session_id);
    return res.json({
      reply: response_text,
      order_id: order_id ?? null,
      payment_link: payment_link ?? null,
      upsell_shown,
      upsell_products,
      tools_used,
      session_id,
    });
  } catch (err) {
    console.error('Chat failed:', err.message);
    // 503 when the agent isn't configured (missing ANTHROPIC_API_KEY); 500 otherwise.
    const status = err.code === 'AGENT_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: 'chat_failed', message: err.message });
  }
});

// GET /simulate-failure — DEMO ONLY. Judges can watch the graceful-failure flow
// end-to-end without needing a real declined card: we create a real test order,
// then run handlePaymentFailure() against a MOCK payment.failed payload for it.
// The audit trail gains order_created -> payment_failed -> retry_attempted ->
// link_sent, and the response returns the recovery result (payment link + a
// user-friendly message). Optional query params: ?product_id=prod_00X and
// ?delay=<ms> (shorten the 2s retry backoff for a snappier demo).
app.get('/simulate-failure', async (req, res) => {
  const product_id = req.query.product_id || 'prod_001';
  const rawDelay = req.query.delay;
  const options =
    rawDelay !== undefined && Number.isFinite(Number(rawDelay))
      ? { retryDelayMs: Number(rawDelay) }
      : {};

  try {
    // 1. Create a real Razorpay test order so we have a genuine order_id + amount.
    const { order_id, amount_paise, currency } = await createOrder({
      product_id,
      quantity: 1,
      agent_reasoning: 'Demo: created an order to simulate a payment failure and recovery.',
      session_id: 'sim_failure',
    });

    // 2. Mock the payment entity Razorpay would send on a payment.failed webhook.
    const mockPayment = {
      id: `pay_SIM_${Date.now()}`,
      order_id,
      amount: amount_paise,
      currency,
      status: 'failed',
      error_code: 'BAD_REQUEST_ERROR',
      error_description: 'Card declined by the issuing bank (simulated).',
    };

    // 3. Run the real graceful-failure flow (log -> backoff -> retry -> link).
    const result = await handlePaymentFailure(mockPayment, options);

    return res.json({
      simulated: true,
      order_id,
      amount_paise,
      amount_inr: amount_paise / 100,
      currency,
      mock_error: mockPayment.error_description,
      ...result,
    });
  } catch (err) {
    if (err.code === 'PRODUCT_NOT_FOUND' || err.code === 'INVALID_QUANTITY') {
      return res.status(400).json({ error: err.code.toLowerCase(), message: err.message });
    }
    console.error('Simulate-failure flow failed:', err.message);
    return res.status(500).json({ error: 'simulate_failure_failed', message: err.message });
  }
});

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RazorAgent server running on http://localhost:${PORT}`);
  });
}

module.exports = app;