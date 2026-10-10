// src/serp/knowledgeGraph.js — Knowledge Graph adapter (Vortex Commerce Task 3).
//
// Engine: 'knowledge_graph'. Entity disambiguation, brand verification,
// cross-domain enrichment. NON-TRANSACTIONAL — returns context only,
// never shown as a product card.
//
// Input: query containing proper noun / "near X" / brand-verify signal
// Output: { name, type, description, address, lat, lng, website, logo, ... }

const { BaseSerpTool } = require('./base');
const { getJson, config } = require('serpapi');

class KnowledgeGraphTool extends BaseSerpTool {
  constructor(opts = {}) {
    super({ engineName: 'knowledge_graph', ...opts });
    this.vertical = 'contextual';
  }

  buildParams(query, ctx) {
    return {
      engine: 'knowledge_graph',
      q: query,
      api_key: config.api_key,
      hl: ctx.hl ?? 'en',
      gl: ctx.gl ?? 'in',
    };
  }

  /**
   * Extract structured entity info from Knowledge Graph response.
   * Returns a context object (NOT an Item) for the dispatcher.
   * @param {string} query
   * @param {object} ctx
   * @returns {Promise<object|null>}
   */
  async resolveEntity(query, ctx = {}) {
    if (!query || typeof query !== 'string') return null;

    this._ensureConfig();
    if (!config.api_key) return null;

    const params = this.buildParams(query, ctx);
    const traceId = ctx.trace_id || `kg_${Date.now()}`;

    try {
      const json = await getJson(params);
      const entity = this._extractEntity(json);
      if (!entity) return null;

      return {
        name: entity.name,
        type: entity['@type'] ?? entity.type ?? 'Thing',
        description: entity.description ?? entity.detailedDescription?.articleBody ?? '',
        address: entity.address?.streetAddress
          ? `${entity.address.streetAddress}, ${entity.address.addressLocality}, ${entity.address.addressRegion}`
          : entity.address,
        lat: entity.geo?.latitude ? Number(entity.geo.latitude) : null,
        lng: entity.geo?.longitude ? Number(entity.geo.longitude) : null,
        website: entity.url ?? entity.website,
        logo: entity.logo ?? entity.image,
        sameAs: entity.sameAs,
        traceId,
      };
    } catch (err) {
      console.warn('[knowledgeGraph] resolveEntity failed:', err.message);
      return null;
    }
  }

  _extractEntity(json) {
    // SERPAPI KG returns: { knowledge_graph: { ... } }
    const kg = json.knowledge_graph ?? json.knowledgeGraph ?? json;
    if (!kg || typeof kg !== 'object') return null;

    // Prefer the main entity if multiple
    if (kg['@type'] || kg.name) return kg;

    // Sometimes nested under 'entities' array
    if (Array.isArray(kg.entities) && kg.entities.length) {
      return kg.entities[0];
    }

    return null;
  }

  // Required by BaseSerpTool but not used for KG (non-transactional)
  mapResult() {
    return {};
  }
}

const knowledgeGraphTool = new KnowledgeGraphTool();

module.exports = { KnowledgeGraphTool, knowledgeGraphTool };