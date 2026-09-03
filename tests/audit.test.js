// tests/audit.test.js — unit tests for the append-only audit logger.
//
// Hermetic: the logger is pointed at a throwaway temp file via AUDIT_LOG_PATH
// (set BEFORE the module is required, since the path is resolved once at load).
// No network, no Razorpay SDK, and the real audit.log is never touched.

const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP_AUDIT = path.join(os.tmpdir(), `razoragent-audit-${process.pid}-${Date.now()}.log`);
process.env.AUDIT_LOG_PATH = TMP_AUDIT;

const { logAction, readAudit } = require('../src/audit/logger');

/** Read the temp audit file back as an array of raw JSONL lines. */
function readLines() {
  if (!fs.existsSync(TMP_AUDIT)) return [];
  return fs
    .readFileSync(TMP_AUDIT, 'utf-8')
    .split('\n')
    .filter((line) => line.trim() !== '');
}

beforeEach(() => {
  // Start every test from a clean slate: the log file should not exist yet.
  if (fs.existsSync(TMP_AUDIT)) fs.rmSync(TMP_AUDIT);
});

afterAll(() => {
  if (fs.existsSync(TMP_AUDIT)) fs.rmSync(TMP_AUDIT);
});

describe('logAction()', () => {
  const validEntry = {
    action: 'order_created',
    status: 'success',
    order_id: 'order_test_1',
    amount_paise: 49900,
  };

  test('creates the audit log file if it does not exist', () => {
    expect(fs.existsSync(TMP_AUDIT)).toBe(false);
    logAction(validEntry);
    expect(fs.existsSync(TMP_AUDIT)).toBe(true);
    expect(readLines()).toHaveLength(1);
  });

  test('appends (does not overwrite) on subsequent calls', () => {
    logAction({ ...validEntry, order_id: 'order_a' });
    logAction({ ...validEntry, order_id: 'order_b' });
    logAction({ ...validEntry, order_id: 'order_c' });

    const ids = readLines().map((line) => JSON.parse(line).order_id);
    expect(ids).toEqual(['order_a', 'order_b', 'order_c']); // all three, in append order
  });

  test('writes exactly one valid JSON object per line, matching the audit schema', () => {
    logAction({ action: 'order_created', status: 'success' });
    logAction({ action: 'payment_captured', status: 'success' });

    const lines = readLines();
    expect(lines).toHaveLength(2);

    const expectedKeys = [
      'action',
      'agent_reasoning',
      'amount_paise',
      'currency',
      'order_id',
      'product_id',
      'session_id',
      'status',
      'timestamp',
    ].sort();

    for (const line of lines) {
      const record = JSON.parse(line); // throws (and fails the test) if not valid JSON
      expect(Object.keys(record).sort()).toEqual(expectedKeys);
      expect(record).toMatchObject({
        timestamp: expect.any(String),
        action: expect.any(String),
        currency: expect.any(String),
        status: expect.any(String),
      });
    }
  });

  test('auto-stamps a valid ISO-8601 timestamp when the caller omits one', () => {
    const before = Date.now();
    const record = logAction({ action: 'link_sent', status: 'success' });
    const after = Date.now();

    const stamped = Date.parse(record.timestamp);
    expect(Number.isNaN(stamped)).toBe(false); // parseable ISO-8601
    expect(stamped).toBeGreaterThanOrEqual(before - 1000);
    expect(stamped).toBeLessThanOrEqual(after + 1000);
  });

  test('throws when a required field (action / status) is missing', () => {
    expect(() => logAction({})).toThrow(/required/i); // action missing first
    expect(() => logAction({ action: 'order_created' })).toThrow(/status/i); // status missing
    expect(() => logAction({ status: 'success' })).toThrow(/action/i); // action missing

    // A rejected entry must NOT be written to the trail.
    expect(readLines()).toHaveLength(0);
  });
});

describe('readAudit()', () => {
  test('returns [] when the log file does not exist', () => {
    expect(fs.existsSync(TMP_AUDIT)).toBe(false);
    expect(readAudit()).toEqual([]);
  });

  test('returns records newest-first', () => {
    logAction({ action: 'order_created', status: 'success', timestamp: '2025-01-01T00:00:00.000Z' });
    logAction({ action: 'payment_captured', status: 'success', timestamp: '2025-06-01T00:00:00.000Z' });

    const actions = readAudit().map((r) => r.action);
    expect(actions).toEqual(['payment_captured', 'order_created']); // June before January
  });
});
