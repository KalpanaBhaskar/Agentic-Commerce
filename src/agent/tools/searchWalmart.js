// src/agent/tools/searchWalmart.js — Walmart search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchWalmartSchema = z.object({
  query: z.string().describe('Groceries, everyday essentials, department store goods on Walmart'),
});

class SearchWalmartTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_walmart',
      description: 'Search Walmart for groceries, everyday essentials, department store goods. Strong filtering and pagination.',
      schema: SearchWalmartSchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('walmart', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchWalmartTool = new SearchWalmartTool();
module.exports = { SearchWalmartTool, searchWalmartTool };