# RazorAgent Architecture Decisions

This document explains every major architectural decision in RazorAgent and the reasoning behind it.

---

## Why tool_use Instead of Plain LLM Responses for Checkout?

### Decision
We use Claude's `tool_use` (function calling) capability instead of plain text generation for checkout operations.

### Reasoning
1. **Bounded and Gated**: Tool schemas strictly define what the agent can do. It can ONLY call `search_catalog`, `create_order`, `get_upsell_suggestions`, and `get_order_status`. Nothing else is possible.

2. **Structured Output**: Tool calls return structured JSON, not unstructured text. This eliminates parsing errors and ensures type safety.

3. **Auditability**: Every tool call is logged with input parameters and results. The `agent_reasoning` field captures the LLM's natural-language explanation of WHY it made the call.

4. **Idempotency**: Tool calls can be retried safely. If a `create_order` fails, the agent can retry with the same parameters without side effects.

5. **ACp Alignment**: The Agentic Commerce Protocol (ACP) uses function calling as the standard for agent-to-merchant communication. Our implementation mirrors this pattern.

### Alternative Considered
Plain text prompting where the LLM outputs a SQL-like query or API call string. Rejected because:
- Harder to validate and sanitize
- Prone to parsing errors
- Doesn't enforce the "bounded" requirement for judges

---

## Why Flat Files Instead of a Database?

### Decision
We use flat files (`catalog.json`, `audit.log` as JSONL, `orders.json`) instead of a database like PostgreSQL or MongoDB.

### Reasoning
1. **Hackathon Constraints**: For a hackathon/demo, setting up and maintaining a database adds unnecessary complexity. Flat files work out of the box.

2. **Portability**: The entire application state is in files. You can copy the project directory to another machine and it works immediately. No database migrations, no connection strings.

3. **Inspectability**: Anyone can open `catalog.json` or `audit.log` in a text editor and understand the data. No need for database clients or SQL queries.

4. **JSONL for Audit**: `audit.log` uses JSON Lines (one JSON object per line) which is:
   - Append-only (perfect for audit trails)
   - Easy to parse line-by-line
   - Human-readable
   - Git-friendly (though we .gitignore it)

5. **Performance**: For a demo with 10 products and a few hundred audit entries, file I/O is instantaneous. The performance difference vs. a database is negligible.

### Alternative Considered
SQLite or PostgreSQL. Rejected because:
- Adds setup complexity (install, configure, connection strings)
- Overkill for demo scale
- Makes the project less portable
- Harder to inspect data without database tools

### Production Consideration
In production, we would migrate to a proper database with:
- ACID transactions for payment operations
- Indexing for fast audit queries
- Backup and replication
- But the bounded tool architecture would remain identical

---

## Why Raw Body Must Be Preserved for Webhook Verification?

### Decision
The webhook handler uses `express.raw()` to capture the raw request body BEFORE JSON parsing, and uses this raw body for HMAC signature verification.

### Reasoning
1. **Security**: Razorpay signs the raw request body with HMAC-SHA256. If we parse JSON first, whitespace differences or encoding changes would break signature verification.

2. **Integrity**: The signature proves the webhook actually came from Razorpay and wasn't tampered with in transit. Any modification to the body invalidates the signature.

3. **Attack Prevention**: Without raw body verification, an attacker could:
   - Modify payment amounts in the webhook
   - Change order IDs to capture payments meant for other orders
   - Replay old webhooks

4. **SDK Requirement**: The Razorpay SDK's `validateWebhookSignature()` function requires the raw body as received from Razorpay.

### Implementation Detail
```javascript
// server.js - webhook route mounted BEFORE express.json()
app.use('/webhook', webhookRouter); // raw body parser
app.use(express.json()); // JSON parser for other routes
```

This order is critical. If `express.json()` runs first, the raw body is lost and signature verification fails.

### Alternative Considered
Parse JSON first, then re-serialize for signature verification. Rejected because:
- Stringification may not match Razorpay's exact formatting
- Adds unnecessary complexity
- Risk of whitespace/encoding differences causing false negatives

---

## Why Amounts Must Always Be in Paise?

### Decision
All monetary amounts are stored and processed in paise (1₹ = 100 paise) as integers, never as floating-point rupees.

### Reasoning
1. **Floating-Point Precision**: JavaScript's `Number` type uses IEEE 754 floating-point, which cannot precisely represent some decimal values. `0.1 + 0.2 !== 0.3` in JavaScript.

2. **Real-World Bugs**: If we used rupees:
   ```javascript
   const price = 29.99; // ₹29.99
   const total = price * 3; // Might be 89.96999999999999 due to floating-point
   ```
   This causes payment discrepancies and accounting errors.

3. **Razorpay Requirement**: Razorpay's API requires amounts in paise as integers. Using rupees would require conversion on every API call, increasing error surface.

4. **Audit Trail Consistency**: Storing integers in the audit log avoids any ambiguity. `2999900` is unambiguous. `29999.00` could be parsed as a float.

5. **Financial Best Practice**: Financial systems universally use integer arithmetic for money to avoid precision errors.

### Implementation
```javascript
// Correct
const amount_paise = 2999900; // ₹29,999.00
const total = amount_paise * quantity; // Always precise

// Incorrect
const amount_inr = 29999.00; // Dangerous!
const total = amount_inr * quantity; // Might be 89996.9999999
```

### Display Conversion
We only convert to rupees for display:
```javascript
const amount_inr = amount_paise / 100;
```

### Alternative Considered
Use decimal.js or similar library for precise decimal arithmetic. Rejected because:
- Adds dependency
- Razorpay API requires paise anyway
- Integer arithmetic is simpler and sufficient

---

## How the Audit Trail Enforces "Explainable and Bounded"?

### Decision
Every money action writes an append-only entry to `audit.log` with a fixed schema including `agent_reasoning`.

### Reasoning for "Explainable"
1. **agent_reasoning Field**: Every agent-initiated action includes natural-language explanation of WHY the action was taken.
   ```json
   {
     "agent_reasoning": "User asked for noise-cancelling headphones. Matched SKU prod_001. Created order."
   }
   ```

2. **Complete Context**: Each audit entry includes:
   - `timestamp`: When it happened
   - `action`: What happened (order_created, payment_captured, etc.)
   - `order_id`: Which order
   - `amount_paise`: How much money
   - `status`: Success or failure
   - `session_id`: Which conversation session
   - `agent_reasoning`: Why it happened

3. **Immutable**: Append-only JSONL means entries can never be modified or deleted. History is preserved forever.

### Reasoning for "Bounded"
1. **Action Types**: Only 6 action types exist:
   - `order_created`
   - `payment_captured`
   - `upsell_shown`
   - `payment_failed`
   - `retry_attempted`
   - `link_sent`

   The agent cannot invent new action types.

2. **Tool Schemas**: The agent can only call 4 tools, each with strict input validation:
   - `search_catalog {query}` - can only search, not modify
   - `create_order {product_id, quantity}` - quantity bounded 1-10
   - `get_upsell_suggestions {product_id}` - read-only
   - `get_order_status {order_id}` - read-only

3. **No Arbitrary Code**: The agent cannot execute arbitrary code or make arbitrary API calls. Every action goes through predefined tool functions.

4. **Audit as Proof**: If an agent tried to do something outside its bounds, it would either:
   - Fail tool schema validation
   - Not have a tool available
   - Be logged as an unknown action (which would be suspicious)

### Implementation
```javascript
// src/audit/logger.js
function logAction(entry) {
  // Validates required fields
  if (!entry.action || !entry.status) {
    throw new Error('Missing required fields');
  }
  
  // Auto-stamps timestamp (caller can't forge time)
  entry.timestamp = new Date().toISOString();
  
  // Append-only (never overwrite)
  fs.appendFileSync(AUDIT_PATH, JSON.stringify(entry) + '\n');
}
```

### Verification
The audit viewer (`npm run audit`) proves the system is working:
- Shows all actions in chronological order
- Filters by action type
- Displays reasoning truncated to 40 chars
- Any deviation from expected patterns is immediately visible

### Alternative Considered
Centralized logging service (e.g., Datadog, CloudWatch). Rejected because:
- Adds external dependency
- Harder to inspect for demo
- Overkill for hackathon scale
- Local file is more transparent for judges

---

## Why Express 4 Instead of Newer Frameworks?

### Decision
We use Express 4 instead of newer frameworks like Fastify, Koa, or NestJS.

### Reasoning
1. **Battle-Tested**: Express has been around since 2010 and powers millions of production applications. Bugs are well-known and rare.

2. **Minimal Learning Curve**: Most Node.js developers know Express. Newer frameworks have steeper learning curves.

3. **Sufficient for Use Case**: We need:
   - HTTP routing
   - Middleware (raw body parser, JSON parser)
   - Simple error handling
   
   Express handles all of this well. We don't need the advanced features of newer frameworks.

4. **Ecosystem Compatibility**: Most Express middleware works out of the box. Newer frameworks may require adapters.

5. **Hackathon Context**: For a demo, reliability and simplicity matter more than micro-optimizations.

### Alternative Considered
Fastify (faster, newer). Rejected because:
- Slightly more complex middleware setup
- Ecosystem smaller than Express
- Performance difference negligible for our scale
- Express is more familiar to most developers

---

## Why Node.js 20 LTS Instead of Other Runtimes?

### Decision
We use Node.js 20 LTS instead of Node.js 18, 21, or other runtimes like Bun or Deno.

### Reasoning
1. **LTS Stability**: Node.js 20 LTS (Long Term Support) is stable and will receive security updates until 2026. Perfect for production deployment.

2. **Async-Native**: Node.js's event loop is ideal for webhook handling. Webhooks are I/O-bound (network calls to Razorpay), and Node.js handles concurrent I/O efficiently.

3. **Ecosystem**: npm has the largest package ecosystem. Razorpay's official SDK is designed for Node.js.

4. **Developer Familiarity**: Most JavaScript developers know Node.js. Alternative runtimes have smaller communities.

5. **Razorpay SDK Compatibility**: The official Razorpay npm package is tested against Node.js. Using alternative runtimes might introduce compatibility issues.

### Alternative Considered
Bun (faster, newer). Rejected because:
- Ecosystem is smaller
- Razorpay SDK compatibility uncertain
- Less battle-tested
- Performance gain not needed for our use case

---

## Why Anthropic SDK Instead of Direct API Calls?

### Decision
We use the official `@anthropic-ai/sdk` instead of making direct HTTP calls to Anthropic's API.

### Reasoning
1. **Type Safety**: The SDK provides TypeScript types (even if we use JavaScript) for request/response structures.

2. **Authentication Handling**: The SDK manages API key authentication, headers, and error handling automatically.

3. **Streaming Support**: The SDK supports streaming responses (though we don't use it currently, it's available for future enhancements).

4. **Retry Logic**: Built-in retry logic for transient failures (network issues, rate limits).

5. **Official Support**: If we encounter issues, Anthropic supports the SDK. Direct API calls are "use at your own risk."

6. **Tool Use Abstraction**: The SDK provides clean abstractions for `tool_use` (function calling) that would be complex to implement manually.

### Alternative Considered
Direct `fetch()` calls to Anthropic's REST API. Rejected because:
- Would need to manually handle authentication headers
- Would need to implement retry logic
- Would need to parse streaming responses manually
- More error-prone
- No official support

---

## Why jest for Testing Instead of Other Frameworks?

### Decision
We use Jest for unit tests instead of Mocha, Ava, or other testing frameworks.

### Reasoning
1. **Zero Configuration**: Jest works out of the box with minimal setup. No need to configure test runners, assertion libraries, or mocking libraries separately.

2. **Built-in Mocking**: Jest has powerful mocking capabilities (`jest.mock()`, `jest.fn()`) built in. We use this to mock Razorpay SDK calls without making real API requests.

3. **Snapshot Testing**: Though we don't use it currently, Jest supports snapshot testing for UI components.

4. **Watch Mode**: `jest --watch` automatically re-runs tests when files change, speeding up development.

5. **Coverage Reports**: Built-in code coverage reporting with `--coverage`.

6. **Parallel Execution**: Jest runs tests in parallel by default, making test suites faster.

### Alternative Considered
Mocha + Chai. Rejected because:
- Requires separate setup for assertion library
- Mocking requires additional libraries (sinon, etc.)
- More configuration needed
- Jest provides everything in one package

---

## Why Environment Variables Instead of Config Files?

### Decision
We use `.env` files with `dotenv` instead of hardcoded configuration or config JSON files.

### Reasoning
1. **Security**: API keys and secrets are never committed to git. `.env` is in `.gitignore`, `.env.example` is committed without secrets.

2. **Environment Flexibility**: Different environments (development, staging, production) can have different configurations without code changes.

3. **Container-Friendly**: Environment variables are the standard for containerized applications (Docker, Kubernetes).

4. **Secrets Management**: Easy to integrate with secrets management systems (AWS Secrets Manager, HashiCorp Vault) in production.

5. **12-Factor App**: Follows the 12-Factor App methodology's recommendation for configuration.

### Implementation
```javascript
// .env (never committed)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=your_webhook_signing_secret
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
PORT=3000
NGROK_URL=https://xxxx.ngrok.io

// .env.example (committed)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
WEBHOOK_SECRET=your_webhook_signing_secret
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
PORT=3000
NGROK_URL=https://xxxx.ngrok.io
```

### Alternative Considered
config.json file. Rejected because:
- Risk of committing secrets
- Harder to manage different environments
- Not container-friendly
- Violates 12-Factor App principles

---

## Why Separate Skills Directory?

### Decision
We have a `skills/` directory with SKILL.md files that teach the agent about specific domains (razorpay-order, merchant-catalog, audit-trail).

### Reasoning
1. **Agent Teachability**: The agent can be "taught" new capabilities by adding new skill files without modifying core code.

2. **Modular Knowledge**: Each skill encapsulates domain knowledge:
   - `razorpay-order/SKILL.md`: Order lifecycle, payment flows
   - `merchant-catalog/SKILL.md`: Product search, upsell logic
   - `audit-trail/SKILL.md`: Logging patterns, audit requirements

3. **Future Extensibility**: New skills can be added for:
   - Inventory management
   - Customer support
   - Returns and refunds
   - Analytics

4. **Documentation as Code**: Skills are documented in markdown, making them human-readable and version-controllable.

5. **ACP Alignment**: Agentic Commerce Protocol envisions agents learning merchant capabilities through skill manifests.

### Alternative Considered
Hardcoding all domain knowledge in the agent code. Rejected because:
- Harder to extend
- Knowledge mixed with implementation
- Less transparent for merchants
- Doesn't scale well

---

## Why ngrok Instead of Local Webhook Testing?

### Decision
We use ngrok to expose localhost:3000 to the internet for Razorpay webhook testing.

### Reasoning
1. **Razorpay Requirement**: Razorpay webhooks require a publicly accessible HTTPS URL. Localhost is not accessible from Razorpay's servers.

2. **SSL/TLS**: ngrok automatically provides HTTPS, which Razorpay requires for webhooks.

3. **Zero Configuration**: ngrok works out of the box with no DNS setup, SSL certificates, or firewall configuration.

4. **Dynamic URL**: Each ngrok session provides a new URL, which is fine for test mode.

5. **Tunneling**: ngrok tunnels traffic from the public URL to localhost, allowing local development with real webhooks.

### Alternative Considered
Local webhook testing tools (like webhook.site). Rejected because:
- Would require modifying code to use different endpoints
- Doesn't test the actual integration with Razorpay
- ngrok is more seamless for development

### Production Consideration
In production, we would use:
- A real domain with proper SSL certificates
- A reverse proxy (nginx, AWS ALB)
- Proper DNS configuration
- But the webhook handler code would remain identical

---

## Summary

Every architectural decision in RazorAgent is made with these principles:

1. **Security First**: Signature verification, input validation, no exposed secrets
2. **Explainability**: Audit trails, agent reasoning, structured logging
3. **Boundedness**: Tool schemas, action types, input validation
4. **Simplicity**: Minimal dependencies, familiar technologies, portable state
5. **ACP Alignment**: Function calling, skill manifests, shared payment tokens
6. **Hackathon Appropriate**: Fast setup, easy demo, clear judge criteria

These decisions create a system that is both demo-ready and architecturally sound for future production use.