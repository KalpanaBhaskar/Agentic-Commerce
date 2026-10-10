// src/agent/tools/searchPlacesReview.js — Places review tool (Vortex Commerce Task 7).

const { z } = require('zod');
const { StructuredTool } = require('@langchain/core/tools');
const { dispatchSearch } = require('../../serp');

const SearchPlacesReviewSchema = z.object({
  query: z.string().describe('Place/restaurant/hotel to check reviews for (e.g., "best rated hotels in Tokyo")'),
});

class SearchPlacesReviewTool extends StructuredTool {
  constructor() {
    super({
      name: 'search_places_review',
      description: 'Search Tripadvisor for ratings, reviews, "is X good?", "best rated" queries. Cross-reference user reviews.',
      schema: SearchPlacesReviewSchema,
    });
  }

  async _call({ query }, _config) {
    const result = await dispatchSearch('places_review', query, { trace_id: _config?.runId });
    return JSON.stringify({ items: result.items, engine: result.engineUsed, entityContext: result.entityContext });
  }
}

const searchPlacesReviewTool = new SearchPlacesReviewTool();
module.exports = { SearchPlacesReviewTool, searchPlacesReviewTool };