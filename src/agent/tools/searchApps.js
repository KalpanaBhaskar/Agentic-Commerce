// src/agent/tools/searchApps.js — Digital apps search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchAppsSchema = z.object({
  query: z.string().describe('App/ebook/digital media search (e.g., "download Notion app", "Kindle books")'),
});

class SearchAppsTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_apps',
      description: 'Search Apple App Store and Google Play for apps, ebooks, digital media, software downloads.',
      schema: SearchAppsSchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('apps_digital', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchAppsTool = new SearchAppsTool();
module.exports = { SearchAppsTool, searchAppsTool };