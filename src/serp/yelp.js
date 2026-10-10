// src/serp/yelp.js — Yelp adapter (Vortex Commerce Task 3).
//
// Engine: 'yelp'. Restaurant reservations, local food delivery, service business
// reviews with full menu support. Also used as fallback for local_food.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class YelpTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'yelp', ...opts });
    this.vertical = 'local_food';
  }

  buildParams(query, ctx) {
    const { location, lat, lng } = ctx;
    return {
      engine: 'yelp',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      location: location ?? (lat && lng ? `${lat},${lng}` : ''),
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const priceRange = raw.price ?? ''; // $, $$, $$$, $$$$

    return {
      id: raw.id ?? raw.alias,
      name: raw.name,
      description: `${raw.categories?.map(c => c.title).join(', ') ?? 'Restaurant'} · ${raw.rating ?? '?'}★ (${raw.review_count ?? 0} reviews)`,
      price_paise: 0, // Yelp doesn't show exact prices
      old_price_paise: null,
      category: raw.categories?.[0]?.title ?? 'food',
      shop_name: raw.name,
      shop_icon: raw.image_url,
      product_link: raw.url,
      location: raw.location?.address1 ? `${raw.location.address1}, ${raw.location.city}` : raw.location?.display_address?.join(', '),
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: raw.transactions?.includes('delivery') ? 'Delivery available' :
                raw.transactions?.includes('pickup') ? 'Pickup available' : null,
      thumbnail: raw.image_url,
    };
  }
}

const yelpTool = new YelpTool();

module.exports = { YelpTool, yelpTool };