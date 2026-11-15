# 🎻 Currency Symphony (working name)

Each world currency is an instrument in an orchestra (USD violin, GBP cello, JPY flute, CHF harp, AUD French horn, CAD double bass). Each melody follows its currency's price; a currency in a bad place plays louder. Gemini judges the condition of the whole world — when it's bad, the symphony turns faster, minor-key and more magnificent (horns + timpani).

Data: European Central Bank daily reference rates (1999 → today): https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip

Gemini needs a `.env` file next to `app.py`:
```
GEMINI_API_KEY=your_key_here
```

Built at DurHack 2026 (theme: **Composition**).

## Run it

**Quick (Steps 1–2):** double-click `static/index.html` → opens in your browser → press **▶ Play**.

**With the server (Step 3+, saving to MongoDB):**
```bash
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```
Then open http://localhost:5050

## Using the SGX FX data
Click **Load CSV** and pick their file. If it doesn't load, copy the first 5 lines of the file and ask Claude to adjust `parseCSV()` in `static/main.js`.

## Built with
Tone.js · p5.js · Python/Flask · MongoDB Atlas · ElevenLabs · (next: Gemini, Vultr)

## Project structure
```
app.py              Python server + MongoDB
static/index.html   page + controls
static/main.js      data → music → visuals
static/style.css    styling
static/assets/      ElevenLabs sound files
```
