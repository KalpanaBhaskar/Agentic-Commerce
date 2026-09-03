// src/agent/providers/anthropic.js — Claude backend for the checkout agent.
//
// This is the DEFAULT provider (CLAUDE.md §1 locks the stack to Claude). It
// exposes the small neutral interface checkout.js drives:
//   formatTools, initMessages, callModel, formatToolResults
// so the bounded tool-use loop is identical across providers.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('Agent not configured: set ANTHROPIC_API_KEY in .env');
    err.code = 'AGENT_NOT_CONFIGURED';
    throw err;
  }
  const opts = { apiKey };
  // Identity-linked API keys (e.g. free / console keys) must declare which
  // workspace each request acts in via this header, or the API returns 401.
  // Standard (paid) keys don't need it, so we only attach it when
  // ANTHROPIC_WORKSPACE_ID is set — future key swaps need no code change.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  if (workspaceId) opts.defaultHeaders = { 'anthropic-workspace-id': workspaceId };
  _client = new Anthropic(opts);
  return _client;
}

// Anthropic tool schemas are already in {name, description, input_schema} shape.
function formatTools(tools) {
  return tools;
}

function initMessages(userMessage) {
  return [{ role: 'user', content: userMessage }];
}

/**
 * One model turn. Returns a neutral result the shared loop understands.
 * @returns {Promise<{assistantMessage:object, text:string, toolCalls:Array<{id,name,input}>, stop:boolean}>}
 */
async function callModel({ system, tools, messages }) {
  const params = { model: MODEL, max_tokens: MAX_TOKENS, system, messages };
  // Only advertise tools when there are some — this lets the same method serve
  // plain completions (e.g. the upsell pitch) as well as the tool-use loop.
  if (Array.isArray(tools) && tools.length > 0) params.tools = tools;

  const resp = await getClient().messages.create(params);

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const toolCalls = resp.content
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  return {
    // Push the assistant turn back verbatim (required before tool_results).
    assistantMessage: { role: 'assistant', content: resp.content },
    text,
    toolCalls,
    stop: resp.stop_reason !== 'tool_use',
  };
}

// Anthropic wants ALL tool_results for a turn in ONE user message.
function formatToolResults(items) {
  return [
    {
      role: 'user',
      content: items.map((i) => ({
        type: 'tool_result',
        tool_use_id: i.toolCall.id,
        content: JSON.stringify(i.result),
        is_error: !!i.isError,
      })),
    },
  ];
}

module.exports = { name: 'anthropic', MODEL, formatTools, initMessages, callModel, formatToolResults };
