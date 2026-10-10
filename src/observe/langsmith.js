// src/observe/langsmith.js — LangSmith tracing wrapper (Vortex Commerce Task 7.8).
//
// Wraps functions with LangSmith traceable for automatic tracing.
// Requires LANGCHAIN_TRACING_V2=true, LANGCHAIN_PROJECT, LANGSMITH_API_KEY in env.

let _traceable = null;
let _initialized = false;

/**
 * Get the traceable function (lazy init).
 * @returns {Function} traceable wrapper or identity if not configured.
 */
function getTraceable() {
  if (!_initialized) {
    _initialized = true;
    try {
      if (process.env.LANGCHAIN_TRACING_V2 === 'true' && process.env.LANGSMITH_API_KEY) {
        const { traceable } = require('langsmith/traceable');
        _traceable = traceable;
        console.info('[langsmith] tracing enabled');
      } else {
        console.info('[langsmith] tracing disabled (set LANGCHAIN_TRACING_V2=true and LANGSMITH_API_KEY)');
        _traceable = (fn) => fn; // no-op
      }
    } catch (e) {
      console.warn('[langsmith] failed to load:', e.message);
      _traceable = (fn) => fn;
    }
  }
  return _traceable;
}

/**
 * Wrap a function with LangSmith tracing.
 * @param {Function} fn
 * @param {object} [options] — { name, run_type, tags, metadata }
 * @returns {Function}
 */
function trace(fn, options = {}) {
  const traceable = getTraceable();
  return traceable(fn, options);
}

/** Flush any pending traces (call on shutdown). */
async function flush() {
  try {
    const { Client } = require('langsmith');
    if (process.env.LANGSMITH_API_KEY) {
      const client = new Client({ apiKey: process.env.LANGSMITH_API_KEY });
      await client.flush();
    }
  } catch (_) {}
}

module.exports = { trace, flush, getTraceable };