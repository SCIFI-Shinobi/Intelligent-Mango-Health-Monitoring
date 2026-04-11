"""
Demo script for defense day - simulates ESP32 sending forecast with anomaly detection
Run: python test_forecast_alert.py
"""
import json
import os

try:
    import requests  # type: ignore
except ImportError:
    requests = None
    import urllib.request
    import urllib.error

API_URL = os.getenv("API_URL", "http://localhost:8000/data/ingest")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "")

def get_config():
    global API_URL, DEVICE_API_KEY
    print("=" * 50)
    print("  Forecast Alert Test  ")
    print("=" * 50)
    
    user_url = input(f"Enter Backend API URL [{API_URL}]: ").strip()
    if user_url:
        if not user_url.endswith("/data/ingest"):
            user_url = user_url.rstrip("/") + "/data/ingest"
        API_URL = user_url
        
    user_key = input(f"Enter Device API Key (Starts with mg_) [{DEVICE_API_KEY}]: ").strip()
    if user_key:
        DEVICE_API_KEY = user_key

def post_json(url, payload):
    """POST JSON using requests when available, else urllib (no extra dependency)."""
    headers = {"Content-Type": "application/json"}
    if DEVICE_API_KEY:
        headers["X-Device-Key"] = DEVICE_API_KEY

    if requests is not None:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        return response.status_code, response.text

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.getcode(), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body

# Simulate ESP32 detecting high disease risk in forecast
payload = {
    "device_id": "esp32-demo",
    "temperature": 29.5,
    "humidity": 82.0,
    "disease_type": "Healthy",
    "confidence_score": 0.92,
    "forecast": [
        {"day": 1, "risk_level": "Stable"},
        {"day": 2, "risk_level": "High_Anthracnose_Risk"},  # ANOMALY - triggers alert
        {"day": 3, "risk_level": "High_Mildew_Risk"},       # ANOMALY - triggers alert
        {"day": 4, "risk_level": "Stable"},
        {"day": 5, "risk_level": "Stable"}
    ]
}

if __name__ == "__main__":
    get_config()

    print("\nSimulating ESP32 forecast with anomaly detection...")
    print(f"Sending to: {API_URL}")
print("Using X-Device-Key header:" + (" yes" if DEVICE_API_KEY else " no (set DEVICE_API_KEY env var)"))
print(f"Forecast includes HIGH RISK on Day 2 (Anthracnose) and Day 3 (Mildew)")
    print("-" * 50)

    try:
        status_code, response_text = post_json(API_URL, payload)
        if status_code == 200:
            print("SUCCESS! Forecast alerts created.")
            print("Check the notification bell in the dashboard!")
            print(response_text)
        else:
            print(f"Error: {status_code}")
            print(response_text)
    except Exception as e:
        print(f"Connection error: {e}")
        print("Make sure the backend is running!")
