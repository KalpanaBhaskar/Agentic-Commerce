// src/agent/tools/searchMaps.js — Maps/local business search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchMapsSchema = z.object({
  query: z.string().describe('Local business search (e.g., "Apple Store hours near me", "mall near me")'),
  location: z.string().optional().describe('Location string (address, city)'),
  lat: z.number().optional().describe('Latitude'),
  lng: z.number().optional().describe('Longitude'),
  type: z.string().optional().describe('Place type (e.g., restaurant, store, mall)'),
});

class SearchMapsTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_maps',
      description: 'Search Google Maps/Local for local businesses, operating hours, location-based storefronts.',
      schema: SearchMapsSchema,
    });
  }

  async _call({ query, location, lat, lng, type }, _config) {
    const ctx = { trace_id: _config?.runId };
    if (location) ctx.location = location;
    if (lat !== undefined) ctx.lat = lat;
    if (lng !== undefined) ctx.lng = lng;
    if (type) ctx.type = type;
    const result = await dispatchSearch('maps_local', query, ctx);
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchMapsTool = new SearchMapsTool();
module.exports = { SearchMapsTool, searchMapsTool };