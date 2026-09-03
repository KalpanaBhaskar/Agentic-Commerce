// src/audit/viewer.js — CLI pretty-printer for the audit trail (Feature 7).
//
// This is the "audit trail visible" demo tool (CLAUDE.md §0): it renders every
// money action as a readable, fixed-width table so a judge can see — at a glance —
// what the agent did, for how much, and why.
//
// Usage:
//   npm run audit
//   npm run audit -- --action=payment_captured
//   node src/audit/viewer.js --action=order_created --limit=20
//   node src/audit/viewer.js --help
//
// Read-only: it uses the shared readAudit() (newest first, tolerant of a missing
// file / corrupt lines) and NEVER writes to the audit trail.

const { readAudit, ACTIONS } = require('./logger');

// Table columns, in display order. `align: 'right'` right-justifies a column
// (used for the money column so amounts line up on the decimal).
const COLUMNS = [
  { key: 'timestamp', header: 'TIMESTAMP', align: 'left' },
  { key: 'action', header: 'ACTION', align: 'left' },
  { key: 'order_id', header: 'ORDER_ID', align: 'left' },
  { key: 'amount_inr', header: 'AMOUNT_INR', align: 'right' },
  { key: 'status', header: 'STATUS', align: 'left' },
  { key: 'reasoning', header: 'REASONING', align: 'left' },
];

const REASONING_MAX = 40; // truncate agent_reasoning to keep the row readable
const EMPTY = '—'; // shown for null/absent cells (distinct from the '---' rule)

/**
 * Parse CLI flags. Supports: --action=<value>, --limit=<n>, --help/-h.
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {{action:(string|null), limit:(number|null), help:boolean}}
 */
function parseArgs(argv) {
  const args = { action: null, limit: null, help: false };
  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.help = true;
    } else if (raw.startsWith('--action=')) {
      args.action = raw.slice('--action='.length).trim();
    } else if (raw.startsWith('--limit=')) {
      const n = Number(raw.slice('--limit='.length));
      if (Number.isInteger(n) && n > 0) args.limit = n;
    }
  }
  return args;
}

/** ISO-8601 timestamp -> compact "YYYY-MM-DD HH:MM:SS"; falls back to raw. */
function formatTimestamp(ts) {
  const s = String(ts ?? '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : s || EMPTY;
}

/** paise (integer) -> "₹1,999.00"; EMPTY for null/non-numeric. */
function formatAmountInr(paise) {
  if (paise === null || paise === undefined || paise === '') return EMPTY;
  const n = Number(paise);
  if (!Number.isFinite(n)) return EMPTY;
  return '₹' + (n / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Truncate to `max` chars total, using a trailing ellipsis when clipped. */
function truncate(text, max) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

/** Map one audit record to its display row (all cells are strings). */
function toRow(record) {
  return {
    timestamp: formatTimestamp(record.timestamp),
    action: String(record.action ?? EMPTY),
    order_id: String(record.order_id ?? EMPTY),
    amount_inr: formatAmountInr(record.amount_paise),
    status: String(record.status ?? EMPTY),
    reasoning: truncate(record.agent_reasoning ?? EMPTY, REASONING_MAX),
  };
}

/**
 * Render rows as a fixed-width table (header + rule + body). Column widths are
 * the max of the header and every cell in that column.
 * @param {object[]} rows  rows from toRow()
 * @returns {string}
 */
function renderTable(rows) {
  const widths = {};
  for (const col of COLUMNS) widths[col.key] = col.header.length;
  for (const row of rows) {
    for (const col of COLUMNS) {
      widths[col.key] = Math.max(widths[col.key], row[col.key].length);
    }
  }

  const pad = (text, col) =>
    col.align === 'right' ? text.padStart(widths[col.key]) : text.padEnd(widths[col.key]);
  const line = (cells) => cells.join('  '); // 2-space gutter between columns

  const header = line(COLUMNS.map((c) => pad(c.header, c)));
  const rule = line(COLUMNS.map((c) => '-'.repeat(widths[c.key])));
  const body = rows.map((r) => line(COLUMNS.map((c) => pad(r[c.key], c))));

  return [header, rule, ...body].join('\n');
}

function printHelp() {
  console.log(
    [
      'RazorAgent audit viewer — pretty-print the money-action audit trail.',
      '',
      'Usage:',
      '  npm run audit',
      '  npm run audit -- --action=<action>   filter to one action type',
      '  npm run audit -- --limit=<n>         show only the newest n entries',
      '',
      `Actions: ${ACTIONS.join(', ')}`,
    ].join('\n')
  );
}

/** Entry point: parse args, read + filter the trail, print the table. */
function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  let records = readAudit(); // newest first, tolerant of missing/corrupt lines
  if (args.action) records = records.filter((r) => r.action === args.action);
  if (args.limit) records = records.slice(0, args.limit);

  const title = 'RazorAgent — Audit Trail' + (args.action ? ` (action=${args.action})` : '');
  console.log('\n' + title);

  if (records.length === 0) {
    console.log(
      args.action
        ? `No audit entries for action="${args.action}".\n`
        : 'No audit entries yet. Money actions will appear here as they happen.\n'
    );
    return;
  }

  console.log(`${records.length} entr${records.length === 1 ? 'y' : 'ies'} (newest first)\n`);
  console.log(renderTable(records.map(toRow)));
  console.log('');
}

// Run only when invoked directly, so the helpers can be unit-tested on import.
if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  formatTimestamp,
  formatAmountInr,
  truncate,
  toRow,
  renderTable,
  main,
};
