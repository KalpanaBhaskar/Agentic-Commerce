// src/serp/amazon.js — Amazon adapter (Vortex Commerce Task 3).
//
// Engine: 'amazon'. Best for broad product discovery, specs, reviews.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class AmazonTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'amazon', ...opts });
    this.vertical = 'amazon';
  }

  buildParams(query, ctx) {
    return {
      engine: 'amazon',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'us', // Amazon US catalog; adjust if needed
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.asin ?? raw.product_id,
      name: raw.title,
      description: raw.description ?? raw.snippet ?? '',
      price_paise: raw.price ? Math.round(raw.price * 100) : 0,
      old_price_paise: raw.original_price ? Math.round(raw.original_price * 100) : null,
      category: raw.category_name ?? 'general',
      shop_name: 'Amazon',
      shop_icon: 'https://www.amazon.com/favicon.ico',
      product_link: raw.link ?? raw.product_link,
      rating: raw.rating,
      reviews: raw.reviews_count ?? raw.reviews,
      delivery: raw.delivery ?? raw.shipping,
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

const amazonTool = new AmazonTool();

module.exports = { AmazonTool, amazonTool };