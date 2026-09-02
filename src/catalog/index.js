// src/catalog/index.js — catalog loader, search, and upsell resolver.
// catalog.json is the SINGLE SOURCE OF TRUTH. This module never duplicates
// product data; it only reads and queries the JSON file.

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'catalog.json');

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
 * Scores each product by how many query terms appear in its
 * name / description / category / tags, then sorts by score desc.
 * @param {string} query
 * @returns {Array<object>} matching products, best match first (empty if none)
 */
function searchCatalog(query) {
  if (!query || typeof query !== 'string') return [];

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
 * @param {string} id
 * @returns {object|null}
 */
function getProduct(id) {
  if (!id) return null;
  return loadCatalog().find((product) => product.id === id) || null;
}

/**
 * Resolve the upsell/cross-sell products for a given product id.
 * Returns the full product objects referenced by upsell_ids
 * (skips any dangling ids that don't resolve).
 * @param {string} product_id
 * @returns {Array<object>}
 */
function getUpsells(product_id) {
  const product = getProduct(product_id);
  if (!product) return [];

  const catalog = loadCatalog();
  return (product.upsell_ids || [])
    .map((upsellId) => catalog.find((p) => p.id === upsellId))
    .filter(Boolean);
}

module.exports = { loadCatalog, searchCatalog, getProduct, getUpsells, CATALOG_PATH };
