// src/agent/providers/groq.js — Groq backend for the checkout agent.
//
// Groq is a FREE, OpenAI-compatible inference API (Llama models with tool
// calling). We use it as a zero-cost stand-in for Claude during testing/demo;
// flip back with LLM_PROVIDER=anthropic once a paid Claude key is available.
// No SDK dependency — we call the REST endpoint with the built-in fetch.
//
// The tool schemas, the bounded loop, and the audit trail are unchanged; only
// the wire format differs (OpenAI-style tools / tool_calls / role:"tool").

const GROQ_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions';
// gpt-oss-20b is a strong OpenAI-compatible tool-caller that stays well under
// Groq's free-tier 8000 TPM budget (a full checkout ≈ 5k tokens). Override with
// GROQ_MODEL (e.g. openai/gpt-oss-120b for stronger reasoning at higher cost).
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const MAX_TOKENS = 1024;

function getKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    const err = new Error('Agent not configured: set GROQ_API_KEY in .env (LLM_PROVIDER=groq)');
    err.code = 'AGENT_NOT_CONFIGURED';
    throw err;
  }
  return key;
}

function safeParseArgs(s) {
  try {
    return JSON.parse(s || '{}');
  } catch (_) {
    return {}; // malformed tool args -> empty input; executeTool will validate
  }
}

// Anthropic {name, description, input_schema} -> OpenAI {type:function, function:{...}}
function formatTools(tools) {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

function initMessages(userMessage) {
  return [{ role: 'user', content: userMessage }];
}

/**
 * One model turn via Groq's chat/completions. Returns the same neutral result
 * shape as the Anthropic provider so the shared loop is provider-agnostic.
 */
async function callModel({ system, tools, messages }) {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // OpenAI-style: system is the first message (Anthropic passes it separately).
    messages: [{ role: 'system', content: system }, ...messages],
  };
  // Only advertise tools when there are some — this lets the same method serve
  // plain completions (e.g. the upsell pitch) as well as the tool-use loop.
  // (Sending tool_choice:'auto' with an empty tools list is rejected.)
  if (Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`Groq API ${resp.status}: ${detail.slice(0, 200)}`);
    err.status = resp.status;
    err.code = 'GROQ_ERROR';
    throw err;
  }

  const data = await resp.json();
  if (process.env.GROQ_DEBUG && data.usage) {
    // Per-turn token accounting — handy for staying under free-tier TPM limits.
    const u = data.usage;
    console.error(`[groq] ${MODEL} usage prompt=${u.prompt_tokens} completion=${u.completion_tokens} total=${u.total_tokens}`);
  }
  const choice = (data.choices && data.choices[0]) || {};
  const msg = choice.message || {};
  const text = (msg.content || '').trim();
  const toolCalls = (msg.tool_calls || []).map((c) => ({
    id: c.id,
    name: c.function.name,
    input: safeParseArgs(c.function.arguments),
  }));

  return {
    // Push the assistant message back verbatim; OpenAI format requires each
    // tool_call to be answered by a matching role:"tool" message next turn.
    assistantMessage: msg,
    text,
    toolCalls,
    stop: choice.finish_reason !== 'tool_calls',
  };
}

// OpenAI wants ONE role:"tool" message per tool call (not a combined block).
function formatToolResults(items) {
  return items.map((i) => ({
    role: 'tool',
    tool_call_id: i.toolCall.id,
    content: JSON.stringify(i.result),
  }));
}

module.exports = { name: 'groq', MODEL, formatTools, initMessages, callModel, formatToolResults };
