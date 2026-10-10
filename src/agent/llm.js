// src/agent/llm.js — ChatGroq singleton (Vortex Commerce Task 7).
//
// Single source of truth for the Groq LLM instance used across all agents/tools.
// Model: openai/gpt-oss-20b (configurable via GROQ_MODEL env).

const { ChatGroq } = require('@langchain/groq');

const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const MAX_TOKENS = 2048;
const TEMPERATURE = 0;

let _llm = null;
let _mockLLM = null; // For testing

/**
 * Get or create the ChatGroq instance.
 * @returns {ChatGroq}
 */
function getLLM() {
  if (_mockLLM) return _mockLLM; // Test override
  if (!_llm) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      const err = new Error('GROQ_API_KEY not set in environment');
      err.code = 'AGENT_NOT_CONFIGURED';
      throw err;
    }
    _llm = new ChatGroq({
      apiKey,
      model: MODEL,
      temperature: TEMPERATURE,
      maxTokens: MAX_TOKENS,
    });
  }
  return _llm;
}

/** Set a mock LLM for testing (overrides the real one). */
function setMockLLM(mock) {
  _mockLLM = mock;
}

/** Reset the singleton (for tests). */
function resetLLM() {
  _llm = null;
  _mockLLM = null;
}

module.exports = { getLLM, resetLLM, setMockLLM, MODEL, MAX_TOKENS, TEMPERATURE };