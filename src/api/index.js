// src/api/index.js — IPaymentService seam (Vortex Commerce Task 2).
//
// FROZEN-MONEY GUARANTEE: this file contains ZERO money logic. Amounts,
// validation, receipt generation, SDK calls, and audit writes all live in
// `./razorpay` + `./paymentLinks` (untouched). This module only binds those
// existing functions behind a small interface so future code (LangChain tools,
// Task 7+) depends on the ABSTRACTION (SOLID-D), never on the concretions.
//
// Interface (JSDoc):
//   IPaymentService = {
//     createOrder(args): Promise<{order_id, amount_paise, currency, product, receipt}>,
//     fetchOrder(order_id): Promise<object>,
//     capturePayment(payment_id, amount_paise): Promise<object>,
//     createPaymentLink(args): Promise<string>,
//   }
//
// Usage:
//   const { getPaymentService } = require('./api');
//   const payments = getPaymentService();
//   await payments.createOrder({ product_id, quantity, product, agent_reasoning, session_id });
//
// Testing seam:
//   setPaymentService(overrides) swaps the singleton (e.g. mocks in Jest);
//   resetPaymentService() restores the real Razorpay-backed implementation.

const { createOrder, fetchOrder, capturePayment } = require('./razorpay');
const { createPaymentLink } = require('./paymentLinks');

/**
 * @typedef {object} IPaymentService
 * @property {(args: object) => Promise<object>} createOrder
 * @property {(order_id: string) => Promise<object>} fetchOrder
 * @property {(payment_id: string, amount_paise: number) => Promise<object>} capturePayment
 * @property {(args: object) => Promise<string>} createPaymentLink
 */

/** The production implementation — thin references, no wrappers, no logic. */
const productionService = Object.freeze({
  createOrder,
  fetchOrder,
  capturePayment,
  createPaymentLink,
});

let _current = productionService;

/**
 * Get the active payment service (production by default).
 * @returns {IPaymentService}
 */
function getPaymentService() {
  return _current;
}

/**
 * Swap the active service (tests / future DI). Partial overrides are merged
 * over production so callers can stub a single method.
 * @param {Partial<IPaymentService>} overrides
 * @returns {IPaymentService} the new active service
 */
function setPaymentService(overrides = {}) {
  _current = Object.freeze({ ...productionService, ...overrides });
  return _current;
}

/** Restore the production Razorpay-backed service. */
function resetPaymentService() {
  _current = productionService;
  return _current;
}

module.exports = { getPaymentService, setPaymentService, resetPaymentService, productionService };
