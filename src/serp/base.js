// src/serp/base.js — BaseSerpTool abstract class (Vortex Commerce Task 3).
//
// Every vertical adapter extends this. It handles:
// - SerpApi client init (lazy, via SERPAPI_API_KEY)
// - Caching (in-memory Map with TTL)
// - Request/response logging for Langfuse scoring
// - Error normalization (engine errors → empty array + log)
// - Image enrichment hook (post-process)
//
// Subclasses implement: `engineName`, `buildParams(query, ctx)`, `mapResult(raw, ctx)`.

const { getJson, config } = require('serpapi');
const { coerceToItem, isValidItem } = require('./types');

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_RESULTS = 10;

class BaseSerpTool {
  /**
   * @param {object} opts
   * @param {string} opts.engineName     serpapi engine string (e.g. 'amazon')
   * @param {number} [opts.ttlMs]        cache TTL
   * @param {object} [opts.logger]       { log: (level, meta) => void }
   */
  constructor({ engineName, ttlMs = DEFAULT_TTL_MS, logger = console } = {}) {
    if (this.constructor === BaseSerpTool) {
      throw new Error('BaseSerpTool is abstract — extend it.');
    }
    if (!engineName) throw new Error('engineName is required');

    this.engineName = engineName;
    this.ttlMs = ttlMs;
    this.logger = logger;
    this.cache = new Map(); // key -> { items, expiresAt }
  }

  /** Ensure SerpApi config is set (idempotent). */
  _ensureConfig() {
    if (!config.api_key && process.env.SERPAPI_API_KEY) {
      config.api_key = process.env.SERPAPI_API_KEY;
    }
  }

  /** Build the cache key for a query + context. */
  _cacheKey(query, ctx = {}) {
    const ctxStr = JSON.stringify({
      gl: ctx.gl ?? 'in',
      hl: ctx.hl ?? 'en',
      location: ctx.location ?? '',
    });
    return `${this.engineName}:${query}:${ctxStr}`;
  }

  /** Check cache; return items if fresh, else null. */
  _getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.items;
  }

  /** Store items in cache. */
  _setCached(key, items) {
    this.cache.set(key, { items, expiresAt: Date.now() + this.ttlMs });
  }

  /**
   * Subclass hook: build the serpapi parameter object for a query.
   * @param {string} query
   * @param {object} ctx  { gl, hl, location, ...vertical-specific }
   * @returns {object} params for getJson()
   */
  buildParams(query, ctx) {
    throw new Error('buildParams() must be implemented by subclass');
  }

  /**
   * Subclass hook: map one raw serpapi result to a pre-coerced object.
   * Returned object will be passed through coerceToItem().
   * @param {object} raw   one element from serpapi results array
   * @param {object} ctx   same as buildParams
   * @returns {object} partial Item fields
   */
  mapResult(raw, ctx) {
    throw new Error('mapResult() must be implemented by subclass');
  }

  /**
   * Main entry: search and return Item[].
   * @param {string} query
   * @param {object} ctx  { gl, hl, location, trace_id, ... }
   * @returns {Promise<Item[]>}
   */
  async search(query, ctx = {}) {
    if (!query || typeof query !== 'string') return [];

    this._ensureConfig();
    if (!config.api_key) {
      this.logger.warn?.('[serp] SERPAPI_API_KEY not set — returning empty');
      return [];
    }

    const traceId = ctx.trace_id || `serp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cacheKey = this._cacheKey(query, ctx);
    const cached = this._getCached(cacheKey);
    if (cached) {
      this.logger.info?.('[serp] cache hit', { engine: this.engineName, query, traceId });
      return cached;
    }

    const params = this.buildParams(query, ctx);
    const started = Date.now();
    let rawResults = [];

    try {
      const json = await getJson(params);
      rawResults = this._extractResultsArray(json) || [];
      this.logger.info?.('[serp] ok', {
        engine: this.engineName,
        query,
        count: rawResults.length,
        ms: Date.now() - started,
        traceId,
      });
    } catch (err) {
      this.logger.error?.('[serp] error', {
        engine: this.engineName,
        query,
        error: err.message,
        ms: Date.now() - started,
        traceId,
      });
      return []; // graceful degradation — caller falls back
    }

    // Map + coerce
    const items = rawResults
      .slice(0, MAX_RESULTS)
      .map((raw) => this.mapResult(raw, { ...ctx, traceId }))
      .map((mapped) => coerceToItem(mapped, { vertical: this.vertical, engine: this.engineName, traceId }))
      .filter(isValidItem);

    this._setCached(cacheKey, items);
    return items;
  }

  /**
   * Override if the engine nests results differently.
   * Default: json.shopping_results || json.results || json.data || []
   */
  _extractResultsArray(json) {
    return json.shopping_results ?? json.results ?? json.data ?? json.organic_results ?? [];
  }

  /** Clear the in-memory cache (useful for tests). */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = { BaseSerpTool };