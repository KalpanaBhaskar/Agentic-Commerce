// src/serp/tripadvisor.js — Tripadvisor adapter (Vortex Commerce Task 3).
//
// Engine: 'tripadvisor'. Reviews, ratings, discovering highly-rated spots.
// Used as primary for 'places_review' and fallback enrich for hotels.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class TripadvisorTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'tripadvisor', ...opts });
    this.vertical = 'places_review';
  }

  buildParams(query, ctx) {
    return {
      engine: 'tripadvisor',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    return {
      id: raw.location_id ?? raw.id,
      name: raw.name ?? raw.title,
      description: `${raw.category ?? 'Attraction'} · ${raw.rating ?? '?'}★ (${raw.review_count ?? 0} reviews)`,
      price_paise: 0, // Tripadvisor doesn't show prices
      old_price_paise: null,
      category: raw.category ?? 'attraction',
      shop_name: raw.name ?? raw.title,
      shop_icon: raw.thumbnail,
      product_link: raw.url ?? raw.link,
      location: raw.address ?? raw.location,
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: raw.open_hours ?? raw.hours,
      thumbnail: raw.thumbnail ?? raw.image,
    };
  }
}

const tripadvisorTool = new TripadvisorTool();

module.exports = { TripadvisorTool, tripadvisorTool };