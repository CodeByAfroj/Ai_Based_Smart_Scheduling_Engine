import os, httpx
from dotenv import load_dotenv

load_dotenv(".env")
api_key = os.getenv("GEMINI_API_KEY")

for model_name in ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-1.5-flash"]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
    headers = {"Content-Type": "application/json"}
    
    resp = httpx.post(url, headers=headers, json=payload)
    print(f"Model: {model_name}, Status: {resp.status_code}")
    if resp.status_code != 200:
        print(resp.text)

