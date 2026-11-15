"""Quick Gemini diagnosis — run:  python gemini_test.py
Prints which models your key can use and how long each kind of request takes.
(Does not print your key.)"""
import os
import time

import requests
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, ".env"))
KEY = os.environ.get("GEMINI_API_KEY", "").strip()
MAIN = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
BASE = "https://generativelanguage.googleapis.com/v1beta"
H = {"x-goog-api-key": KEY, "Content-Type": "application/json"}

print(f"Key loaded: {'yes' if KEY else 'NO'} (starts with {KEY[:3]!r}, length {len(KEY)})")

# 1. which models can this key use?
print("\n1) Models available to your key (Flash / Lite only):")
flash = []
try:
    t = time.time()
    r = requests.get(f"{BASE}/models?pageSize=200", headers=H, timeout=30)
    print(f"   HTTP {r.status_code} in {time.time() - t:.1f}s")
    for m in r.json().get("models", []):
        name = m["name"].replace("models/", "")
        if "flash" in name and "generateContent" in m.get("supportedGenerationMethods", []):
            flash.append(name)
            print("   -", name)
except Exception as e:
    print("   ERROR:", e)


def test(model, label, gen_config):
    body = {"contents": [{"parts": [{"text": 'Reply with JSON {"ok": true}'}]}], "generationConfig": gen_config}
    t = time.time()
    try:
        r = requests.post(f"{BASE}/models/{model}:generateContent", headers=H, json=body, timeout=60)
        print(f"   {label:<28} HTTP {r.status_code} in {time.time() - t:.1f}s  {r.text[:120].replace(chr(10), ' ')}")
    except Exception as e:
        print(f"   {label:<28} FAILED after {time.time() - t:.1f}s: {type(e).__name__}")


# 2. time a tiny request in different ways
print(f"\n2) Timing tiny requests on {MAIN}:")
test(MAIN, "plain", {})
test(MAIN, "JSON mode", {"responseMimeType": "application/json"})
test(MAIN, "JSON + thinking low", {"responseMimeType": "application/json", "thinkingConfig": {"thinkingLevel": "low"}})
test(MAIN, "JSON + thinking budget 0", {"responseMimeType": "application/json", "thinkingConfig": {"thinkingBudget": 0}})

# 3. try other flash models the key has (fastest first, usually "lite")
others = sorted([m for m in flash if m != MAIN], key=lambda m: ("lite" not in m, m))[:3]
if others:
    print("\n3) Trying other Flash models:")
    for m in others:
        test(m, m, {"responseMimeType": "application/json"})

print("\nDone — copy everything above and send it to Claude.")
