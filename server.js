// server.js — Express entry point for RazorAgent
// Feature 1: scaffold + agent-readable catalog endpoint.
// Later features mount /orders, /chat, /webhook on this same app.

require('dotenv').config();

const express = require('express');
const { loadCatalog } = require('./src/catalog');

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

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RazorAgent server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
