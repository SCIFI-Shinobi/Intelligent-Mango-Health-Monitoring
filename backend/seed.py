"""
MangoGuard Gateway Simulator
Sends data to the deployed backend exactly like a real ESP32 gateway would.
Just replace the API_KEY below with the one from your website (Settings > Devices).

Usage:
  python seed.py              (interactive menu)
  python seed.py --live       (send a healthy reading)
  python seed.py --test-alert (send a diseased reading to trigger alerts)
  python seed.py --seed       (local DB seeding for development only)
"""

import os
import sys
import random
import secrets
import requests
import argparse
from datetime import datetime, timedelta

# ──────────────────────────────────────────────────────────
#  REPLACE THESE WITH YOUR OWN VALUES
# ──────────────────────────────────────────────────────────
API_KEY = "mg_c2a2bc944471a63f0ea2b5c9f4f432fc361172d5a76acd74"
API_URL = "https://mango-guard-backend.onrender.com"
# ──────────────────────────────────────────────────────────

# Add parent dir so we can import the app package (only needed for --seed)
sys.path.insert(0, os.path.dirname(__file__))


def _post(payload: dict, label: str):
    """Send a payload to /data/ingest and print the result."""
    print(f"\n[+] {label}")
    print(f"    Sending to {API_URL}/data/ingest")
    print(f"    Disease   : {payload['disease_type']} | Confidence: {payload['confidence_score']}")
    print(f"    Temp      : {payload['temperature']}C | Humidity: {payload['humidity']}%")
    if any(d.get("risk_level", "Stable") != "Stable" for d in payload.get("forecast", [])):
        risky = [d for d in payload["forecast"] if d.get("risk_level", "Stable") != "Stable"]
        for r in risky:
            print(f"    Forecast  : Day {r['day']} → {r['risk_level']}")

    headers = {"X-Device-Key": API_KEY, "Content-Type": "application/json"}
    try:
        response = requests.post(f"{API_URL}/data/ingest", json=payload, headers=headers)
        if response.ok:
            print(f"    [SUCCESS] {response.json()}")
        else:
            print(f"    [FAILED] HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print(f"    [ERROR] Could not connect to API: {e}")


def _stable_forecast():
    """1-day stable forecast item to append to the queue."""
    return [
        {"day": 5, "risk_level": "Stable", "date": (datetime.now() + timedelta(days=5)).isoformat()}
    ]


def _high_risk_forecast(disease_type: str):
    """1-day high-risk forecast item to append to the queue."""
    tag = disease_type.replace(" ", "_")
    return [
        {"day": 5, "risk_level": f"High_{tag}_Risk", "date": (datetime.now() + timedelta(days=5)).isoformat()}
    ]


# ── Simulation helpers ─────────────────────────────────────────────────────────

def send_healthy():
    """Choice 1 — healthy reading, stable forecast, no alerts triggered."""
    _post({
        "device_id": "esp32-gateway",
        "temperature": round(random.uniform(24, 29), 1),
        "humidity": round(random.uniform(55, 70), 1),
        "disease_type": "Healthy",
        "confidence_score": round(random.uniform(0.90, 0.99), 2),
        "recommendations": [{
            "title": "Routine Maintenance",
            "description": "Plants look healthy. Continue regular care.",
            "title_am": "መደበኛ ክትትል",
            "description_am": "ተክሉ በጥሩ ሁኔታ ላይ ነው። ውሃ ማጠጣትዎን ይቀጥሉ።",
        }],
        "forecast": _stable_forecast(),
    }, label="Healthy Reading (no alerts)")


def send_disease_detection(disease_type: str, confidence: float):
    """Choices 2 & 3 — disease detected above threshold → triggers DISEASE email only."""
    _post({
        "device_id": "esp32-gateway",
        "temperature": round(random.uniform(28, 33), 1),
        "humidity": round(random.uniform(70, 85), 1),
        "disease_type": disease_type,
        "confidence_score": confidence,
        "recommendations": [{
            "title": f"{disease_type} Treatment",
            "description": f"Apply recommended treatment for {disease_type}.",
            "title_am": "የህክምና ሕክምና",
            "description_am": "የሚመከሩ መድሃኒቶችን ይጠቀሙ።",
        }],
        "forecast": _stable_forecast(),   # ← no high-risk days, so NO forecast email
    }, label=f"{disease_type} Detection (disease email only)")


def send_forecast_alert(disease_type: str):
    """Choices 4 & 5 — healthy reading but high-risk forecast → triggers FORECAST email only."""
    _post({
        "device_id": "esp32-gateway",
        "temperature": round(random.uniform(29, 34), 1),
        "humidity": round(random.uniform(75, 90), 1),
        "disease_type": "Healthy",          # ← no active disease → no disease email
        "confidence_score": 0.91,
        "recommendations": [{
            "title": "Preventive Action Recommended",
            "description": f"High {disease_type} risk forecast. Apply preventive measures now.",
            "title_am": "የቅድሚያ እርምጃ",
            "description_am": "ከፍተኛ የበሽታ አደጋ ተንብዮ ። አስቀድሞ እርምጃ ይውሰዱ።",
        }],
        "forecast": _high_risk_forecast(disease_type),  # ← high-risk days → forecast email sent
    }, label=f"High {disease_type} Risk Forecast (forecast email only)")


def send_combined_alert(disease_type: str, confidence: float):
    """Choice 6 — disease detected AND high-risk forecast → triggers BOTH emails."""
    _post({
        "device_id": "esp32-gateway",
        "temperature": 34.0,
        "humidity": 90.0,
        "disease_type": disease_type,
        "confidence_score": confidence,
        "recommendations": [{
            "title": f"Urgent: {disease_type} Treatment Required",
            "description": f"Active {disease_type} detected. Immediate treatment and monitoring required.",
            "title_am": "አስቸኳይ ህክምና",
            "description_am": "ንቁ በሽታ ተደርሶ ። ወዲያውኑ ህክምና ያድርጉ።",
        }],
        "forecast": _high_risk_forecast(disease_type),  # ← both disease + forecast emails
    }, label=f"Combined Alert: {disease_type} + High-Risk Forecast (BOTH emails)")


# ── Historical seed ────────────────────────────────────────────────────────────

def run_historical_seed():
    """Seed the local database with 7 days of sample data (dev only)."""
    from app.database import engine, SessionLocal, Base
    from app.models import SensorData, InferenceResult, User, Device
    from passlib.context import CryptContext

    pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.username == "admin").first()
        if not user:
            user = User(
                username="admin",
                password=pwd_context.hash("admin"),
                email="",
                notification_emails_enabled=False,
                disease_confidence_threshold=70
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[+] Created local dev user: admin / admin")

        device = db.query(Device).filter(Device.user_id == user.id).first()
        if not device:
            device = Device(
                user_id=user.id,
                device_name="Main Gateway ESP32",
                api_key=secrets.token_urlsafe(32)
            )
            db.add(device)
            db.commit()
            db.refresh(device)
            print(f"[+] Created device with API Key: {device.api_key}")

        internal_device_id = f"device:{device.id}"

        now = datetime.utcnow()
        sensor_count = db.query(SensorData).filter(SensorData.device_id == internal_device_id).count()
        if sensor_count > 100:
            print(f"[=] Sensor data already exists, skipping")
        else:
            print(f"[+] Seeding sensor data...")
            base_temp, base_humidity = 26.0, 72.0
            entries = []
            for i in range(7 * 48):
                ts = now - timedelta(minutes=30 * (7 * 48 - i))
                hour = ts.hour
                temp = base_temp + random.uniform(1, 6) if 6 <= hour <= 14 else base_temp + random.uniform(-4, 0)
                hum = max(40, min(95, base_humidity + random.uniform(-5, 15) - (temp - base_temp) * 1.5))
                entries.append(SensorData(device_id=internal_device_id, temperature=round(temp, 1), humidity=round(hum, 1), timestamp=ts))
            db.bulk_save_objects(entries)
            db.commit()

        inf_count = db.query(InferenceResult).filter(InferenceResult.device_id == internal_device_id).count()
        if inf_count > 20:
            print(f"[=] Detection results already exist, skipping")
        else:
            print("[+] Seeding detection results...")
            detections = []
            options = [("Healthy", 0.85, 0.99), ("Anthracnose", 0.70, 0.95), ("Powdery Mildew", 0.65, 0.90)]
            for i in range(7 * 12):
                ts = now - timedelta(hours=2 * (7 * 12 - i))
                disease, lo, hi = random.choice(options)
                detections.append(InferenceResult(device_id=internal_device_id, disease_type=disease, confidence_score=round(random.uniform(lo, hi), 2), timestamp=ts))
            db.bulk_save_objects(detections)
            db.commit()

        print("[OK] Historical seed completed!")
    finally:
        db.close()


# ── Menu ───────────────────────────────────────────────────────────────────────

def show_menu():
    print("\n" + "=" * 55)
    print("   MangoGuard Gateway Simulator")
    print("=" * 55)
    print(f"   API: {API_URL}")
    print(f"   Key: {API_KEY[:12]}...{API_KEY[-4:]}")
    print("=" * 55)
    print("  DETECTION TESTS  (triggers disease email if above threshold)")
    print("  1. Send Healthy Update               → no email")
    print("  2. Send Anthracnose Detection         → 🚨 disease email")
    print("  3. Send Powdery Mildew Detection      → 🚨 disease email")
    print()
    print("  FORECAST TESTS   (triggers forecast email)")
    print("  4. Send High Anthracnose Forecast     → ⚠️  forecast email")
    print("  5. Send High Powdery Mildew Forecast  → ⚠️  forecast email")
    print()
    print("  COMBINED TEST    (triggers both emails)")
    print("  6. Send Anthracnose + High Forecast   → 🚨 + ⚠️  both emails")
    print()
    print("  7. Seed Local DB (dev only)")
    print("  8. Exit")
    print("=" * 55)
    return input("Select (1-8): ").strip()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MangoGuard Gateway Simulator")
    parser.add_argument("--seed", action="store_true", help="Seed local DB with historical data (dev only)")
    parser.add_argument("--live", action="store_true", help="Send a healthy update via API")
    parser.add_argument("--test-alert", action="store_true", help="Send a diseased detection to trigger alerts")

    args = parser.parse_args()

    if args.seed:
        run_historical_seed()
    elif args.live:
        send_healthy()
    elif args.test_alert:
        send_disease_detection("Anthracnose", 0.92)
    else:
        while True:
            choice = show_menu()
            if choice == "1":
                send_healthy()
            elif choice == "2":
                send_disease_detection("Anthracnose", 0.92)
            elif choice == "3":
                send_disease_detection("Powdery Mildew", 0.87)
            elif choice == "4":
                send_forecast_alert("Anthracnose")
            elif choice == "5":
                send_forecast_alert("Powdery Mildew")
            elif choice == "6":
                send_combined_alert("Anthracnose", 0.91)
            elif choice == "7":
                run_historical_seed()
            elif choice == "8":
                print("Exiting...")
                break
            else:
                print("[!] Invalid choice.")
