"""
Demo script for defense day - simulates ESP32 sending forecast with anomaly detection
Run: python test_forecast_alert.py
"""
import requests

API_URL = "http://localhost:8000/data/ingest"

# Simulate ESP32 detecting high disease risk in forecast
payload = {
    "device_id": "esp32-demo",
    "temperature": 29.5,
    "humidity": 82.0,
    "disease_type": "Healthy",
    "confidence_score": 0.92,
    "season": "wet",
    "precipitation": 15.0,
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
    response = requests.post(API_URL, json=payload)
    if response.status_code == 200:
        print("SUCCESS! Forecast alerts created.")
        print("Check the notification bell in the dashboard!")
        print(response.json())
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Connection error: {e}")
    print("Make sure the backend is running!")
