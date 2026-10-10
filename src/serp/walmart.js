// src/serp/walmart.js — Walmart adapter (Vortex Commerce Task 3).
//
// Engine: 'walmart'. Everyday essentials, groceries, department store goods.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class WalmartTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'walmart', ...opts });
    this.vertical = 'walmart';
  }

  buildParams(query, ctx) {
    return {
      engine: 'walmart',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'us',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.id ?? raw.product_id,
      name: raw.title ?? raw.name,
      description: raw.description ?? raw.short_description ?? '',
      price_paise: raw.price ? Math.round(raw.price * 100) : 0,
      old_price_paise: raw.was_price ? Math.round(raw.was_price * 100) : null,
      category: raw.category ?? 'general',
      shop_name: 'Walmart',
      shop_icon: 'https://www.walmart.com/favicon.ico',
      product_link: raw.product_url ?? raw.link,
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: raw.delivery ?? raw.shipping,
      thumbnail: raw.thumbnail_image ?? raw.image,
    };
  }
}

const walmartTool = new WalmartTool();

module.exports = { WalmartTool, walmartTool };