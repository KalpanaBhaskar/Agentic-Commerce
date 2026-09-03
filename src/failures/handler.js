// src/failures/handler.js — graceful payment failure handling (Feature 6).
//
// A failed payment is not the end of the road. When one occurs we:
//   1. record the failure in the audit trail (action=payment_failed),
//   2. wait a short backoff, then retry ONCE by re-checking the order with
//      Razorpay — a payment can complete on its own between the failure and our
//      retry (action=retry_attempted),
//   3a. if it settled, record the recovery (action=payment_captured), or
//   3b. if it's still unpaid, hand the buyer a Razorpay payment link so they can
//       finish paying without starting over (action=link_sent, via
//       createPaymentLink) and return a friendly, actionable message.
//
// Every branch leaves a clear, explainable trail: payment_failed -> retry_attempted
// -> (payment_captured | link_sent). Amounts are always paise (integers).

const { fetchOrder } = require('../api/razorpay');
const { createPaymentLink } = require('../api/paymentLinks');
const { logAction } = require('../audit/logger');

// First (and only) exponential-backoff step before the single retry.
const RETRY_DELAY_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Has the order been paid? Razorpay marks an order `paid` once its payments
 * cover the amount due — this is how we detect a payment that came through on
 * its own between the failure and our retry.
 * @param {object|null} order  a Razorpay order object (from fetchOrder)
 * @returns {boolean}
 */
function isOrderPaid(order) {
  if (!order) return false;
  if (order.status === 'paid') return true;
  return Number(order.amount_due) === 0 && Number(order.amount_paid) > 0;
}

/**
 * Handle a failed payment gracefully: log -> backoff -> retry once -> recover.
 *
 * @param {object} payment  the Razorpay payment entity from the payment.failed
 *   webhook payload: { id, order_id, amount, currency, error_description, ... }.
 * @param {object} [options]
 * @param {number} [options.retryDelayMs=RETRY_DELAY_MS]  backoff before the retry;
 *   overridable so tests and the demo route don't have to wait the full 2s.
 * @returns {Promise<{recovered:boolean, payment_link?:string, message:string}>}
 */
async function handlePaymentFailure(payment, { retryDelayMs = RETRY_DELAY_MS } = {}) {
  const p = payment || {};
  const payment_id = p.id ?? null;
  const order_id = p.order_id ?? null;
  const error_description =
    p.error_description || p.error_reason || p.error_code || 'the payment could not be completed';
  // Trim trailing punctuation/space so we can compose sentences around it cleanly.
  const reason = String(error_description).replace(/[.\s]+$/, '');
  const payloadAmount = Number.isInteger(p.amount) ? p.amount : null;
  const currency = p.currency || 'INR';

  // --- 1. Record the failure -------------------------------------------------
  logAction({
    action: 'payment_failed',
    order_id,
    amount_paise: payloadAmount,
    currency,
    product_id: null,
    status: 'failed',
    agent_reasoning: `Payment ${payment_id ?? '(unknown)'} failed: ${reason}.`,
  });

  // --- 2. Backoff, then retry ONCE by re-checking the order ------------------
  await sleep(retryDelayMs);

  let order = null;
  if (order_id) {
    try {
      order = await fetchOrder(order_id);
    } catch (e) {
      // An unknown/mock order id (or a transient fetch error) simply means we
      // can't confirm a payment — treat it as "still unpaid" and fall back.
      order = null;
    }
  }

  const paid = isOrderPaid(order);
  const amount_paise =
    (order && Number.isInteger(order.amount) ? order.amount : payloadAmount) ?? null;
  const resolvedCurrency = (order && order.currency) || currency;

  logAction({
    action: 'retry_attempted',
    order_id,
    amount_paise,
    currency: resolvedCurrency,
    product_id: null,
    status: paid ? 'success' : 'failed',
    agent_reasoning: paid
      ? `Retry after ${retryDelayMs}ms backoff: order ${order_id} is now paid — payment recovered.`
      : `Retry after ${retryDelayMs}ms backoff: order ${
          order_id ?? '(unknown)'
        } still unpaid — falling back to a payment link.`,
  });

  // --- 3a. Recovered on retry: the payment went through in the meantime ------
  if (paid) {
    logAction({
      action: 'payment_captured',
      order_id,
      amount_paise,
      currency: resolvedCurrency,
      product_id: null,
      status: 'success',
      agent_reasoning: `Order ${order_id} settled on retry after an initial payment failure.`,
    });
    return {
      recovered: true,
      message: 'Good news — your payment went through on the retry. Your order is confirmed!',
    };
  }

  // --- 3b. Still unpaid: give the buyer a payment link to finish paying ------
  // createPaymentLink() writes the `link_sent` audit line itself, so we don't
  // log it again here (one action = one line).
  const payment_link = await createPaymentLink({
    order_id,
    amount_paise,
    description: error_description,
  });

  return {
    recovered: true,
    payment_link,
    message:
      `Your payment didn't go through — ${reason}. ` +
      'No need to start over — use this secure payment link to complete your purchase.',
  };
}

module.exports = { handlePaymentFailure, isOrderPaid, RETRY_DELAY_MS };
