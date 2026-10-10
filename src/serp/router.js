// src/serp/router.js — pure vertical→engines mapping (Vortex Commerce Task 3).
//
// This is the SINGLE SOURCE OF TRUTH for SerpApi routing. It is a pure
// function (no I/O, no state) so it's trivial to test and swap.
// The classifier (Task 6) emits a `vertical`; the dispatcher calls
// `router.resolve(vertical)` → engine list, then runs each until one returns
// non-empty results. Google Shopping is the universal fallback.
//
// See docs/VORTEX_ARCHITECTURE.md §3 for the normative table.

const { BaseSerpTool } = require('./base');
const { enrichBatch } = require('./imageEnricher');

// Lazy-load adapters to avoid circular deps and speed up cold start.
const ADAPTERS = {
  // Retail
  google_shopping: () => require('./googleShopping').googleShoppingTool,
  amazon: () => require('./amazon').amazonTool,
  walmart: () => require('./walmart').walmartTool,
  home_depot: () => require('./homeDepot').homeDepotTool,
  ebay: () => require('./ebay').ebayTool,

  // Travel & Hospitality
  google_hotels: () => require('./hotels').hotelsTool,
  google_flights: () => require('./flights').flightsTool,
  airbnb: () => require('./airbnb').airbnbTool,
  tripadvisor: () => require('./tripadvisor').tripadvisorTool,

  // Local Services & Food
  yelp: () => require('./yelp').yelpTool,
  opentable: () => require('./openTable').openTableTool,
  google_maps: () => require('./maps').mapsTool,
  google_local: () => require('./maps').localTool, // alias

  // Digital Goods
  apple_app_store: () => require('./apps').appleAppStoreTool,
  google_play: () => require('./apps').googlePlayTool,

  // Contextual (non-transactional)
  knowledge_graph: () => require('./knowledgeGraph').knowledgeGraphTool,
  google_images: () => require('./imageEnricher').imageTool,
};

/**
 * Routing matrix: vertical → ordered engine list.
 * First engine is primary; subsequent are fallbacks.
 * @type {Record<string, string[]>}
 */
const VERTICAL_ENGINES = Object.freeze({
  // Retail
  retail_general: ['google_shopping'], // fallback aggregator
  amazon: ['amazon', 'google_shopping'],
  walmart: ['walmart', 'google_shopping'],
  homedepot: ['home_depot', 'google_shopping'],
  ebay: ['ebay', 'google_shopping'],

  // Travel
  hotels: ['google_hotels', 'tripadvisor'], // tripadvisor for review enrich
  flights: ['google_flights'],
  airbnb: ['airbnb'],
  places_review: ['tripadvisor'],

  // Local
  local_food: ['yelp', 'google_maps'],
  restaurants_booking: ['opentable', 'yelp'],
  maps_local: ['google_maps', 'google_local'],

  // Digital
  apps_digital: ['apple_app_store', 'google_play'],

  // Context (never used as primary for shopping)
  unknown: ['google_shopping'],
});

/**
 * Resolve a vertical to an ordered list of engine names.
 * @param {string} vertical
 * @returns {string[]}
 */
function resolve(vertical) {
  return VERTICAL_ENGINES[vertical] ?? VERTICAL_ENGINES.unknown;
}

/**
 * Get an initialized adapter instance for an engine name.
 * @param {string} engineName
 * @returns {BaseSerpTool}
 */
function getAdapter(engineName) {
  const loader = ADAPTERS[engineName];
  if (!loader) {
    throw new Error(`No adapter registered for engine: ${engineName}`);
  }
  return loader();
}

/**
 * Search a vertical with automatic fallback.
 * Tries each engine in order until one returns non-empty results.
 * @param {string} vertical
 * @param {string} query
 * @param {object} ctx  { gl, hl, location, trace_id, ... }
 * @returns {Promise<{items: Item[], engineUsed: string|null}>}
 */
async function searchWithFallback(vertical, query, ctx = {}) {
  const engines = resolve(vertical);
  const traceId = ctx.trace_id || `router_${Date.now()}`;

  for (const engine of engines) {
    try {
      const adapter = getAdapter(engine);
      let items = await adapter.search(query, { ...ctx, traceId });
      if (items.length > 0) {
        // Guarantee every item has an image_url via enrichment
        items = await enrichBatch(items, { ...ctx, traceId });
        return { items, engineUsed: engine };
      }
    } catch (err) {
      console.warn(`[router] engine ${engine} failed for vertical ${vertical}:`, err.message);
    }
  }

  return { items: [], engineUsed: null };
}

module.exports = { VERTICAL_ENGINES, resolve, getAdapter, searchWithFallback, ADAPTERS };