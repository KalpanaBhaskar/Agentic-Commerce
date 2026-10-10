// src/agent/tools/searchEbay.js — eBay search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchEbaySchema = z.object({
  query: z.string().describe('Unique finds, collectibles, secondhand, vintage, refurbished on eBay'),
});

class SearchEbayTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_ebay',
      description: 'Search eBay for unique finds, collectibles, secondhand, vintage, refurbished items.',
      schema: SearchEbaySchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('ebay', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchEbayTool = new SearchEbayTool();
module.exports = { SearchEbayTool, searchEbayTool };