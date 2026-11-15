"""Curren-Sing — small Python server.

- Serves the website
- /api/ecb         → latest ECB exchange-rate history (downloaded automatically, cached 12 h in data/)
- /api/analyse     → asks Gemini how stressed the world currency market is
- /api/performances → saves / lists performances in MongoDB Atlas

Run:  python app.py   →  open http://localhost:5050
(Port 5050, because macOS AirPlay already uses 5000.)
"""
import datetime
import io
import json
import os
import threading
import time
import zipfile

import requests
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_from_directory
from pymongo import MongoClient

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, "atlas-credentials.env"))  # MONGODB_URI
load_dotenv(os.path.join(HERE, ".env"))                    # GEMINI_API_KEY (and optional GEMINI_MODEL)

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")  # 2.5-flash is closed to new users
# Optional backup models (comma-separated, names from AI Studio) tried when the main one is overloaded
GEMINI_FALLBACKS = [m.strip() for m in os.environ.get("GEMINI_FALLBACK_MODELS", "").split(",") if m.strip()]

app = Flask(__name__, static_folder="static", static_url_path="")

uri = os.environ.get("MONGODB_URI")
performances = MongoClient(uri, serverSelectionTimeoutMS=4000, connectTimeoutMS=4000)["hackathon"]["performances"] if uri else None


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# ---------- ECB data: downloaded automatically, refreshed at most every 12 hours ----------
ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"
DATA_DIR = os.path.join(HERE, "data")
ECB_CSV = os.path.join(DATA_DIR, "eurofxref-hist.csv")


@app.get("/api/ecb")
def ecb_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    fresh = os.path.exists(ECB_CSV) and time.time() - os.path.getmtime(ECB_CSV) < 12 * 3600
    note = "cached copy"
    if not fresh:
        try:
            r = requests.get(ECB_URL, timeout=30)
            r.raise_for_status()
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                name = next(n for n in z.namelist() if n.lower().endswith(".csv"))
                with open(ECB_CSV, "wb") as f:
                    f.write(z.read(name))
            note = "downloaded just now"
        except Exception as e:
            if not os.path.exists(ECB_CSV):                     # no internet and no old copy → tell the page
                return jsonify(error=f"Could not download ECB data: {e}"), 502
            note = "older copy (download failed)"
    with open(ECB_CSV, encoding="utf-8") as f:
        resp = Response(f.read(), mimetype="text/csv")
    resp.headers["X-Data-Note"] = note
    resp.headers["X-Data-Updated"] = datetime.datetime.fromtimestamp(os.path.getmtime(ECB_CSV)).strftime("%Y-%m-%d %H:%M")
    return resp


@app.post("/api/analyse")
def analyse():
    if not GEMINI_KEY:
        return jsonify(error="GEMINI_API_KEY missing in .env"), 503
    snapshot = request.get_json(force=True) or {}
    prompt = (
        "You are the CONDUCTOR of a classical orchestra in which every instrument plays a world currency. "
        "Look at this snapshot of the currency market, judge how stressed the WHOLE world economy is "
        "(use your knowledge of real events around this date if you know them), and choose how the NEXT "
        "4-bar phrase should sound. Calm world = gentle and slow; troubled world = faster, minor key, grander.\n"
        "Reply ONLY as JSON with these keys:\n"
        '  "mood": number 0 (calm, healthy) to 1 (crisis),\n'
        '  "character": one of "Pastorale", "Cantabile", "Misterioso", "Agitato", "Grandioso",\n'
        '  "mode": "major" or "minor",\n'
        '  "tempo": one of "Adagio", "Andante", "Moderato", "Allegro", "Presto",\n'
        '  "dynamics": one of "p", "mp", "mf", "f", "ff",\n'
        '  "progression": one of "I–IV–V–I", "I–vi–ii–V", "I–ii–V–I", "I–IV–I–V" (major) '
        'or "i–iv–V–i", "i–VI–iv–V", "i–iv–VI–V" (minor) — must match the mode,\n'
        '  "headline": max 8 words about what is happening in the world,\n'
        '  "commentary": one sentence, max 25 words, explaining WHY you chose this music.\n\n'
        + json.dumps(snapshot)
    )
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        # thinkingLevel "low": this is a quick decision, so don't let the model think for ages
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4,
                             "thinkingConfig": {"thinkingLevel": "low"}},
    }
    last_error = "unknown error"
    # try the main model (twice), then any backup models — Google is sometimes overloaded (503) or rate-limited (429)
    for model in [GEMINI_MODEL] + GEMINI_FALLBACKS:
        for attempt in range(3):
            try:
                r = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json"},
                    json=body,
                    timeout=15,
                )
                if r.status_code == 400 and "thinking" in r.text.lower():   # model doesn't support it → drop it
                    body["generationConfig"].pop("thinkingConfig", None)
                    continue
                if r.status_code in (429, 500, 503):            # busy → don't wait, go straight to the next model
                    last_error = f"{r.status_code} Google is busy ({model})"
                    break
                r.raise_for_status()
                text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
                out = json.loads(text)
                out["mood"] = max(0.0, min(1.0, float(out.get("mood", 0.5))))
                out["model"] = model
                return jsonify(out)
            except Exception as e:  # show the reason in the app instead of crashing
                detail = getattr(getattr(e, "response", None), "text", "") or ""
                last_error = f"{e} {detail[:200]}".strip()
                break                                            # not a "busy" error → try the next model
    return jsonify(error=last_error), 502


# ---------- Performances: saved to MongoDB Atlas, or kept on this laptop until MongoDB is reachable ----------
# (Some Wi-Fi networks, e.g. university ones, block MongoDB's port 27017.)
PENDING = os.path.join(DATA_DIR, "pending_performances.json")
_lock = threading.Lock()
_last_fail = 0.0                    # when MongoDB was last unreachable (don't keep waiting on it)


def _read_pending():
    try:
        with open(PENDING, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_pending(items):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(PENDING, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=1)


def _mongo_ok():
    return performances is not None and time.time() - _last_fail > 30


def _flush_pending():
    """Upload locally-kept performances once MongoDB is reachable again."""
    global _last_fail
    with _lock:
        items = _read_pending()
        if not items or not _mongo_ok():
            return 0
        try:
            docs = [{**d, "createdAt": datetime.datetime.fromisoformat(d["createdAt"]), "uploadedLater": True} for d in items]
            performances.insert_many(docs)
            _write_pending([])
            print(f"☁️  Uploaded {len(docs)} saved performance(s) to MongoDB")
            return len(docs)
        except Exception:
            _last_fail = time.time()
            return 0


def _sync_loop():                   # background helper: try every 30 s
    while True:
        time.sleep(30)
        _flush_pending()


@app.post("/api/performances")
def save_performance():
    global _last_fail
    data = request.get_json(force=True) or {}
    now = datetime.datetime.now(datetime.timezone.utc)
    if _mongo_ok():
        try:
            result = performances.insert_one({**data, "createdAt": now})
            uploaded = _flush_pending()
            return jsonify(stored="mongodb", id=str(result.inserted_id), uploadedWaiting=uploaded)
        except Exception as e:
            _last_fail = time.time()
            print("MongoDB unreachable → keeping performance on this laptop:", type(e).__name__)
    with _lock:                     # MongoDB not reachable → keep it locally for later
        items = _read_pending()
        items.append({**data, "createdAt": now.isoformat()})
        _write_pending(items)
    return jsonify(stored="local", waiting=len(items)), 202


@app.get("/api/performances")
def list_performances():
    global _last_fail
    _flush_pending()
    local = [{**d, "local": True} for d in reversed(_read_pending())]
    if not _mongo_ok():
        return jsonify(items=local, mongodb=False)
    try:
        docs = list(performances.find({}, {"_id": 0}).sort("createdAt", -1).limit(30))
        for d in docs:
            if isinstance(d.get("createdAt"), datetime.datetime):
                d["createdAt"] = d["createdAt"].isoformat()
        return jsonify(items=local + docs, mongodb=True)
    except Exception:
        _last_fail = time.time()
        return jsonify(items=local, mongodb=False)


if __name__ == "__main__":
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":   # only in the real server process, not the auto-reloader
        threading.Thread(target=_sync_loop, daemon=True).start()
    app.run(debug=True, port=5050)
