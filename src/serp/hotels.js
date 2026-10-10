// src/serp/hotels.js — Google Hotels adapter (Vortex Commerce Task 3).
//
// Engine: 'google_hotels'. Traditional hotel properties, room availability,
// pricing tiers, deep property details. Tripadvisor used for review enrich.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class HotelsTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_hotels', ...opts });
    this.vertical = 'hotels';
  }

  buildParams(query, ctx) {
    const { check_in, check_out, adults = 2, children = 0 } = ctx;
    return {
      engine: 'google_hotels',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      check_in_date: check_in ?? new Date().toISOString().slice(0, 10),
      check_out_date: check_out ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      adults,
      children,
      currency: 'INR',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const rate = raw.rate_per_night ?? raw.price ?? {};
    const price = rate.lowest ?? rate.extracted_price ?? 0;

    return {
      id: raw.hotel_id ?? raw.id ?? raw.place_id,
      name: raw.name ?? raw.title,
      description: raw.description ?? raw.snippet ?? `${raw.rating || '?'}★ · ${raw.reviews || 0} reviews`,
      price_paise: Math.round(price * 100),
      old_price_paise: rate.original_price ? Math.round(rate.original_price * 100) : null,
      category: 'hotel',
      shop_name: raw.name ?? raw.title,
      shop_icon: raw.logo ?? raw.thumbnail,
      product_link: raw.link ?? raw.booking_link,
      location: raw.address ?? raw.location ?? raw.neighborhood,
      rating: raw.rating,
      reviews: raw.reviews,
      delivery: `Check-in: ${raw.check_in_time ?? '3 PM'} · Check-out: ${raw.check_out_time ?? '11 AM'}`,
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

const hotelsTool = new HotelsTool();

module.exports = { HotelsTool, hotelsTool };