// src/serp/types.js — canonical Item contract (Vortex Commerce Task 3).
//
// Every vertical adapter MUST return objects matching this shape. The
// ImageEnricher guarantees `image_url` is non-null before the item reaches
// the agent/frontend. Old fields (`thumbnail`, `source`, etc.) are kept for
// backward compatibility but deprecated — new code uses the fields below.
//
// See docs/VORTEX_ARCHITECTURE.md §4 for the full contract rationale.

/**
 * @typedef {object} Item
 * @property {string} id                    // engine product_id or serp_<ts>_<i>
 * @property {string} name                  // display name
 * @property {string} description           // ≤500 chars
 * @property {number} price_paise           // integer paise; 0 if price-on-request
 * @property {'INR'} currency               // locked to INR for now
 * @property {string} category              // vertical name (e.g. "hotels")
 * @property {string} vertical              // classifier vertical (e.g. "hotels")
 * @property {string} engine                // serp engine actually used (e.g. "google_hotels")
 * @property {string|null} shop_name        // merchant / hotel / restaurant name
 * @property {string|null} shop_icon        // favicon / logo URL
 * @property {string|null} product_link     // deep link to merchant page
 * @property {string|null} location         // hotels/restaurants/maps: address/area
 * @property {number|null} rating           // 0-5 scale
 * @property {number|null} reviews          // review count
 * @property {string|null} delivery         // delivery info / check-in time
 * @property {number|null} old_price_paise  // was-price for discount calc
 * @property {number|null} discount_pct     // computed (old - new) / old * 100
 * @property {string} image_url             // GUARANTEED non-null after ImageEnricher
 * @property {'serpapi'} source             // constant
 * @property {string} trace_id              // LangSmith run id for observability
 */

// Field order matches the table in VORTEX_ARCHITECTURE.md §4
const ITEM_KEYS = Object.freeze([
  'id', 'name', 'description', 'price_paise', 'currency',
  'category', 'vertical', 'engine', 'shop_name', 'shop_icon',
  'product_link', 'location', 'rating', 'reviews', 'delivery',
  'old_price_paise', 'discount_pct', 'image_url', 'source', 'trace_id',
]);

/**
 * Validate an object has all required Item keys (non-null for required fields).
 * Optional/nullable fields may be missing or null — caller decides.
 * @param {object} obj
 * @returns {boolean}
 */
function isValidItem(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const required = ['id', 'name', 'description', 'price_paise', 'currency',
    'category', 'vertical', 'engine', 'source'];
  return required.every((k) => obj[k] !== undefined && obj[k] !== null && obj[k] !== '');
}

/**
 * Coerce a raw adapter result into a valid Item, filling safe defaults.
 * Does NOT fetch images — that's ImageEnricher's job.
 * @param {object} raw
 * @param {object} ctx  { vertical, engine, trace_id }
 * @returns {Item}
 */
function coerceToItem(raw, ctx = {}) {
  const now = Date.now();
  const id = raw.id || raw.product_id || `serp_${now}_${Math.random().toString(36).slice(2, 8)}`;

  const price = Number(raw.price_paise ?? raw.extracted_price_paise ?? raw.price ?? 0);
  const oldPrice = raw.old_price_paise ?? raw.extracted_old_price_paise
    ? Number(raw.old_price_paise ?? raw.extracted_old_price_paise)
    : null;

  const discount = (oldPrice && price && oldPrice > price)
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : null;

  return {
    id,
    name: String(raw.name ?? raw.title ?? 'Untitled').slice(0, 200),
    description: String(raw.description ?? raw.snippet ?? raw.tagline ?? '').slice(0, 500),
    price_paise: Math.round(price),
    currency: 'INR',
    category: String(raw.category ?? raw.vertical ?? ctx.vertical ?? 'general'),
    vertical: String(ctx.vertical ?? 'unknown'),
    engine: String(ctx.engine ?? 'unknown'),
    shop_name: raw.shop_name ?? raw.source ?? raw.merchant_name ?? null,
    shop_icon: raw.shop_icon ?? raw.source_icon ?? raw.merchant_icon ?? null,
    product_link: raw.product_link ?? raw.link ?? raw.url ?? null,
    location: raw.location ?? raw.address ?? raw.area ?? raw.neighborhood ?? null,
    rating: raw.rating !== undefined && raw.rating !== null ? Number(raw.rating) : null,
    reviews: raw.reviews !== undefined && raw.reviews !== null ? Number(raw.reviews) : null,
    delivery: raw.delivery ?? raw.shipping ?? raw.check_in_time ?? null,
    old_price_paise: oldPrice,
    discount_pct: discount,
    image_url: raw.image_url ?? raw.thumbnail ?? raw.image ?? '', // placeholder; enricher fills
    source: 'serpapi',
    trace_id: ctx.trace_id ?? null,
  };
}

module.exports = { ITEM_KEYS, isValidItem, coerceToItem };