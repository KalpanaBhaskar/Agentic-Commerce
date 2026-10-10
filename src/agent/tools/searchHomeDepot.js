// src/agent/tools/searchHomeDepot.js — Home Depot search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchHomeDepotSchema = z.object({
  query: z.string().describe('Hardware, tools, home improvement, building materials on Home Depot'),
});

class SearchHomeDepotTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_homedepot',
      description: 'Search Home Depot for hardware, tools, home improvement, building materials.',
      schema: SearchHomeDepotSchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('homedepot', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchHomeDepotTool = new SearchHomeDepotTool();
module.exports = { SearchHomeDepotTool, searchHomeDepotTool };