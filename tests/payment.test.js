// tests/payment.test.js — frozen-money pins (Vortex Commerce Task 2).
//
// These tests lock the behavior Task 2 promises never to change:
// paise-only math, quantity 1..10, UUID receipt, order_created/link_sent
// audit lines, and the IPaymentService seam delegating to the real impl.
//
// Hermetic: the `razorpay` SDK is mocked (no network), the audit trail points
// at a temp file, and products are passed inline so catalog.json is untouched
// (except the PRODUCT_NOT_FOUND case, which reads the real file read-only).

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP_AUDIT = path.join(os.tmpdir(), `vortex-payment-${process.pid}-${Date.now()}.log`);
process.env.AUDIT_LOG_PATH = TMP_AUDIT;
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_pin';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'pin_secret';

jest.mock('razorpay');

const Razorpay = require('razorpay');
const { readAudit, AUDIT_PATH } = require('../src/audit/logger');

const FAKE_ORDER_ID = 'order_PIN123';
const FAKE_LINK = 'https://rzp.io/i/pinFakeLink';

const mockOrdersCreate = jest.fn(async ({ amount, currency, receipt }) => ({
  id: FAKE_ORDER_ID,
  amount,
  currency,
  receipt,
  status: 'created',
}));
const mockPaymentLinkCreate = jest.fn(async () => ({ short_url: FAKE_LINK }));

Razorpay.mockImplementation(() => ({
  orders: { create: mockOrdersCreate, fetch: jest.fn() },
  payments: { capture: jest.fn() },
  paymentLink: { create: mockPaymentLinkCreate },
}));

// Require AFTER the mock so initRazorpay() picks up the stub.
const { createOrder } = require('../src/api/razorpay');
const { createPaymentLink } = require('../src/api/paymentLinks');
const {
  getPaymentService,
  setPaymentService,
  resetPaymentService,
  productionService,
} = require('../src/api');

const PRODUCT = {
  id: 'prod_pin_001',
  name: 'Pinned Test Product',
  price_paise: 199900, // Rs 1,999.00
  currency: 'INR',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

beforeEach(() => {
  jest.clearAllMocks();
  // NOTE: do NOT clear the Razorpay mockImplementation (clearAllMocks only
  // clears calls, not implementations — this comment guards that invariant).
  if (fs.existsSync(AUDIT_PATH)) fs.rmSync(AUDIT_PATH);
  resetPaymentService();
});

afterAll(() => {
  if (fs.existsSync(AUDIT_PATH)) fs.rmSync(AUDIT_PATH);
});

describe('frozen money math (paise integers only)', () => {
  test('amount_paise = price_paise * quantity (no floats)', async () => {
    const res = await createOrder({
      product_id: PRODUCT.id,
      quantity: 3,
      product: PRODUCT,
      session_id: 'pin_sess',
    });
    expect(res.amount_paise).toBe(199900 * 3); // 599700
    expect(Number.isInteger(res.amount_paise)).toBe(true);
    expect(mockOrdersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 599700, currency: 'INR' })
    );
  });

  test('quantity boundaries 1 and 10 pass; 0/11/fraction fail', async () => {
    await expect(
      createOrder({ product_id: PRODUCT.id, quantity: 1, product: PRODUCT })
    ).resolves.toMatchObject({ amount_paise: 199900 });
    await expect(
      createOrder({ product_id: PRODUCT.id, quantity: 10, product: PRODUCT })
    ).resolves.toMatchObject({ amount_paise: 1999000 });

    for (const bad of [0, 11, 1.5, 'abc', null]) {
      await expect(
        createOrder({ product_id: PRODUCT.id, quantity: bad, product: PRODUCT })
      ).rejects.toMatchObject({ code: 'INVALID_QUANTITY' });
    }
  });

  test('unknown product rejects with PRODUCT_NOT_FOUND', async () => {
    await expect(
      createOrder({ product_id: 'prod_nope_zzz', quantity: 1 })
    ).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  test('receipt is a UUID v4 (idempotency key, <=40 chars)', async () => {
    const res = await createOrder({
      product_id: PRODUCT.id,
      quantity: 1,
      product: PRODUCT,
    });
    expect(res.receipt).toMatch(UUID_RE);
    expect(res.receipt.length).toBeLessThanOrEqual(40);
  });
});

describe('frozen audit lines', () => {
  test('createOrder writes exactly one order_created line with amount + product', async () => {
    const res = await createOrder({
      product_id: PRODUCT.id,
      quantity: 2,
      product: PRODUCT,
      agent_reasoning: 'pin reasoning',
      session_id: 'pin_sess',
    });
    const lines = readAudit();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      action: 'order_created',
      order_id: FAKE_ORDER_ID,
      amount_paise: 399800,
      status: 'success',
    });
    expect(res.order_id).toBe(FAKE_ORDER_ID);
  });

  test('createPaymentLink returns short_url and writes link_sent', async () => {
    const url = await createPaymentLink({
      order_id: FAKE_ORDER_ID,
      amount_paise: 399800,
      description: '2 x Pinned Test Product',
    });
    expect(url).toBe(FAKE_LINK);
    const actions = readAudit().map((r) => r.action);
    expect(actions).toEqual(['link_sent']);
  });
});

describe('IPaymentService seam (SOLID-D, no logic)', () => {
  test('exposes the four frozen functions by reference', () => {
    const svc = getPaymentService();
    expect(svc.createOrder).toBe(productionService.createOrder);
    expect(svc.fetchOrder).toBe(productionService.fetchOrder);
    expect(svc.capturePayment).toBe(productionService.capturePayment);
    expect(svc.createPaymentLink).toBe(productionService.createPaymentLink);
  });

  test('setPaymentService() merges overrides; resetPaymentService() restores', () => {
    const stub = jest.fn(async () => 'stubbed');
    setPaymentService({ createPaymentLink: stub });
    expect(getPaymentService().createPaymentLink).toBe(stub);
    expect(getPaymentService().createOrder).toBe(productionService.createOrder);
    resetPaymentService();
    expect(getPaymentService().createPaymentLink).toBe(productionService.createPaymentLink);
  });
});
