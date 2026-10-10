// src/serp/imageEnricher.js — Image Enricher (Vortex Commerce Task 4).
//
// Guarantees every Item has a non-null image_url by falling back to
// Google Images search. Logs image_hit/image_fallback for Langfuse scoring.
//
// Usage: const enriched = await imageEnricher.enrichBatch(items, ctx);

const { BaseSerpTool } = require('./base');
const { getJson, config } = require('serpapi');

const PLACEHOLDER = 'https://via.placeholder.com/300x300?text=No+Image';

class ImageTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_images', ...opts });
  }

  buildParams(query, ctx) {
    return {
      engine: 'google_images',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      num: 1,
      ijn: 0,
    };
  }

  mapResult(raw, ctx) {
    return {
      image_url: raw.original ?? raw.thumbnail ?? raw.link,
    };
  }

  /**
   * Fetch one image for a query. Returns URL or placeholder.
   * @param {string} query
   * @param {object} ctx
   * @returns {Promise<string>}
   */
  async fetchOne(query, ctx = {}) {
    if (!query) return PLACEHOLDER;

    this._ensureConfig();
    if (!config.api_key) return PLACEHOLDER;

    try {
      const params = this.buildParams(query, ctx);
      const json = await getJson(params);
      const results = json.images_results ?? json.results ?? [];
      if (results.length > 0) {
        return results[0].original ?? results[0].thumbnail ?? results[0].link ?? PLACEHOLDER;
      }
    } catch (err) {
      console.warn('[imageEnricher] fetchOne failed:', err.message);
    }
    return PLACEHOLDER;
  }
}

const imageTool = new ImageTool();

/**
 * Enrich a batch of items, guaranteeing each has image_url.
 * @param {Item[]} items
 * @param {object} ctx { trace_id, ... }
 * @returns {Promise<Item[]>}
 */
async function enrichBatch(items, ctx = {}) {
  if (!items?.length) return items;

  const traceId = ctx.trace_id || `img_${Date.now()}`;
  const enriched = [];

  for (const item of items) {
    let imageUrl = item.image_url;
    let source = 'original';

    if (!imageUrl || imageUrl === PLACEHOLDER) {
      // Build a good search query from item metadata
      const searchQuery = [item.name, item.shop_name, item.category].filter(Boolean).join(' ');
      imageUrl = await imageTool.fetchOne(searchQuery, { ...ctx, traceId });
      source = imageUrl === PLACEHOLDER ? 'placeholder' : 'google_images';
    }

    enriched.push({
      ...item,
      image_url: imageUrl,
      _image_source: source, // for Langfuse scoring
    });

    // Log for scoring
    console.info('[imageEnricher]', {
      traceId,
      itemId: item.id,
      source,
      hasImage: source !== 'placeholder',
    });
  }

  return enriched;
}

module.exports = { ImageTool, imageTool, enrichBatch, PLACEHOLDER };