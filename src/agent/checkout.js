// src/agent/checkout.js — conversational checkout agent (Feature 4).
//
// processCheckout() runs a BOUNDED tool-use loop: the model may act ONLY through
// the four tools in tools.js (search / order / upsell / status). We execute each
// tool for real, feed the results back, and repeat until the model stops.
//
// The model PROVIDER is pluggable (Anthropic by default; Groq for free testing),
// but the tools, the bounded loop, and the audit trail are identical either way
// — the "agent can't act outside its tool schemas" guarantee (§0) holds for both.
// Orders are only ever created through create_order, and every order is audited.

const crypto = require('crypto');

const { loadCatalog } = require('../catalog');
const { TOOLS, executeTool } = require('./tools');
const { getProvider } = require('./providers');

const MAX_TURNS = 8; // safety bound on the agentic loop

// Base persona + operating rules (CLAUDE.md §4). We embed a SLIM catalog index
// (no long descriptions, no ids) so the model has product context cheaply but
// must still call search_catalog to resolve a product's id before ordering —
// which keeps the "bounded tool use" flow genuine and the prompt small enough
// for tight free-tier token budgets.
function buildSystemPrompt() {
  const index = loadCatalog()
    .map((p) => {
      const rupees = Math.round(p.price_paise / 100).toLocaleString('en-IN');
      const tags = Array.isArray(p.tags) ? p.tags.join(', ') : '';
      return `- ${p.name} | ₹${rupees} | ${p.category} | ${tags}`;
    })
    .join('\n');
  return [
    'You are RazorAgent, an AI commerce assistant for a merchant. Help customers ' +
      'find and purchase products. When a customer wants to buy something, look it ' +
      "up, create the order, and suggest add-ons. Always briefly explain what you're doing.",
    '',
    'You may act ONLY through your tools (search_catalog, create_order, ' +
      'get_upsell_suggestions, get_order_status). Never claim to have placed an ' +
      'order or looked up a status without calling the matching tool.',
    '',
    'Order flow: call search_catalog to find the product and its id, then call ' +
      'create_order with that product_id. When the customer clearly wants to buy, ' +
      'proceed and create the order right away — default quantity to 1 if they did ' +
      'not specify one (do not stop to ask). After creating an order, call ' +
      'get_upsell_suggestions for that product and briefly mention any add-ons.',
    '',
    'All money is in paise (1 rupee = 100 paise). Show prices to the customer in ' +
      'rupees (₹). Keep replies concise.',
    '',
    'Products this merchant sells (call search_catalog for full details + ids):',
    '<catalog>',
    index,
    '</catalog>',
  ].join('\n');
}

/**
 * Run the conversational checkout agent for one user message.
 * @param {string} userMessage   the customer's plain-language message
 * @param {string} [sessionId]   optional; a UUID is generated if omitted
 * @returns {Promise<{response_text:string, order_id:(string|null), payment_link:(string|null), tools_used:string[], session_id:string}>}
 */
async function processCheckout(userMessage, sessionId) {
  const session_id = sessionId || crypto.randomUUID();
  const provider = getProvider();
  const system = buildSystemPrompt();
  const tools = provider.formatTools(TOOLS);
  const messages = provider.initMessages(userMessage);

  const tools_used = [];
  let order_id = null;
  let payment_link = null;
  let response_text = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { assistantMessage, text, toolCalls, stop } = await provider.callModel({
      system,
      tools,
      messages,
    });

    if (text) response_text = text; // keep the latest prose as the reply + reasoning
    messages.push(assistantMessage); // record the assistant turn before tool results

    if (stop || !toolCalls.length) break;

    // Execute every tool call, collect results to feed back next turn.
    const items = [];
    for (const tc of toolCalls) {
      tools_used.push(tc.name);
      let result;
      let isError = false;
      try {
        // `text` is the model's explanation this turn -> audited as the order's reasoning.
        result = await executeTool(tc.name, tc.input, { reasoning: text, session_id });
        if (tc.name === 'create_order' && result && result.order_id) {
          order_id = result.order_id;
          payment_link = result.payment_link || payment_link;
        }
      } catch (e) {
        // Surface the error back to the model so it can recover (apologise,
        // suggest an alternative) rather than crash the request.
        isError = true;
        result = { error: e.code || 'tool_error', message: e.message };
      }
      items.push({ toolCall: tc, result, isError });
    }
    messages.push(...provider.formatToolResults(items));
  }

  if (!response_text) {
    response_text =
      'Sorry — I could not complete that just now. Please try rephrasing what you would like to buy.';
  }

  return { response_text, order_id, payment_link, tools_used, session_id };
}

module.exports = { processCheckout, buildSystemPrompt };
