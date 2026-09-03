// src/agent/checkout.js — conversational checkout agent (Feature 4).
//
// processCheckout() runs a BOUNDED tool_use loop with Claude: the model may act
// ONLY through the four tools in tools.js (search / order / upsell / status).
// We execute each tool for real, feed the results back, and repeat until Claude
// is done (stop_reason !== 'tool_use'). "The agent can't act outside its tool
// schemas" is the guarantee the judges look for (§0) — orders are only ever
// created through create_order, and every order writes an audit line.

const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');

const { loadCatalog } = require('../catalog');
const { TOOLS, executeTool } = require('./tools');

// Model is pinned by the project (CLAUDE.md §1) but overridable via env, so you
// can swap it without a code change if your API key targets a different id.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const MAX_TURNS = 8; // safety bound on the agentic loop

// Lazy singleton client — do NOT construct at module load (env may not be ready
// yet, e.g. under Jest or before dotenv runs). Mirrors the razorpay.js pattern.
let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('Agent not configured: set ANTHROPIC_API_KEY in .env');
    err.code = 'AGENT_NOT_CONFIGURED';
    throw err;
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// Base persona + operating rules (CLAUDE.md §4). The live catalog is embedded so
// Claude has product context without a tool call, but it must STILL call
// create_order to actually place an order.
function buildSystemPrompt() {
  const catalog = JSON.stringify(loadCatalog(), null, 2);
  return [
    'You are RazorAgent, an AI commerce assistant for a merchant. Help customers ' +
      'find and purchase products. When a customer wants to buy something, search ' +
      'the catalog, suggest the right product, and create an order. Always explain ' +
      "what you're doing. After creating an order, check for upsell opportunities.",
    '',
    'You may act ONLY through your tools (search_catalog, create_order, ' +
      'get_upsell_suggestions, get_order_status). Never claim to have placed an ' +
      'order or looked up a status without calling the matching tool.',
    '',
    'All money is in paise (1 rupee = 100 paise). When you show a price to the ' +
      'customer, convert to rupees (₹) so it is readable. Keep replies concise.',
    '',
    'Here is the current merchant catalog for reference — you may answer questions ' +
      'from it directly, but you must still call create_order to place an order:',
    '<catalog>',
    catalog,
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
  const client = getClient();
  const system = buildSystemPrompt();

  const messages = [{ role: 'user', content: userMessage }];
  const tools_used = [];
  let order_id = null;
  let payment_link = null;
  let response_text = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: TOOLS,
      messages,
    });

    // Claude's natural-language explanation this turn = the reasoning we audit
    // against any order it creates in the same turn.
    const reasoning = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (reasoning) response_text = reasoning; // keep the latest prose as the reply

    // Record the assistant turn verbatim (required before we send tool_results).
    messages.push({ role: 'assistant', content: resp.content });

    if (resp.stop_reason !== 'tool_use') {
      break; // end_turn (done) — or max_tokens/stop_sequence; use whatever prose we have
    }

    // Execute every tool_use block, collect the tool_result blocks to send back.
    const toolUses = resp.content.filter((b) => b.type === 'tool_use');
    const toolResults = [];
    for (const tu of toolUses) {
      tools_used.push(tu.name);
      let result;
      let is_error = false;
      try {
        result = await executeTool(tu.name, tu.input, { reasoning, session_id });
        if (tu.name === 'create_order' && result && result.order_id) {
          order_id = result.order_id;
          payment_link = result.payment_link || payment_link;
        }
      } catch (e) {
        // Surface the error to Claude as a tool_result so it can recover
        // (e.g. apologise, suggest an in-stock alternative) rather than crash.
        is_error = true;
        result = { error: e.code || 'tool_error', message: e.message };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result),
        is_error,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (!response_text) {
    response_text =
      'Sorry — I could not complete that just now. Please try rephrasing what you would like to buy.';
  }

  return { response_text, order_id, payment_link, tools_used, session_id };
}

module.exports = { processCheckout, buildSystemPrompt, MODEL };
