"""Quick ElevenLabs check — run:  python eleven_test.py   (does not print your key)"""
import os

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
voice = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
print(f"Key: starts {key[:3]!r}, length {len(key)}, spaces/quotes inside: {any(c in key for c in ' \"')}")
print(f"Voice ID: length {len(voice)}")

r = requests.post(
    f"https://api.elevenlabs.io/v1/text-to-speech/{voice}",
    headers={"xi-api-key": key, "Content-Type": "application/json"},
    json={"text": "Hello from Curren-Sing.", "model_id": "eleven_flash_v2_5"},
    timeout=30,
)
print("\nText-to-speech:", r.status_code)
if r.ok:
    open("eleven_test.mp3", "wb").write(r.content)
    print("✅ Works! Saved eleven_test.mp3 — double-click it to listen.")
else:
    print(r.text[:600])
