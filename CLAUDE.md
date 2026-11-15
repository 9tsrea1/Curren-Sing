# CLAUDE.md — project context for Claude Code

## Who / what
- Gillian, **solo** at **DurHack 2026** (Durham, 14–15 Nov 2026). Business-management undergrad moving into CS; knows some Python and JavaScript — explain changes simply, keep code readable with short comments.
- Goal: **win any prize** (so she can say "won a hackathon"). Enter as many prizes as the project honestly fits.
- **Submission deadline ≈ Sunday 15 Nov 12:00** (Devpost). Feature freeze ~09:30 Sunday; last 2 hours = polish, demo video, Devpost write-up.
- Planning notes live outside the repo in iCloud: `~/Library/Mobile Documents/com~apple~CloudDocs/notvault/01_vie/time_sens/Durhack/` (prize list + step plan .md files). The step plan there is from an earlier "storm" version — the idea has since changed (see below).

## The project: "Currency Symphony" (working name — final name decided at the end)
Theme of DurHack 2026: **COMPOSITION** (mix art, music and tech; judged on Creativity & Innovation · Technical Execution · Research & Learning · Polish).

Each world currency is an instrument in an orchestra. **Default seating** (user can change it in the "Orchestra seating" panel — any currency in the file → any instrument):
| Currency | Instrument | Role |
|---|---|---|
| USD | Violin | main melody |
| GBP | Cello | long chord notes |
| JPY | Flute | off-beat answers |
| CHF | Harp | arpeggio, up if rising / down if falling |
| EUR | Piano | chords on beats 1 & 3 |
| AUD | French horn | enters when tense |
| CAD | Double bass | foundation |
| (world) | Timpani, deep drum | appear only when the world is stressed |

ECB rates are "per 1 EUR", so `prepare()` converts every currency (plus EUR itself) into **strength vs a basket** (USD, EUR, JPY, GBP, CHF, AUD, CAD, geometric mean) — that's how EUR can be an instrument. All currencies with ≥70% coverage are kept (gaps filled with last value) and are selectable.

### How the music is composed (classical engine, rebuilt Sat ~22:45 — every note must be explainable)
- **Conductor** picks a *character* per 4-bar phrase: Pastorale · Cantabile · Misterioso · Agitato · Grandioso → key (C major / A harmonic minor), tempo marking (Adagio…Presto), dynamics (p…ff), chord progression (e.g. I–IV–V–I, i–iv–V–i). **Gemini decides this** via `/api/analyse` (asked mid-phrase, applied at the next phrase); maths fallback (`fallbackDirection`) when offline. `sanitizeDirection()` validates Gemini's JSON.
- **One chord per bar**, phrases end in cadences. Instruments: violin melody & flute answer = strong beats land on a chord tone near where the currency sits in its 3-month range (max leap 7 semitones), weak beats move one scale step towards it; cello holds 3rd/5th with smooth voice-leading; double bass plays root/5th; piano = Alberti bass when calm, repeated chords when tense; harp arpeggio up/down with the currency's trend; horns when tense; timpani tuned to tonic & dominant; deep drum only in Grandioso.
- `S.why[k]` stores the note + plain-English reason; the **Score panel** (right side, toggle "🎼 Hide score") shows conductor choice, progression, current chord, and each instrument's note + reason.
- Gillian found the earlier free-scale version "weird" — keep it classical (functional harmony, voice-leading, cadences).

Rules (Gillian's design — keep them):
- **Each melody follows its currency's value** (up → higher notes).
- **A currency "not in a good place"** (far from its ~1-year normal and/or more volatile than usual, `S.cur[c].stress`) is **gently** louder (max +6 dB, eased per bar).
- **Changes must feel musical, never like turning up the phone volume**: drama comes from (a) a **sudden accented note (sforzando)** when a currency makes a surprising move (`z` vs its last-60-day volatility > 3.2, with a cooldown), shown as "⚡ USD jolts — Violin"; (b) **new instruments entering** (horn → timpani → deep drum) as world tension rises, with hysteresis; (c) key change major↔minor with hysteresis; (d) tempo gliding slowly 70→130 bpm. World tension `S.Ws` is smoothed per bar (0.12).
- **"View from" menu**: default = the world basket; or pick any currency → every currency is re-measured in that currency (`applyView(b)`, recomputes `S.cur` from `S.raw`), the chosen one becomes a flat line. Graph + music follow the view; world tension stays basket-based.
- **World condition** = average stress of ALL currencies (ranked 0–1) blended 50/50 with **Gemini's** judgement.
- **Main view = line graph** of every seated currency (% change over the last ~2 years, lines coloured by instrument, pulse on notes) + world-tension area chart underneath + whole-history overview with playhead.
- She explicitly **did not want** the earlier storm/weather/thunder concept, nor the circle-per-currency view — don't bring them back.
- Practical framing for judges: *sonification* — hear the state of world markets; accessibility; early awareness.

Data: **European Central Bank daily reference rates** (rates per 1 EUR, 1999 → today), `eurofxref-hist.csv` from https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip — put it in `data/`. SGX FX's own data couldn't be found; their brief allows any data. File is newest-first and has `N/A` values — `parseCSV()`/`prepare()` already handle that. Demo moments: 2008 crash, Euro crisis 2011, **Brexit vote June 2016**, COVID March 2020, 2022 (the "Jump to" menu).

## Code layout
```
app.py              Flask server (port 5050 — macOS AirPlay uses 5000)
                    /api/analyse      → Gemini judges world tension → {mood 0-1, headline, commentary}
                    /api/performances → save/list performances in MongoDB Atlas (db "hackathon")
static/index.html   page + control panel
static/main.js      data → stress/world maths → Tone.js orchestra → p5.js stage visuals
static/style.css
static/assets/      (sound files if needed)
test_db.py          Gillian's MongoDB connection test
atlas-credentials.env  MONGODB_URI (secret, gitignored)
.env                GEMINI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (secret, gitignored)
.venv/              Python venv (flask, pymongo, python-dotenv, requests)
```
Run: `source .venv/bin/activate && pip install -r requirements.txt && python app.py` → http://localhost:5050 (opening index.html directly works but has no AI/saving).

Libraries via CDN: Tone.js 14.8.49, p5.js 1.9.4. Instrument samples: `https://nbrosowsky.github.io/tonejs-instruments/samples/<instrument>/<Note>.mp3` (only use notes that exist — see `INSTRUMENTS` in main.js); synth fallback if samples fail.

### Important technical lessons
- An earlier version **froze the browser** after a while. Likely causes: changing tempo (`bpm.rampTo`) on every note and too many overlapping synth voices. Current rules: tempo/volume change **once per bar** in `onBar()`, `maxPolyphony` on synths, `onStep` wrapped in try/catch, rolling stats via running sums (no O(n·window) loops). Keep it that way; test long playback.
- Never commit secrets. `.gitignore` already covers `.env`, `atlas-credentials.env`, `.venv/`, `__pycache__/`.

## Prizes being targeted (one Devpost submission, tick each)
Core: DurHack main (Composition) · Spirit of the Dino (organisers' favourite fun project) · Marshall Wace "New Worlds" · Waterstons "connect things that usually aren't" (money + music) · SGX FX ① Protect your assets / ② Get creative (market data, any data allowed) · Accenture (redesign a frustrating process with AI/LLMs — reading many market screens → *listening* to the world) · MLH: Gemini API · MongoDB Atlas · ElevenLabs · DEV writing post (after the event).
Stretch: Vultr (deploy) · Entire (she's coding with Claude Code + Entire CLI so sessions are captured; entire-graph optional) · Neptune North (independent actors that keep playing when cut off — e.g. instruments that keep going if the AI/connection drops).
Skipped: RS/Arduino, Solana, P&G, QRT, Tiger Data (unless time).

## Status / next steps (as of Sat ~21:45)
- [x] Symphony version runs without freezing on her Mac
- [x] (22:30) Line-graph view, smooth/musical dynamics, user-chosen seating, EUR added — needs testing
- [ ] Load ECB CSV, check the music sounds good and nothing freezes
- [ ] Gemini key in `.env`, run `python app.py`, confirm AI commentary appears
- [ ] **ElevenLabs narrator**: read Gemini's commentary aloud like a concert narrator (needs ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID; add a `/api/narrate` endpoint returning audio, play it in main.js, don't overlap clips)
- [ ] MongoDB gallery page listing saved performances
- [ ] Push to GitHub regularly; Entire mirror connected
- [ ] (stretch) deploy to Vultr
- [ ] Sunday: polish, 1–2 min demo video, Devpost with "How we used X" per sponsor, practise 3-min demo, collect "I Demoed" sticker
