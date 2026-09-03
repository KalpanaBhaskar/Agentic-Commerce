// src/agent/providers/index.js — pick the LLM backend from env.
//
// LLM_PROVIDER=anthropic (default) | groq. Each provider exposes the same
// neutral interface (formatTools, initMessages, callModel, formatToolResults)
// so checkout.js's bounded tool-use loop never changes when you swap backends.

function getProvider() {
  const name = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
  switch (name) {
    case 'groq':
      return require('./groq');
    case 'anthropic':
      return require('./anthropic');
    default: {
      const err = new Error(`Unknown LLM_PROVIDER: ${name} (use "anthropic" or "groq")`);
      err.code = 'AGENT_NOT_CONFIGURED';
      throw err;
    }
  }
}

module.exports = { getProvider };
