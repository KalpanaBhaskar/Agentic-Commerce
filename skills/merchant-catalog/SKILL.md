---
name: merchant-catalog
description: Reads the merchant product catalog and handles AI-driven upsell/cross-sell logic to drive revenue growth.
tags: [catalog, upsell, recommendations, reasoning]
---

# Merchant Catalog & Upsell Skill

This skill teaches the agent how to read the merchant's structured catalog and proactively recommend related products (upselling/cross-selling) during the conversational checkout flow.

## Core Rules

1. **Catalog Source of Truth:** All product information must be read from the local `catalog.json` file. You must expect products to have the following schema: `id, name, description, price_paise, currency, category, stock, upsell_ids[]`.
2. **Upsell Trigger:** If a user expresses intent to buy a product, you MUST check the catalog to see if that product has `upsell_ids` associated with it before creating the order.
3. **LLM Reasoning:** When suggesting an upsell, you must briefly explain the reasoning to the user naturally (e.g., "Customers who buy the laptop often add a wireless mouse for better ergonomics. Would you like to add it?").
4. **Audit Requirement:** If you successfully present an upsell to the user, you must log it to the audit trail with `action: "upsell_shown"`.

## Workflow: Reading and Matching

1. Read `catalog.json` when the user asks to buy something.
2. Parse the user's plain-language request (NLP intent parsing) and match it to a specific product ID in the catalog.

## Workflow: Executing an Upsell

When a product is matched, execute these steps strictly before creating the Razorpay order:
1. Check the `upsell_ids[]` array for the requested product.
2. If `upsell_ids` exist, look up those IDs in the catalog to retrieve their names and prices.
3. Use your reasoning capabilities to formulate a helpful recommendation based on the product descriptions.
4. Ask the user if they want to add the recommended item(s) to their order.
5. Wait for the user's confirmation or rejection.
6. Write to `audit.log` indicating the upsell was offered (e.g., `action: "upsell_shown"`, with your `agent_reasoning` included).
7. Calculate the final total amount in paise and proceed to the `razorpay-order` workflow.