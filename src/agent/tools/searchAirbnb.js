// src/agent/tools/searchAirbnb.js — Airbnb search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchAirbnbSchema = z.object({
  query: z.string().describe('Airbnb search query (e.g., "villa in Bali")'),
  check_in: z.string().optional().describe('Check-in date YYYY-MM-DD'),
  check_out: z.string().optional().describe('Check-out date YYYY-MM-DD'),
  adults: z.number().int().min(1).max(16).optional().describe('Number of adults'),
  children: z.number().int().min(0).max(10).optional().describe('Number of children'),
  min_price: z.number().optional().describe('Minimum price per night'),
  max_price: z.number().optional().describe('Maximum price per night'),
});

class SearchAirbnbTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_airbnb',
      description: 'Search Airbnb for alternative accommodations, unique homes, villas, apartments.',
      schema: SearchAirbnbSchema,
    });
  }

  async _call({ query, check_in, check_out, adults, children, min_price, max_price }, _config) {
    const ctx = { trace_id: _config?.runId };
    if (check_in) ctx.check_in = check_in;
    if (check_out) ctx.check_out = check_out;
    if (adults) ctx.adults = adults;
    if (children) ctx.children = children;
    if (min_price) ctx.min_price = min_price;
    if (max_price) ctx.max_price = max_price;
    const result = await dispatchSearch('airbnb', query, ctx);
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchAirbnbTool = new SearchAirbnbTool();
module.exports = { SearchAirbnbTool, searchAirbnbTool };