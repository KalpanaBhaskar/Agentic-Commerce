// src/agent/tools/searchAmazon.js — Amazon search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchAmazonSchema = z.object({
  query: z.string().describe('What the user wants to buy on Amazon (specs, reviews, Prime)'),
});

class SearchAmazonTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_amazon',
      description: 'Search Amazon for products (best for specs, reviews, Prime eligibility). Returns items with image, price, ratings.',
      schema: SearchAmazonSchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('amazon', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchAmazonTool = new SearchAmazonTool();
module.exports = { SearchAmazonTool, searchAmazonTool };