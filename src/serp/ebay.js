// src/serp/ebay.js — eBay adapter (Vortex Commerce Task 3).
//
// Engine: 'ebay'. Unique finds, collectibles, tech accessories, secondhand.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class EbayTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'ebay', ...opts });
    this.vertical = 'ebay';
  }

  buildParams(query, ctx) {
    return {
      engine: 'ebay',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'us',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const price = raw.price ? raw.price.value : 0;
    const currency = raw.price ? raw.price.currency : 'USD';

    return {
      id: raw.item_id ?? raw.id,
      name: raw.title,
      description: raw.subtitle ?? raw.condition ?? '',
      price_paise: Math.round(price * (currency === 'USD' ? 83 : 1) * 100), // rough USD→INR
      old_price_paise: raw.original_price ? Math.round(raw.original_price.value * 100) : null,
      category: raw.category_name ?? 'collectibles',
      shop_name: raw.seller ?? 'eBay Seller',
      shop_icon: 'https://www.ebay.com/favicon.ico',
      product_link: raw.item_url ?? raw.link,
      rating: raw.seller_feedback_percentage ? raw.seller_feedback_percentage / 20 : null, // % → 5-star
      reviews: raw.seller_feedback_score,
      delivery: raw.shipping,
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

const ebayTool = new EbayTool();

module.exports = { EbayTool, ebayTool };