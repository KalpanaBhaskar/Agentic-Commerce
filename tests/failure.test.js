// tests/failure.test.js — unit tests for the graceful payment-failure handler.
//
// The Razorpay SDK wrappers are MOCKED (jest.mock) so NO real API calls are made:
// fetchOrder() returns a canned order and createPaymentLink() returns a fake URL.
// The audit trail is isolated to a temp file via AUDIT_LOG_PATH. retryDelayMs is
// forced to 0 so tests don't wait the real 2s backoff.

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.AUDIT_LOG_PATH = path.join(os.tmpdir(), `razoragent-failure-${process.pid}-${Date.now()}.log`);

// Mock the SDK wrappers the handler depends on — do NOT hit Razorpay in tests.
jest.mock('../src/api/razorpay');
jest.mock('../src/api/paymentLinks');

const { fetchOrder } = require('../src/api/razorpay');
const { createPaymentLink } = require('../src/api/paymentLinks');
const { handlePaymentFailure } = require('../src/failures/handler');
const { readAudit, AUDIT_PATH } = require('../src/audit/logger');

const FAKE_LINK = 'https://rzp.io/i/testFakeLink';

// A representative payment.failed webhook entity.
const failedPayment = {
  id: 'pay_TEST123',
  order_id: 'order_TEST123',
  amount: 199900,
  currency: 'INR',
  error_description: 'Card declined by the issuing bank',
};

beforeEach(() => {
  jest.clearAllMocks();
  if (fs.existsSync(AUDIT_PATH)) fs.rmSync(AUDIT_PATH); // fresh audit trail per test
  createPaymentLink.mockResolvedValue(FAKE_LINK);
});

afterAll(() => {
  if (fs.existsSync(AUDIT_PATH)) fs.rmSync(AUDIT_PATH);
});

describe('handlePaymentFailure() — still unpaid after retry (link fallback)', () => {
  beforeEach(() => {
    // Order is NOT paid on re-fetch -> handler falls back to a payment link.
    fetchOrder.mockResolvedValue({
      status: 'attempted',
      amount: 199900,
      amount_paid: 0,
      amount_due: 199900,
      currency: 'INR',
    });
  });

  test('logs payment_failed to the audit trail', async () => {
    await handlePaymentFailure(failedPayment, { retryDelayMs: 0 });
    const actions = readAudit().map((r) => r.action);
    expect(actions).toContain('payment_failed');
  });

  test('logs retry_attempted to the audit trail', async () => {
    await handlePaymentFailure(failedPayment, { retryDelayMs: 0 });
    const actions = readAudit().map((r) => r.action);
    expect(actions).toContain('retry_attempted');
  });

  test('returns a payment_link URL when the payment cannot be recovered', async () => {
    const result = await handlePaymentFailure(failedPayment, { retryDelayMs: 0 });

    expect(createPaymentLink).toHaveBeenCalledTimes(1);
    expect(result.payment_link).toBe(FAKE_LINK);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });

  test('uses the mocked SDK wrappers (no real Razorpay API calls)', async () => {
    await handlePaymentFailure(failedPayment, { retryDelayMs: 0 });
    expect(fetchOrder).toHaveBeenCalledWith('order_TEST123');
    expect(createPaymentLink).toHaveBeenCalled();
  });
});

describe('handlePaymentFailure() — recovered on retry', () => {
  beforeEach(() => {
    // Order shows as paid on re-fetch -> handler records recovery, no link needed.
    fetchOrder.mockResolvedValue({
      status: 'paid',
      amount: 199900,
      amount_paid: 199900,
      amount_due: 0,
      currency: 'INR',
    });
  });

  test('records recovery and does NOT create a payment link', async () => {
    const result = await handlePaymentFailure(failedPayment, { retryDelayMs: 0 });

    const actions = readAudit().map((r) => r.action);
    expect(actions).toContain('payment_failed');
    expect(actions).toContain('retry_attempted');
    expect(actions).toContain('payment_captured'); // settled on retry

    expect(createPaymentLink).not.toHaveBeenCalled();
    expect(result.recovered).toBe(true);
    expect(result.payment_link).toBeUndefined();
  });
});
