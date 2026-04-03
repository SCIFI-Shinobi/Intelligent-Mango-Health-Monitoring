"""
Demo script for defense day - simulates ESP32 sending forecast with anomaly detection
Run: python test_forecast_alert.py
"""
import json

try:
    import requests  # type: ignore
except ImportError:
    requests = None
    import urllib.request
    import urllib.error

API_URL = "http://localhost:8000/data/ingest"


def post_json(url, payload):
    """POST JSON using requests when available, else urllib (no extra dependency)."""
    if requests is not None:
        response = requests.post(url, json=payload, timeout=10)
        return response.status_code, response.text

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
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
    "season": "wet",
    "forecast": [
        {"day": 1, "risk_level": "Stable"},
        {"day": 2, "risk_level": "High_Anthracnose_Risk"},  # ANOMALY - triggers alert
        {"day": 3, "risk_level": "High_Mildew_Risk"},       # ANOMALY - triggers alert
        {"day": 4, "risk_level": "Stable"},
        {"day": 5, "risk_level": "Stable"}
    ]
}

print("Simulating ESP32 forecast with anomaly detection...")
print(f"Sending to: {API_URL}")
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
