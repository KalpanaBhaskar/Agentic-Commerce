// tests/serp.test.js — SerpApi adapter + router pins (Vortex Commerce Task 3).
//
// Mocks serpapi.getJson so no network calls. Validates:
// - Each adapter maps raw JSON → Item with required fields
// - Router resolves verticals to correct engine lists
// - Fallback chain works (primary empty → fallback used)
// - Image enricher guarantees image_url

jest.mock('serpapi', () => ({
  getJson: jest.fn(),
  config: { api_key: 'test_serpapi_key' },
}));

// Require AFTER mock
const {
  BaseSerpTool,
  ITEM_KEYS,
  isValidItem,
  coerceToItem,
  VERTICAL_ENGINES,
  resolve,
  getAdapter,
  searchWithFallback,
  googleShoppingTool,
  amazonTool,
  walmartTool,
  homeDepotTool,
  ebayTool,
  hotelsTool,
  flightsTool,
  airbnbTool,
  tripadvisorTool,
  yelpTool,
  openTableTool,
  mapsTool,
  localTool,
  appleAppStoreTool,
  googlePlayTool,
  knowledgeGraphTool,
  imageTool,
  enrichBatch,
  PLACEHOLDER,
  dispatchSearch,
  needsEntityResolution,
  extractEntityName,
} = require('../src/serp');

const FAKE_API_KEY = 'test_serpapi_key';

beforeEach(() => {
  jest.resetAllMocks(); // resets mock implementations including mockResolvedValueOnce queues
  // Clear all adapter caches
  Object.values({
    googleShoppingTool,
    amazonTool,
    walmartTool,
    homeDepotTool,
    ebayTool,
    hotelsTool,
    flightsTool,
    airbnbTool,
    tripadvisorTool,
    yelpTool,
    openTableTool,
    mapsTool,
    localTool,
    appleAppStoreTool,
    googlePlayTool,
    imageTool,
  }).forEach(t => t.clearCache?.());
});

describe('types', () => {
  test('coerceToItem fills required fields with safe defaults', () => {
    const item = coerceToItem({ title: 'Test Product', price_paise: 1999 }, { vertical: 'retail', engine: 'google_shopping', trace_id: 't1' });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe('Test Product');
    expect(item.price_paise).toBe(1999);
    expect(item.currency).toBe('INR');
    expect(item.vertical).toBe('retail');
    expect(item.engine).toBe('google_shopping');
    expect(item.trace_id).toBe('t1');
    expect(item.image_url).toBe(''); // placeholder before enrich
    expect(item.source).toBe('serpapi');
  });

  test('isValidItem rejects missing required fields', () => {
    expect(isValidItem({})).toBe(false);
    expect(isValidItem({ id: '1', name: 'x', description: 'd', price_paise: 100, currency: 'INR',
      category: 'c', vertical: 'v', engine: 'e', image_url: 'img', source: 'serpapi' })).toBe(true);
  });
});

describe('router', () => {
  test('VERTICAL_ENGINES matches architecture §3 matrix', () => {
    expect(VERTICAL_ENGINES.retail_general).toEqual(['google_shopping']);
    expect(VERTICAL_ENGINES.amazon).toEqual(['amazon', 'google_shopping']);
    expect(VERTICAL_ENGINES.walmart).toEqual(['walmart', 'google_shopping']);
    expect(VERTICAL_ENGINES.homedepot).toEqual(['home_depot', 'google_shopping']);
    expect(VERTICAL_ENGINES.ebay).toEqual(['ebay', 'google_shopping']);
    expect(VERTICAL_ENGINES.hotels).toEqual(['google_hotels', 'tripadvisor']);
    expect(VERTICAL_ENGINES.flights).toEqual(['google_flights']);
    expect(VERTICAL_ENGINES.airbnb).toEqual(['airbnb']);
    expect(VERTICAL_ENGINES.places_review).toEqual(['tripadvisor']);
    expect(VERTICAL_ENGINES.local_food).toEqual(['yelp', 'google_maps']);
    expect(VERTICAL_ENGINES.restaurants_booking).toEqual(['opentable', 'yelp']);
    expect(VERTICAL_ENGINES.maps_local).toEqual(['google_maps', 'google_local']);
    expect(VERTICAL_ENGINES.apps_digital).toEqual(['apple_app_store', 'google_play']);
  });

  test('resolve() returns fallback for unknown vertical', () => {
    expect(resolve('unknown_xyz')).toEqual(['google_shopping']);
  });

  test('getAdapter() returns instance for each registered engine', () => {
    expect(getAdapter('google_shopping')).toBeInstanceOf(BaseSerpTool);
    expect(getAdapter('amazon')).toBeInstanceOf(BaseSerpTool);
    expect(getAdapter('knowledge_graph')).toBeInstanceOf(BaseSerpTool);
    expect(getAdapter('google_images')).toBeInstanceOf(BaseSerpTool);
  });

  test('getAdapter() throws for unregistered engine', () => {
    expect(() => getAdapter('nonexistent')).toThrow('No adapter registered');
  });
});

const { getJson } = require('serpapi');

describe('adapters — mapResult produces valid Item shape', () => {
  const ctx = { traceId: 'test_trace', gl: 'in', hl: 'en' };

  // Helper: mock getJson and call adapter.search()
  async function runAdapter(adapter, query, mockResults) {
    getJson.mockResolvedValue({ shopping_results: mockResults, results: mockResults });
    return adapter.search(query, ctx);
  }

  test('googleShoppingTool maps shopping_results', async () => {
    const items = await runAdapter(googleShoppingTool, 'camera', [{
      product_id: 'prod_123',
      title: 'Sony Camera',
      snippet: 'Great camera',
      extracted_price: 1999.99,
      extracted_old_price: 2499.99,
      source: 'Amazon',
      source_icon: 'icon.png',
      product_link: 'https://amazon.com/p',
      rating: 4.5,
      reviews: 100,
      delivery: 'Free delivery',
      thumbnail: 'thumb.jpg',
      tag: 'electronics',
    }]);
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.id).toBe('prod_123');
    expect(item.name).toBe('Sony Camera');
    expect(item.price_paise).toBe(199999);
    expect(item.old_price_paise).toBe(249999);
    expect(item.discount_pct).toBe(20);
    expect(item.shop_name).toBe('Amazon');
    expect(item.shop_icon).toBe('icon.png');
    expect(item.product_link).toBe('https://amazon.com/p');
    expect(item.rating).toBe(4.5);
    expect(item.reviews).toBe(100);
    expect(item.delivery).toBe('Free delivery');
    expect(item.vertical).toBe('retail_general');
    expect(item.engine).toBe('google_shopping');
  });

  test('amazonTool maps ASIN + price', async () => {
    getJson.mockResolvedValue({ shopping_results: [{
      asin: 'B08N5WRWNW',
      title: 'Echo Dot',
      description: 'Smart speaker with Alexa',
      price: 49.99,
      original_price: 59.99,
      category_name: 'Electronics',
      link: 'https://amazon.com/dp/B08N5WRWNW',
      rating: 4.7,
      reviews_count: 50000,
      delivery: 'FREE Shipping',
      thumbnail: 'thumb.jpg',
    }] });
    const items = await amazonTool.search('echo dot', ctx);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('B08N5WRWNW');
    expect(items[0].price_paise).toBe(4999);
    expect(items[0].old_price_paise).toBe(5999);
    // ((59.99 - 49.99) / 59.99) * 100 = 16.67% -> rounds to 17
    expect(items[0].discount_pct).toBe(17);
  });

  test('hotelsTool maps rate_per_night + location', async () => {
    getJson.mockResolvedValue({ results: [{
      hotel_id: 'hotel_1',
      name: 'Grand Hotel',
      description: 'Luxury hotel',
      rate_per_night: { lowest: 299.99, extracted_price: 299.99 },
      address: '123 Main St, Downtown',
      rating: 4.8,
      reviews: 200,
      check_in_time: '3 PM',
      check_out_time: '11 AM',
      thumbnail: 'hotel.jpg',
    }] });
    const items = await hotelsTool.search('downtown hotel', { ...ctx, check_in: '2025-01-15', check_out: '2025-01-16' });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('hotel_1');
    expect(items[0].price_paise).toBe(29999);
    expect(items[0].location).toBe('123 Main St, Downtown');
    expect(items[0].delivery).toContain('Check-in: 3 PM');
  });

  test('flightsTool maps airline + airports', async () => {
    getJson.mockResolvedValue({ results: [{
      flight_id: 'fl_1',
      airline: 'IndiGo',
      departure_airport: { code: 'DEL', name: 'Delhi' },
      arrival_airport: { code: 'BOM', name: 'Mumbai' },
      departure_time: '06:00',
      arrival_time: '08:30',
      duration: '2h 30m',
      stops: 'Non-stop',
      price: 4500,
      outbound_date: '2025-01-15',
      return_date: '2025-01-20',
      airline_logo: 'logo.png',
      thumbnail: 'flight.jpg',
    }] });
    const items = await flightsTool.search('DEL to BOM', { ...ctx, departure_id: 'DEL', arrival_id: 'BOM' });
    expect(items).toHaveLength(1);
    expect(items[0].name).toContain('IndiGo');
    expect(items[0].location).toContain('Delhi → Mumbai');
    expect(items[0].delivery).toContain('Returns');
  });

  test('airbnbTool maps property_type + host', async () => {
    getJson.mockResolvedValue({ results: [{
      id: 'abnb_1',
      name: 'Cozy Villa',
      property_type: 'Villa',
      bedrooms: 3,
      beds: 4,
      bathrooms: 2,
      price: { rate: 150.00 },
      host: { name: 'John', profile_pic: 'host.jpg' },
      url: 'https://airbnb.com/rooms/abnb_1',
      address: 'Beach Road, Goa',
      rating: 4.9,
      review_count: 50,
      check_in_time: '2 PM',
      check_out_time: '11 AM',
      thumbnail: 'villa.jpg',
    }] });
    const items = await airbnbTool.search('Goa villa', { ...ctx, check_in: '2025-01-15', check_out: '2025-01-16' });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('abnb_1');
    expect(items[0].description).toContain('Villa');
    expect(items[0].shop_name).toBe('John');
  });

  test('yelpTool maps categories + delivery flag', async () => {
    getJson.mockResolvedValue({ results: [{
      id: 'yelp_1',
      name: 'Sushi Place',
      categories: [{ title: 'Japanese' }, { title: 'Sushi' }],
      rating: 4.6,
      review_count: 300,
      transactions: ['delivery', 'pickup'],
      location: { address1: '456 Oak Ave', city: 'Mumbai' },
      image_url: 'sushi.jpg',
      url: 'https://yelp.com/biz/sushi-place',
      thumbnail: 'sushi.jpg',
    }] });
    const items = await yelpTool.search('sushi near me', ctx);
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('Japanese');
    expect(items[0].delivery).toBe('Delivery available');
    expect(items[0].location).toContain('Mumbai');
  });

  test('mapsTool maps place_id + hours', async () => {
    getJson.mockResolvedValue({ results: [{
      place_id: 'place_1',
      title: 'Central Mall',
      type: 'shopping_mall',
      rating: 4.3,
      reviews: 1200,
      address: '789 Center Blvd',
      hours: '10 AM – 10 PM',
      open_now: true,
      website: 'https://centralmall.com',
      thumbnail: 'mall.jpg',
    }] });
    const items = await mapsTool.search('mall near me', { ...ctx, lat: 12.97, lng: 77.59 });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('place_1');
    expect(items[0].delivery).toBe('Open now');
  });
});

describe('searchWithFallback', () => {
  test('uses primary engine when it returns results', async () => {
    // Mock data compatible with amazon adapter
    getJson.mockResolvedValue({ shopping_results: [{
      asin: 'p1',
      title: 'Primary',
      description: 'Primary product',
      price: 1.00,
      thumbnail: 'img.jpg'
    }] });
    const { items, engineUsed } = await searchWithFallback('amazon', 'test', { traceId: 'fb1' });
    expect(items).toHaveLength(1);
    expect(engineUsed).toBe('amazon');
  });

  test('falls back when primary returns empty', async () => {
    getJson
      .mockResolvedValueOnce({ shopping_results: [] }) // primary (amazon)
      .mockResolvedValueOnce({ shopping_results: [{ product_id: 'p2', title: 'Fallback', snippet: 'Fallback product', extracted_price: 200, thumbnail: 'img.jpg' }] }); // fallback (google_shopping)
    const { items, engineUsed } = await searchWithFallback('amazon', 'test', { traceId: 'fb2' });
    expect(items).toHaveLength(1);
    expect(engineUsed).toBe('google_shopping');
  });
});

describe('imageEnricher', () => {
  test('enrichBatch guarantees image_url on every item', async () => {
    getJson.mockResolvedValue({ images_results: [{ original: 'https://img.com/found.jpg' }] });

    const items = [
      { ...coerceToItem({ title: 'Item A', price: 100 }, { vertical: 'test', engine: 'test', traceId: 'e1' }), image_url: '' },
      { ...coerceToItem({ title: 'Item B', price: 200 }, { vertical: 'test', engine: 'test', traceId: 'e1' }), image_url: 'https://already.com/img.jpg' },
    ];

    const enriched = await enrichBatch(items, { traceId: 'e1' });
    expect(enriched[0].image_url).toBe('https://img.com/found.jpg');
    expect(enriched[1].image_url).toBe('https://already.com/img.jpg');
    expect(enriched[0]._image_source).toBe('google_images');
    expect(enriched[1]._image_source).toBe('original');
  });

  test('falls back to placeholder when Google Images returns nothing', async () => {
    getJson.mockResolvedValue({ images_results: [] });
    const items = [{ ...coerceToItem({ title: 'No Image' }, { vertical: 'test', engine: 'test', traceId: 'e2' }), image_url: '' }];
    const enriched = await enrichBatch(items, { traceId: 'e2' });
    expect(enriched[0].image_url).toBe(PLACEHOLDER);
    expect(enriched[0]._image_source).toBe('placeholder');
  });
});

describe('knowledgeGraph', () => {
  test('resolveEntity returns structured context', async () => {
    getJson.mockResolvedValue({
      knowledge_graph: {
        name: 'Apple Park',
        '@type': 'Place',
        description: 'Apple headquarters',
        address: { streetAddress: '1 Apple Park Way', addressLocality: 'Cupertino', addressRegion: 'CA' },
        geo: { latitude: '37.3349', longitude: '-122.0090' },
        url: 'https://apple.com',
        logo: 'https://apple.com/logo.png',
      },
    });
    const ctx = await knowledgeGraphTool.resolveEntity('Apple Park', { traceId: 'kg1' });
    expect(ctx.name).toBe('Apple Park');
    expect(ctx.type).toBe('Place');
    expect(ctx.lat).toBeCloseTo(37.3349);
    expect(ctx.lng).toBeCloseTo(-122.009);
  });
});

describe('dispatcher (Task 5)', () => {
  test('needsEntityResolution detects location-relative queries', () => {
    expect(needsEntityResolution('hotel near Apple Park')).toBe(true);
    expect(needsEntityResolution('restaurants close to Central Park')).toBe(true);
    expect(needsEntityResolution('cafe around Times Square')).toBe(true);
    expect(needsEntityResolution('shops nearby')).toBe(true);
    expect(needsEntityResolution('within 5km of downtown')).toBe(true);
    expect(needsEntityResolution('walking distance from downtown')).toBe(true);
  });

  test('needsEntityResolution detects proper nouns', () => {
    expect(needsEntityResolution('Sony camera')).toBe(true);
    expect(needsEntityResolution('Apple store')).toBe(true);
    expect(needsEntityResolution('Nike shoes')).toBe(true);
  });

  test('needsEntityResolution ignores generic queries', () => {
    expect(needsEntityResolution('cheap headphones')).toBe(false);
    expect(needsEntityResolution('best laptop')).toBe(false);
    expect(needsEntityResolution('buy shoes')).toBe(false);
    expect(needsEntityResolution('')).toBe(false);
  });

  test('extractEntityName strips intent verbs and location prepositions', () => {
    expect(extractEntityName('hotel near Apple Park')).toBe('Apple Park');
    expect(extractEntityName('restaurants close to Central Park')).toBe('Central Park');
    expect(extractEntityName('find Sony camera')).toBe('Sony camera');
    expect(extractEntityName('buy Nike shoes online')).toBe('Nike shoes online');
  });

  test('dispatchSearch resolves entity and injects coords into context', async () => {
    // Mock KG response
    getJson.mockResolvedValueOnce({
      knowledge_graph: {
        name: 'Apple Park',
        '@type': 'Place',
        address: { streetAddress: '1 Apple Park Way', addressLocality: 'Cupertino', addressRegion: 'CA' },
        geo: { latitude: '37.3349', longitude: '-122.0090' },
      },
    });
    // Mock router: hotels vertical uses google_hotels then tripadvisor
    getJson
      .mockResolvedValueOnce({ results: [] }) // google_hotels
      .mockResolvedValueOnce({ results: [{ location_id: 'p1', name: 'Hotel near Apple Park', snippet: 'Nice hotel', extracted_price: 200, thumbnail: 'img.jpg' }] }); // tripadvisor

    const { items, engineUsed, entityContext } = await dispatchSearch('hotels', 'hotel near Apple Park', { traceId: 'd1' });

    expect(entityContext).not.toBeNull();
    expect(entityContext.name).toBe('Apple Park');
    expect(entityContext.lat).toBeCloseTo(37.3349);
    expect(entityContext.lng).toBeCloseTo(-122.009);
    expect(items).toHaveLength(1);
    expect(engineUsed).toBe('tripadvisor');
  });

  test('dispatchSearch skips KG for generic queries', async () => {
    getJson.mockResolvedValue({ shopping_results: [{ product_id: 'p1', title: 'Generic Hotel', snippet: 'Hotel', extracted_price: 100, thumbnail: 'img.jpg' }] });

    const { items, entityContext } = await dispatchSearch('hotels', 'cheap hotel downtown', { traceId: 'd2' });

    expect(entityContext).toBeNull();
    expect(items).toHaveLength(1);
  });

  test('dispatchSearch never returns KG result as product', async () => {
    getJson
      .mockResolvedValueOnce({
        knowledge_graph: { name: 'Apple Park', '@type': 'Place', geo: { latitude: '37.3349', longitude: '-122.0090' } },
      })
      .mockResolvedValueOnce({ shopping_results: [] })
      .mockResolvedValueOnce({ shopping_results: [{ product_id: 'p1', title: 'Hotel', snippet: 'Hotel', extracted_price: 200, thumbnail: 'img.jpg' }] });

    const { items, entityContext } = await dispatchSearch('hotels', 'hotel near Apple Park', { traceId: 'd3' });

    // Items should only contain transactional results, not the KG entity
    expect(items.every(item => item.id !== 'Apple Park' && !item.name.includes('Apple Park'))).toBe(true);
    // Entity context is separate
    expect(entityContext).not.toBeNull();
    expect(entityContext.name).toBe('Apple Park');
  });
});