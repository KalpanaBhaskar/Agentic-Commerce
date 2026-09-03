// src/api/razorpay.js — Razorpay SDK wrapper.
// The ONLY module that talks to Razorpay's Orders/Payments APIs.
// Everything here deals in PAISE (integers) — never rupees, never floats.

const Razorpay = require('razorpay');
const crypto = require('crypto');

const { getProduct } = require('../catalog');
const { logAction } = require('../audit/logger');

// Lazily-created singleton SDK client. We do NOT construct it at module load
// time because env vars may not be ready when this file is first require()d
// (e.g. under Jest, or before dotenv runs). initRazorpay() builds it on first use.
let _client = null;

/**
 * Initialise (once) and return the Razorpay SDK client.
 * @throws {Error} if RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing.
 * @returns {import('razorpay')}
 */
function initRazorpay() {
  if (_client) return _client;

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      'Razorpay is not configured: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env'
    );
  }

  _client = new Razorpay({ key_id, key_secret });
  return _client;
}

/**
 * Create a Razorpay order for a catalog product.
 * Validates the product exists, computes amount in paise, creates the order,
 * and writes ONE audit line (action=order_created) before returning.
 *
 * @param {object}  args
 * @param {string}  args.product_id
 * @param {number}  args.quantity          integer 1..10
 * @param {string}  [args.agent_reasoning] why this order was created (from the
 *                                          checkout agent); falls back to a
 *                                          generated description. Logged in audit.
 * @param {string}  [args.session_id]      conversation/session id, logged in audit
 * @returns {Promise<{order_id:string, amount_paise:number, currency:string, product:object, receipt:string}>}
 * @throws {Error} err.code = 'INVALID_QUANTITY' | 'PRODUCT_NOT_FOUND' | 'RAZORPAY_ERROR'
 */
async function createOrder({ product_id, quantity, agent_reasoning, session_id } = {}) {
  // 1. Validate quantity — bounded 1..10 (mirrors the create_order tool schema, §7).
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
    const err = new Error(`Invalid quantity: ${quantity}. Must be an integer between 1 and 10.`);
    err.code = 'INVALID_QUANTITY';
    throw err;
  }

  // 2. Validate product exists in the catalog (single source of truth).
  const product = getProduct(product_id);
  if (!product) {
    const err = new Error(`Product not found: ${product_id}`);
    err.code = 'PRODUCT_NOT_FOUND';
    throw err;
  }

  // 3. Money math in paise only. integer * integer => integer (no floats).
  const amount_paise = product.price_paise * qty;
  const currency = product.currency || 'INR';

  // 4. Idempotency / dedup reference. Razorpay uses `receipt` (max 40 chars) as
  //    the merchant-side unique key; a v4 UUID is 36 chars and unique per attempt.
  const receipt = crypto.randomUUID();

  // 5. Create the order via the SDK.
  const rzp = initRazorpay();
  let order;
  try {
    order = await rzp.orders.create({
      amount: amount_paise,
      currency,
      receipt,
      notes: {
        product_id: product.id,
        product_name: product.name,
        quantity: String(qty),
      },
    });
  } catch (e) {
    const err = new Error(
      `Razorpay order creation failed: ${(e && e.error && e.error.description) || e.message}`
    );
    err.code = 'RAZORPAY_ERROR';
    err.cause = e;
    throw err;
  }

  // 6. Audit BEFORE returning — every money action is logged (§6).
  logAction({
    action: 'order_created',
    order_id: order.id,
    amount_paise,
    currency,
    product_id: product.id,
    status: 'success',
    agent_reasoning:
      agent_reasoning ||
      `Created Razorpay order for ${qty} x "${product.name}" (${product.id}) = ${amount_paise} paise.`,
    session_id: session_id ?? null,
  });

  return { order_id: order.id, amount_paise, currency, product, receipt };
}

/**
 * Fetch an order from Razorpay. Returns the full order object, whose `.status`
 * is one of: created | attempted | paid.
 * @param {string} order_id
 * @returns {Promise<object>}
 */
async function fetchOrder(order_id) {
  const rzp = initRazorpay();
  return rzp.orders.fetch(order_id);
}

/**
 * Capture an authorized payment and audit it (action=payment_captured).
 * Used by the webhook handler (Feature 3) once payment.captured arrives.
 * @param {string} payment_id
 * @param {number} amount_paise  integer paise to capture
 * @returns {Promise<object>} the captured payment object
 */
async function capturePayment(payment_id, amount_paise) {
  const rzp = initRazorpay();
  const payment = await rzp.payments.capture(payment_id, amount_paise, 'INR');

  logAction({
    action: 'payment_captured',
    order_id: payment.order_id ?? null,
    amount_paise: payment.amount ?? amount_paise,
    currency: payment.currency ?? 'INR',
    product_id: null,
    status: payment.status === 'captured' ? 'success' : payment.status || 'unknown',
    agent_reasoning: `Captured payment ${payment_id} for ${payment.amount ?? amount_paise} paise.`,
  });

  return payment;
}

module.exports = { initRazorpay, createOrder, fetchOrder, capturePayment };
