// src/serp/homeDepot.js — Home Depot adapter (Vortex Commerce Task 3).
//
// Engine: 'home_depot'. Hardware, home improvement, tools, building materials.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class HomeDepotTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'home_depot', ...opts });
    this.vertical = 'homedepot';
  }

  buildParams(query, ctx) {
    return {
      engine: 'home_depot',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'us',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.product_id ?? raw.id,
      name: raw.title ?? raw.name,
      description: raw.description ?? raw.short_description ?? '',
      price_paise: raw.price ? Math.round(raw.price * 100) : 0,
      old_price_paise: raw.was_price ? Math.round(raw.was_price * 100) : null,
      category: raw.category ?? 'hardware',
      shop_name: 'The Home Depot',
      shop_icon: 'https://www.homedepot.com/favicon.ico',
      product_link: raw.product_url ?? raw.link,
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: raw.availability ?? raw.delivery,
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

const homeDepotTool = new HomeDepotTool();

module.exports = { HomeDepotTool, homeDepotTool };