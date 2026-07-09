// Deterministic HTML injection. Reads index.template.html (source, human-edited, never
// served) + data.json (single source of numbers), writes index.html (served, never
// hand-edited). No LLM writes a number into HTML: every figure below is read out of
// data.json. Refuses to write if a marker region is missing, a token is unresolved, or
// an em/en dash appears in the output (house style forbids them).
const fs = require('fs');

const d = JSON.parse(fs.readFileSync('data.json', 'utf8'));

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Canonical window order, shared by the scorecard and the leaderboard table so one
// toggle controls both.
const WINS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'allTime', label: 'All time' },
];

const COLS = [
  { k: 'name', label: 'Closer', cls: '' },
  { k: 'dealsClosed', label: 'Deals closed', cls: 'num' },
  { k: 'cash', label: 'Cash collected', cls: 'num ok' },
  { k: 'callsBooked', label: 'Calls booked', cls: 'num' },
  { k: 'callsHeld', label: 'Calls held', cls: 'num' },
  { k: 'noShow', label: 'No show', cls: 'num' },
  { k: 'noShowRate', label: 'No show rate', cls: 'num' },
  { k: 'showed', label: 'Show', cls: 'num' },
  { k: 'showRate', label: 'Show rate', cls: 'num' },
  { k: 'closeRate', label: 'Close rate', cls: 'num' },
  { k: 'outboundCalls', label: 'Outbound calls', cls: 'num' },
  { k: 'inboundCalls', label: 'Inbound calls', cls: 'num' },
  { k: 'callHours', label: 'Call hours', cls: 'num' },
];

// The team-wide scorecard tiles, in display order, each pulled straight from data.totals.
const SCORECARD_TILES = [
  { k: 'cash', label: 'Total cash collected', cls: 'ok' },
  { k: 'dealsClosed', label: 'Total deals closed', cls: '' },
  { k: 'callsBooked', label: 'Total calls booked', cls: '' },
  { k: 'callsHeld', label: 'Total calls held', cls: '' },
  { k: 'noShow', label: 'Total no show', cls: '' },
  { k: 'noShowRate', label: 'No show rate', cls: '' },
  { k: 'showed', label: 'Total show', cls: '' },
];

function medal(rank) {
  if (rank === 1) return '<span class="medal g">1</span>';
  if (rank === 2) return '<span class="medal s">2</span>';
  if (rank === 3) return '<span class="medal b">3</span>';
  return '<span class="medal">' + rank + '</span>';
}

function buildTable(winKey, rows, totals) {
  const head = '<tr><th></th>' + COLS.map(c => '<th class="' + c.cls + '">' + c.label + '</th>').join('') + '</tr>';
  const body = rows.map(r => {
    const cells = COLS.map(c => {
      const raw = c.k === 'callHours' ? Number(r[c.k]).toFixed(1) : r[c.k];
      const v = c.k === 'name' ? esc(r.name) : esc(raw);
      return '<td class="' + c.cls + '">' + v + '</td>';
    }).join('');
    return '<tr><td class="rank">' + medal(r.rank) + '</td>' + cells + '</tr>';
  }).join('\n');
  const totalCells = COLS.map(c => {
    if (c.k === 'name') return '<td class="foot">Team total</td>';
    const raw = c.k === 'callHours' ? Number(totals[c.k]).toFixed(1) : totals[c.k];
    return '<td class="num foot">' + esc(raw) + '</td>';
  }).join('');
  const foot = '<tr class="totalrow"><td></td>' + totalCells + '</tr>';
  return '<div class="boardwrap"><table class="board">' +
    '<thead>' + head + '</thead><tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>';
}

// Shared toggle: one set of buttons controls every .wpanel on the page, in whichever
// section it lives, since both the scorecard and the leaderboard table render their
// panels with the same data-win attribute and .wpanel class.
function buildWindowTabs() {
  const tabs = WINS.map((w, i) =>
    '<button class="wtab' + (i === 0 ? ' active' : '') + '" data-win="' + w.key + '" onclick="slSwitchWindow(\'' + w.key + '\')">' + esc(w.label) + '</button>'
  ).join('');
  const script = '<script>function slSwitchWindow(k){' +
    'document.querySelectorAll(".wtab").forEach(function(b){b.classList.toggle("active", b.dataset.win===k);});' +
    'document.querySelectorAll(".wpanel").forEach(function(p){p.classList.toggle("active", p.dataset.win===k);});' +
    '}</script>';
  return '<div class="wtabs">' + tabs + '</div>' + script;
}

function buildScorecardBlock() {
  const panels = WINS.map((w, i) => {
    const t = d.totals[w.key];
    const tiles = SCORECARD_TILES.map(tile =>
      '<div class="tile"><div class="tv ' + tile.cls + '">' + esc(t[tile.k]) + '</div><div class="tl">' + esc(tile.label) + '</div></div>'
    ).join('');
    return '<div class="wpanel' + (i === 0 ? ' active' : '') + '" data-win="' + w.key + '">' +
      '<div class="wlabel">' + esc(d.windows[w.key].label) + '</div>' +
      '<div class="tiles">' + tiles + '</div>' +
      '</div>';
  }).join('\n');
  return buildWindowTabs() + panels;
}

function buildLeaderboardBlock() {
  const panels = WINS.map((w, i) =>
    '<div class="wpanel' + (i === 0 ? ' active' : '') + '" data-win="' + w.key + '">' +
    '<div class="wlabel">' + esc(d.windows[w.key].label) + '</div>' +
    buildTable(w.key, d.leaderboard[w.key], d.totals[w.key]) +
    '</div>'
  ).join('\n');
  return panels;
}

function buildAuditBlock() {
  const a = d.audit;
  const items = [
    ['Opportunities pulled from the pipeline board', a.totalOpportunitiesPulled],
    ['Excluded as internal/test records', a.excludedTestRecords],
    ['Calls all time by non-closer team members (setters, VAs), excluded from the board', a.nonCloserCallsAllTime],
    ['Cash collected all time not yet attributed to a closer', a.unattributedCashAllTime],
  ];
  return '<table class="audit"><tbody>' + items.map(([l, v]) =>
    '<tr><td>' + esc(l) + '</td><td class="num">' + esc(v) + '</td></tr>'
  ).join('') + '</tbody></table>';
}

let html = fs.readFileSync('index.template.html', 'utf8');

// --- Marker region: SCORECARD ---
const reSc = /<!--SCORECARD_START-->[\s\S]*?<!--SCORECARD_END-->/;
if (!reSc.test(html)) { console.error('ERROR: SCORECARD markers not found'); process.exit(1); }
html = html.replace(reSc, '<!--SCORECARD_START-->' + buildScorecardBlock() + '<!--SCORECARD_END-->');

// --- Marker region: LEADERBOARD ---
const reLb = /<!--LEADERBOARD_START-->[\s\S]*?<!--LEADERBOARD_END-->/;
if (!reLb.test(html)) { console.error('ERROR: LEADERBOARD markers not found'); process.exit(1); }
html = html.replace(reLb, '<!--LEADERBOARD_START-->' + buildLeaderboardBlock() + '<!--LEADERBOARD_END-->');

// --- Marker region: AUDIT ---
const reAudit = /<!--AUDIT_START-->[\s\S]*?<!--AUDIT_END-->/;
if (!reAudit.test(html)) { console.error('ERROR: AUDIT markers not found'); process.exit(1); }
html = html.replace(reAudit, '<!--AUDIT_START-->' + buildAuditBlock() + '<!--AUDIT_END-->');

// --- Live tokens: {%dotted.path%} filled from data.json ---
function flatten(obj, prefix, out) {
  const keys = Array.isArray(obj) ? obj.map((_, i) => i) : Object.keys(obj);
  for (const k of keys) {
    const v = obj[k];
    const key = prefix ? prefix + '.' + k : String(k);
    if (v && typeof v === 'object') {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}
const T = flatten(d, '', {});
html = html.replace(/\{%\s*([a-zA-Z0-9_.]+)\s*%\}/g, (m, key) => (key in T ? esc(T[key]) : m));
const leftover = html.match(/\{%\s*[a-zA-Z0-9_.]+\s*%\}/g);
if (leftover) {
  console.error('ERROR: unresolved live tokens: ' + [...new Set(leftover)].join(', '));
  process.exit(1);
}

// --- Dash guard: no em/en dashes anywhere in the rendered output ---
const DASH = /[–—]/;
if (DASH.test(html)) {
  console.error('ERROR: em/en dash in rendered output');
  process.exit(1);
}

fs.writeFileSync('index.html', html);
console.log('OK index.html written from data.json (asOf ' + d.asOf + ')');
