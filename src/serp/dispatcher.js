// src/serp/dispatcher.js — KG-enhanced search dispatcher (Vortex Commerce Task 5).
//
// Flow:
// 1. Detect if query needs entity resolution (proper noun, "near X", brand verify)
// 2. Call knowledgeGraphTool.resolveEntity() to get structured context
// 3. Inject entity context (lat/lng/address/type) into router searchWithFallback
// 4. Never return KG result as a product — it's contextual only

const { knowledgeGraphTool } = require('./knowledgeGraph');
const { searchWithFallback } = require('./router');

/**
 * Heuristics to decide if a query needs entity resolution.
 * Returns true for: "near X", "close to X", "around X", brand names, proper nouns with location intent.
 * @param {string} query
 * @returns {boolean}
 */
function needsEntityResolution(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();

  // Location-relative patterns
  const locationPatterns = [
    /\bnear\s+/,
    /\bclose\s+to\s+/,
    /\baround\s+/,
    /\bin\s+the\s+area\s+of\s+/,
    /\bnearby\b/,
    /\bwithin\s+\d+/,
    /\bwalking\s+distance\s+(from|of)\s+/,
  ];

  if (locationPatterns.some((re) => re.test(q))) return true;

  // Proper noun detection: capitalized words that aren't common sentence starters
  const words = query.trim().split(/\s+/);
  const commonStarters = new Set([
    'i', 'we', 'you', 'the', 'a', 'an', 'find', 'search', 'show', 'get',
    'buy', 'book', 'order', 'want', 'need', 'looking', 'for', 'some', 'any',
    'cheap', 'best', 'top', 'good', 'great', 'nice', 'new', 'latest',
  ]);

  const hasProperNoun = words.some((w, i) => {
    const clean = w.replace(/[.,!?;:'"()]/g, '');
    if (clean.length < 2) return false;
    if (commonStarters.has(clean.toLowerCase())) return false;
    // Capitalized word (not first word, or first word but not a starter)
    return /^[A-Z][a-z]+/.test(clean) && (i > 0 || !commonStarters.has(clean.toLowerCase()));
  });

  if (hasProperNoun) return true;

  // Brand-like patterns (all caps, known brands could be extended)
  if (/\b[A-Z]{2,}\b/.test(query)) return true;

  return false;
}

/**
 * Extract the entity name from a query for KG lookup.
 * Strips common commerce verbs and location prepositions.
 * @param {string} query
 * @returns {string} entity name to resolve
 */
function extractEntityName(query) {
  if (!query) return query;

  let q = query.trim();

  // Remove common commerce intent verbs
  const intentPrefixes = [
    /^(find|search|show|get|buy|book|order|want|need|looking\s+for)\s+/i,
    /^(restaurant|hotel|flight|store|shop|cafe|mall)\s+/i,
  ];
  for (const re of intentPrefixes) {
    q = q.replace(re, '');
  }

  // Remove "near X", "close to X", "in X" but keep X as the entity
  const nearMatch = q.match(/\b(?:near|close\s+to|around|in\s+the\s+area\s+of|nearby)\s+(.+)$/i);
  if (nearMatch) {
    return nearMatch[1].trim();
  }

  // Remove trailing location prepositions
  q = q.replace(/\s+(in|at|near|around|close\s+to)\s+.*$/i, '');

  return q.trim();
}

/**
 * Main dispatcher: resolves entities if needed, then searches with context.
 * @param {string} vertical  classifier vertical (e.g., 'hotels', 'local_food')
 * @param {string} query     user's raw query
 * @param {object} ctx       { gl, hl, trace_id, ... }
 * @returns {Promise<{items: Item[], engineUsed: string|null, entityContext: object|null}>}
 */
async function dispatchSearch(vertical, query, ctx = {}) {
  const traceId = ctx.trace_id || `dispatch_${Date.now()}`;
  let entityContext = null;

  // Step 1: Check if we should resolve an entity first
  if (needsEntityResolution(query)) {
    const entityName = extractEntityName(query);
    if (entityName && entityName.length > 1) {
      console.info('[dispatcher] resolving entity', { entityName, vertical, traceId });
      entityContext = await knowledgeGraphTool.resolveEntity(entityName, { ...ctx, traceId });

      if (entityContext) {
        console.info('[dispatcher] entity resolved', {
          name: entityContext.name,
          type: entityContext.type,
          hasCoords: entityContext.lat !== null && entityContext.lng !== null,
          traceId,
        });
      }
    }
  }

  // Step 2: Build enriched context for router
  const enrichedCtx = { ...ctx, traceId };
  if (entityContext) {
    // Inject coordinates for location-based engines (maps, hotels, local)
    if (entityContext.lat !== null && entityContext.lng !== null) {
      enrichedCtx.lat = entityContext.lat;
      enrichedCtx.lng = entityContext.lng;
    }
    // Inject address for engines that accept it
    if (entityContext.address) {
      enrichedCtx.location = entityContext.address;
    }
    // Pass entity type for vertical-specific logic
    enrichedCtx.entityType = entityContext.type;
    enrichedCtx.entityName = entityContext.name;
  }

  // Step 3: Search with enriched context
  const { items, engineUsed } = await searchWithFallback(vertical, query, enrichedCtx);

  // Step 4: Return results + entity context (for logging/debugging), never KG as product
  return { items, engineUsed, entityContext };
}

module.exports = {
  needsEntityResolution,
  extractEntityName,
  dispatchSearch,
};