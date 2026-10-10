// src/observe/langfuse.js — Langfuse observation wrapper (Vortex Commerce Task 7.8).
//
// Wraps functions with Langfuse observe for scoring/cost tracking.
// Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL in env.

// Dynamic import to avoid Jest ESM issues
let _langfuse = null;
let _enabled = false;

async function getLangfuse() {
  if (_langfuse) return _langfuse;
  if (!_enabled) return null;
  
  try {
    const langfuse = await import('langfuse');
    _langfuse = langfuse;
    return langfuse;
  } catch (e) {
    console.warn('[langfuse] dynamic import failed:', e.message);
    _enabled = false;
    return null;
  }
}

function init() {
  if (_enabled) return;
  try {
    if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY) {
      _enabled = true;
      console.info('[langfuse] observation enabled');
    } else {
      console.info('[langfuse] observation disabled (set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY)');
    }
  } catch (e) {
    console.warn('[langfuse] init failed:', e.message);
  }
}

/**
 * Wrap an async function or object with invoke method with Langfuse observation.
 * @param {Function|Object} fn - Function or object with invoke method
 * @param {object} options — { name, sessionId, metadata, userId }
 * @returns {Function|Object} Wrapped function/object with preserved interface
 */
async function observe(fn, options = {}) {
  init();
  if (!_enabled) return fn;

  const langfuse = await getLangfuse();
  if (!langfuse) return fn;

  // If fn is an object with invoke method (like LangGraph agent), wrap the invoke method
  if (fn && typeof fn === 'object' && typeof fn.invoke === 'function') {
    const originalInvoke = fn.invoke.bind(fn);
    fn.invoke = async (...args) => {
      const trace = langfuse.langfuse?.trace?.({
        name: options.name || 'agent',
        sessionId: options.sessionId,
        userId: options.userId,
        metadata: options.metadata,
        input: args,
      });

      try {
        const result = await originalInvoke(...args);
        trace?.update?.({ output: result, level: 'DEFAULT' });
        return result;
      } catch (err) {
        trace?.update?.({ output: err.message, level: 'ERROR', statusMessage: err.message });
        throw err;
      } finally {
        trace?.end?.();
      }
    };
    return fn;
  }

  // If fn is a function, wrap it directly
  if (typeof fn === 'function') {
    return async (...args) => {
      const trace = langfuse.langfuse?.trace?.({
        name: options.name || fn.name || 'anonymous',
        sessionId: options.sessionId,
        userId: options.userId,
        metadata: options.metadata,
        input: args,
      });

      try {
        const result = await fn(...args);
        trace?.update?.({ output: result, level: 'DEFAULT' });
        return result;
      } catch (err) {
        trace?.update?.({ output: err.message, level: 'ERROR', statusMessage: err.message });
        throw err;
      } finally {
        trace?.end?.();
      }
    };
  }

  return fn;
}

/**
 * Score a trace (for buy_success, image_hit, disambiguation_hit, etc.).
 * @param {string} traceId
 * @param {string} name
 * @param {number} value
 * @param {string} [comment]
 */
async function score(traceId, name, value, comment) {
  init();
  if (!_enabled) return;
  const langfuse = await getLangfuse();
  if (!langfuse) return;
  try {
    await langfuse.langfuse?.score({
      traceId,
      name,
      value,
      comment,
    });
  } catch (e) {
    console.warn('[langfuse] score failed:', e.message);
  }
}

/** Shutdown flush. */
async function shutdown() {
  const langfuse = await getLangfuse();
  if (langfuse) {
    await langfuse.langfuse?.shutdown();
  }
}

module.exports = { observe, score, shutdown, init };