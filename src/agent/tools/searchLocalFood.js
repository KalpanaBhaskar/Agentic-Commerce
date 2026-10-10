// src/agent/tools/searchLocalFood.js — Local food/restaurant search tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchLocalFoodSchema = z.object({
  query: z.string().describe('Food/restaurant search (e.g., "sushi delivery near me", "Italian restaurant downtown")'),
  location: z.string().optional().describe('Location string (address, city, or "near me")'),
  lat: z.number().optional().describe('Latitude'),
  lng: z.number().optional().describe('Longitude'),
});

class SearchLocalFoodTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_local_food',
      description: 'Search Yelp for restaurants, food delivery, menus, cuisine search. Google Maps fallback for hours/location.',
      schema: SearchLocalFoodSchema,
    });
  }

  async _call({ query, location, lat, lng }, _config) {
    const ctx = { trace_id: _config?.runId };
    if (location) ctx.location = location;
    if (lat !== undefined) ctx.lat = lat;
    if (lng !== undefined) ctx.lng = lng;
    const result = await dispatchSearch('local_food', query, ctx);
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchLocalFoodTool = new SearchLocalFoodTool();
module.exports = { SearchLocalFoodTool, searchLocalFoodTool };