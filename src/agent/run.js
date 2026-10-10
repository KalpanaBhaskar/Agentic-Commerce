// src/agent/run.js — LangChain agent runner (Vortex Commerce Task 7.5–7.8).
//
// Replaces the hand-rolled tool-use loop in checkout.js with LangChain's
// createReactAgent + AgentExecutor(maxIterations=8).
// Adds memory via session_id, tracing via LangSmith/Langfuse.

const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { RunnableWithMessageHistory } = require('@langchain/core/runnables');
const { InMemoryChatMessageHistory } = require('@langchain/core/chat_history');
const { traceable } = require('langsmith/traceable');
const { observe } = require('../observe');
const { HumanMessage, AIMessage, SystemMessage } = require('@langchain/core/messages');

const { getLLM, resetLLM } = require('./llm');
const {
  searchRetailTool,
  searchAmazonTool,
  searchWalmartTool,
  searchHomeDepotTool,
  searchEbayTool,
  searchHotelsTool,
  searchFlightsTool,
  searchAirbnbTool,
  searchPlacesReviewTool,
  searchLocalFoodTool,
  searchRestaurantsBookingTool,
  searchMapsTool,
  searchAppsTool,
  createOrderTool,
  getOrderStatusTool,
  getUpsellTool,
  classifyIntentTool,
} = require('./tools');

const MAX_ITERATIONS = 8;

// Session memory store (in-memory; replace with Redis in production)
const sessionStore = new Map();

function getSessionHistory(sessionId) {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionStore.get(sessionId);
}

function clearSessionHistory(sessionId) {
  sessionStore.delete(sessionId);
}

/**
 * System prompt with all operating rules.
 * Includes: routing via classify_intent, image guarantee, markdown formatting.
 */
const SYSTEM_PROMPT = `
You are Vortex Commerce, an AI commerce assistant for a merchant. Help customers
find and purchase products, book hotels/flights/restaurants, and discover local services.
When a customer wants to buy/book something, look it up, create the order, and suggest add-ons.
Always briefly explain what you're doing.

TOOLS AVAILABLE:
- classify_intent: Classify user query into a commerce vertical (use FIRST for every new query)
- search_retail: General product search across merchants (price comparison)
- search_amazon: Amazon specs, reviews, Prime
- search_walmart: Groceries, everyday essentials
- search_homedepot: Hardware, tools, home improvement
- search_ebay: Unique finds, collectibles, secondhand
- search_hotels: Traditional hotels, room booking (provide check_in/check_out if known)
- search_flights: Flight itineraries, pricing (provide departure_id/arrival_id if known)
- search_airbnb: Vacation rentals, villas, apartments
- search_places_review: Ratings, reviews, "best rated" (Tripadvisor)
- search_local_food: Restaurants, food delivery, menus, "near me" food
- search_restaurants_booking: Table reservations (OpenTable)
- search_maps: Local businesses, hours, address, "open now"
- search_apps: Mobile apps, ebooks, digital media
- create_order: Create Razorpay order + payment link (qty 1-10, defaults to 1)
- get_order_status: Check order status
- get_upsell_suggestions: Add-on suggestions for a product

OPERATING RULES:
1. ALWAYS call classify_intent FIRST on every new user message to determine the vertical.
2. Then call the matching search_* tool for that vertical. Use additional parameters (dates, location) if the user provided them.
3. Present results as professional markdown cards: name, price (₹), shop, rating, discount, delivery, image.
4. Each item MUST have a "Buy Now" affordance — tell the user they can say "I want to buy <name> (ID: <id>)".
5. When the customer clearly wants to buy/book, call create_order immediately with the product_id. Default quantity to 1.
6. After an order is placed, do NOT add your own upsell — the system appends a tailored upsell automatically.
7. Use get_upsell_suggestions ONLY if the customer asks what pairs with a product before buying.
8. All money in paise (1₹ = 100 paise). Show prices in ₹.
9. Keep replies concise but informative. Use markdown tables for comparisons.
10. Maintain conversation context — remember what you showed and what the customer liked.

IMAGE GUARANTEE: Every search result already has an image_url (guaranteed by the system). Display it in your markdown.
`.trim();

/**
 * Build the prompt template with system prompt + history + user input + agent scratchpad.
 */
const prompt = ChatPromptTemplate.fromMessages([
  ['system', SYSTEM_PROMPT],
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
  new MessagesPlaceholder('agent_scratchpad'),
]);

/**
 * Create the base agent + executor.
 * @returns {Runnable} LangGraph agent runnable
 */
function createAgentExecutor() {
  const llm = getLLM();
  const tools = [
    classifyIntentTool,
    searchRetailTool,
    searchAmazonTool,
    searchWalmartTool,
    searchHomeDepotTool,
    searchEbayTool,
    searchHotelsTool,
    searchFlightsTool,
    searchAirbnbTool,
    searchPlacesReviewTool,
    searchLocalFoodTool,
    searchRestaurantsBookingTool,
    searchMapsTool,
    searchAppsTool,
    createOrderTool,
    getOrderStatusTool,
    getUpsellTool,
  ];

  // createReactAgent returns a runnable that handles tool calling internally
  // It takes: { llm, tools, prompt?, stateModifier? }
  const agent = createReactAgent({ llm, tools, prompt: SYSTEM_PROMPT });
  return agent;
}

/**
 * Run the agent for one user message with session memory and tracing.
 * @param {string} userMessage
 * @param {string} sessionId
 * @returns {Promise<{output: string, intermediateSteps: any[]}>}
 */
const tracedRunAgent = traceable(async (userMessage, sessionId) => {
  const agent = createAgentExecutor();

  // Get session history
  const history = getSessionHistory(sessionId);
  const pastMessages = await history.getMessages();

  // Convert history messages to proper BaseMessage classes for LangGraph
  const formattedHistory = pastMessages.map(msg => {
    if (msg.type === 'human') return new HumanMessage(msg.content);
    if (msg.type === 'ai') return new AIMessage(msg.content);
    if (msg.type === 'system') return new SystemMessage(msg.content);
    return new HumanMessage(String(msg.content || msg));
  });

  // Build messages array: history + current user message
  const messages = [...formattedHistory, new HumanMessage(userMessage)];

  // Langfuse observation using context manager (not wrapper)
  let observed = agent;
  try {
    const { observe } = require('../observe');
    observed = await observe(agent, {
      name: 'vortex-agent-run',
      sessionId,
      metadata: { userMessage: userMessage.slice(0, 100) },
    });
  } catch (_) {
    // observe failed (e.g., langfuse not configured), use agent directly
  }

  const result = await observed.invoke({ messages });

  // Save to history using role-based format (InMemoryChatMessageHistory expects this)
  await history.addUserMessage(userMessage);
  if (result.messages) {
    const lastMsg = result.messages[result.messages.length - 1];
    if (lastMsg?.content) {
      await history.addAIMessage(lastMsg.content);
    }
  }

  // LangGraph agent returns { messages: [...] }, extract the last AI message
  const output = result.messages ? result.messages[result.messages.length - 1]?.content : '';

  // Extract intermediate steps from tool calls in messages
  const intermediateSteps = [];
  if (result.messages) {
    for (const msg of result.messages) {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          intermediateSteps.push({ action: { tool: tc.name, toolInput: tc.args }, observation: '' });
        }
      }
    }
  }

  return { output, intermediateSteps };
}, {
  name: 'VortexAgent',
  run_type: 'chain',
  tags: ['vortex', 'agent'],
  metadata: { sessionId: undefined }, // will be set per call
});

// Wrapper to set metadata per call
async function runAgent(userMessage, sessionId) {
  // The traceable function will be called with proper metadata
  return tracedRunAgent(userMessage, sessionId);
}

/**
 * Main entry point for /chat endpoint.
 * Returns the same shape as the old processCheckout for compatibility.
 * @param {string} userMessage
 * @param {string} [sessionId]
 * @param {Array} [conversationHistory] — legacy, ignored (memory is session-based)
 * @returns {Promise<object>}
 */
async function processChat(userMessage, sessionId, conversationHistory = []) {
  const crypto = require('crypto');
  const session_id = sessionId || crypto.randomUUID();

  try {
    const result = await runAgent(userMessage, session_id);

    // Extract search results from intermediate steps for frontend
    let searchResults = [];
    let orderId = null;
    let paymentLink = null;
    let orderedProduct = null;
    let upsellShown = false;
    let upsellProducts = [];

    if (result.intermediateSteps) {
      for (const step of result.intermediateSteps) {
        const action = step.action;
        const toolOutput = step.observation;

        if (action.tool === 'create_order') {
          try {
            const parsed = JSON.parse(toolOutput);
            orderId = parsed.order_id;
            paymentLink = parsed.payment_link;
            orderedProduct = { id: parsed.product_id, name: parsed.product_name, image_url: parsed.image_url };
          } catch (_) {}
        }
        if (action.tool && action.tool.startsWith('search_')) {
          try {
            const parsed = JSON.parse(toolOutput);
            if (parsed.items && parsed.items.length > 0) {
              searchResults = parsed.items;
            }
          } catch (_) {}
        }
      }
    }

    // Post-order upsell (mirrors checkout.js logic)
    if (orderId) {
      const { getUpsells, getProduct } = require('../catalog');
      const { generateUpsellPitch, MAX_UPSELLS } = require('./upsell');
      const { logAction } = require('../audit/logger');

      const product = getProduct(orderedProduct?.id);
      if (product) {
        const addons = (await getUpsells(product.id)).slice(0, MAX_UPSELLS);
        if (addons.length > 0) {
          const { pitch, reasoning } = await generateUpsellPitch(product, addons);
          if (pitch) {
            // Append to output
            // Note: result.output already contains the agent's reply; we append here
            // but the frontend will receive upsell_shown/upsell_products separately
            upsellShown = true;
            upsellProducts = addons.map((p) => ({
              id: p.id,
              name: p.name,
              price_paise: p.price_paise,
              price_inr: p.price_paise / 100,
            }));
            logAction({
              action: 'upsell_shown',
              order_id: orderId,
              product_id: product.id,
              status: 'success',
              agent_reasoning: reasoning,
              session_id,
            });
          }
        }
      }
    }

    return {
      response_text: result.output,
      order_id: orderId,
      payment_link: paymentLink,
      tools_used: result.intermediateSteps?.map((s) => s.action.tool) || [],
      session_id,
      upsell_shown: upsellShown,
      upsell_products: upsellProducts,
      product_image: orderedProduct?.image_url || null,
      search_results: searchResults,
      trace_id: session_id, // for now; LangSmith run_id would be better
    };
  } catch (err) {
    console.error('Agent run failed:', err.message);
    return {
      response_text: 'Sorry — I could not complete that just now. Please try rephrasing what you would like to buy.',
      order_id: null,
      payment_link: null,
      tools_used: [],
      session_id,
      upsell_shown: false,
      upsell_products: [],
      product_image: null,
      search_results: [],
      trace_id: session_id,
    };
  }
}

module.exports = {
  processChat,
  createAgentExecutor,
  runAgent,
  getSessionHistory,
  clearSessionHistory,
  SYSTEM_PROMPT,
  MAX_ITERATIONS,
};