---
name: audit-trail
description: Enforces immutable, append-only structured logging for every money action and agent decision.
tags: [audit, compliance, JSONL, logging, reasoning]
---

# Audit Trail & Compliance Skill

This skill guarantees that every financial action or decision made by the agent is explicitly logged in a transparent, machine-readable, and human-verifiable format. 

## Core Rules & Non-Negotiables

1. **Mandatory Logging:** You MUST write a structured log entry immediately after any of the following events occur:
   - Order creation
   - Payment capture
   - Upsell presentation
   - Failure handling
2. **Format Requirement:** Logs must be written as append-only, newline-delimited JSON (JSONL) to the `audit.log` file[cite: 2]. 
3. **No Floats:** The `amount_paise` field must always be an integer[cite: 2].
4. **Explainability:** You must always fill out the `agent_reasoning` field to explain *why* you took the action[cite: 2].

## Log Entry Schema

Every JSON line written to `audit.log` must strictly adhere to this schema[cite: 2]:

```json
{
  "timestamp": "ISO 8601 UTC string (e.g., 2026-08-30T10:00:00Z)",
  "action": "Must be one of: order_created | payment_captured | upsell_shown | failure_handled",
  "amount_paise": 50000, 
  "order_id": "The Razorpay order_* id",
  "status": "Must be one of: success | failed | retried",
  "agent_reasoning": "A clear, 1-2 sentence explanation of your decision (e.g., 'Retried payment capture after initial webhook timeout.')"
}