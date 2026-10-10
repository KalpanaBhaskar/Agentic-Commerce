// src/agent/tools/getUpsell.js — Get upsell suggestions tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { getUpsells, getProduct } = require('../../catalog');

const GetUpsellSchema = z.object({
  product_id: z.string().describe('Catalog product ID to find add-ons for'),
});

class GetUpsellTool extends StructuredTool {
  constructor() {
    super({
      name: 'get_upsell_suggestions',
      description: 'Get upsell/cross-sell suggestions for a product the customer is interested in or has just ordered.',
      schema: GetUpsellSchema,
    });
  }

  async _call({ product_id }) {
    const product = getProduct(product_id);
    if (!product) {
      return JSON.stringify({ product_id, count: 0, suggestions: [] });
    }

    const suggestions = await getUpsells(product_id);
    const items = suggestions.map((p) => ({
      id: p.id,
      name: p.name,
      price_paise: p.price_paise,
      price_inr: p.price_paise / 100,
      category: p.category,
      description: p.description,
      image_url: p.image_url,
    }));

    return JSON.stringify({
      product_id,
      count: items.length,
      suggestions: items,
    });
  }
}

const getUpsellTool = new GetUpsellTool();
module.exports = { GetUpsellTool, getUpsellTool };