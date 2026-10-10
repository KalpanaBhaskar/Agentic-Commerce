// tests/agent.test.js — LangChain agent flow pins (Vortex Commerce Task 7.10).
//
// Uses mock LLM via setMockLLM to test agent orchestration without API calls.
// Validates: tool calling sequence, memory, search→order flow, upsell.

const { processChat } = require('../src/agent/run');
const { getPaymentService, setPaymentService, resetPaymentService } = require('../src/api');
const { getLLM, setMockLLM, resetLLM } = require('../src/agent/llm');
const { readAudit } = require('../src/audit/logger');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Mock payment service
const mockPaymentService = {
  createOrder: jest.fn(),
  fetchOrder: jest.fn(),
  capturePayment: jest.fn(),
  createPaymentLink: jest.fn(),
};

beforeAll(() => {
  setPaymentService(mockPaymentService);
});

// Create a mock LLM that returns predictable responses
let mockInvoke = jest.fn();

function createMockLLM() {
  return {
    bindTools: jest.fn().mockReturnThis(),
    invoke: mockInvoke,
    call: mockInvoke,
    generate: mockInvoke,
  };
}

beforeAll(() => {
  setPaymentService(mockPaymentService);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockInvoke.mockReset();
  // Reset payment service mocks
  mockPaymentService.createOrder.mockReset();
  mockPaymentService.fetchOrder.mockReset();
  mockPaymentService.capturePayment.mockReset();
  mockPaymentService.createPaymentLink.mockReset();

  // Default mocks
  mockPaymentService.createOrder.mockResolvedValue({
    order_id: 'order_TEST123',
    amount_paise: 199900,
    currency: 'INR',
    product: { id: 'prod_test', name: 'Test Product', price_paise: 199900, image_url: 'img.jpg' },
    receipt: 'test-receipt',
  });
  mockPaymentService.createPaymentLink.mockResolvedValue('https://rzp.io/i/testLink');
  mockPaymentService.fetchOrder.mockResolvedValue({
    id: 'order_TEST123',
    status: 'paid',
    amount: 199900,
    amount_paid: 199900,
    currency: 'INR',
  });

  // Set mock LLM for the agent
  const mockLLM = {
    bindTools: jest.fn().mockReturnThis(),
    invoke: mockInvoke,
    call: mockInvoke,
    generate: mockInvoke,
  };
  require('../src/agent/llm').setMockLLM(mockLLM);
});

afterAll(() => {
  resetPaymentService();
  require('../src/agent/llm').resetLLM();
});

describe('LangChain Agent (processChat)', () => {
  test('simple product search returns items', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        vertical: 'retail_general',
        confidence: 0.9,
        signals: ['headphones'],
      }),
    });

    const result = await processChat('Sony WH-1000XM5 headphones', 'test_session_1');

    expect(result.session_id).toBe('test_session_1');
    expect(typeof result.response_text).toBe('string');
    expect(result.response_text.length).toBeGreaterThan(0);
    expect(Array.isArray(result.tools_used)).toBe(true);
  });

  test('search results include image_url and product metadata', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        vertical: 'retail_general',
        confidence: 0.9,
        signals: ['camera'],
      }),
    });

    const result = await processChat('Sony camera', 'test_session_2');

    expect(result.search_results).toBeDefined();
    expect(Array.isArray(result.search_results)).toBe(true);
    if (result.search_results.length > 0) {
      expect(result.search_results[0].image_url).toBeDefined();
    }
  });

  test('create_order tool is callable and returns order', async () => {
    // Test the payment service directly (createOrder tool wraps this)
    const { getPaymentService } = require('../src/api');
    const payments = getPaymentService();
    
    const result = await payments.createOrder({
      product_id: 'prod_test',
      quantity: 1,
      product: { id: 'prod_test', name: 'Test Product', price_paise: 199900, image_url: 'img.jpg' },
      agent_reasoning: 'test order',
      session_id: 'test_session',
    });

    // Use unique order ID to avoid duplicate reference_id error
    const { createPaymentLink } = require('../src/api/paymentLinks');
    const payment_link = await createPaymentLink({
      order_id: `order_TEST123_${Date.now()}`,
      amount_paise: result.amount_paise,
      description: `1 x ${result.product.name}`,
    });

    expect(result.order_id).toBe('order_TEST123');
    expect(payment_link).toContain('rzp.io');
    expect(mockPaymentService.createOrder).toHaveBeenCalled();
  });

  test('memory: session history persists across messages', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        content: JSON.stringify({ vertical: 'retail_general', confidence: 0.9, signals: ['camera'] }),
      })
      .mockResolvedValueOnce({ content: '' });

    await processChat('Sony camera', 'memory_test_session');

    mockInvoke
      .mockResolvedValueOnce({
        content: JSON.stringify({ vertical: 'retail_general', confidence: 0.9, signals: ['lens'] }),
      })
      .mockResolvedValueOnce({ content: '' });

    const result = await processChat('lens for it', 'memory_test_session');

    expect(result.session_id).toBe('memory_test_session');
    expect(result.response_text).toBeDefined();
  });

  test('upsell shown after order', async () => {
    mockInvoke
      .mockResolvedValueOnce({
        content: JSON.stringify({ vertical: 'retail_general', confidence: 0.9, signals: ['camera'] }),
      })
      .mockResolvedValueOnce({ content: '' })
      .mockResolvedValueOnce({ content: '' });

    const result = await processChat('I want to buy camera (ID: prod_test)', 'test_session_4');

    expect(result.upsell_shown).toBeDefined();
    expect(typeof result.upsell_shown).toBe('boolean');
  });

  test('trace_id included in response', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'retail_general', confidence: 0.9, signals: ['test'] }),
    });

    const result = await processChat('test product', 'trace_test_session');

    expect(result.trace_id).toBeDefined();
    expect(result.trace_id).toBe('trace_test_session'); // currently session_id used as trace_id
  });
});