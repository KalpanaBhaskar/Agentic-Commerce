// src/serp/flights.js — Google Flights adapter (Vortex Commerce Task 3).
//
// Engine: 'google_flights'. Flight itineraries, pricing insights, routing options.
// Price is "from" price — price_paise = 0 (price-on-request).

const { BaseSerpTool } = require('./base');
const { coerceToItem } = require('./types');
const { config } = require('serpapi');

class FlightsTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'google_flights', ...opts });
    this.vertical = 'flights';
  }

  buildParams(query, ctx) {
    const { departure_id, arrival_id, outbound_date, return_date, adults = 1 } = ctx;
    return {
      engine: 'google_flights',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
      departure_id: departure_id || (query.includes('→') ? query.split('→')[0].trim() : ''),
      arrival_id: arrival_id || (query.includes('→') ? query.split('→')[1].trim() : ''),
      outbound_date: outbound_date ?? new Date().toISOString().slice(0, 10),
      return_date: return_date,
      adults,
      currency: 'INR',
      num: ctx.num ?? 10,
    };
  }

  mapResult(raw, ctx) {
    const price = raw.price ?? raw.lowest_price ?? 0;

    return {
      id: raw.flight_id ?? raw.id,
      name: `${raw.airline ?? 'Airline'} · ${raw.departure_airport?.code ?? ''} → ${raw.arrival_airport?.code ?? ''}`,
      description: `${raw.departure_time ?? ''} – ${raw.arrival_time ?? ''} · ${raw.duration ?? ''} · ${raw.stops ?? 'Direct'}`,
      price_paise: Math.round(price * 100),
      old_price_paise: null,
      category: 'flight',
      shop_name: raw.airline,
      shop_icon: raw.airline_logo,
      product_link: raw.link ?? raw.booking_link,
      location: `${raw.departure_airport?.name ?? ''} → ${raw.arrival_airport?.name ?? ''}`,
      rating: null,
      reviews: null,
      delivery: `Departs ${raw.outbound_date ?? ''}${raw.return_date ? ` · Returns ${raw.return_date}` : ''}`,
      thumbnail: raw.airline_logo ?? raw.thumbnail,
    };
  }
}

const flightsTool = new FlightsTool();

module.exports = { FlightsTool, flightsTool };