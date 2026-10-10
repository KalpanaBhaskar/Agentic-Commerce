// src/serp/airbnb.js — Airbnb adapter (Vortex Commerce Task 3).
//
// Engine: 'airbnb'. Alternative accommodations, unique homes, villas, apartments.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class AirbnbTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'airbnb', ...opts });
    this.vertical = 'airbnb';
  }

  buildParams(query, ctx) {
    const { check_in, check_out, adults = 2, children = 0, min_price, max_price } = ctx;
    return {
      engine: 'airbnb',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      check_in: check_in ?? new Date().toISOString().slice(0, 10),
      check_out: check_out ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      adults,
      children,
      min_price,
      max_price,
      currency: 'INR',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const price = raw.price?.rate ?? raw.price_per_night ?? 0;

    return {
      id: raw.id ?? raw.listing_id,
      name: raw.name ?? raw.title,
      description: `${raw.property_type ?? 'Home'} · ${raw.bedrooms ?? '?'}BR · ${raw.beds ?? '?'} beds · ${raw.bathrooms ?? '?'} bath`,
      price_paise: Math.round(price * 100),
      old_price_paise: null,
      category: 'vacation_rental',
      shop_name: raw.host?.name ?? 'Airbnb Host',
      shop_icon: raw.host?.profile_pic,
      product_link: raw.url ?? raw.link,
      location: raw.address ?? raw.location ?? raw.neighborhood,
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: `Check-in: ${raw.check_in_time ?? '3 PM'} · Check-out: ${raw.check_out_time ?? '11 AM'}`,
      thumbnail: raw.thumbnail ?? raw.image ?? raw.pictures?.[0],
    };
  }
}

const airbnbTool = new AirbnbTool();

module.exports = { AirbnbTool, airbnbTool };