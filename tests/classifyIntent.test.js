// tests/classifyIntent.test.js — Intent classifier pins (Vortex Commerce Task 6).
//
// Mocks ChatGroq to test classification logic without API calls.

let mockInvoke = jest.fn();

jest.mock('@langchain/groq', () => ({
  ChatGroq: jest.fn().mockImplementation(() => ({
    invoke: mockInvoke,
  })),
}));

const { ChatGroq } = require('@langchain/groq');
const { classifyIntent, heuristicClassify } = require('../src/agent/tools/classifyIntent');

beforeEach(() => {
  jest.clearAllMocks();
  mockInvoke.mockReset();
});

describe('classifyIntent', () => {
  test('returns valid schema for heuristic high-confidence cases', async () => {
    const result = await classifyIntent('buy Sony headphones on Amazon');
    expect(result.vertical).toBe('amazon');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(Array.isArray(result.signals)).toBe(true);
  });

  test('heuristic: Amazon explicit mention', async () => {
    const result = await classifyIntent('Sony WH-1000XM5 on Amazon');
    expect(result.vertical).toBe('amazon');
  });

  test('heuristic: Walmart groceries', async () => {
    const result = await classifyIntent('milk and eggs Walmart');
    expect(result.vertical).toBe('walmart');
  });

  test('heuristic: Home Depot tools', async () => {
    const result = await classifyIntent('cordless drill Home Depot');
    expect(result.vertical).toBe('homedepot');
  });

  test('heuristic: eBay collectibles', async () => {
    const result = await classifyIntent('vintage Pokemon cards eBay');
    expect(result.vertical).toBe('ebay');
  });

  test('heuristic: Hotels traditional', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'hotels', confidence: 0.85, signals: ['hotel'] }),
    });
    const result = await classifyIntent('Marriott hotel downtown Chicago');
    expect(result.vertical).toBe('hotels');
  });

  test('heuristic: Airbnb vacation rental', async () => {
    const result = await classifyIntent('Airbnb villa in Bali');
    expect(result.vertical).toBe('airbnb');
  });

  test('heuristic: Flights', async () => {
    const result = await classifyIntent('flight NYC to London Friday');
    expect(result.vertical).toBe('flights');
  });

  test('heuristic: Food delivery', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'local_food', confidence: 0.8, signals: ['food'] }),
    });
    const result = await classifyIntent('sushi delivery near me');
    expect(result.vertical).toBe('local_food');
  });

  test('heuristic: Restaurant booking', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'restaurants_booking', confidence: 0.85, signals: ['booking'] }),
    });
    const result = await classifyIntent('book table at Italian restaurant for 4 at 7pm');
    expect(result.vertical).toBe('restaurants_booking');
  });

  test('heuristic: Places review', async () => {
    const result = await classifyIntent('best rated hotels in Tokyo Tripadvisor');
    expect(result.vertical).toBe('places_review');
  });

  test('heuristic: Local business hours', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'maps_local', confidence: 0.7, signals: ['local business'] }),
    });
    const result = await classifyIntent('Apple Store hours near me');
    expect(result.vertical).toBe('maps_local');
  });

  test('heuristic: Digital apps', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'apps_digital', confidence: 0.8, signals: ['digital'] }),
    });
    const result = await classifyIntent('download Notion app');
    expect(result.vertical).toBe('apps_digital');
  });

  test('heuristic: Generic retail fallback', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'retail_general', confidence: 0.7, signals: ['product query'] }),
    });
    const result = await classifyIntent('wireless headphones under $200');
    expect(result.vertical).toBe('retail_general');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  test('Groq path: low confidence falls back to retail_general', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'unknown', confidence: 0.3, signals: ['ambiguous'] }),
    });

    const result = await classifyIntent('something completely random xyz123');
    expect(result.vertical).toBe('retail_general');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.signals).toContain('low_confidence_fallback');
  });

  test('Groq path: invalid vertical corrected to retail_general', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ vertical: 'invalid_vertical', confidence: 0.8, signals: ['test'] }),
    });

    const result = await classifyIntent('test query');
    expect(result.vertical).toBe('retail_general');
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  test('Groq path: parse error falls back to heuristic', async () => {
    mockInvoke.mockResolvedValue({ content: 'not valid json {{{' });

    const result = await classifyIntent('Sony camera on Amazon');
    expect(result.vertical).toBe('amazon'); // heuristic catches it
  });

  test('empty query defaults to retail_general', async () => {
    const result = await classifyIntent('');
    expect(result.vertical).toBe('retail_general');
    expect(result.signals).toContain('empty_query');
  });

  test('non-string input defaults to retail_general', async () => {
    const result = await classifyIntent(null);
    expect(result.vertical).toBe('retail_general');
  });
});

describe('heuristicClassify', () => {
  test('detects merchant names case-insensitively', () => {
    expect(heuristicClassify('AMAZON prime').vertical).toBe('amazon');
    expect(heuristicClassify('Walmart grocery').vertical).toBe('walmart');
    expect(heuristicClassify('HOME DEPOT tools').vertical).toBe('homedepot');
  });

  test('detects category keywords', () => {
    // These have < 0.9 confidence, so they fall through to Groq in classifyIntent
    // but heuristicClassify returns them directly with lower confidence
    expect(heuristicClassify('hotel in paris').vertical).toBe('hotels');
    expect(heuristicClassify('villa rental').vertical).toBe('airbnb');
    expect(heuristicClassify('flight to tokyo').vertical).toBe('flights');
    expect(heuristicClassify('food delivery near me').vertical).toBe('local_food');
    expect(heuristicClassify('book a table at restaurant').vertical).toBe('restaurants_booking');
    expect(heuristicClassify('best rated').vertical).toBe('places_review');
    expect(heuristicClassify('mobile app').vertical).toBe('apps_digital');
  });

  test('location + business -> maps_local', () => {
    expect(heuristicClassify('store hours near me').vertical).toBe('maps_local');
    expect(heuristicClassify('shop open now').vertical).toBe('maps_local');
  });

  test('generic product -> retail_general', () => {
    expect(heuristicClassify('cheap headphones').vertical).toBe('retail_general');
    expect(heuristicClassify('buy laptop').vertical).toBe('retail_general');
  });
});