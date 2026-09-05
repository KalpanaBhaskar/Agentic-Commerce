// src/webhooks/handler.js — Razorpay webhook receiver (Feature 3).
//
 // Mounted at POST /webhook. This is the ONE route that must see the RAW request
 // body: Razorpay signs the exact bytes it sends, so we verify HMAC-SHA256 over
 // the raw buffer BEFORE any JSON parsing. server.js mounts this router ahead of
 // the global express.json() for exactly that reason.
 //
 // Flow: raw body -> verify signature -> parse event -> dispatch -> respond.
 //   - missing/invalid signature    -> 400 (tells us the endpoint is misconfigured
 //                                          or someone is spoofing; Razorpay will retry)
 //   - valid, even if a handler fails-> 200 (so Razorpay does NOT retry a handled event)

const express = require('express');
const Razorpay = require('razorpay');

const { capturePayment } = require('../api/razorpay');
const { handlePaymentFailure } = require('../failures/handler');
const { logAction } = require('../audit/logger');

const router = express.Router();

// Raw body parser scoped to THIS route only. `type: '*/*'` captures the body as
// a Buffer regardless of Content-Type, so signature verification always sees the
// real bytes Razorpay signed — never a re-serialised object.
const rawBody = express.raw({ type: '*/*' });

/**
 * POST /webhook — verify signature, dispatch on event type, then acknowledge.
 */
router.post('/', rawBody, async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const secret = process.env.WEBHOOK_SECRET;

  // req.body is a Buffer (from express.raw). Keep the exact string for HMAC.
  const rawPayload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  // Operational logging: record EVERY hit before we trust anything. This is
  // console/debug logging — NOT the money-action audit trail (§6), which has a
  // fixed schema. We log enough to debug misconfig, spoofing and replays.
  const meta = { bytes: rawPayload.length, has_signature: Boolean(signature) };

  // --- 1. Config + presence guards --------------------------------------
  if (!secret) {
    // Our side is misconfigured. 500 (not 200) so we notice and Razorpay retries.
    console.error('[webhook] WEBHOOK_SECRET is not set; cannot verify signature.', meta);
    return res.status(500).json({ error: 'webhook_secret_not_configured' });
  }
  if (!signature) {
    console.warn('[webhook] rejected: missing x-razorpay-signature header.', meta);
    return res.status(400).json({ error: 'missing_signature' });
  }

  // --- 2. Verify HMAC-SHA256 over the RAW body --------------------------
  let valid = false;
  try {
    valid = Razorpay.validateWebhookSignature(rawPayload, signature, secret);
  } catch (e) {
    valid = false; // malformed signature/secret -> treat as invalid
  }
  if (!valid) {
    console.warn('[webhook] rejected: INVALID signature.', meta);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  // --- 3. Parse the (now-trusted) event ---------------------------------
  let event;
  try {
    event = JSON.parse(rawPayload);
  } catch (e) {
    // Signature was valid but body isn't JSON — nothing to dispatch. Ack anyway.
    console.warn('[webhook] signature ok but body is not valid JSON; ignoring.', meta);
    return res.status(200).json({ status: 'ignored', reason: 'unparseable_body' });
  }

  const eventType = event.event || 'unknown';
  const payment = (event.payload && event.payload.payment && event.payload.payment.entity) || null;
  console.log(
    `[webhook] event=${eventType} payment=${payment ? payment.id : 'n/a'} ` +
      `order=${payment ? payment.order_id : 'n/a'}`,
    meta
  );

  // --- 4. Dispatch. From here we ALWAYS 200 (event is handled). ---------
  try {
    switch (eventType) {
      case 'payment.captured':
        await onPaymentCaptured(payment);
        break;
      case 'payment.failed':
        // Feature 6: log the failure, back off + retry once, then fall back to
        // a payment link if still unpaid. We await so the whole recovery flow is
        // audited before we ack (adds the ~2s backoff to this request in test mode).
        await handlePaymentFailure(payment);
        break;
      default:
        console.log(`[webhook] no handler for event=${eventType}; acking.`);
    }
  } catch (e) {
    // Handled-but-errored: log it, but STILL ack so Razorpay does not retry a
    // money event we've already seen (retries risk double-processing).
    console.error(`[webhook] handler for ${eventType} threw:`, e.message);
  }

  return res.status(200).json({ status: 'ok', event: eventType });
});

/**
 * payment.captured — the payment is already captured per this event. We attempt
 * an idempotent capture for reconciliation (a no-op error for already-captured
 * real payments, and a not-found error for dashboard test dummy ids) and ensure
 * EXACTLY ONE payment_captured audit line is written either way.
 *
 * @param {object|null} payment  Razorpay payment entity from the webhook payload
 */
async function onPaymentCaptured(payment) {
  if (!payment) {
    console.warn('[webhook] payment.captured with no payment entity; skipping.');
    return;
  }
  const { id, order_id, amount, currency } = payment;
  try {
    // capturePayment() writes its own payment_captured audit line on success.
    await capturePayment(id, amount);
  } catch (e) {
    // Already-captured (real events) or unknown/dummy id (dashboard test events)
    // land here. Record the confirmation from the TRUSTED webhook payload so the
    // audit trail still shows exactly one payment_captured line for this event.
    logAction({
      action: 'payment_captured',
      order_id: order_id ?? null,
      amount_paise: amount ?? null,
      currency: currency ?? 'INR',
      product_id: null,
      status: 'success',
      agent_reasoning:
        `Confirmed payment.captured webhook for ${id} (${amount} paise); ` +
        `direct capture skipped (${e.message}).`,
    });
  }
}

module.exports = router;