// src/agent/tools/searchHotels.js — Hotels search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchHotelsSchema = z.object({
  query: z.string().describe('Hotel search query (e.g., "boutique hotel downtown Chicago")'),
  check_in: z.string().optional().describe('Check-in date YYYY-MM-DD'),
  check_out: z.string().optional().describe('Check-out date YYYY-MM-DD'),
  adults: z.number().int().min(1).max(10).optional().describe('Number of adults'),
  children: z.number().int().min(0).max(10).optional().describe('Number of children'),
});

class SearchHotelsTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_hotels',
      description: 'Search Google Hotels for traditional hotel properties, room availability, pricing tiers, deep property details. Tripadvisor used for review enrichment.',
      schema: SearchHotelsSchema,
    });
  }

  async _call({ query, check_in, check_out, adults, children }, _config) {
    const ctx = { trace_id: _config?.runId };
    if (check_in) ctx.check_in = check_in;
    if (check_out) ctx.check_out = check_out;
    if (adults) ctx.adults = adults;
    if (children) ctx.children = children;
    const result = await dispatchSearch('hotels', query, ctx);
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchHotelsTool = new SearchHotelsTool();
module.exports = { SearchHotelsTool, searchHotelsTool };