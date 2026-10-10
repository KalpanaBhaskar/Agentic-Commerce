// src/agent/tools/searchRestaurantsBooking.js — Restaurant booking tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchRestaurantsBookingSchema = z.object({
  query: z.string().describe('Restaurant booking query (e.g., "book table Italian restaurant for 4 at 7pm")'),
  date: z.string().optional().describe('Booking date YYYY-MM-DD'),
  time: z.string().optional().describe('Booking time HH:MM'),
  party_size: z.number().int().min(1).max(20).optional().describe('Party size'),
});

class SearchRestaurantsBookingTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_restaurants_booking',
      description: 'Search OpenTable for restaurant bookings and dining reservations. Yelp fallback.',
      schema: SearchRestaurantsBookingSchema,
    });
  }

  async _call({ query, date, time, party_size }, _config) {
    const ctx = { trace_id: _config?.runId };
    if (date) ctx.date = date;
    if (time) ctx.time = time;
    if (party_size) ctx.party_size = party_size;
    const result = await dispatchSearch('restaurants_booking', query, ctx);
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchRestaurantsBookingTool = new SearchRestaurantsBookingTool();
module.exports = { SearchRestaurantsBookingTool, searchRestaurantsBookingTool };