// src/serp/apps.js — App Store adapters (Vortex Commerce Task 3).
//
// Engines: 'apple_app_store', 'google_play'. Apps, ebooks, digital media.
// Used for apps_digital vertical.

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class AppleAppStoreTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'apple_app_store', ...opts });
    this.vertical = 'apps_digital';
  }

  buildParams(query, ctx) {
    return {
      engine: 'apple_app_store',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const price = raw.price ?? 0;
    const currency = raw.currency ?? 'INR';

    return {
      id: raw.id ?? raw.app_id,
      name: raw.name ?? raw.title,
      description: raw.description ?? raw.snippet ?? '',
      price_paise: Math.round(price * 100),
      old_price_paise: null,
      category: raw.category ?? raw.primary_genre ?? 'app',
      shop_name: 'Apple App Store',
      shop_icon: 'https://www.apple.com/favicon.ico',
      product_link: raw.url ?? raw.link,
      location: null,
      rating: raw.rating,
      reviews: raw.review_count,
      delivery: `Size: ${raw.size ?? 'N/A'} · ${raw.version ?? ''}`,
      thumbnail: raw.icon ?? raw.thumbnail,
    };
  }
}

class GooglePlayTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_play', ...opts });
    this.vertical = 'apps_digital';
  }

  buildParams(query, ctx) {
    return {
      engine: 'google_play',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const price = raw.price ?? 0;

    return {
      id: raw.app_id ?? raw.id,
      name: raw.title,
      description: raw.description ?? raw.short_description ?? '',
      price_paise: Math.round(price * 100),
      old_price_paise: null,
      category: raw.category ?? raw.genre ?? 'app',
      shop_name: 'Google Play Store',
      shop_icon: 'https://play.google.com/favicon.ico',
      product_link: raw.url ?? raw.link,
      location: null,
      rating: raw.rating,
      reviews: raw.reviews,
      delivery: `Size: ${raw.size ?? 'N/A'} · Installs: ${raw.installs ?? ''}`,
      thumbnail: raw.icon ?? raw.thumbnail,
    };
  }
}

const appleAppStoreTool = new AppleAppStoreTool();
const googlePlayTool = new GooglePlayTool();

module.exports = { AppleAppStoreTool, GooglePlayTool, appleAppStoreTool, googlePlayTool };