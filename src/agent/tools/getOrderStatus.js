// src/agent/tools/getOrderStatus.js — Get order status tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { getPaymentService } = require('../../api');

const GetOrderStatusSchema = z.object({
  order_id: z.string().describe('Razorpay order ID (e.g., order_ABC123)'),
});

class GetOrderStatusTool extends StructuredTool {
  constructor() {
    super({
      name: 'get_order_status',
      description: 'Check the status of an existing Razorpay order by ID (created | attempted | paid).',
      schema: GetOrderStatusSchema,
    });
  }

  async _call({ order_id }, _config) {
    const payments = getPaymentService();
    const order = await payments.fetchOrder(order_id);
    return JSON.stringify({
      order_id: order.id,
      status: order.status,
      amount_paise: order.amount,
      amount_paid_paise: order.amount_paid,
      currency: order.currency,
      receipt: order.receipt,
    });
  }
}

const getOrderStatusTool = new GetOrderStatusTool();
module.exports = { GetOrderStatusTool, getOrderStatusTool };