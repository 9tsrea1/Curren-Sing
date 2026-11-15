# CLAUDE.md — project context for Claude Code

## How to work with the developer (read this every session)
The developer is building this solo at DurHack 2026 (deadline 12:00 Sun 15 Nov, feature freeze 09:30). Explain changes in plain English and keep code readable with short comments.
1. Before changing anything, say in 2–3 plain-English lines what you'll change and why. If a request is ambiguous, pick the most sensible reading, say which one you picked, and go ahead.
2. Keep the design rules in this file: classical-sounding music (chords, cadences, voice-leading), every note explainable in the Score panel, changes must feel musical (never sudden volume jumps), main view = line graph, at least one musician always stays.
3. Make small, safe changes. Never break: music playback, the Gemini conductor (with maths fallback), the ElevenLabs narrator, ECB auto-loading, MongoDB saving (with the offline queue), Gallery/Replay, keyboard shortcuts, volume sliders.
4. After editing, check your work: `node --check static/main.js`, `python -m py_compile app.py`, and if possible a quick simulation of the music loop so nothing throws errors.
5. Never print or commit secrets (.env, atlas-credentials.env). Never call paid APIs in loops without caching.
6. When done, explain simply what changed and how to test it at http://localhost:5050, and update this file if anything important changed.
7. Then commit with a clear message and push, so the session is linked in Entire (the Entire CLI captures Claude Code sessions as checkpoints on commit).


## The project: **"Curren-Sing"** (currency + sing)
Built for DurHack 2026, theme **COMPOSITION** (mix art, music and tech; judged on Creativity & Innovation · Technical Execution · Research & Learning · Polish).

Each world currency is an instrument in an orchestra. **6 main seats** (the 7th seat — horn, then trumpet, then clarinet for AUD — was removed: it never sounded right; AUD can still be added with "+ Add musician"). **Default seating** (user can change it in the "Orchestra seating" panel — any currency in the file → any instrument):
| Currency | Instrument | Role |
|---|---|---|
| USD | Violin | main melody |
| GBP | Cello | long chord notes |
| JPY | Flute | off-beat answers |
| CHF | Harp | arpeggio, up if rising / down if falling |
| EUR | Piano | chords on beats 1 & 3 |
| CAD | Double bass | foundation |
| (world) | Timpani, deep drum | appear only when the world is stressed |

ECB rates are "per 1 EUR", so `prepare()` converts every currency (plus EUR itself) into **strength vs a basket** (USD, EUR, JPY, GBP, CHF, AUD, CAD, geometric mean) — that's how EUR can be an instrument. All currencies with ≥70% coverage are kept (gaps filled with last value) and are selectable.

### How the music is composed (classical engine — every note must be explainable)
- **Conductor** picks a *character* per 4-bar phrase: Pastorale · Cantabile · Misterioso · Agitato · Grandioso → key (C major / A harmonic minor), tempo marking (Adagio…Presto), dynamics (p…ff), chord progression (e.g. I–IV–V–I, i–iv–V–i). **Gemini decides this** via `/api/analyse` (asked mid-phrase, applied at the next phrase); maths fallback (`fallbackDirection`) when offline. `sanitizeDirection()` validates Gemini's JSON.
- **One chord per bar**, phrases end in cadences. Instruments: violin melody & flute answer = strong beats land on a chord tone near where the currency sits in its 3-month range (max leap 7 semitones), weak beats move one scale step towards it; cello holds 3rd/5th with smooth voice-leading; double bass plays root/5th; piano = Alberti bass when calm, repeated chords when tense; harp arpeggio up/down with the currency's trend; timpani tuned to tonic & dominant; deep drum only in Grandioso. Sample files: only natural-note names work (the sample site names sharps `As3`, but the loader asks for `A#3`).
- **Gemini reads ahead**: `prefetchAI()` keeps asking Gemini about the data rows where the next 1–3 phrases will start (one request at a time), storing plans in `S.aiCache`; `onBar` uses the plan for the current phrase start if present, else maths. Cache is cleared on new data / view change. Server (`app.py`) tries GEMINI_MODEL then GEMINI_FALLBACK_MODELS from `.env` (currently gemini-3.5-flash-lite first; 3.8-flash was overloaded), skipping busy (429/503) models instantly, 15 s timeout, thinkingLevel "low". `gemini_test.py` diagnoses keys/models/latency.
- **Narrator (ElevenLabs)**: when a phrase starts with a Gemini plan, `onBar` calls `narrate(plan)` → POST `/api/narrate` {text: plan.say (Gemini's commentary)} → plays the mp3 via an HTML `Audio` over the music (volume from the narrator slider, default 45%). Server caches each clip in `data/narration/` (sha256 of voice|model|text) so repeats cost nothing; model default `eleven_flash_v2_5` (override with ELEVENLABS_MODEL). Rules: one clip at a time (new ones are *skipped*, not queued, while one is busy), each plan spoken once, stops on pause / when 🎙 Narrator is turned off, 20 s timeout, on any failure it waits 30 s and shows "Narrator unavailable — music continues" in `#narrStatus`. The music never waits for it.
- **📚 Gallery** (button in the panel → centred `#gallery` panel, Esc/✕ closes): `openGallery()` loads GET `/api/performances` ({items, mongodb}); each card (`galleryCard`) shows title, saved date, music date, view, seating (instrument → currency, guests included, muted dimmed, removed hidden), first Gemini headline, and a "⏳ waiting to upload" badge for items with `local: true` (saved on the laptop while MongoDB is unreachable). "▶ Replay" → `replayPerformance(p)`: applies its view, restores `S.voice`/`S.assign`/`S.removed`/`S.muted` for the 6 seats (older 7-seat saves: entries whose instrument no longer exists — French horn/Trumpet/Clarinet — are skipped so the rest line up) and `S.extra` guests (matched by instrument label & currency name; anything not in the loaded data is skipped and named in the status), `jumpToDate(p.at)` (shared with the "Jump to" menu), then starts playing. All saved text is HTML-escaped (`esc`).
- `S.why[k]` stores the note + plain-English reason; the **Score panel** (right side, toggle "🎼 Hide score") shows conductor choice, progression, current chord, and each instrument's note + reason.
- Keep it classical: functional harmony, voice-leading, cadences — not free-scale noodling.

- **Guest musicians (“+ Add musician”)**: `S.extra` (max 8) — user picks any instrument type + any currency. `playGuests()` keeps the vibe unchanged: quiet velocity, chord notes only, fixed gaps in the bar (melody guests beats 2/4 off-beats, low guests every other bar, colour guests pos 3/7), take turns when >3. Drawn as solid lines, same style as the main seats (not dashed — the developer's choice); listed in the Score panel; saved with performances. Volume sliders: narrator volume + music volume (Tone.Destination).

- **Timeline scrubbing**: the whole-history strip at the bottom of the stage (`TL` box, set each frame in `draw()`) — click or drag to jump to any date (`mousePressed/mouseDragged/mouseReleased`, only when the click lands on the canvas, not on a panel). Shows year labels (every 5 years), red dots for the "Jump to" moments, and a date bubble on hover/drag; year ticks are computed once per dataset (`TL.dates` cache), not per frame. Jolts (sforzandi) are suppressed while dragging.
- **Keyboard**: Space = play/pause, ←/→ = 3 months back/forward, Shift+←/→ = 1 year (ignored while typing in an input/select). Esc closes the Gallery.

Design rules (keep them):
- **Each melody follows its currency's value** (up → higher notes).
- **A currency "not in a good place"** (far from its ~1-year normal and/or more volatile than usual, `S.cur[c].stress`) is **gently** louder (max +6 dB, eased per bar).
- **Changes must feel musical, never like turning up the phone volume**: drama comes from (a) a **sudden accented note (sforzando)** when a currency makes a surprising move (`z` vs its last-60-day volatility > 3.2, with a cooldown), shown as "⚡ USD jolts — Violin"; (b) **new instruments entering** (timpani → deep drum) as world tension rises, with hysteresis; (c) key change major↔minor with hysteresis; (d) tempo gliding slowly 70→130 bpm. World tension `S.Ws` is smoothed per bar (0.12).
- **"View from" menu**: default = the world basket; or pick any currency → every currency is re-measured in that currency (`applyView(b)`, recomputes `S.cur` from `S.raw`), the chosen one becomes a flat line. Graph + music follow the view; world tension stays basket-based.
- **World condition** = average stress of ALL currencies (ranked 0–1) blended 50/50 with **Gemini's** judgement.
- **Main view = line graph** of every seated currency (% change over the last ~2 years, lines coloured by instrument, pulse on notes) + world-tension area chart underneath + whole-history overview with playhead.
- Purpose: *sonification* — hear the state of world markets; accessibility; early awareness.

Data is **loaded automatically**: `GET /api/ecb` in app.py downloads the ECB zip, extracts it to `data/eurofxref-hist.csv` (gitignored), refreshes at most every 12 h, falls back to the cached copy; `loadECB()` in main.js calls it on page load and via the "🌍 Latest ECB" button. "Load CSV" and "Demo data" still exist.
Data: **European Central Bank daily reference rates** (rates per 1 EUR, 1999 → today), `eurofxref-hist.csv` from https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip — put it in `data/`. File is newest-first and has `N/A` values — `parseCSV()`/`prepare()` already handle that. Demo moments: 2008 crash, Euro crisis 2011, **Brexit vote June 2016**, COVID March 2020, 2022 (the "Jump to" menu).

## Code layout
```
app.py              Flask server (port 5050 — macOS AirPlay uses 5000)
                    /api/ecb          → latest ECB rates (downloaded, cached 12 h in data/)
                    /api/analyse      → Gemini judges world tension → {mood 0-1, headline, commentary}
                    /api/narrate      → ElevenLabs text→speech mp3, cached in data/narration/<hash>.mp3
                    /api/performances → save/list performances in MongoDB Atlas (db "hackathon"),
                                        kept in data/pending_performances.json while MongoDB is unreachable
static/index.html   page + control panel
static/main.js      data → stress/world maths → Tone.js orchestra → p5.js stage visuals
static/style.css
static/assets/      (sound files if needed)
test_db.py          MongoDB connection test
gemini_test.py      Gemini key / model / latency check
atlas-credentials.env  MONGODB_URI (secret, gitignored)
.env                GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODELS, ELEVENLABS_API_KEY,
                    ELEVENLABS_VOICE_ID, optional ELEVENLABS_MODEL (secret, gitignored)
.venv/              Python venv (flask, pymongo, python-dotenv, requests)
```
Run: `source .venv/bin/activate && pip install -r requirements.txt && python app.py` → http://localhost:5050 (opening index.html directly works but has no AI/saving).

Libraries via CDN: Tone.js 14.8.49, p5.js 1.9.4. Instrument samples: `https://nbrosowsky.github.io/tonejs-instruments/samples/<instrument>/<Note>.mp3` (only use notes that exist — see `INSTRUMENTS` in main.js); synth fallback if samples fail.

### Important technical lessons
- An earlier version **froze the browser** after a while. Likely causes: changing tempo (`bpm.rampTo`) on every note and too many overlapping synth voices. Current rules: tempo/volume change **once per bar** in `onBar()`, `maxPolyphony` on synths, `onStep` wrapped in try/catch, rolling stats via running sums (no O(n·window) loops). Keep it that way; test long playback.
- Never commit secrets. `.gitignore` already covers `.env`, `atlas-credentials.env`, `.venv/`, `__pycache__/`, `data/`, `.DS_Store`.

## Status / next steps
- [x] Orchestra runs without freezing
- [x] Line-graph view, smooth/musical dynamics, user-chosen seating, EUR added, guest musicians, volume sliders
- [x] Keyboard shortcuts (Space, ←/→, Shift+←/→)
- [x] Draggable timeline — tested in headless Chrome (drag 2005→2017 OK, no errors)
- [x] 7th seat (clarinet) removed → 6 main seats; guest lines solid — tested in headless Chrome (old 7-seat save replays correctly, no errors)
- [ ] Long playback test with real ECB data: music sounds good and nothing freezes
- [ ] Confirm Gemini commentary appears with the key in `.env`
- [x] **ElevenLabs narrator** built: `/api/narrate` + 🎙 Narrator button. Tested with a fake ElevenLabs (caching + errors OK). **Real call returned 401 "Invalid API key"** → put a fresh ELEVENLABS_API_KEY in `.env`, restart app.py, then listen to check the level
- [x] **📚 Gallery** of saved performances — tested in headless Chrome with a fake locally-saved performance (open, card, ⏳ badge, Replay restores view/seats/guests/date and plays). Not yet seen with real MongoDB items (MongoDB was unreachable on the venue Wi-Fi during the test)
- [ ] (stretch) deploy to Vultr
- [ ] Polish, 1–2 min demo video, Devpost write-up, practise the 3-min demo
