// src/agent/tools/createOrder.js — Create order tool (Vortex Commerce Task 7).

const { StructuredTool } = require('@langchain/core/tools');
const { getPaymentService } = require('../../api');
const crypto = require('crypto');

// JSON Schema for StructuredTool (plain object, not Zod)
const CreateOrderSchema = {
  type: 'object',
  properties: {
    product_id: { type: 'string', description: 'Catalog product ID (e.g., prod_001 or serp_...)' },
    quantity: { type: 'integer', minimum: 1, maximum: 10, description: 'Quantity (1-10)' },
    reasoning: { type: 'string', description: 'Why this order was created (for audit)' },
  },
  required: ['product_id'],
  additionalProperties: false,
};

class CreateOrderTool extends StructuredTool {
  constructor() {
    super({
      name: 'create_order',
      description: 'Create a Razorpay order for a specific product and quantity. Returns order_id and payment_link. Quantity defaults to 1.',
      schema: CreateOrderSchema,
    });
  }

  async _call({ product_id, quantity, reasoning }, _config) {
    const payments = getPaymentService();
    const sessionId = _config?.runId || `sess_${crypto.randomUUID()}`;

    // Get product details from catalog/serp cache
    const { getProduct } = require('../../catalog');
    const product = getProduct(product_id);
    if (!product) {
      throw new Error(`Product not found: ${product_id}`);
    }

    const result = await payments.createOrder({
      product_id,
      quantity,
      product,
      agent_reasoning: reasoning,
      session_id: sessionId,
    });

    const { createPaymentLink } = require('../../api/paymentLinks');
    const payment_link = await createPaymentLink({
      order_id: result.order_id,
      amount_paise: result.amount_paise,
      description: `${quantity} x ${result.product.name}`,
    });

    return JSON.stringify({
      order_id: result.order_id,
      product_id: result.product.id,
      product_name: result.product.name,
      quantity,
      amount_paise: result.amount_paise,
      amount_inr: result.amount_paise / 100,
      currency: result.currency,
      payment_link,
    });
  }
}

const createOrderTool = new CreateOrderTool();
module.exports = { CreateOrderTool, createOrderTool };