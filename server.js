// server.js — Express entry point for RazorAgent
// Feature 1: scaffold + agent-readable catalog endpoint.
// Later features mount /orders, /chat, /webhook on this same app.

require('dotenv').config();

const express = require('express');
const { loadCatalog } = require('./src/catalog');
const { createOrder } = require('./src/api/razorpay');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON body parsing for future POST routes (/orders, /chat).
// NOTE: the /webhook route (Feature 3) will need the RAW body for HMAC
// verification, so it must register its own raw parser before this runs.
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

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RazorAgent server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
