"""Currency Symphony — small Python server.

- Serves the website
- /api/analyse     → asks Gemini how stressed the world currency market is
- /api/performances → saves / lists performances in MongoDB Atlas

Run:  python app.py   →  open http://localhost:5050
(Port 5050, because macOS AirPlay already uses 5000.)
"""
import datetime
import json
import os
import time

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
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
performances = MongoClient(uri)["hackathon"]["performances"] if uri else None


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


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
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
    }
    last_error = "unknown error"
    # try the main model (twice), then any backup models — Google is sometimes overloaded (503) or rate-limited (429)
    for model in [GEMINI_MODEL] + GEMINI_FALLBACKS:
        for attempt in range(2):
            try:
                r = requests.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    headers={"x-goog-api-key": GEMINI_KEY, "Content-Type": "application/json"},
                    json=body,
                    timeout=20,
                )
                if r.status_code in (429, 500, 503):            # busy → wait a moment and retry
                    last_error = f"{r.status_code} Google is busy ({model})"
                    time.sleep(1.5)
                    continue
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


@app.post("/api/performances")
def save_performance():
    if performances is None:
        return jsonify(error="MONGODB_URI missing"), 503
    data = request.get_json(force=True) or {}
    data["createdAt"] = datetime.datetime.now(datetime.timezone.utc)
    result = performances.insert_one(data)
    return jsonify(id=str(result.inserted_id))


@app.get("/api/performances")
def list_performances():
    if performances is None:
        return jsonify(error="MONGODB_URI missing"), 503
    docs = list(performances.find({}, {"_id": 0}).sort("createdAt", -1).limit(20))
    return jsonify(docs)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
