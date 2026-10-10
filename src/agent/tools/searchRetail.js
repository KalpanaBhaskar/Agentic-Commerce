// src/agent/tools/searchRetail.js — Retail general search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchRetailSchema = z.object({
  query: z.string().describe('What the user wants to buy (general product search)'),
});

class SearchRetailTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_retail',
      description: 'Search for general retail products across multiple merchants (price comparison, no specific store). Returns items with image, price, shop, discounts.',
      schema: SearchRetailSchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('retail_general', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchRetailTool = new SearchRetailTool();
module.exports = { SearchRetailTool, searchRetailTool };