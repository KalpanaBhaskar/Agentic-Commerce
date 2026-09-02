// src/failures/handler.js — payment failure handling.
//
// Feature 3 ships a STUB: it just records the failure in the audit trail so the
// webhook dispatcher has a stable function to call. Feature 6
// (feat/06-failure-handler) expands handlePaymentFailed() into the real flow:
//   log failure -> retry once after a 2s backoff -> on repeat failure create a
//   Razorpay payment link (action=link_sent) and return a user-friendly message.

const { logAction } = require('../audit/logger');

/**
 * Handle a payment.failed webhook. STUB: logs action=payment_failed only.
 * @param {object|null} payment  Razorpay payment entity from the webhook payload
 * @returns {Promise<{status:string, order_id:(string|null)}>}
 */
async function handlePaymentFailed(payment) {
  const p = payment || {};
  const order_id = p.order_id ?? null;
  const amount_paise = p.amount ?? null;
  const currency = p.currency ?? 'INR';
  const reason = p.error_description || p.error_reason || p.error_code || 'unknown reason';

  logAction({
    action: 'payment_failed',
    order_id,
    amount_paise,
    currency,
    product_id: null,
    status: 'failed',
    agent_reasoning:
      `Payment ${p.id ?? '(unknown)'} failed: ${reason}. ` +
      `[Feature 3 stub — retry + payment-link fallback arrives in Feature 6.]`,
  });

  return { status: 'logged', order_id };
}

module.exports = { handlePaymentFailed };
