// src/serp/index.js — SerpApi module public API (Vortex Commerce Task 3).
//
// Re-exports all adapters, router, types, and enricher for clean imports.

const { BaseSerpTool } = require('./base');
const { ITEM_KEYS, isValidItem, coerceToItem } = require('./types');
const {
  VERTICAL_ENGINES,
  resolve,
  getAdapter,
  searchWithFallback,
  ADAPTERS,
} = require('./router');
const { dispatchSearch, needsEntityResolution, extractEntityName } = require('./dispatcher');

const { googleShoppingTool } = require('./googleShopping');
const { amazonTool } = require('./amazon');
const { walmartTool } = require('./walmart');
const { homeDepotTool } = require('./homeDepot');
const { ebayTool } = require('./ebay');
const { hotelsTool } = require('./hotels');
const { flightsTool } = require('./flights');
const { airbnbTool } = require('./airbnb');
const { tripadvisorTool } = require('./tripadvisor');
const { yelpTool } = require('./yelp');
const { openTableTool } = require('./openTable');
const { mapsTool, localTool } = require('./maps');
const { appleAppStoreTool, googlePlayTool } = require('./apps');
const { knowledgeGraphTool } = require('./knowledgeGraph');
const { imageTool, enrichBatch, PLACEHOLDER } = require('./imageEnricher');

module.exports = {
  // Base & types
  BaseSerpTool,
  ITEM_KEYS,
  isValidItem,
  coerceToItem,

  // Router
  VERTICAL_ENGINES,
  resolve,
  getAdapter,
  searchWithFallback,
  ADAPTERS,

  // Dispatcher (Task 5)
  dispatchSearch,
  needsEntityResolution,
  extractEntityName,

  // Adapters (instances)
  googleShoppingTool,
  amazonTool,
  walmartTool,
  homeDepotTool,
  ebayTool,
  hotelsTool,
  flightsTool,
  airbnbTool,
  tripadvisorTool,
  yelpTool,
  openTableTool,
  mapsTool,
  localTool,
  appleAppStoreTool,
  googlePlayTool,
  knowledgeGraphTool,
  imageTool,

  // Utilities
  enrichBatch,
  PLACEHOLDER,
};