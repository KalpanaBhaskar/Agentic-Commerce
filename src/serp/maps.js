// src/serp/maps.js — Google Maps/Local adapter (Vortex Commerce Task 3).
//
// Engines: 'google_maps', 'google_local'. Local businesses, operating hours,
// location-based storefronts. Used for maps_local vertical.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class MapsTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_maps', ...opts });
    this.vertical = 'maps_local';
  }

  buildParams(query, ctx) {
    const { lat, lng, location, type } = ctx;
    return {
      engine: 'google_maps',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      ll: lat && lng ? `@${lat},${lng},14z` : undefined,
      location: location,
      type: type ?? 'establishment',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.place_id ?? raw.id,
      name: raw.title ?? raw.name,
      description: `${raw.type ?? raw.category ?? 'Place'} · ${raw.rating ?? '?'}★ (${raw.reviews ?? 0} reviews)`,
      price_paise: 0,
      old_price_paise: null,
      category: raw.type ?? raw.category ?? 'local_business',
      shop_name: raw.title ?? raw.name,
      shop_icon: raw.thumbnail,
      product_link: raw.link ?? raw.website,
      location: raw.address ?? raw.location,
      rating: raw.rating,
      reviews: raw.reviews,
      delivery: raw.hours ?? raw.open_now ? 'Open now' : 'Closed',
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

class LocalTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_local', ...opts });
    this.vertical = 'maps_local';
  }

  buildParams(query, ctx) {
    const { lat, lng, location } = ctx;
    return {
      engine: 'google_local',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      ll: lat && lng ? `@${lat},${lng},14z` : undefined,
      location: location,
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.place_id ?? raw.id,
      name: raw.title ?? raw.name,
      description: `${raw.type ?? raw.category ?? 'Place'} · ${raw.rating ?? '?'}★ (${raw.reviews ?? 0} reviews)`,
      price_paise: 0,
      old_price_paise: null,
      category: raw.type ?? raw.category ?? 'local_business',
      shop_name: raw.title ?? raw.name,
      shop_icon: raw.thumbnail,
      product_link: raw.link ?? raw.website,
      location: raw.address ?? raw.location,
      rating: raw.rating,
      reviews: raw.reviews,
      delivery: raw.hours ?? raw.open_now ? 'Open now' : 'Closed',
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

const mapsTool = new MapsTool();
const localTool = new LocalTool();

module.exports = { MapsTool, LocalTool, mapsTool, localTool };