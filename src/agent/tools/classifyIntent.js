// src/agent/tools/classifyIntent.js — Intent Classifier (Vortex Commerce Task 6).
//
// Classifies user queries into commerce verticals using heuristic + Groq fallback.
// Returns { vertical, confidence, signals } where vertical matches VERTICAL_ENGINES keys.
// Low confidence (< 0.6) falls back to 'retail_general'.
// Does not use LangChain StructuredTool to avoid schema validation issues; 
// plain async function compatible with agent pipeline.

const { ChatGroq } = require('@langchain/groq');

// Vertical enum matching VERTICAL_ENGINES keys from src/serp/router.js
const VERTICALS = [
  'retail_general',
  'amazon',
  'walmart',
  'homedepot',
  'ebay',
  'hotels',
  'flights',
  'airbnb',
  'places_review',
  'local_food',
  'restaurants_booking',
  'maps_local',
  'apps_digital',
  'unknown',
];

const CLASSIFY_SYSTEM_PROMPT = `
You are an intent classifier for Vortex Commerce, a multi-vertical agentic commerce platform.
Classify the user's query into exactly ONE vertical from the list below.

VERTICALS AND THEIR DOMAINS:
- retail_general: General product shopping, price comparison, no specific merchant preference
- amazon: User explicitly wants Amazon (specs, reviews, Prime, "on Amazon")
- walmart: Groceries, everyday essentials, department store goods
- homedepot: Hardware, tools, home improvement, building materials
- ebay: Unique finds, collectibles, secondhand, vintage, refurbished
- hotels: Traditional hotels, room booking, amenities, check-in/out
- flights: Flight search, itineraries, airline pricing, routing
- airbnb: Vacation rentals, villas, apartments, unique stays, hosts
- places_review: Ratings, reviews, "is X good?", "best rated", Tripadvisor-style queries
- local_food: Restaurants, food delivery, menus, cuisine search, "near me" food
- restaurants_booking: Table reservations, OpenTable, booking a specific time/party size
- maps_local: Local businesses, hours, address, storefronts, "open now", services
- apps_digital: Mobile apps, ebooks, digital media, software downloads
- unknown: Cannot determine intent, ambiguous query

RULES:
1. If user mentions a specific merchant/platform by name -> that vertical
2. If query has location intent ("near", "in [city]", "nearby") + food/restaurant -> local_food
3. If query has location intent + booking/reservation -> restaurants_booking
4. If query has location intent + hotel/stay -> hotels or airbnb (prefer hotels for traditional)
5. If query mentions flights/airlines/airport codes -> flights
6. If query asks for reviews/ratings/"best" -> places_review
7. If query mentions apps/software/download -> apps_digital
8. Default to retail_general for generic product queries
9. Use 'unknown' only if truly ambiguous

Return JSON with: vertical, confidence (0-1), signals (array of matched phrases).
`.trim();

/**
 * Heuristic classification for obvious cases (saves tokens).
 * @param {string} query
 * @returns {{vertical: string, confidence: number, signals: string[]}}
 */
function heuristicClassify(query) {
  const q = query.toLowerCase();
  const signals = [];

  // Merchant-specific
  if (/\bamazon\b/.test(q)) return { vertical: 'amazon', confidence: 0.95, signals: ['amazon'] };
  if (/\bwalmart\b/.test(q)) return { vertical: 'walmart', confidence: 0.95, signals: ['walmart'] };
  if (/\bhome\s*depot\b/.test(q)) return { vertical: 'homedepot', confidence: 0.95, signals: ['home depot'] };
  if (/\bebay\b/.test(q)) return { vertical: 'ebay', confidence: 0.95, signals: ['ebay'] };
  if (/\bairbnb\b/.test(q)) return { vertical: 'airbnb', confidence: 0.95, signals: ['airbnb'] };
  if (/\bopentable\b/.test(q)) return { vertical: 'restaurants_booking', confidence: 0.95, signals: ['opentable'] };
  if (/\btripadvisor\b/.test(q)) return { vertical: 'places_review', confidence: 0.95, signals: ['tripadvisor'] };
  if (/\byelp\b/.test(q)) return { vertical: 'local_food', confidence: 0.9, signals: ['yelp'] };

  // Category patterns
  if (/\b(hotel|motel|inn|resort|stay|accommodation)\b/.test(q)) {
    signals.push('hotel');
    if (/\b(villa|apartment|home|rental|host)\b/.test(q)) {
      return { vertical: 'airbnb', confidence: 0.8, signals: [...signals, 'vacation rental'] };
    }
    return { vertical: 'hotels', confidence: 0.85, signals };
  }

  if (/\b(flight|fly|airline|airport|itinerary)\b/.test(q)) {
    return { vertical: 'flights', confidence: 0.9, signals: ['flight'] };
  }

  if (/\b(restaurant|food|eat|cuisine|delivery|takeout|menu)\b/.test(q)) {
    signals.push('food');
    if (/\b(book|reserve|reservation|table|party\s+of)\b/.test(q)) {
      return { vertical: 'restaurants_booking', confidence: 0.85, signals: [...signals, 'booking'] };
    }
    return { vertical: 'local_food', confidence: 0.8, signals };
  }

  if (/\b(review|rating|rated|stars|best|top)\b/.test(q)) {
    return { vertical: 'places_review', confidence: 0.75, signals: ['review'] };
  }

  if (/\b(app|software|download|ebook|digital)\b/.test(q)) {
    return { vertical: 'apps_digital', confidence: 0.8, signals: ['digital'] };
  }

  // Location-aware patterns (must come before generic product check)
  // Extended location triggers including "open now", "hours", etc.
  if (/\b(near|nearby|close\s+to|around|in\s+\w+|downtown|uptown|open\s+now|hours?)\b/.test(q)) {
    signals.push('location');
    // Location + food -> local_food
    if (/\b(restaurant|food|eat|cuisine|delivery|takeout|menu)\b/.test(q)) {
      return { vertical: 'local_food', confidence: 0.8, signals: [...signals, 'food'] };
    }
    // Location + business -> maps_local
    if (/\b(store|shop|mall|business|service|hours?|open)\b/.test(q)) {
      return { vertical: 'maps_local', confidence: 0.7, signals: [...signals, 'local business'] };
    }
    // Location + generic -> retail_general (with location signal)
    return { vertical: 'retail_general', confidence: 0.6, signals: [...signals, 'location'] };
  }

  if (/\b(villa|apartment|home\s+rental|vacation\s+rental)\b/.test(q)) {
    return { vertical: 'airbnb', confidence: 0.8, signals: ['vacation rental'] };
  }

  // Generic product query
  if (/\b(buy|purchase|order|shop|price|cost|cheap|deal|product|item)\b/.test(q)) {
    return { vertical: 'retail_general', confidence: 0.7, signals: ['product query'] };
  }

  return { vertical: 'retail_general', confidence: 0.5, signals: ['fallback'] };
}

/**
 * Classify intent using Groq LLM.
 * @param {string} query
 * @returns {Promise<{vertical: string, confidence: number, signals: string[]}>}
 */
async function classifyWithGroq(query) {
  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    temperature: 0,
    maxTokens: 200,
  });

  const messages = [
    { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
    { role: 'user', content: `Query: "${query}"` },
  ];

  const response = await llm.invoke(messages);
  const content = response.content?.toString().trim() || '{}';
  
  try {
    const parsed = JSON.parse(content);
    // Validate vertical is in our enum
    if (!VERTICALS.includes(parsed.vertical)) {
      parsed.vertical = 'retail_general';
      parsed.confidence = Math.min(parsed.confidence || 0.5, 0.5);
    }
    // Clamp confidence
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));
    // Fallback for low confidence
    if (parsed.confidence < 0.6) {
      parsed.vertical = 'retail_general';
      parsed.confidence = Math.max(parsed.confidence, 0.5);
      parsed.signals = [...(parsed.signals || []), 'low_confidence_fallback'];
    }
    return parsed;
  } catch (e) {
    // Fallback to heuristic on parse error
    return heuristicClassify(query);
  }
}

/**
 * Main classification function: heuristic first, then Groq if needed.
 * @param {string} query
 * @returns {Promise<{vertical: string, confidence: number, signals: string[]}>}
 */
async function classifyIntent(query) {
  if (!query || typeof query !== 'string') {
    return { vertical: 'retail_general', confidence: 0.5, signals: ['empty_query'] };
  }

  // Quick heuristic pre-check for obvious cases (saves tokens)
  const heuristic = heuristicClassify(query);
  if (heuristic.confidence >= 0.9) {
    return heuristic;
  }

  // Use Groq for ambiguous cases
  return classifyWithGroq(query);
}

module.exports = { classifyIntent, heuristicClassify, VERTICALS, CLASSIFY_SYSTEM_PROMPT };