// src/catalog/index.js — catalog loader, search, and upsell resolver.
// Now uses SERPAPI for dynamic product search, with catalog.json as fallback.

const fs = require('fs');
const path = require('path');
const { searchProducts, getRelatedProducts } = require('./serpapi');

const CATALOG_PATH = path.join(__dirname, 'catalog.json');

// In-memory cache for SERPAPI products (transient product data)
const serpapiCache = new Map();

/**
 * Load and parse the full catalog from disk.
 * Read fresh on every call so edits to catalog.json take effect without restart.
 * @returns {Array<object>} array of product objects
 */
function loadCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Search the catalog for products matching a free-text query.
 * Now uses SERPAPI for dynamic product search (returns top 10 results).
 * Falls back to static catalog if SERPAPI is not configured.
 * @param {string} query
 * @returns {Promise<Array<object>>} matching products, best match first (empty if none)
 */
async function searchCatalog(query) {
  if (!query || typeof query !== 'string') return [];

  // Try SERPAPI first if API key is configured
  if (process.env.SERPAPI_API_KEY) {
    try {
      const results = await searchProducts(query, 10);
      if (results.length > 0) {
        // Cache the results for later getProduct calls
        results.forEach((product) => {
          serpapiCache.set(product.id, product);
        });
        return results;
      }
    } catch (error) {
      console.warn('SERPAPI search failed, falling back to static catalog:', error.message);
    }
  }

  // Fallback to static catalog search if SERPAPI fails or not configured
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return loadCatalog()
    .map((product) => {
      const haystack = [
        product.name,
        product.description,
        product.category,
        ...(product.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      const score = terms.reduce(
        (acc, term) => acc + (haystack.includes(term) ? 1 : 0),
        0
      );
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
}

/**
 * Fetch a single product by its id.
 * Checks SERPAPI cache first (for dynamic products), then falls back to static catalog.
 * @param {string} id
 * @returns {object|null}
 */
function getProduct(id) {
  if (!id) return null;

  // Check SERPAPI cache first (for dynamic products)
  if (serpapiCache.has(id)) {
    return serpapiCache.get(id);
  }

  // Fallback to static catalog
  return loadCatalog().find((product) => product.id === id) || null;
}

/**
 * Resolve the upsell/cross-sell products for a given product id.
 * For SERPAPI products, uses related product search.
 * For static catalog products, returns the full product objects referenced by upsell_ids
 * (skips any dangling ids that don't resolve).
 * @param {string} product_id
 * @returns {Promise<Array<object>>}
 */
async function getUpsells(product_id) {
  const product = getProduct(product_id);
  if (!product) return [];

  // If it's a SERPAPI product, get related products dynamically
  if (product.source === 'serpapi') {
    try {
      const related = await getRelatedProducts(product.name, 5);
      return related;
    } catch (error) {
      console.warn('Failed to get related products:', error.message);
      return [];
    }
  }

  // For static catalog products, use upsell_ids
  const catalog = loadCatalog();
  return (product.upsell_ids || [])
    .map((upsellId) => catalog.find((p) => p.id === upsellId))
    .filter(Boolean);
}

module.exports = { loadCatalog, searchCatalog, getProduct, getUpsells, CATALOG_PATH };
