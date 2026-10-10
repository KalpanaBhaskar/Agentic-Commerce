# RazorAgent — Full Submission Package + Extended Build Plan

---

## SUBMISSION ANSWERS

---

### Project Name / Title
**RazorAgent — AI-Native Agentic Commerce for Razorpay Merchants**

---

### Project Objectives
*(~150 words)*

Most merchants on Razorpay rely on static storefronts that only work when a human buyer actively searches, clicks, and checks out. That breaks completely in an AI-first world where buyers are agents, not people.

RazorAgent makes a merchant fully transactable by both human and AI buyers. It does this through four objectives:

1. Expose the merchant's product catalog in a structured, LLM-readable format that any AI buyer agent can parse and act on.
2. Let a buyer describe what they want in plain language and have an AI agent handle the full checkout — product match, order creation, and payment — without any UI friction.
3. Proactively grow revenue by having the agent suggest relevant upsells before checkout is confirmed, with a clear reasoning trail the merchant can audit.
4. Make every money action explainable, bounded by typed tool schemas, and recoverable — so the merchant never loses trust or control over their own commerce layer.

---

### 5-Minute Pitch Video — What to Cover (in order)

**Minute 0:00–0:45 — The problem (make judges feel it)**
Open with a single sentence: "Every merchant on Razorpay today needs a human buyer to find, click, and pay. That era is ending." Explain that AI agents are now actively browsing the web and completing transactions — NPCI's UAP is live, Stripe and OpenAI have already published ACP, and agent-to-agent commerce is the open infrastructure problem of 2025. The merchant who isn't set up for an AI buyer will be invisible. That's the problem.

**Minute 0:45–1:30 — What RazorAgent does (one clear sentence, then show it)**
"RazorAgent is an AI layer that sits on top of Razorpay and makes a merchant sellable to any buyer — human or AI." Then immediately open the terminal and hit `GET /catalog`. Show that it returns clean, structured JSON. Say: "Any AI agent in the world can read this, understand what's for sale, and transact."

**Minute 1:30–2:30 — Live demo: conversational checkout**
Send a `POST /chat` with the message "I want noise-cancelling headphones." Show the agent reason through the catalog, pick the right product, create a real Razorpay test-mode order, suggest a upsell ("customers also buy a carry case — want to add it for ₹499?"), and return a payment link. Make it live, not a recording.

**Minute 2:30–3:15 — The audit trail (the trust layer)**
Run `npm run audit` in the terminal. Walk through one row: timestamp, action, amount, product, and the `agent_reasoning` field. Say: "Every money action is logged with the agent's own explanation. The merchant knows exactly what happened and why. This is what 'explainable and bounded' means in practice."

**Minute 3:15–3:45 — Graceful failure demo**
Hit the `/simulate-failure` endpoint. Show the audit log update in sequence: `payment_failed` → `retry_attempted` → `link_sent`. Show the user-friendly message returned. Say: "The agent doesn't crash. It retries, and if that fails, it hands the buyer a payment link and tells them what happened."

**Minute 3:45–4:30 — The frontend: merchant dashboard**
Switch to the browser. Show the live dashboard: catalog editor, real-time audit feed, revenue chart, upsell performance. Say: "The merchant can manage their AI-native store from here, watch revenue grow in real time, and tune which products get upsell priority."

**Minute 4:30–5:00 — Why this wins + close**
"RazorAgent is not a demo of AI features bolted onto a payment flow. It's a reimagining of the merchant's commerce layer for a world where buyers are agents. Every action is bounded, every rupee is traceable, and every failure is handled. This is what agentic commerce looks like on Razorpay." Pause. Done.

---

### Build Challenges & Technical Obstacles
*(~150 words)*

The hardest problem was raw body preservation for webhook verification. Razorpay's HMAC-SHA256 signature verification requires the exact raw bytes of the request body — but Express's JSON middleware parses the body before our webhook handler could read it. Every webhook was failing signature verification. The fix was mounting the `/webhook` route before `express.json()` and using `express.raw()` exclusively for that route. One line of middleware ordering that took hours to debug.

The second challenge was making the Claude tool-use loop reliable. Claude sometimes returns multiple tool calls in a single response, and the agentic loop needed to handle partial tool execution, re-inject results correctly, and not double-create orders if the model hallucinated a second `create_order` call. Solved this by tracking which `tool_use` IDs had already been executed and rejecting duplicates at the tool dispatcher level.

The third was amounts in paise. Razorpay rejects float values silently in some cases. Enforced integer-only paise arithmetic throughout with a single utility function and caught three silent bugs doing it.

---
---

## STANDOUT FEATURE IDEA: Agent-Readable Storefront UI + Merchant Intelligence Dashboard

Here's what pushes this from "good technical demo" to "product someone would actually use."

**The gap in the current 8 sessions:** the agent works over an API but there's no face to it. Judges can see terminal output, but they can't *feel* the product. More importantly, the judging criteria includes "Problem Taste" — picking a real-world merchant problem. A merchant dashboard that shows revenue impact makes that real.

**What to add:**

1. **A clean React frontend** — two views:
   - **Buyer view:** a chat widget where a human buyer types naturally and the checkout agent responds. Shows the upsell suggestion, confirms the order, and shows the payment link. This makes the conversational checkout *tangible*.
   - **Merchant dashboard:** live audit feed (auto-refreshes), catalog editor (add/edit products, set upsell_ids), revenue summary (total orders, total captured, upsell attach rate), and a "failure recovery log."

2. **Upsell intelligence report** (free, no paid APIs) — after 5+ orders, show a simple table: "Product X was upsold Y times, Z% accepted." Built from the audit.log alone. This directly proves revenue growth to judges.

3. **Agent-readable storefront page** — a public `/store` URL that renders the catalog as a human-readable page AND returns `application/json` when called with `Accept: application/json`. This is the ACP concept made visible: one URL, two consumers (human browser + AI agent).

All of this uses zero paid APIs. React (free), Tailwind (free), your existing Express backend (free), audit.log as the database (already built).

---

## EXTENDED SESSION PROMPTS (Session 8 onwards)
### Designed for any coding agent — Claude Code, Cursor, Copilot, etc.
### Every session = one branch + one PR + merge before next session

---

## SESSION 8 — README + Project Documentation
**Branch:** `docs/08-readme-documentation`

```
CONTEXT:
- This is the RazorAgent project. Read CLAUDE.md in the project root completely before starting.
- Features 1–7 are complete and merged to main. The backend is fully working.
- Stack: Node.js 20, Express 4, Razorpay SDK, Anthropic SDK (claude-sonnet-4-6), flat-file persistence.

TASK:
Create the following files exactly as specified. Do not modify any existing src/ files.

FILE 1: README.md (project root)
Include these sections in this order:
1. Project name + one-line description
2. "Why now" paragraph (mention ACP, NPCI UAP, agent-to-agent commerce — 3 sentences max)
3. Architecture section with ASCII diagram showing:
   Buyer → POST /chat → Claude Agent (tool_use) → [search_catalog | create_order | get_upsells] → Razorpay API → audit.log
4. Feature table: 6 rows, columns: Feature | Endpoint | What it does
5. Setup instructions:
   a. Clone repo
   b. npm install
   c. Copy .env.example to .env and fill in values (explain where to get each)
   d. npm run dev
   e. ngrok http 3000 (separate terminal)
   f. Set webhook URL in Razorpay dashboard
6. API reference table: Method | Endpoint | Body | Response — for all routes
7. Test commands: exact curl commands for every endpoint
8. Audit trail section: paste example audit.log output (fabricate realistic sample data)
9. Tech stack table: Layer | Choice | Why
10. Judging criteria checklist: show how the project meets each of the 4 bar requirements

FILE 2: docs/DEMO_SCRIPT.md
A step-by-step guide for the 5-minute pitch video with:
- Exact terminal commands to run at each step
- What to say (1-2 sentences per step)
- Expected output to show
- Fallback if something breaks (e.g. use /simulate-failure if webhook doesn't fire)
8 steps total matching the pitch video outline.

FILE 3: docs/ARCHITECTURE.md
Explain every architectural decision and why:
- Why tool_use instead of plain LLM responses for checkout
- Why flat files instead of a database
- Why raw body must be preserved for webhook verification
- Why amounts must always be in paise
- How the audit trail enforces "explainable and bounded"

FILE 4: .env.example (update if it exists, create if not)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=your_webhook_signing_secret
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
PORT=3000
NGROK_URL=https://xxxx.ngrok.io

COMMIT MESSAGE: docs: README, demo script, architecture docs
PR TITLE: docs: complete project documentation
PR DESCRIPTION: Adds README with setup instructions, demo script for pitch video, architecture decisions doc, and updated .env.example. No code changes.
```

---

## SESSION 9 — React Frontend: Buyer Chat Widget
**Branch:** `feat/09-frontend-chat`

```
CONTEXT:
- Read CLAUDE.md in the project root completely before starting.
- Sessions 1–8 are complete and merged. The backend runs on port 3000.
- The POST /chat endpoint accepts { message: string, session_id?: string } and returns
  { reply: string, order_id?: string, payment_link?: string, upsell_shown: bool, tools_used: [] }
- Stack: Node.js 20, Express 4. We are adding a React frontend now.

TASK:
Add a React frontend for the buyer-facing chat widget. Use Create React App or Vite (your choice — pick whichever is faster to scaffold). Place all frontend code in a top-level `client/` directory.

STEP 1: Scaffold the React app
Run: npm create vite@latest client -- --template react
cd client && npm install
Add Tailwind CSS: npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
Configure tailwind.config.js content to include: ["./src/**/*.{js,jsx}"]

STEP 2: Add a proxy to vite.config.js so /api calls go to Express on port 3000:
export default {
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', rewrite: (path) => path.replace(/^\/api/, '') }
    }
  }
}

STEP 3: Create client/src/components/ChatWidget.jsx
This is the main buyer interface. It must:
- Show a chat window with a message history (user messages right-aligned, agent messages left-aligned)
- Have a text input at the bottom with a Send button
- On send: POST to /api/chat with { message, session_id } (generate UUID session_id on first message, reuse after)
- Show a loading indicator ("RazorAgent is thinking...") while waiting
- If the response includes payment_link: render a prominent "Pay Now →" button that opens the link in a new tab
- If upsell_shown is true: highlight the upsell message with a subtle yellow/amber border
- Show a small badge at the bottom of each agent message listing tools_used (e.g. "used: search_catalog, create_order")
- Style: clean, minimal, white background, Razorpay blue (#2B6CB0) for user messages, light gray for agent messages
- The chat window must be scrollable and auto-scroll to the latest message

STEP 4: Create client/src/App.jsx
Simple layout:
- Header: "RazorAgent" logo text on left, "Merchant Dashboard →" link on right (href="/dashboard", disabled for now)
- Main: render <ChatWidget />
- Footer: "Powered by Razorpay test-mode APIs + Claude AI"

STEP 5: Update server.js to serve the built React app
Add after all routes:
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'client/dist/index.html')));
  }

STEP 6: Add to root package.json scripts:
  "client": "cd client && npm run dev",
  "build:client": "cd client && npm run build",
  "dev:all": "concurrently \"npm run dev\" \"npm run client\""
Install concurrently: npm install -D concurrently

HOW TO TEST:
1. npm run dev:all
2. Open http://localhost:5173
3. Type "I want to buy headphones" and verify:
   - Loading indicator appears
   - Agent response appears with product suggestion
   - If upsell exists, amber border shows
   - "Pay Now" button appears with real Razorpay link
   - tools_used badge shows at bottom of message

COMMIT MESSAGE: feat: buyer chat widget React frontend
PR TITLE: feat: React chat UI for conversational checkout
PR DESCRIPTION: Adds a Vite+React frontend in client/. Buyer can type naturally, agent responds with product match, upsell suggestion, and a Pay Now button. Proxies to Express on port 3000. Run with npm run dev:all.
```

---

## SESSION 10 — Merchant Dashboard: Audit Feed + Revenue Summary
**Branch:** `feat/10-merchant-dashboard`

```
CONTEXT:
- Read CLAUDE.md in the project root completely before starting.
- Session 9 is complete. React frontend exists in client/. npm run dev:all starts both servers.
- The GET /audit endpoint returns an array of audit log entries sorted by timestamp desc.
- Each entry has: timestamp, action, order_id, amount_paise, currency, product_id, status, agent_reasoning.

TASK:
Build the merchant dashboard page at route /dashboard in the React app.

STEP 1: Create client/src/pages/Dashboard.jsx
This page has two sections stacked vertically:

SECTION A — Revenue Summary Cards (top row, 4 cards side by side):
Card 1: "Total Orders" — count of entries where action === "order_created"
Card 2: "Total Captured (₹)" — sum of amount_paise where action === "payment_captured", divide by 100, format as ₹X,XXX
Card 3: "Upsells Shown" — count of entries where action === "upsell_shown"
Card 4: "Failure Recovery Rate" — (count of link_sent / count of payment_failed) * 100, show as X%
All 4 cards: white background, subtle shadow, metric in large bold text, label in small gray text below.

SECTION B — Live Audit Feed (full width below cards):
A table with columns: Time | Action | Order ID | Amount | Status | Agent Reasoning
- Time: format as HH:MM:SS (local time)
- Action: show as a colored badge — order_created=blue, payment_captured=green, upsell_shown=amber, payment_failed=red, retry_attempted=orange, link_sent=teal
- Order ID: show only last 8 chars with "..." prefix (e.g. "...xyz12345")
- Amount: show as ₹X.XX (convert from paise), show "—" if amount_paise is 0 or missing
- Status: success=green text, failed=red text, retried=orange text
- Agent Reasoning: truncate to 60 chars with "..." if longer, full text on hover (title attribute)
Table rows: alternating white/gray-50, newest entry at top.

AUTO-REFRESH: poll GET /api/audit every 5 seconds using setInterval in a useEffect.
Show "Last updated: HH:MM:SS" text above the table, update on each poll.

STEP 2: Update client/src/App.jsx
Add React Router (npm install react-router-dom in client/).
Routes:
- / → ChatWidget (existing)
- /dashboard → Dashboard

Update header "Merchant Dashboard →" link to use <Link to="/dashboard">.
Add "← Buyer Chat" link in dashboard header pointing back to /.

STEP 3: Add a loading state to Dashboard
While first fetch is in progress, show a centered spinner (CSS animation, no external library).
If fetch fails, show "Could not load audit data. Is the server running?" in red.

HOW TO TEST:
1. npm run dev:all
2. Do 2-3 chat interactions in the buyer view to generate audit entries
3. Open http://localhost:5173/dashboard
4. Verify all 4 metric cards show correct numbers
5. Verify audit table shows entries with correct badges and formatting
6. Wait 5 seconds — verify the table auto-refreshes (do a new chat interaction and watch it appear)

COMMIT MESSAGE: feat: merchant dashboard with live audit feed and revenue metrics
PR TITLE: feat: merchant intelligence dashboard
PR DESCRIPTION: Adds /dashboard route with 4 revenue metric cards and a live-updating audit feed. Polls /api/audit every 5 seconds. Shows action badges, formatted amounts, and agent reasoning. No backend changes.
```

---

## SESSION 11 — Agent-Readable Storefront (ACP Concept)
**Branch:** `feat/11-agent-readable-storefront`

```
CONTEXT:
- Read CLAUDE.md in the project root completely before starting.
- Sessions 1–10 complete. Frontend at client/, backend at port 3000.
- The GET /catalog endpoint exists and returns raw catalog JSON.
- We are adding a public storefront page that serves TWO formats from ONE URL.

TASK:
This is the ACP (Agentic Commerce Protocol) concept made visible: one URL that a human
browser renders as a webpage, and an AI agent calls with Accept: application/json to get
structured data it can transact on. This is a talking point with judges.

STEP 1: Modify GET /catalog in server.js (or the catalog router)
Check the Accept header:
  if (req.headers['accept']?.includes('application/json')) {
    return res.json({ catalog: products, agent_instructions: { ... } });
  } else {
    return res.redirect('/store');  // serve the human UI
  }

The agent_instructions object to include in the JSON response:
{
  "agent_instructions": {
    "how_to_buy": "POST /chat with { message: 'I want to buy [product name]', session_id: 'your-uuid' }",
    "how_to_checkout": "The agent will return a payment_link. Open it to complete payment.",
    "currency": "INR",
    "amounts": "All prices in paise. Divide by 100 for INR.",
    "upsells": "Each product has upsell_ids[]. Agent will suggest these automatically.",
    "protocol": "ACP-inspired. This endpoint is machine-readable. Human UI at /store."
  }
}

STEP 2: Create client/src/pages/Storefront.jsx
A clean, public-facing product listing page at route /store.
Layout:
- Header: merchant name ("Demo Electronics Store"), tagline ("Now transactable by AI buyers")
- A small info banner: "This store is AI-native. Call GET /catalog with Accept: application/json to transact programmatically." — style it in a subtle teal/green box.
- Product grid: 2-3 columns, each card shows:
  * Product name (bold)
  * Description (2 lines, truncated)
  * Price in ₹ (convert from paise)
  * Category badge
  * "Buy via AI Chat →" button that opens the chat widget at / with the product name pre-filled as a message
    (use: window.location.href = '/?q=' + encodeURIComponent(product.name))
- Fetch products from GET /api/catalog (will return JSON because the React app calls with json Accept header — this is fine for the frontend)

STEP 3: Update ChatWidget.jsx to read URL query param
On mount, check window.location.search for ?q=.
If present, pre-fill the input with that value and auto-submit after 500ms.
This creates the UX: buyer clicks "Buy via AI Chat →" on the storefront → lands on chat → checkout starts automatically.

STEP 4: Update App.jsx routing
Add route: /store → Storefront
Update header to include "Our Store" link pointing to /store.

STEP 5: Update README.md
Add a section: "Agent-Readable Catalog"
Explain that GET /catalog returns JSON for AI agents and redirects humans to /store.
Include example curl: curl -H "Accept: application/json" http://localhost:3000/catalog

HOW TO TEST:
1. npm run dev:all
2. Open http://localhost:5173/store — verify product grid renders with prices and buttons
3. Click "Buy via AI Chat →" on any product — verify chat opens with product name pre-filled and auto-submits
4. In terminal: curl -H "Accept: application/json" http://localhost:3000/catalog
   Verify it returns JSON with agent_instructions field
5. Open http://localhost:5173/catalog in browser — verify it redirects to /store

COMMIT MESSAGE: feat: agent-readable storefront with dual content negotiation
PR TITLE: feat: ACP-inspired dual-mode storefront
PR DESCRIPTION: GET /catalog now serves JSON to AI agents (Accept: application/json) and redirects humans to /store. The /store page is a clean product listing with "Buy via AI Chat" buttons. Demonstrates the ACP concept: one URL, two consumers.
```

---

## SESSION 12 — Upsell Intelligence Report
**Branch:** `feat/12-upsell-intelligence`

```
CONTEXT:
- Read CLAUDE.md in the project root completely before starting.
- Sessions 1–11 complete. Dashboard exists at /dashboard. Audit log is the data source.
- No paid APIs. All intelligence is derived from audit.log entries alone.

TASK:
Add an "Upsell Intelligence" section to the merchant dashboard. This shows which products
are being upsold, how often, and gives revenue impact numbers. Derived purely from audit.log.

STEP 1: Add GET /analytics endpoint to server.js (or a new src/routes/analytics.js)
This endpoint reads audit.log, parses all JSONL entries, and computes:

{
  "total_revenue_paise": sum of amount_paise where action === "payment_captured",
  "total_orders": count where action === "order_created",
  "upsell_shown_count": count where action === "upsell_shown",
  "failure_count": count where action === "payment_failed",
  "recovered_count": count where action === "link_sent",
  "product_breakdown": [
    {
      "product_id": "prod_001",
      "product_name": "...",  (look up from catalog.json)
      "order_count": N,
      "revenue_paise": N,
      "upsell_shown": N,
      "upsell_revenue_paise": N  (sum of amount_paise for orders where an upsell was shown before capture)
    }
  ],
  "top_upsell_pairs": [
    { "from_product": "...", "to_product": "...", "shown": N }
  ]
}

For upsell_revenue_paise: match upsell_shown entries to subsequent order_created entries
within the same session_id (use the session_id field in audit log).
If no session_id exists in older entries, skip that calculation gracefully.

STEP 2: Add Upsell Intelligence section to client/src/pages/Dashboard.jsx
Below the audit feed table, add a new section titled "Upsell Intelligence".

Sub-section A — Product Revenue Table:
Columns: Product | Orders | Revenue (₹) | Upsells Shown | Upsell Revenue (₹) | Attach Rate
- Attach Rate = (upsell_shown / order_count) * 100, formatted as X%
- Sort by Revenue descending
- If data is empty (no orders yet): show "No orders yet. Start a chat to see data."

Sub-section B — Top Upsell Pairs:
A simple list: "Product A → Product B: shown N times"
Show max 5 pairs sorted by shown count descending.
If empty: hide this sub-section entirely.

Sub-section C — Revenue Impact Summary:
One sentence, dynamically generated from the numbers:
"Upsell suggestions drove ₹X in additional revenue across Y orders (Z% attach rate)."
Style this sentence in bold teal.

STEP 3: Update the auto-refresh in Dashboard.jsx
Also fetch /api/analytics every 5 seconds alongside /api/audit.
Update the analytics section whenever new data arrives.

HOW TO TEST:
1. Do at least 5 chat interactions that trigger upsells (ask for products with upsell_ids)
2. Complete at least 2 payments via the test payment links
3. Open /dashboard and scroll to Upsell Intelligence section
4. Verify product table shows correct counts
5. Verify revenue impact sentence renders with real numbers
6. Check that if no upsell_shown entries exist, the section shows the empty state message gracefully

COMMIT MESSAGE: feat: upsell intelligence report from audit log data
PR TITLE: feat: merchant upsell analytics dashboard
PR DESCRIPTION: Adds GET /analytics endpoint that derives product revenue, upsell attach rates, and top upsell pairs from audit.log. Dashboard shows a live upsell intelligence report. No paid APIs — all computed from existing data.
```

---

## SESSION 13 — Final Polish, Error Boundaries, Demo Hardening
**Branch:** `feat/13-polish-demo-ready`

```
CONTEXT:
- Read CLAUDE.md in the project root completely before starting.
- Sessions 1–12 complete. Full stack: backend + React frontend with chat, dashboard, storefront, analytics.
- This is the final session before submission. Goal: make the demo bulletproof.

TASK:
A series of targeted improvements. Do each one completely before moving to the next.

IMPROVEMENT 1 — React error boundaries
Create client/src/components/ErrorBoundary.jsx:
A class component that catches render errors and shows a friendly message instead of crashing.
"Something went wrong. Please refresh the page."
Wrap <ChatWidget />, <Dashboard />, and <Storefront /> in <ErrorBoundary> in App.jsx.

IMPROVEMENT 2 — Loading skeleton for Dashboard
While analytics data is loading on first render, show skeleton placeholder divs
(gray animated pulse using CSS animation: pulse 1.5s infinite) instead of empty cards.
This makes the dashboard look polished even on slow connections.

IMPROVEMENT 3 — Chat session persistence
Store the session_id in sessionStorage (not localStorage) so it persists across page
navigations within the same browser tab but resets on a new tab.
This means the audit log will correctly group a buyer's full session together.

IMPROVEMENT 4 — Amount formatting utility
Create client/src/utils/format.js:
  export const formatINR = (paise) => '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  export const formatTime = (isoString) => new Date(isoString).toLocaleTimeString('en-IN');
Replace all manual paise-to-rupee conversions in Dashboard.jsx and Storefront.jsx with these utils.

IMPROVEMENT 5 — Backend: /health endpoint enhancement
Update GET /health to return:
{
  "status": "ok",
  "timestamp": ISO8601,
  "razorpay_connected": true/false,  (try initializing SDK, catch error)
  "catalog_loaded": true/false,       (check if catalog.json is readable)
  "audit_log_entries": N              (count lines in audit.log)
}
This is useful for judges to quickly verify everything is wired up.

IMPROVEMENT 6 — Postman/curl test collection
Create docs/API_TESTS.md with ready-to-run curl commands for every endpoint.
Include example request bodies with realistic data.
Also include: "How to simulate the full demo flow" — 6 curl commands in order that run the entire checkout from catalog browse to payment failure recovery.

IMPROVEMENT 7 — Final README update
Add a "Live Demo Flow" section at the top of README.md (after the one-line description) with:
"To see the full flow: npm run dev:all → open http://localhost:5173 → type 'I want headphones' → click Pay Now → check /dashboard for the audit trail."
This is the first thing a judge reads. Make it irresistible.

COMMIT MESSAGE: feat: demo hardening, error boundaries, polish
PR TITLE: feat: final polish and demo hardening
PR DESCRIPTION: Error boundaries, loading skeletons, session persistence, amount formatting utility, enhanced /health endpoint, and curl test collection. The app is now demo-ready. Every edge case handled gracefully.
```

---

## FINAL CHECKLIST before submission

- [ ] All 13 PRs merged to main
- [ ] npm run dev:all starts cleanly with no errors
- [ ] All 4 judging criteria visibly demonstrated: explainable ✓ bounded ✓ audit trail ✓ failure handled ✓
- [ ] .env is NOT committed (check git log)
- [ ] README has setup instructions a stranger can follow
- [ ] /health endpoint returns razorpay_connected: true (with your test keys in .env)
- [ ] npm test passes
- [ ] 5-minute pitch video recorded and uploaded
- [ ] Pitch video link added to submission form
