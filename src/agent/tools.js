// src/agent/tools.js — the agent's ONLY levers on the system.
//
// This module is the "bounded and gated" core (CLAUDE.md §0, §7): Claude can act
// ONLY through the four tool schemas in TOOLS, and each one is wired here to a
// real, audited function. If a capability isn't in this file, the agent cannot
// reach it — an unknown tool name throws.

const { searchCatalog, getUpsells } = require('../catalog');
const { createOrder, fetchOrder } = require('../api/razorpay');
const { createPaymentLink } = require('../api/paymentLinks');

/**
 * Claude tool_use schemas. Shapes match CLAUDE.md §7 exactly.
 * @type {Array<{name:string, description:string, input_schema:object}>}
 */
const TOOLS = [
  {
    name: 'search_catalog',
    description:
      'Search the merchant catalog for products matching a user query. Returns matching products (best match first) with price, stock and category.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What the user wants to buy' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_order',
    description:
      'Create a Razorpay order for a specific product and quantity, and get a payment link the customer can pay at. Only call this once the customer has clearly decided to buy.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Catalog product id, e.g. prod_001' },
        quantity: { type: 'integer', minimum: 1, maximum: 10, description: 'How many units (1-10)' },
      },
      required: ['product_id', 'quantity'],
    },
  },
  {
    name: 'get_upsell_suggestions',
    description:
      'Get upsell/cross-sell suggestions for a product the customer is interested in or has just ordered.',
    input_schema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Catalog product id to find add-ons for' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'get_order_status',
    description: 'Check the status of an existing Razorpay order by id (created | attempted | paid).',
    input_schema: {
      type: 'object',
      properties: {
        order_id: { type: 'string', description: 'Razorpay order id, e.g. order_ABC123' },
      },
      required: ['order_id'],
    },
  },
];

// Compact product view for tool results — enough for Claude to reason about and
// present, without dumping the whole record. Prices in paise AND rupees.
function slim(p) {
  return {
    id: p.id,
    name: p.name,
    price_paise: p.price_paise,
    price_inr: p.price_paise / 100,
    category: p.category,
    description: p.description,
    stock: p.stock,
    upsell_ids: p.upsell_ids || [],
  };
}

/**
 * Execute one tool call by name. This is the ONLY place tool names resolve to
 * real actions — an unknown name throws, so the agent cannot reach anything not
 * listed in TOOLS.
 *
 * @param {string} name   tool name from a Claude tool_use block
 * @param {object} input  the tool_use input (already schema-shaped by Claude)
 * @param {object} [ctx]  execution context: { reasoning, session_id }
 * @returns {Promise<object>} JSON-serialisable tool result
 */
async function executeTool(name, input = {}, ctx = {}) {
  switch (name) {
    case 'search_catalog': {
      const results = searchCatalog(input.query);
      return { query: input.query, count: results.length, products: results.map(slim) };
    }

    case 'create_order': {
      const { order_id, amount_paise, currency, product } = await createOrder({
        product_id: input.product_id,
        quantity: input.quantity,
        agent_reasoning: ctx.reasoning, // capture WHY (§0) into the order_created audit line
        session_id: ctx.session_id,
      });
      // Feature 4 hands the buyer a payable link (this logs link_sent).
      const payment_link = await createPaymentLink({
        order_id,
        amount_paise,
        description: `${input.quantity} x ${product.name}`,
      });
      return {
        order_id,
        product_id: product.id,
        product_name: product.name,
        quantity: input.quantity,
        amount_paise,
        amount_inr: amount_paise / 100,
        currency,
        payment_link,
      };
    }

    case 'get_upsell_suggestions': {
      const suggestions = getUpsells(input.product_id);
      return {
        product_id: input.product_id,
        count: suggestions.length,
        suggestions: suggestions.map(slim),
      };
    }

    case 'get_order_status': {
      const order = await fetchOrder(input.order_id);
      return {
        order_id: order.id,
        status: order.status,
        amount_paise: order.amount,
        amount_paid_paise: order.amount_paid,
        currency: order.currency,
        receipt: order.receipt,
      };
    }

    default: {
      const err = new Error(`Unknown tool: ${name}`);
      err.code = 'UNKNOWN_TOOL';
      throw err;
    }
  }
}

module.exports = { TOOLS, executeTool, slim };
