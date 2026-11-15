/* 🎻 Curren-Sing — the world's currencies, played by an orchestra

   HOW THE MUSIC IS MADE — every note can be explained:
   1. CONDUCTOR (Gemini, or maths if offline) looks at the whole world every phrase (4 bars) and picks
      a classical "character": Pastorale · Cantabile · Misterioso · Agitato · Grandioso
      → that sets the KEY (C major / A minor), TEMPO marking, DYNAMICS and CHORD PROGRESSION.
   2. HARMONY: each bar has one chord from that progression (e.g. i – iv – V – i). Every phrase ends with
      a cadence, like real classical music.
   3. MUSICIANS: each instrument follows its own currency:
      - where the currency sits in its recent range → how high the instrument plays
      - strong beats land on CHORD notes, weak beats move ONE STEP towards the currency (passing notes)
      - a currency in a bad place → gently louder; a sudden big move → one accented note (sforzando)
   4. The SCORE panel shows, for every instrument, the note it just played and why.
*/

// ---------------- orchestra ----------------
const SAMPLE_BASE = 'https://nbrosowsky.github.io/tonejs-instruments/samples/';
const INSTRUMENTS = [
  { id: 'violin',      label: 'Violin',      color: '#7dd3fc', gain: -9,  def: 'USD', lo: 64, hi: 86, notes: ['A3', 'C4', 'E4', 'G4', 'A4', 'C5', 'E5', 'G5', 'A5', 'C6'] },
  { id: 'cello',       label: 'Cello',       color: '#fca5a5', gain: -7,  def: 'GBP', lo: 43, hi: 62, notes: ['C2', 'E2', 'G2', 'A2', 'C3', 'E3', 'G3', 'A3', 'C4'] },
  { id: 'flute',       label: 'Flute',       color: '#bef264', gain: -11, def: 'JPY', lo: 69, hi: 88, notes: ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'] },
  { id: 'harp',        label: 'Harp',        color: '#f0abfc', gain: -11, def: 'CHF', lo: 52, hi: 79, notes: ['C3', 'E3', 'G3', 'A4', 'C5', 'E5', 'G5'] },
  { id: 'piano',       label: 'Piano',       color: '#ffffff', gain: -13, def: 'EUR', lo: 45, hi: 67, notes: ['C2', 'G2', 'C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6'] },
  { id: 'french-horn', label: 'French horn', color: '#fde68a', gain: -11, def: 'AUD', lo: 48, hi: 65, notes: ['C2', 'G2', 'D3', 'F3', 'A3', 'C4'] },
  { id: 'contrabass',  label: 'Double bass', color: '#c4b5fd', gain: -7,  def: 'CAD', lo: 33, hi: 50, notes: ['C2', 'D2', 'E2', 'A2', 'E3'] },
];
const NI = INSTRUMENTS.length;
const [VLN, VC, FL, HP, PNO, HN, CB] = [0, 1, 2, 3, 4, 5, 6];
const BASKET = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD'];  // "the world" a currency is measured against

// ---------------- classical harmony ----------------
const KEYS = {
  major: { name: 'C major', tonic: 60, steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'A minor', tonic: 57, steps: [0, 2, 3, 5, 7, 8, 11] },   // harmonic minor → a real V chord (E–G#–B)
};
const DEGREE = { I: 0, i: 0, ii: 1, iii: 2, III: 2, IV: 3, iv: 3, V: 4, v: 4, vi: 5, VI: 5, vii: 6, VII: 6 };
const PROGRESSIONS = {
  'I–IV–V–I': ['I', 'IV', 'V', 'I'], 'I–vi–ii–V': ['I', 'vi', 'ii', 'V'], 'I–ii–V–I': ['I', 'ii', 'V', 'I'], 'I–IV–I–V': ['I', 'IV', 'I', 'V'],
  'i–iv–V–i': ['i', 'iv', 'V', 'i'], 'i–VI–iv–V': ['i', 'VI', 'iv', 'V'], 'i–iv–VI–V': ['i', 'iv', 'VI', 'V'],
};
const TEMPI = { Adagio: 60, Andante: 76, Moderato: 96, Allegro: 120, Presto: 140 };
const DYN = { p: 0.35, mp: 0.45, mf: 0.55, f: 0.7, ff: 0.85 };
const CHARACTERS = {
  Pastorale:  { mode: 'major', tempo: 'Andante',  dyn: 'mf', prog: 'I–IV–V–I',  blurb: 'calm and pastoral' },
  Cantabile:  { mode: 'major', tempo: 'Moderato', dyn: 'mf', prog: 'I–vi–ii–V', blurb: 'singing, a little restless' },
  Misterioso: { mode: 'minor', tempo: 'Andante',  dyn: 'mp', prog: 'i–VI–iv–V', blurb: 'uneasy and mysterious' },
  Agitato:    { mode: 'minor', tempo: 'Allegro',  dyn: 'f',  prog: 'i–iv–V–i',  blurb: 'agitated and tense' },
  Grandioso:  { mode: 'minor', tempo: 'Presto',   dyn: 'ff', prog: 'i–iv–V–i',  blurb: 'grand and dramatic — full orchestra' },
};
const TENSE = c => c === 'Agitato' || c === 'Grandioso';

const MAX_ROWS = 20000;
const VIEW_ROWS = 520;          // how much history the main graph shows (~2 years of daily data)
const ACCENT_Z = 3.2;           // a move this surprising → one sudden accented note
const ACCENT_GAP = 24;          // at least this many notes between two accents on the same instrument
const JUMPS = [
  ['Start', null], ['2008 financial crisis', '2008-08-01'], ['Euro debt crisis', '2011-07-01'],
  ['Brexit vote', '2016-06-01'], ['COVID crash', '2020-02-15'], ['2022 energy shock', '2022-02-01'],
];

// ---------------- state ----------------
const S = {
  ready: false, playing: false, mode: 'generic',
  names: [], raw: [], view: -1,
  cur: [],            // every currency: { name, value[], z[], stress[], level[], chg[], dev[], volR[] }
  assign: [],         // assign[k] = index into S.cur for instrument k
  dates: [], n: 0, world: [], spark: [],
  idx: 0, stride: 3, step: 0, bar: 0, Ws: 0,
  dir: null, numeral: 'I', chord: [], vel: 0.55,
  on: { horn: false, timp: false, drum: false },
  last: Array(NI).fill(null), why: Array(NI).fill(null),
  muted: Array(NI).fill(false), pulse: Array(NI).fill(0), accent: Array(NI).fill(false), lastAccent: Array(NI).fill(-1e9),
  events: [], yr: 5, showScore: true,
  inst: null, timp: null, drum: null,
  aiDir: null, aiMood: null, aiRow: -1e9, aiText: '', aiInflight: 0, aiPending: new Set(), aiLat: 8, aiFails: 0, aiLog: [],
  aiCache: new Map(),   // Gemini's plans for upcoming phrases: data row → { dir, mood, text }
};

// ---------------- helpers ----------------
const mean  = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const $ = id => document.getElementById(id);
const setStatus = t => { $('status').textContent = t; };
const setAI = t => { $('aiStatus').textContent = t; };
const event = text => { S.events.push({ text, until: performance.now() + 4000 }); if (S.events.length > 4) S.events.shift(); };
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const toNote = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const pcName = pc => NOTE_NAMES[((pc % 12) + 12) % 12];
const nearest = (arr, t) => arr.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), arr[0]);

// =====================================================
// DATA
// =====================================================
function demoData(n = 1500) {
  const names = ['USD', 'GBP', 'JPY', 'CHF', 'EUR', 'AUD', 'CAD', 'CNY'];
  const crises = [[350, 560], [950, 1160]];
  const dates = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2015, 0, 1) + i * 86400000).toISOString().slice(0, 10));
  const prices = names.map((_, k) => {
    let p = 1; const out = [];
    for (let i = 0; i < n; i++) {
      const crisis = crises.some(([a, b]) => i >= a && i < b);
      const sigma = (crisis ? 0.010 : 0.0025) * (0.8 + 0.08 * k);
      const jolt = Math.random() < 0.004 ? (Math.random() - 0.5) * 0.06 : 0;   // rare sudden moves
      p *= 1 + (Math.random() - 0.5) * 2 * sigma + (crisis ? (k % 2 ? 0.0015 : -0.0015) : 0) + jolt;
      out.push(p);
    }
    return out;
  });
  return { names, prices, dates, mode: 'generic' };
}

// Reads the ECB file (Date, USD, JPY, … = units per 1 EUR) or generic wide / long CSVs.
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const delim = lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
  const clean = c => c.trim().replace(/^"|"$/g, '');
  const head = lines[0].split(delim).map(clean);
  const lower = head.map(h => h.toLowerCase());
  const rows = lines.slice(1).map(l => l.split(delim).map(clean));

  const dateCol  = lower.findIndex(h => /date|time/.test(h));
  const pairCol  = lower.findIndex(h => /pair|symbol|ccy|instrument|ticker|currency/.test(h));
  const priceCol = lower.findIndex(h => /^(mid|close|price|rate|last)/.test(h));
  const bidCol   = lower.findIndex(h => /bid/.test(h));
  const askCol   = lower.findIndex(h => /ask|offer/.test(h));
  const getPrice = r => priceCol >= 0 ? parseFloat(r[priceCol])
    : (bidCol >= 0 && askCol >= 0 ? (parseFloat(r[bidCol]) + parseFloat(r[askCol])) / 2 : NaN);

  if (pairCol >= 0 && (priceCol >= 0 || (bidCol >= 0 && askCol >= 0))) {       // long format
    const groups = new Map(), dates = new Map();
    for (const r of rows) {
      const p = getPrice(r); if (!isFinite(p)) continue;
      const k = r[pairCol];
      if (!groups.has(k)) { groups.set(k, []); dates.set(k, []); }
      groups.get(k).push(p); dates.get(k).push(dateCol >= 0 ? r[dateCol] : '');
    }
    const top = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 16);
    return { names: top.map(t => t[0]), prices: top.map(t => t[1]), dates: dates.get(top[0]?.[0]) || [], mode: 'generic' };
  }

  const skip = /^(time|date|datetime|timestamp|ts|id|index)$|volume|qty|size|count/;     // wide format
  const cols = head.map((_, i) => i).filter(i => {
    if (skip.test(lower[i]) || i === dateCol || !head[i]) return false;
    const ok = rows.reduce((s, r) => s + (isFinite(parseFloat(r[i])) ? 1 : 0), 0);
    return ok >= rows.length * 0.7;                                   // drop currencies that stopped existing
  });
  const prices = cols.map(i => {                                       // fill gaps with the last known value
    const raw = rows.map(r => parseFloat(r[i]));
    let last = raw.find(isFinite);
    return raw.map(x => (isFinite(x) ? (last = x) : last));
  });
  const names = cols.map(i => head[i]);
  const isECB = ['USD', 'JPY', 'GBP'].every(c => names.includes(c));
  return { names, prices, dates: dateCol >= 0 ? rows.map(r => r[dateCol]) : [], mode: isECB ? 'per-eur' : 'generic' };
}

// rolling mean & standard deviation using running sums (fast — no freezing)
function rolling(arr, w) {
  const n = arr.length, m = new Float64Array(n), sd = new Float64Array(n);
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    s += arr[i]; s2 += arr[i] * arr[i];
    if (i >= w) { s -= arr[i - w]; s2 -= arr[i - w] * arr[i - w]; }
    const c = Math.min(i + 1, w);
    m[i] = s / c; sd[i] = Math.sqrt(Math.max(0, s2 / c - m[i] * m[i]));
  }
  return { m, sd };
}

// Everything the music needs to know about one currency's value over time.
function currencyStats(name, p) {
  const ret = p.map((x, i) => (i ? Math.log(x / p[i - 1]) : 0));
  const vol60 = rolling(ret, 60).sd;                                    // what "a normal move" looked like lately
  const vol = rolling(ret, 20).sd;
  const sortedVol = Array.from(vol).sort((a, b) => a - b);
  const volMed = sortedVol[Math.floor(sortedVol.length / 2)] || 1e-9;
  const { m, sd } = rolling(p, 250);                                     // ~1 year = "normal level"
  const dev = p.map((x, i) => (sd[i] > 0 ? (x - m[i]) / sd[i] : 0));
  const volR = Array.from(vol, v => (volMed > 1e-12 ? v / volMed : 1));
  // level = where today's value sits in the last ~3 months (0 = lowest, 1 = highest)
  const level = p.map((x, i) => {
    let lo = Infinity, hi = -Infinity;
    for (let j = Math.max(0, i - 63); j <= i; j++) { if (p[j] < lo) lo = p[j]; if (p[j] > hi) hi = p[j]; }
    return hi - lo > 1e-12 ? (x - lo) / (hi - lo) : 0.5;
  });
  return {
    name, value: p, level, dev, volR,
    z: ret.map((r, i) => (i > 20 && vol60[i - 1] > 1e-12 ? r / vol60[i - 1] : 0)),  // how surprising today's move is
    stress: p.map((_, i) => clamp(0.5 * clamp(Math.abs(dev[i]) / 2.5, 0, 1) + 0.5 * clamp((volR[i] - 1) / 2, 0, 1), 0, 1)),
    chg: p.map((x, i) => (i >= 21 ? (x / p[i - 21] - 1) * 100 : 0)),
  };
}

// "View from": measure every currency in the chosen currency (b), or against the world basket (b = -1).
function applyView(b) {
  S.view = b;
  S.cur = S.raw.map((p, c) => currencyStats(S.names[c], b < 0 ? p : p.map((x, i) => x / S.raw[b][i])));
  S.aiCache = new Map(); S.ver = (S.ver || 0) + 1;   // Gemini's plans were made from the old point of view
  const label = b < 0 ? 'the world basket' : S.names[b];
  setStatus(`👀 Viewing every currency from ${label}${b >= 0 ? ` (${S.names[b]} itself is the flat line)` : ''}`);
}

function prepare({ names, prices, dates = [], mode = 'generic' }) {
  if (!prices.length || prices[0].length < 60) {
    setStatus('⚠️ Could not find price columns. Send the first few lines of the file to Claude.');
    return;
  }
  names = [...names]; prices = prices.map(p => [...p]); dates = [...dates];
  let n = Math.min(...prices.map(p => p.length));
  prices = prices.map(p => p.slice(0, n)); dates = dates.slice(0, n);
  if (dates.length > 1 && Date.parse(dates[0]) > Date.parse(dates[dates.length - 1])) {   // newest-first files
    prices.forEach(p => p.reverse()); dates.reverse();
  }
  // ECB rates are "units per 1 EUR" → turn every currency (and EUR) into strength vs a world basket
  if (mode === 'per-eur') {
    names.push('EUR'); prices.push(Array(n).fill(1));
    const worth = prices.map(p => p.map(x => 1 / x));
    const basket = BASKET.map(c => names.indexOf(c)).filter(k => k >= 0);
    const gm = Array.from({ length: n }, (_, i) => Math.exp(mean(basket.map(k => Math.log(worth[k][i])))));
    prices = worth.map(w => w.map((x, i) => x / gm[i]));
  }
  const thin = Math.ceil(n / MAX_ROWS);
  if (thin > 1) { prices = prices.map(p => p.filter((_, i) => i % thin === 0)); dates = dates.filter((_, i) => i % thin === 0); }
  n = prices[0].length;

  S.names = names; S.raw = prices; S.view = -1;
  S.cur = prices.map((p, c) => currencyStats(names[c], p));

  // world condition = average stress of ALL currencies (from the world basket) → ranked 0…1
  const raw = Array.from({ length: n }, (_, i) => mean(S.cur.map(c => c.stress[i])));
  const sorted = [...raw].sort((a, b) => a - b);
  const rank = x => { let lo = 0, hi = sorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < x) lo = mid + 1; else hi = mid; } return lo / sorted.length; };
  S.world = raw.map(x => Math.pow(rank(x), 1.6));
  S.spark = Array.from({ length: 400 }, (_, j) => S.world[Math.floor(j / 400 * (n - 1))]);

  const used = new Set();                                                // default seating
  S.assign = INSTRUMENTS.map(def => {
    let c = S.cur.findIndex(x => x.name.toUpperCase() === def.def);
    if (c < 0 || used.has(c)) c = S.cur.findIndex((_, j) => !used.has(j));
    if (c < 0) c = 0;
    used.add(c); return c;
  });

  S.dates = dates; S.n = n; S.mode = mode;
  S.idx = 0; S.step = 0; S.bar = 0; S.Ws = S.world[0];
  S.dir = null; S.on = { horn: false, timp: false, drum: false };
  S.last = Array(NI).fill(null); S.why = Array(NI).fill(null); S.lastAccent = Array(NI).fill(-1e9);
  S.aiDir = null; S.aiMood = null; S.aiText = ''; S.aiLog = []; S.aiFails = 0; S.aiRetryAt = 0; S.events = [];
  S.aiPending = new Set(); S.ver = (S.ver || 0) + 1;
  S.aiCache = new Map();
  S.ready = true;
  buildSeating(); buildViewMenu();
  $('jump').disabled = !dates.length;
  setStatus(`Loaded ${n} days · ${S.cur.length} currencies${dates.length ? ` · ${dates[0]} → ${dates[n - 1]}` : ''}`);
}

// =====================================================
// AUDIO SET-UP (Tone.js)
// =====================================================
function setupAudio() {
  const limiter = new Tone.Limiter(-1).toDestination();
  const reverb = new Tone.Reverb({ decay: 3.2, wet: 0.28 }).connect(limiter);
  let loaded = 0;
  S.inst = INSTRUMENTS.map((def, k) => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 12,
      oscillator: { type: k === CB ? 'sine' : 'triangle' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.8 },
    }).connect(reverb);
    const ins = { ready: false, synth, db: def.gain };
    ins.sampler = new Tone.Sampler({
      urls: Object.fromEntries(def.notes.map(nt => [nt, nt + '.mp3'])),
      baseUrl: SAMPLE_BASE + def.id + '/',
      release: 1,
      onload: () => { ins.ready = true; loaded++; setStatus(`🎻 Orchestra loading… ${loaded}/${NI} instruments ready`); },
      onerror: e => console.warn(def.id, 'samples failed — using synth instead', e),
    }).connect(reverb);
    ins.sampler.volume.value = def.gain; ins.synth.volume.value = def.gain - 4;
    return ins;
  });
  S.timp = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 1.5, envelope: { attack: 0.001, decay: 0.9, sustain: 0 } }).connect(reverb);
  S.timp.volume.value = -8;
  S.drum = new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 4, envelope: { attack: 0.001, decay: 1.6, sustain: 0 } }).connect(reverb);
  S.drum.volume.value = -6;
  Tone.Transport.bpm.value = 76;
  Tone.Transport.scheduleRepeat(onStep, '8n');
}

// =====================================================
// CONDUCTOR — chooses the character of each phrase
// =====================================================
function fallbackDirection(W) {
  const c = W < 0.3 ? 'Pastorale' : W < 0.5 ? 'Cantabile' : W < 0.68 ? 'Misterioso' : W < 0.85 ? 'Agitato' : 'Grandioso';
  return { character: c, ...CHARACTERS[c], source: 'maths', reason: `World tension is ${Math.round(W * 100)}%, so the piece is ${CHARACTERS[c].blurb}.` };
}

// make sure whatever Gemini returns is something the orchestra can actually play
function sanitizeDirection(d) {
  const c = CHARACTERS[d.character] ? d.character : fallbackDirection(S.Ws).character;
  const base = CHARACTERS[c];
  const mode = d.mode === 'major' || d.mode === 'minor' ? d.mode : base.mode;
  let prog = PROGRESSIONS[d.progression] ? d.progression : base.prog;
  if ((mode === 'major') !== prog.startsWith('I')) prog = mode === 'major' ? 'I–IV–V–I' : 'i–iv–V–i';
  return {
    character: c, mode, prog, blurb: base.blurb, source: 'Gemini',
    tempo: TEMPI[d.tempo] ? d.tempo : base.tempo,
    dyn: DYN[d.dynamics] ? d.dynamics : base.dyn,
    reason: d.commentary || base.blurb,
  };
}

function setDirection(d) {
  const prev = S.dir;
  S.dir = d;
  if (!prev || prev.character !== d.character) event(`🎼 ${d.character} — ${d.blurb}`);
  if (prev && prev.mode !== d.mode) event(d.mode === 'minor' ? '🎼 The music turns to A minor' : '🎼 Back to C major');
  if (!prev || prev.tempo !== d.tempo) Tone.Transport.bpm.rampTo(TEMPI[d.tempo], 6);       // tempo glides over ~6 s
  const want = { horn: TENSE(d.character), timp: TENSE(d.character) || d.character === 'Misterioso', drum: d.character === 'Grandioso' };
  if (want.horn && !S.on.horn) event('🎺 French horns join in');
  if (want.timp && !S.on.timp) event('🥁 Timpani enter');
  if (want.drum && !S.on.drum) event('🥁 A deep bass drum appears');
  S.on = want;
}

// =====================================================
// HARMONY HELPERS
// =====================================================
const keyOf = () => KEYS[S.dir.mode];
function chordPcs(key, numeral) {                 // e.g. 'V' in A minor → [E, G#, B] as pitch classes
  const d = DEGREE[numeral];
  return [0, 2, 4].map(o => (key.tonic + key.steps[(d + o) % 7]) % 12);
}
function inRange(lo, hi, test) { const out = []; for (let m = lo; m <= hi; m++) if (test(m)) out.push(m); return out; }
const chordTones = (lo, hi) => inRange(lo, hi, m => S.chord.includes(m % 12));
const scaleTones = (lo, hi) => { const k = keyOf(); return inRange(lo, hi, m => k.steps.includes(((m - k.tonic) % 12 + 12) % 12)); };
const chordName = () => S.chord.map(pcName).join('–');

// describe where a currency sits in plain words
function levelWord(l) { return l > 0.8 ? 'near its 3-month HIGH' : l > 0.6 ? 'fairly high' : l > 0.4 ? 'in the middle' : l > 0.2 ? 'fairly low' : 'near its 3-month LOW'; }
function moveWord(k, i) {
  const v = S.cur[S.assign[k]].value, p = v[Math.max(0, i - S.stride)];
  const pct = (v[i] / p - 1) * 100;
  return `${pct >= 0 ? '▲' : '▼'}${Math.abs(pct).toFixed(2)}%`;
}

// =====================================================
// ONE BAR = ONE CHORD
// =====================================================
function onBar(i) {
  // world tension (smoothed): maths, blended with Gemini's mood when it's fresh
  // new phrase every 4 bars → the conductor decides its character
  if (S.bar % 4 === 0) {
    const plan = cachedAI(i);                                          // did Gemini already plan this moment?
    if (plan) { S.aiDir = plan.dir; S.aiMood = plan.mood; S.aiText = plan.text; S.aiRow = i; S.aiTextDate = S.dates[i] || ''; }
  }
  const aiFresh = S.aiMood !== null && Math.abs(i - S.aiRow) < 32 * S.stride;
  const target = aiFresh ? 0.5 * S.world[i] + 0.5 * S.aiMood : S.world[i];
  S.Ws += 0.2 * (target - S.Ws);
  if (S.bar % 4 === 0) setDirection(aiFresh && S.aiDir ? S.aiDir : fallbackDirection(S.Ws));
  S.numeral = PROGRESSIONS[S.dir.prog][S.bar % 4];
  S.chord = chordPcs(keyOf(), S.numeral);
  S.bar++;

  S.vel += 0.25 * (DYN[S.dir.dyn] - S.vel);                         // dynamics change gradually
  S.inst.forEach((ins, k) => {                                        // a currency in a bad place → gently louder
    const want = INSTRUMENTS[k].gain + 6 * S.cur[S.assign[k]].stress[i];
    ins.db += 0.25 * (want - ins.db);
    ins.sampler.volume.value = ins.db; ins.synth.volume.value = ins.db - 4;
  });
}

// =====================================================
// ONE STEP = ONE EIGHTH NOTE
// =====================================================
function onStep(time) {
  try {
    if (!S.ready) return;
    const i = S.idx, pos = S.step % 8;
    if (pos === 0) onBar(i);
    const ch = S.dir.character, fast = TENSE(ch);
    const C = k => S.cur[S.assign[k]];

    // sudden surprising move since the last note → that instrument gets ONE accented note
    for (let k = 0; k < NI; k++) {
      let mz = 0;
      for (let j = Math.max(1, i - S.stride + 1); j <= i; j++) mz = Math.max(mz, Math.abs(C(k).z[j]));
      S.accent[k] = mz > ACCENT_Z && S.step - S.lastAccent[k] > ACCENT_GAP && !S.muted[k];
      if (S.accent[k]) { S.lastAccent[k] = S.step; event(`⚡ ${C(k).name} jolts ${moveWord(k, i)} — ${INSTRUMENTS[k].label} sforzando`); }
    }

    // play helper: records WHY each note was chosen
    const play = (k, midis, dur, reason) => {
      if (S.muted[k]) return;
      midis = [].concat(midis);
      const ins = S.inst[k], out = ins.ready ? ins.sampler : ins.synth;
      let vel = clamp(S.vel + 0.15 * C(k).stress[i], 0.2, 0.9);
      if (S.accent[k]) {                                               // sforzando: loud + doubled an octave up
        midis = [...midis, midis[midis.length - 1] + 12]; vel = 1;
        reason = `⚡ ${C(k).name} made a sudden move (${moveWord(k, i)}) → sforzando! ` + reason;
        S.accent[k] = false; S.pulse[k] = 1.6;
      } else S.pulse[k] = Math.max(S.pulse[k], 0.6);
      out.triggerAttackRelease(midis.map(toNote), dur, time, vel);
      S.last[k] = midis[0];
      S.why[k] = { note: midis.map(toNote).join(' '), reason };
    };

    // a MELODY note: strong beat → chord note near where the currency sits; weak beat → one step towards it
    const melody = (k, strong) => {
      const def = INSTRUMENTS[k], c = C(k), lvl = c.level[i];
      const target = def.lo + lvl * (def.hi - def.lo);
      const prev = S.last[k] ?? Math.round((def.lo + def.hi) / 2);
      if (strong) {
        let cands = chordTones(def.lo, def.hi).filter(m => Math.abs(m - prev) <= 7);   // no wild leaps
        if (!cands.length) cands = chordTones(def.lo, def.hi);
        const m = nearest(cands, target);
        return [m, `${c.name} is ${levelWord(lvl)} (${moveWord(k, i)}) → plays ${m > target + 1 ? 'just above' : m < target - 1 ? 'just below' : 'right at'} that height; strong beat → a chord note of ${S.numeral} (${chordName()})`];
      }
      const sc = scaleTones(def.lo, def.hi), at = sc.indexOf(nearest(sc, prev));
      const dir = target > prev + 1 ? 1 : target < prev - 1 ? -1 : 0;
      const m = sc[clamp(at + dir, 0, sc.length - 1)];
      return [m, dir
        ? `${c.name} ${moveWord(k, i)} is ${levelWord(lvl)}, ${dir > 0 ? 'above' : 'below'} the last note → one step ${dir > 0 ? 'up' : 'down'} the scale (passing note)`
        : `${c.name} ${moveWord(k, i)} is still ${levelWord(lvl)} → the melody stays on the same note`];
    };

    // ---- VIOLIN: the main melody ----
    if (fast || pos % 2 === 0) {
      if (!(ch === 'Misterioso' && pos % 4 !== 0)) {
        const [m, r] = melody(VLN, pos % 4 === 0);
        play(VLN, m, fast ? '8n' : ch === 'Misterioso' ? '2n' : '4n', r);
      }
    } else if (S.accent[VLN]) play(VLN, S.last[VLN] ?? 76, '8n', 'accent');

    // ---- FLUTE: answers the violin ----
    const fluteOn = ch === 'Pastorale' ? pos % 2 === 1 : fast ? pos % 2 === 1 : pos === 2 || pos === 6;
    if (fluteOn || S.accent[FL]) { const [m, r] = melody(FL, pos === 2 || pos === 6); play(FL, m, '8n', r); }

    // ---- CELLO: holds a chord note, moving smoothly (nearest note to the last one) ----
    if (pos === 0 || pos === 4 || S.accent[VC]) {
      const def = INSTRUMENTS[VC], c = C(VC), target = def.lo + c.level[i] * (def.hi - def.lo);
      const cands = chordTones(def.lo, def.hi).filter(m => m % 12 !== S.chord[0]);   // prefers 3rd / 5th of the chord
      const m = nearest(cands, S.last[VC] != null ? (S.last[VC] + target) / 2 : target);
      play(VC, m, '2n', `${c.name} is ${levelWord(c.level[i])} → cello holds ${toNote(m)}, the ${m % 12 === S.chord[1] ? '3rd' : '5th'} of ${S.numeral} (${chordName()}), moving as little as possible`);
    }

    // ---- DOUBLE BASS: the root of the chord (the foundation) ----
    const bassOn = fast ? pos % 2 === 0 : pos === 0 || pos === 4;
    if (bassOn || S.accent[CB]) {
      const def = INSTRUMENTS[CB], c = C(CB);
      const pc = pos === 4 && !fast ? S.chord[2] : S.chord[0];
      const cands = inRange(def.lo, def.hi, m => m % 12 === pc);
      const m = c.level[i] > 0.5 ? cands[cands.length - 1] : cands[0];
      play(CB, m, fast ? '8n' : '2n', `bass plays the ${pc === S.chord[0] ? 'root' : '5th'} of ${S.numeral} (${pcName(pc)}); ${c.name} is ${levelWord(c.level[i])} → ${m === cands[0] ? 'low' : 'high'} octave`);
    }

    // ---- PIANO: classical accompaniment (Alberti bass when calm, repeated chords when tense) ----
    {
      const def = INSTRUMENTS[PNO], c = C(PNO), base = c.level[i] > 0.5 ? def.lo + 7 : def.lo;
      const tones = chordTones(base, base + 14).slice(0, 4);
      if (!fast && ch !== 'Misterioso') {                               // Alberti: low – high – middle – high
        const pattern = [0, 2, 1, 2], m = tones[pattern[pos % 4]] ?? tones[0];
        play(PNO, m, '8n', `Alberti pattern (classic Mozart accompaniment) on ${S.numeral}; ${c.name} is ${levelWord(c.level[i])} → ${base > def.lo ? 'higher' : 'lower'} register`);
      } else if ((fast && pos % 2 === 0) || (ch === 'Misterioso' && pos === 0) || S.accent[PNO]) {
        play(PNO, tones.slice(0, 3), fast ? '8n' : '1m', `${fast ? 'repeated' : 'soft held'} ${S.numeral} chord (${chordName()}) — ${ch}; ${c.name} is ${levelWord(c.level[i])}`);
      }
    }

    // ---- HARP: arpeggio in the gaps, up if its currency is rising, down if falling ----
    if ((!fast && pos % 2 === 1) || (fast && pos === 0) || S.accent[HP]) {
      const def = INSTRUMENTS[HP], c = C(HP), v = c.value;
      const rising = v[i] >= v[Math.max(0, i - 5 * S.stride)];
      const tones = chordTones(def.lo, def.hi);
      if (fast) play(HP, tones.slice(0, 4), '4n', `strummed ${S.numeral} chord (tense music)`);
      else {
        const j = Math.floor(pos / 2), seq = rising ? tones : [...tones].reverse();
        const start = Math.floor(c.level[i] * Math.max(0, seq.length - 4));
        play(HP, seq[start + j] ?? seq[0], '8n', `${c.name} ${rising ? 'rising' : 'falling'} over the last weeks → arpeggio goes ${rising ? 'up' : 'down'} through ${chordName()}`);
      }
    }

    // ---- FRENCH HORN: only when the music is tense (or its own currency is in a bad place) ----
    if (((S.on.horn || C(HN).stress[i] > 0.6) && (pos === 0 || (ch === 'Grandioso' && pos === 4))) || S.accent[HN]) {
      const def = INSTRUMENTS[HN], c = C(HN);
      const m = nearest(chordTones(def.lo, def.hi), def.lo + c.level[i] * (def.hi - def.lo));
      play(HN, m, ch === 'Grandioso' ? '4n' : '1m', S.on.horn ? `${S.dir.character}: horns reinforce ${S.numeral}` : `${c.name} is in a bad place → its horn comes forward`);
    }

    // ---- TIMPANI (tuned to the tonic and dominant, like Beethoven) & DEEP DRUM ----
    const k = keyOf(), tonic = k.tonic % 12, dom = (k.tonic + 7) % 12;
    const timpPc = S.chord[0] === dom ? dom : tonic;
    if (S.on.timp && TENSE(ch) && (pos === 0 || pos === 4)) S.timp.triggerAttackRelease(toNote(36 + ((timpPc - 0 + 12) % 12)), '8n', time, 0.4 + 0.4 * S.Ws);
    if (S.on.timp && ch === 'Misterioso' && S.bar % 4 === 0 && pos >= 6) S.timp.triggerAttackRelease(toNote(36 + dom), '16n', time, 0.3);
    if (S.on.drum && pos === 0 && (S.bar % 4 === 1 || S.numeral === 'V')) S.drum.triggerAttackRelease('C1', '2n', time, 0.9);

    S.step++;
    S.idx = (i + S.stride) % S.n;
    prefetchAI();
  } catch (e) {
    console.error(e);
  }
}

// The data is history, so we can read AHEAD like a conductor reading the score:
// keep Gemini working on the next few phrases, so its plan is ready before each phrase begins.
function cachedAI(row) {
  let best = null, bd = Infinity;
  for (const [r, v] of S.aiCache) { const d = Math.abs(r - row); if (d < bd) { bd = d; best = v; } }
  return bd <= 16 * S.stride ? best : null;
}
function prefetchAI() {
  if (!S.ready) return;
  if (location.protocol === 'file:') { if (S.step % 32 === 1) setAI('🤖 Conductor offline — run "python app.py" and open http://localhost:5050'); return; }
  if (S.aiInflight >= 2 || Date.now() < (S.aiRetryAt || 0)) return;  // at most 2 questions at once
  const phraseRows = 32 * S.stride;
  const stepsLeft = (32 - (S.step % 32)) % 32;                         // eighth notes until the next phrase starts
  const nextStart = S.idx + stepsLeft * S.stride;                      // data row where the next phrase begins
  const bpm = Tone.Transport.bpm.value || 76;
  for (let k = 0; k < 4; k++) {                                        // look up to 4 phrases ahead
    const row = (nextStart + k * phraseRows) % S.n;
    if (cachedAI(row) || S.aiPending.has(row)) continue;
    // while playing, skip phrases Gemini can't finish in time (it has been taking ~S.aiLat seconds)
    const secsUntil = (stepsLeft + 32 * k) * 30 / bpm;
    if (S.playing && secsUntil < S.aiLat * 1.2) continue;
    askAI(row);
    return;
  }
}
// keep reading ahead even while paused (e.g. right after loading the CSV, before you press Play)
setInterval(prefetchAI, 1000);


// =====================================================
// AI CONDUCTOR — Gemini chooses the character of the next phrase (needs: python app.py)
// =====================================================
async function askAI(i) {
  S.aiInflight++; S.aiPending.add(i);
  const t0 = Date.now(), ver = S.ver;
  setAI(`📖 Gemini is reading ahead in the score (planning ${S.dates[i] || 'the next phrase'})…`);
  const snapshot = {
    date: S.dates[i] || `step ${i}`,
    note: S.view >= 0
      ? `Each value is the currency measured in ${S.names[S.view]} (the listener's point of view).`
      : S.mode === 'per-eur'
        ? "Each value is the currency's strength against a basket of major world currencies (from ECB daily rates)."
        : 'Values are prices as given in the data file.',
    world_tension_from_maths: +S.world[i].toFixed(2),
    current_character: S.dir?.character,
    orchestra: S.assign.map((c, k) => ({
      instrument: INSTRUMENTS[k].label,
      currency: S.cur[c].name,
      change_last_month_pct: +S.cur[c].chg[i].toFixed(2),
      distance_from_1yr_normal_sd: +S.cur[c].dev[i].toFixed(2),
      volatility_vs_usual: +S.cur[c].volR[i].toFixed(2),
    })),
  };
  try {
    const res = await fetch('/api/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || res.status);
    if (ver !== S.ver) return;                                  // answer belongs to old data / old view
    const plan = { dir: sanitizeDirection(out), mood: clamp(+out.mood || 0, 0, 1), text: `${out.headline} — ${out.commentary}` };
    S.aiCache.set(i, plan);
    S.aiLat = 0.7 * S.aiLat + 0.3 * ((Date.now() - t0) / 1000);   // how long Gemini usually takes
    if (S.aiCache.size > 300) S.aiCache.delete(S.aiCache.keys().next().value);   // keep memory small
    S.aiLog.push({ date: snapshot.date, mood: plan.mood, character: plan.dir.character, headline: out.headline, commentary: out.commentary });
    S.aiFails = 0; S.aiRetryAt = 0;
    const ahead = [...S.aiCache.keys()].filter(r => r > S.idx).length;
    setAI(`📖 Gemini is reading ahead in the score — ${ahead} upcoming phrase${ahead === 1 ? '' : 's'} planned (up to ${snapshot.date})${out.model ? ` · ${out.model}` : ''}`);
  } catch (e) {
    S.aiFails++;
    // never give up for good: wait a little longer after each failure (1, 2, 3… phrases, max 4), then try again
    S.aiRetryAt = Date.now() + 5000 * Math.min(S.aiFails, 6);   // wait 5 s, 10 s, … (max 30 s) before asking again
    const busy = /503|429|busy|high demand/i.test(e.message);
    setAI(`🤖 ${busy ? 'Gemini is busy right now' : 'AI error: ' + e.message.slice(0, 160)} — using maths, will try again shortly`);
  } finally {
    S.aiInflight--; S.aiPending.delete(i);
  }
}

// =====================================================
// CONTROLS
// =====================================================
function buildSeating() {
  const box = $('seating'); box.innerHTML = '';
  const order = S.cur.map((c, j) => [c.name, j]).sort((a, b) => a[0].localeCompare(b[0]));
  INSTRUMENTS.forEach((def, k) => {
    const row = document.createElement('div');
    row.className = 'seat' + (S.muted[k] ? ' off' : '');
    const dot = document.createElement('button');
    dot.className = 'dot'; dot.title = 'Mute / unmute';
    dot.style.borderColor = def.color; dot.style.background = S.muted[k] ? 'transparent' : def.color;
    dot.onclick = () => {
      S.muted[k] = !S.muted[k];
      row.classList.toggle('off', S.muted[k]);
      dot.style.background = S.muted[k] ? 'transparent' : def.color;
    };
    const name = document.createElement('span'); name.className = 'name'; name.textContent = def.label;
    const sel = document.createElement('select');
    order.forEach(([nm, j]) => { const o = document.createElement('option'); o.value = j; o.textContent = nm; sel.appendChild(o); });
    sel.value = S.assign[k];
    sel.onchange = () => { S.assign[k] = +sel.value; S.last[k] = null; };
    row.append(dot, name, sel);
    box.appendChild(row);
  });
}

function buildViewMenu() {
  const sel = $('viewFrom'); sel.innerHTML = '';
  const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); };
  add(-1, S.mode === 'per-eur' ? '🌍 The world (basket of 7)' : '🌍 Prices as given');
  S.names.map((nm, j) => [nm, j]).sort((a, b) => a[0].localeCompare(b[0])).forEach(([nm, j]) => add(j, nm));
  sel.value = -1; sel.disabled = false;
}
$('viewFrom').onchange = e => { if (S.ready) applyView(+e.target.value); };

JUMPS.forEach(([label, date]) => {
  const o = document.createElement('option'); o.value = date || ''; o.textContent = label; $('jump').appendChild(o);
});
$('jump').onchange = e => {
  if (!S.ready) return;
  const v = e.target.value;
  if (!v) { S.idx = 0; return; }
  const t = Date.parse(v), j = S.dates.findIndex(d => Date.parse(d) >= t);
  if (j >= 0) S.idx = j; else setStatus('That date is not in this data.');
};

// Load the latest ECB exchange rates automatically (the server downloads them, refreshed every 12 h)
async function loadECB() {
  if (location.protocol === 'file:') return;           // needs the Python server
  setStatus('🌍 Getting the latest exchange rates from the European Central Bank…');
  try {
    const res = await fetch('/api/ecb');
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
    prepare(parseCSV(await res.text()));
    setStatus(`🌍 ECB data ready (${res.headers.get('X-Data-Note')}, ${res.headers.get('X-Data-Updated')}) · ` +
      `${S.n} days · ${S.cur.length} currencies · ${S.dates[0]} → ${S.dates[S.n - 1]}`);
  } catch (e) {
    setStatus(`Couldn't get ECB data (${e.message}) — use Load CSV or Demo data instead.`);
  }
}
$('ecbBtn').onclick = () => { if (S.playing) $('playBtn').click(); loadECB(); };
loadECB();                                              // happens by itself when the page opens

$('fileInput').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => prepare(parseCSV(r.result));
  r.readAsText(f);
};
$('playBtn').onclick = async () => {
  if (!S.ready) {
    if (location.protocol !== 'file:') return setStatus('⏳ Still loading the exchange rates — try again in a moment.');
    prepare(demoData());                               // opened without the server → practice with fake data
  }
  await Tone.start();                                // browsers only allow sound after a click
  if (!S.inst) setupAudio();
  if (S.playing) { Tone.Transport.pause(); S.playing = false; $('playBtn').textContent = '▶ Play'; }
  else { Tone.Transport.start(); S.playing = true; $('playBtn').textContent = '⏸ Pause'; }
};
$('stride').oninput = e => { S.stride = +e.target.value; $('strideVal').textContent = e.target.value; };
$('scoreBtn').onclick = () => {
  S.showScore = !S.showScore;
  $('score').style.display = S.showScore ? 'block' : 'none';
  $('scoreBtn').textContent = S.showScore ? '🎼 Hide score' : '🎼 Show score';
};

$('saveBtn').onclick = async () => {
  if (!S.ready) return setStatus('Load data first.');
  const body = {
    title: prompt('Name this performance:', 'Untitled symphony') || 'Untitled symphony',
    seating: INSTRUMENTS.map((def, k) => ({ instrument: def.label, currency: S.cur[S.assign[k]].name })),
    viewFrom: S.view < 0 ? 'world' : S.names[S.view],
    at: S.dates[S.idx] || null, peakTension: Math.max(...S.world), ai: S.aiLog.slice(-20),
  };
  try {
    const res = await fetch('/api/performances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(res.status);
    setStatus(`💾 Saved "${body.title}" to MongoDB`);
  } catch {
    setStatus('Saving needs the Python server: run "python app.py" and open http://localhost:5050');
  }
};

// the "why this note" score panel (updated a few times per second)
function updateScore() {
  if (!S.showScore || !S.dir) return;
  const d = S.dir;
  $('scoreHead').innerHTML =
    `<b>${d.character}</b> · ${keyOf().name} · ${d.tempo} (${TEMPI[d.tempo]} bpm) · <i>${d.dyn}</i><br>` +
    `<span class="src">${d.source === 'Gemini' ? `🤖 Gemini (plan for ${S.aiTextDate || 'this phrase'})` : '🧮 Maths (Gemini\'s plan not ready yet)'}: ${d.reason}</span><br>` +
    `Progression <b>${d.prog}</b> · bar ${((S.bar - 1) % 4) + 1}/4 · chord <b>${S.numeral}</b> = ${chordName()}`;
  $('scoreRows').innerHTML = INSTRUMENTS.map((def, k) => {
    const w = S.why[k], cur = S.cur[S.assign[k]]?.name || '';
    return `<div class="srow${S.muted[k] ? ' off' : ''}"><span class="sdot" style="background:${def.color}"></span>` +
      `<b>${def.label}</b> <small>${cur}</small> <span class="snote">${w ? w.note : '—'}</span>` +
      `<div class="swhy">${w ? w.reason : 'waiting…'}</div></div>`;
  }).join('');
}

// =====================================================
// VISUALS (p5.js) — line graph of every playing currency + world tension
// =====================================================
function setup() {
  createCanvas(windowWidth, windowHeight).parent('stage');
  textFont('Helvetica');
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

function draw() {
  background(lerpColor(color('#0b1020'), color('#2a0d18'), S.ready ? S.Ws * 0.8 : 0));
  const x0 = width > 900 ? 385 : 50, x1 = width - 130 - (S.showScore && width > 1100 ? 330 : 0);
  const top = 100, bot = height * 0.62;                  // main graph
  const wTop = height * 0.67, wBot = height * 0.80;      // world tension panel

  noStroke(); fill(255); textAlign(CENTER); textSize(28);
  const cx = (x0 + x1) / 2;
  text(S.ready && S.dates[S.idx] ? S.dates[S.idx] : 'Curren-Sing', cx, 50);
  if (!S.ready) { textSize(16); text('Loading the latest exchange rates…', cx, height / 2); return; }
  if (frameCount % 8 === 0) updateScore();

  const i = S.idx, a = Math.max(0, i - VIEW_ROWS);
  textSize(13); fill(255, 200);
  const viewName = S.view < 0 ? 'the world' : S.names[S.view];
  const head = S.dir ? `${S.dir.character} · ${keyOf().name} · ${S.dir.tempo}` : 'warming up';
  text(`Seen from ${viewName} · World tension ${Math.round(S.Ws * 100)}% · ${head}`, cx, 74);

  // ---- main graph: % change of each seated currency over the visible window ----
  const pct = INSTRUMENTS.map((_, k) => {
    const v = S.cur[S.assign[k]].value;
    return v.slice(a, i + 1).map(x => (x / v[a] - 1) * 100);
  });
  let maxAbs = 2;
  pct.forEach((p, k) => { if (!S.muted[k]) p.forEach(x => { maxAbs = Math.max(maxAbs, Math.abs(x)); }); });
  S.yr += 0.06 * (maxAbs * 1.1 - S.yr);                       // smooth zoom, no jumping
  const X = j => map(j, 0, VIEW_ROWS, x0, x1);
  const Y = v => map(v, -S.yr, S.yr, bot, top);

  const stepPct = [1, 2, 5, 10, 20, 50, 100].find(s => S.yr / s <= 4) || 100;
  textAlign(RIGHT); textSize(11);
  for (let g = -Math.floor(S.yr / stepPct) * stepPct; g <= S.yr; g += stepPct) {
    stroke(255, g === 0 ? 70 : 22); strokeWeight(1); line(x0, Y(g), x1, Y(g));
    noStroke(); fill(255, 120); text(`${g > 0 ? '+' : ''}${g}%`, x0 - 6, Y(g) + 4);
  }
  if (S.dates.length) {
    textAlign(CENTER); let lastYear = '';
    for (let j = a; j <= i; j++) {
      const y = (S.dates[j] || '').slice(0, 4);
      if (y !== lastYear && lastYear !== '') {
        const x = X(j - a); stroke(255, 18); line(x, top, x, wBot);
        noStroke(); fill(255, 110); text(y, x, wBot + 14);
      }
      lastYear = y;
    }
  }

  const labels = [];
  pct.forEach((p, k) => {
    const def = INSTRUMENTS[k], c = color(def.color);
    S.pulse[k] *= 0.9;
    c.setAlpha(S.muted[k] ? 40 : 230);
    stroke(c); strokeWeight(S.muted[k] ? 1 : 2 + S.pulse[k] * 2); noFill();
    beginShape(); p.forEach((v, j) => vertex(X(j), Y(v))); endShape();
    const ex = X(p.length - 1), ey = Y(p[p.length - 1]);
    noStroke(); fill(c); circle(ex, ey, 7 + S.pulse[k] * 14);
    if (!S.muted[k]) labels.push({ y: ey, text: `${S.cur[S.assign[k]].name} · ${def.label}${S.why[k] ? ' ' + S.why[k].note.split(' ')[0] : ''}`, c, ex });
  });
  labels.sort((p, q) => p.y - q.y);
  for (let j = 1; j < labels.length; j++) labels[j].y = Math.max(labels[j].y, labels[j - 1].y + 15);
  textAlign(LEFT); textSize(12);
  labels.forEach(l => { fill(l.c); text(l.text, l.ex + 12, l.y + 4); });

  // ---- world tension panel ----
  noStroke(); fill(255, 150); textAlign(LEFT); textSize(12);
  text('World tension', x0, wTop - 6);
  const wPath = S.world.slice(a, i + 1);
  fill(255, 120, 120, 60); stroke(255, 140, 140, 200); strokeWeight(1.5);
  beginShape(); vertex(X(0), wBot);
  wPath.forEach((v, j) => vertex(X(j), map(v, 0, 1, wBot, wTop)));
  vertex(X(wPath.length - 1), wBot); endShape(CLOSE);
  stroke(255, 40); line(x0, map(0.5, 0, 1, wBot, wTop), x1, map(0.5, 0, 1, wBot, wTop));
  noStroke(); fill(255, 220, 160); circle(X(wPath.length - 1), map(S.Ws, 0, 1, wBot, wTop), 9);

  // ---- events ----
  const now = performance.now();
  S.events = S.events.filter(e => e.until > now);
  textAlign(RIGHT); textSize(14);
  S.events.forEach((e, j) => { fill(255, 230, 160, map(e.until - now, 0, 800, 0, 255, true)); text(e.text, x1, 100 + j * 20); });

  // ---- Gemini's commentary ----
  // only show Gemini's words while the phrase you're hearing really is Gemini's plan
  if (S.aiText && S.dir && S.dir.source === 'Gemini') {
    fill(255, 235, 200); textSize(15); textAlign(LEFT); noStroke();
    text(`🤖 Gemini on ${S.aiTextDate}: ${S.aiText}`, x0, height * 0.84, x1 - x0, 50);
  }

  // ---- whole-history overview + playhead ----
  const oy = height - 16, oh = 24;
  noFill(); stroke(255, 90); strokeWeight(1);
  beginShape(); S.spark.forEach((v, j) => vertex(map(j, 0, S.spark.length - 1, x0, x1), oy - v * oh)); endShape();
  const px = map(i, 0, S.n - 1, x0, x1);
  stroke(255, 220, 120); strokeWeight(2); line(px, oy - oh - 4, px, oy + 2);
  noStroke();
}
