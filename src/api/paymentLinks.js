// src/api/paymentLinks.js — Razorpay Payment Links wrapper.
// Used as the graceful-failure fallback (Feature 6): when a payment can't be
// completed inline, we hand the buyer a shareable short_url to pay.

const { initRazorpay } = require('./razorpay');
const { logAction } = require('../audit/logger');

/**
 * Create a Razorpay payment link and audit it (action=link_sent).
 * @param {object} args
 * @param {string} [args.order_id]      our order id, used as reference + in notes
 * @param {number} args.amount_paise    integer paise (never rupees/floats)
 * @param {string} [args.description]   human-readable line shown on the link
 * @returns {Promise<string>} the short_url the buyer can pay at
 */
async function createPaymentLink({ order_id, amount_paise, description } = {}) {
  const rzp = initRazorpay();

  const payload = {
    amount: amount_paise,
    currency: 'INR',
    description: description || `Payment for order ${order_id || '(unlinked)'}`,
    notes: { order_id: order_id || '' },
  };
  // reference_id ties the link back to our order (must be unique per link).
  if (order_id) payload.reference_id = order_id;

  const link = await rzp.paymentLink.create(payload);

  logAction({
    action: 'link_sent',
    order_id: order_id ?? null,
    amount_paise,
    currency: 'INR',
    product_id: null,
    status: 'success',
    agent_reasoning: `Created Razorpay payment link (${amount_paise} paise) as payment fallback${
      order_id ? ` for order ${order_id}` : ''
    }.`,
  });

  return link.short_url;
}

module.exports = { createPaymentLink };
