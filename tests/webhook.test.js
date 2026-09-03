// tests/webhook.test.js — HMAC signature verification + POST /webhook handler.
//
// No real Razorpay API calls: we exercise the STATIC HMAC verifier directly and
// drive the Express route with supertest. The valid-signature case uses a benign
// (unhandled) event so no payment capture / SDK call is triggered.

const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Isolate the audit trail and pin a known webhook secret BEFORE requiring the
// handler. (These are set on process.env, which the handler reads at request time.)
process.env.AUDIT_LOG_PATH = path.join(os.tmpdir(), `razoragent-webhook-${process.pid}-${Date.now()}.log`);
const WEBHOOK_SECRET = 'test_webhook_secret_123';
process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;

const express = require('express');
const request = require('supertest');
const Razorpay = require('razorpay');
const webhookRouter = require('../src/webhooks/handler');

// Minimal app mounting ONLY the webhook router (its raw-body parser lives inside
// the router), mirroring server.js's mount without pulling in its other deps.
function buildApp() {
  const app = express();
  app.use('/webhook', webhookRouter);
  return app;
}

// Razorpay signs the raw body with HMAC-SHA256(secret) and hex-encodes it.
const sign = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('Razorpay.validateWebhookSignature()', () => {
  const body = JSON.stringify({ event: 'payment.captured', hello: 'world' });

  test('returns true for a valid signature', () => {
    const signature = sign(body, WEBHOOK_SECRET);
    expect(Razorpay.validateWebhookSignature(body, signature, WEBHOOK_SECRET)).toBe(true);
  });

  test('returns false when the body is tampered after signing', () => {
    const signature = sign(body, WEBHOOK_SECRET); // signature over the ORIGINAL body
    const tampered = JSON.stringify({ event: 'payment.captured', hello: 'tampered' });
    expect(Razorpay.validateWebhookSignature(tampered, signature, WEBHOOK_SECRET)).toBe(false);
  });
});

describe('POST /webhook', () => {
  let app;
  beforeAll(() => {
    app = buildApp();
  });

  test('returns 200 for a valid signature (benign event is acked)', async () => {
    const body = JSON.stringify({ event: 'payment.authorized' }); // no handler -> default -> ack
    const signature = sign(body, WEBHOOK_SECRET);

    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', event: 'payment.authorized' });
  });

  test('returns 400 for an invalid signature', async () => {
    const body = JSON.stringify({ event: 'payment.captured' });
    const badSignature = sign(body, 'the_wrong_secret'); // correct format, wrong secret

    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', badSignature)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'invalid_signature' });
  });

  test('returns 400 when the signature header is missing', async () => {
    const body = JSON.stringify({ event: 'payment.captured' });

    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'missing_signature' });
  });
});
