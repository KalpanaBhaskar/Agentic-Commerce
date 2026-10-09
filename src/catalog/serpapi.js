// src/catalog/serpapi.js — SERPAPI-based product search integration
// Uses Google Shopping API to dynamically fetch products instead of static JSON

const { getJson, config } = require('serpapi');
require('dotenv').config();

// Configure SerpApi with API key from environment
config.api_key = process.env.SERPAPI_API_KEY;

/**
 * Search Google Shopping for products matching a query
 * Returns top results (default 10) in catalog-compatible format
 * @param {string} query - Search query for products
 * @param {number} limit - Number of results to return (default: 10)
 * @returns {Promise<Array<object>>} Array of product objects matching catalog schema
 */
async function searchProducts(query, limit = 10) {
  if (!process.env.SERPAPI_API_KEY) {
    throw new Error('SERPAPI_API_KEY not configured in environment');
  }

  try {
    const json = await getJson({
      engine: 'google_shopping',
      q: query,
      api_key: process.env.SERPAPI_API_KEY,
      hl: 'en',
      gl: 'in', // India region for INR pricing
      num: limit,
    });

    if (!json.shopping_results || !Array.isArray(json.shopping_results)) {
      return [];
    }

    // Convert SERPAPI results to catalog schema
    const products = json.shopping_results
      .slice(0, limit)
      .map((result, index) => {
        // Generate a unique ID based on SERPAPI product_id or fallback to hash
        const id = result.product_id || `serp_${Date.now()}_${index}`;

        // Extract price - SERPAPI returns extracted_price as number
        const price = result.extracted_price || 0;
        const price_paise = Math.round(price * 100); // Convert to paise

        // Clean up description - use snippet or title
        const description = result.snippet || result.title || result.tagline || '';

        // Determine category from extensions or tags if available
        const category = result.tag || 'general';

        // Extract shop/source information
        const shopName = result.source || 'Unknown Shop';
        const shopIcon = result.source_icon || null;

        return {
          id,
          name: result.title || 'Unknown Product',
          description: description.substring(0, 500), // Limit description length
          price_paise,
          currency: 'INR',
          category,
          stock: 10, // Default stock for dynamic products
          upsell_ids: [], // Empty for now - upsells can be derived from related searches
          tags: result.extensions || [],
          image_url: result.thumbnail || result.thumbnail || null,
          source: 'serpapi', // Mark as SERPAPI source
          product_link: result.product_link || null,
          shop_name: shopName,
          shop_icon: shopIcon,
          rating: result.rating || null,
          reviews: result.reviews || null,
          delivery: result.delivery || null,
          old_price: result.extracted_old_price ? Math.round(result.extracted_old_price * 100) : null,
          discount: result.extracted_old_price && result.extracted_price
            ? Math.round(((result.extracted_old_price - result.extracted_price) / result.extracted_old_price) * 100)
            : null,
        };
      });

    return products;
  } catch (error) {
    console.error('SERPAPI search error:', error.message);
    throw new Error(`Failed to search products: ${error.message}`);
  }
}

/**
 * Get related products for upsell suggestions using SERPAPI
 * Searches for related products based on the original product name
 * @param {string} productName - Name of the product to find related items for
 * @param {number} limit - Number of related products to return (default: 5)
 * @returns {Promise<Array<object>>} Array of related product objects
 */
async function getRelatedProducts(productName, limit = 5) {
  try {
    // Search for related terms like "accessories", "compatible", "with"
    const relatedQuery = `${productName} accessories related`;
    const products = await searchProducts(relatedQuery, limit);
    return products;
  } catch (error) {
    console.error('Failed to get related products:', error.message);
    return [];
  }
}

module.exports = {
  searchProducts,
  getRelatedProducts,
};
