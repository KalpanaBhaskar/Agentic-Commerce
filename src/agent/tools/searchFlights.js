// src/agent/tools/searchFlights.js — Flights search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchFlightsSchema = z.object({
  query: z.string().describe('Flight search query (e.g., "NYC to London Friday")'),
  departure_id: z.string().optional().describe('Departure airport code (e.g., JFK)'),
  arrival_id: z.string().optional().describe('Arrival airport code (e.g., LHR)'),
  outbound_date: z.string().optional().describe('Outbound date YYYY-MM-DD'),
  return_date: z.string().optional().describe('Return date YYYY-MM-DD'),
  adults: z.number().int().min(1).max(9).optional().describe('Number of passengers'),
});

class SearchFlightsTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_flights',
      description: 'Search Google Flights for flight itineraries, pricing insights, routing options.',
      schema: SearchFlightsSchema,
    });
  }

  async _call({ query, departure_id, arrival_id, outbound_date, return_date, adults }, _config) {
    const ctx = { trace_id: _config?.runId };
    if (departure_id) ctx.departure_id = departure_id;
    if (arrival_id) ctx.arrival_id = arrival_id;
    if (outbound_date) ctx.outbound_date = outbound_date;
    if (return_date) ctx.return_date = return_date;
    if (adults) ctx.adults = adults;
    const result = await dispatchSearch('flights', query, ctx);
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchFlightsTool = new SearchFlightsTool();
module.exports = { SearchFlightsTool, searchFlightsTool };