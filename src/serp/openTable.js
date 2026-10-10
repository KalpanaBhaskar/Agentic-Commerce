// src/serp/openTable.js — OpenTable adapter (Vortex Commerce Task 3).
//
// Engine: 'opentable'. Restaurant bookings and dining reservation data.
// Fallback for restaurants_booking.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class OpenTableTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'opentable', ...opts });
    this.vertical = 'restaurants_booking';
  }

  buildParams(query, ctx) {
    const { date, time, party_size = 2 } = ctx;
    return {
      engine: 'opentable',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      date: date ?? new Date().toISOString().slice(0, 10),
      time: time ?? '19:00',
      party_size,
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.restaurant_id ?? raw.id,
      name: raw.name,
      description: `${raw.cuisine ?? 'Restaurant'} · ${raw.rating ?? '?'}★ (${raw.review_count ?? 0} reviews) · ${raw.price_range ?? ''}`,
      price_paise: 0,
      old_price_paise: null,
      category: 'restaurant',
      shop_name: raw.name,
      shop_icon: raw.image_url,
      product_link: raw.reservation_url ?? raw.url,
      location: raw.address?.street ? `${raw.address.street}, ${raw.address.city}` : raw.neighborhood,
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: `Reservations for ${raw.party_size ?? 2} at ${raw.time ?? '7:00 PM'}`,
      thumbnail: raw.image_url ?? raw.thumbnail,
    };
  }
}

const openTableTool = new OpenTableTool();

module.exports = { OpenTableTool, openTableTool };