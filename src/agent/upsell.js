// src/agent/upsell.js — LLM-written cross-sell pitch (Feature 5).
//
// generateUpsellPitch() turns a just-ordered product + its catalog add-ons into
// a short, friendly upsell line plus an internal reasoning note for the audit
// trail. It runs through the SAME pluggable provider as the checkout agent
// (Groq for free testing, Claude in production) so there's one LLM path to
// reason about — see src/agent/providers/.
//
// It is defensive by design: an empty add-on list, an unavailable model, or an
// unparseable reply all fall back to a clean deterministic pitch, so the
// checkout flow can always continue.

const { getProvider } = require('./providers');

// Show at most this many add-ons in a single pitch (CLAUDE.md §4: "1-2").
const MAX_UPSELLS = 2;

// paise -> "1,999" (Indian digit grouping). Display only; never for maths.
function formatRupees(paise) {
  return Math.round(paise / 100).toLocaleString('en-IN');
}

function buildSystemPrompt() {
  return [
    "You are RazorAgent's cross-sell copywriter for an online store.",
    'Given a product the customer just ordered and one or two related add-on ' +
      'products, write a short, warm upsell.',
    '',
    'Respond with ONLY a compact JSON object — no markdown, no code fences:',
    '{"pitch": "<1-2 sentences to the customer>", "reasoning": "<one internal sentence>"}',
    '',
    'The pitch must: name the add-on(s) naturally, give a concrete reason people ' +
      'pair them with the ordered product, and end with a question inviting the add ' +
      '(e.g. "Want to add it for ₹1,999?"). Use the rupee prices exactly as given.',
    'The reasoning is an internal note (not shown to the customer) explaining why ' +
      'these add-ons suit the order; it is recorded in the audit trail.',
  ].join('\n');
}

function buildUserPrompt(product, addons) {
  const lines = addons.map(
    (p) => `- ${p.name} (₹${formatRupees(p.price_paise)}): ${p.description}`
  );
  return [
    `Ordered product: ${product.name} (₹${formatRupees(product.price_paise)}), category ${product.category}.`,
    '',
    'Candidate add-on(s):',
    ...lines,
  ].join('\n');
}

// Pull the first {...} JSON object out of a model reply that may be wrapped in
// prose or ```json fences. Returns the parsed object, or null if none parses.
function extractJson(text) {
  if (!text) return null;
  const unfenced = text.replace(/```json/gi, ' ').replace(/```/g, ' ');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

/**
 * Generate a customer-facing upsell pitch and an internal reasoning note.
 *
 * @param {object} product         the product the customer just ordered
 * @param {Array<object>} upsellProducts  candidate add-on products (full records)
 * @returns {Promise<{pitch:string, reasoning:string}>}
 *   `pitch` is '' when there is nothing to suggest; callers should skip the
 *   upsell (and the audit line) in that case.
 */
async function generateUpsellPitch(product, upsellProducts) {
  const addons = (upsellProducts || []).slice(0, MAX_UPSELLS);
  if (addons.length === 0) {
    return { pitch: '', reasoning: 'No add-ons available to suggest.' };
  }

  // Deterministic fallback — used verbatim if the model is unavailable or its
  // reply can't be parsed, so we never leak raw/braced text to the buyer.
  const first = addons[0];
  const fallbackPitch =
    `Customers who buy the ${product.name} often add the ${first.name}. ` +
    `Want to add it for ₹${formatRupees(first.price_paise)}?`;
  const fallbackReasoning =
    `Suggested ${addons.map((p) => p.name).join(' and ')} as complementary add-ons for ${product.name}.`;

  try {
    const provider = getProvider();
    const messages = provider.initMessages(buildUserPrompt(product, addons));
    const { text } = await provider.callModel({
      system: buildSystemPrompt(),
      tools: [], // plain completion — no tool use for copywriting
      messages,
    });

    const parsed = extractJson(text);
    if (parsed && typeof parsed.pitch === 'string' && parsed.pitch.trim()) {
      const reasoning =
        typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : fallbackReasoning;
      return { pitch: parsed.pitch.trim(), reasoning };
    }
    return { pitch: fallbackPitch, reasoning: fallbackReasoning };
  } catch (_) {
    return { pitch: fallbackPitch, reasoning: fallbackReasoning };
  }
}

module.exports = { generateUpsellPitch, MAX_UPSELLS };
