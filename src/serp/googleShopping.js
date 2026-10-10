// src/serp/googleShopping.js — Google Shopping adapter (Vortex Commerce Task 3).
//
// Fallback aggregator for general retail. Engine: 'google_shopping'.
// Maps SERPAPI shopping_results → Item.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class GoogleShoppingTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_shopping', ...opts });
    this.vertical = 'retail_general';
  }

  buildParams(query, ctx) {
    return {
      engine: 'google_shopping',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const price = raw.extracted_price ?? 0;
    const oldPrice = raw.extracted_old_price ?? null;

    return {
      id: raw.product_id ?? raw.id,
      name: raw.title,
      description: raw.snippet ?? raw.tagline ?? '',
      price_paise: Math.round(price * 100),
      old_price_paise: oldPrice ? Math.round(oldPrice * 100) : null,
      category: raw.tag ?? 'general',
      shop_name: raw.source,
      shop_icon: raw.source_icon,
      product_link: raw.product_link,
      rating: raw.rating,
      reviews: raw.reviews,
      delivery: raw.delivery,
      thumbnail: raw.thumbnail,
    };
  }
}

const googleShoppingTool = new GoogleShoppingTool();

module.exports = { GoogleShoppingTool, googleShoppingTool };