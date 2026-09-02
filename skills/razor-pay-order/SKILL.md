---
name: razorpay-order
description: Teaches the agent the Razorpay order lifecycle, idempotency, and mandatory audit logging.
tags: [razorpay, commerce, orders, audit]
---

# Razorpay Order Management Skill

This skill provides instructions on how to interact with the Razorpay Orders API for the RazorAgent project.

## Core Rules & Non-Negotiables

1. **Always Create an Order First:** You must create an order via `POST /v1/orders` before any payment can be processed. Never attempt to charge without a valid `order_id`.
2. **Amounts in Paise:** All financial amounts must be integers representing paise (e.g., ₹100.50 = 10050). Never use floats.
3. **Idempotency Keys:** When creating an order, you must pass a unique `receipt` ID or idempotency key to prevent duplicate orders.
4. **Mandatory Audit Logging:** Every time you create an order, fetch an order, or handle a failure, you MUST write a structured JSON line to `audit.log`.

## Workflow: Creating an Order

When a user requests to purchase an item from the catalog:

1. Calculate the total amount in paise.
2. Generate a unique receipt string (e.g., `rcpt_user123_timestamp`).
3. Call the Razorpay Orders API:
   - Endpoint: `POST https://api.razorpay.com/v1/orders`
   - Payload:
     ```json
     {
       "amount": 50000, 
       "currency": "INR",
       "receipt": "rcpt_user123_1700000000"
     }
     ```
4. **Audit Requirement:** Immediately log this action to the audit trail using the `audit-trail` skill pattern. The log must include:
   - `action: "order_created"`
   - `amount_paise: 50000`
   - `order_id`: The ID returned by Razorpay.
   - `agent_reasoning`: "User requested to purchase [Item Name] based on catalog match."

## Workflow: Fetching Order Status

When you need to check the status of an existing order:

1. Call the Razorpay Orders API:
   - Endpoint: `GET https://api.razorpay.com/v1/orders/:id`
2. **Audit Requirement:** If the status has changed (e.g., from `created` to `paid`), log the state change to the audit trail.

## Graceful Failure Handling

If the `POST /v1/orders` call fails (e.g., network error or API limit):
1. **Log it:** Write to `audit.log` with `status: "failed"` and `action: "failure_handled"`.
2. **Retry:** Implement an exponential backoff retry (e.g., wait 2 seconds, then retry once).
3. **Fallback:** If the retry fails, gracefully inform the user and do not proceed with the checkout flow.