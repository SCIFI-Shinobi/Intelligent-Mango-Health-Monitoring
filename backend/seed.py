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


def send_api_update(disease_type="Healthy", confidence=0.98, high_risk=False):
    """Send data to /data/ingest exactly like a real ESP32 gateway would."""

    payload = {
        "device_id": "esp32-gateway",
        "temperature": 32.0 if high_risk else round(random.uniform(24, 30), 1),
        "humidity": 85.0 if high_risk else round(random.uniform(55, 75), 1),
        "disease_type": disease_type,
        "confidence_score": confidence,
        "recommendations": [
            {
                "title": f"{disease_type} Treatment" if disease_type != "Healthy" else "Routine Maintenance",
                "description": f"Apply recommended treatment for {disease_type}." if disease_type != "Healthy" else "Plants look healthy. Continue regular care.",
                "title_am": "የአያያዝ መመሪያ" if disease_type != "Healthy" else "መደበኛ ክትትል",
                "description_am": "መደበኛ የህክምና ክትትል ያድርጉ።" if disease_type != "Healthy" else "ተክሉ በጥሩ ሁኔታ ላይ ነው። ውሃ ማጠጣትዎን ይቀጥሉ።"
            }
        ],
        "forecast": [
            {"day": 1, "risk_level": "Stable", "date": (datetime.now() - timedelta(days=4)).isoformat()},
            {"day": 2, "risk_level": "Stable", "date": (datetime.now() - timedelta(days=3)).isoformat()},
            {"day": 3, "risk_level": "Stable", "date": (datetime.now() - timedelta(days=2)).isoformat()},
            {"day": 4, "risk_level": "Stable", "date": (datetime.now() - timedelta(days=1)).isoformat()},
            {"day": 5, "risk_level": "High_Anthracnose_Risk" if high_risk else "Stable", "date": datetime.now().isoformat()}
        ]
    }

    print(f"\n[+] Sending to {API_URL}/data/ingest")
    print(f"    Disease: {disease_type} | Confidence: {confidence}")
    print(f"    Temp: {payload['temperature']}C | Humidity: {payload['humidity']}%")

    headers = {"X-Device-Key": API_KEY, "Content-Type": "application/json"}
    try:
        response = requests.post(f"{API_URL}/data/ingest", json=payload, headers=headers)
        if response.ok:
            print(f"[SUCCESS] {response.json()}")
        else:
            print(f"[FAILED] HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[ERROR] Could not connect to API: {e}")


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


def show_menu():
    print("\n" + "=" * 50)
    print("   MangoGuard Gateway Simulator")
    print("=" * 50)
    print(f"   API: {API_URL}")
    print(f"   Key: {API_KEY[:12]}...{API_KEY[-4:]}")
    print("=" * 50)
    print("1. Send Healthy Update")
    print("2. Send Anthracnose Detection (High Risk)")
    print("3. Send Powdery Mildew Detection")
    print("4. Seed Local DB (dev only)")
    print("5. Exit")
    print("=" * 50)
    return input("Select (1-5): ")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MangoGuard Gateway Simulator")
    parser.add_argument("--seed", action="store_true", help="Seed local DB with historical data (dev only)")
    parser.add_argument("--live", action="store_true", help="Send a healthy update via API")
    parser.add_argument("--test-alert", action="store_true", help="Send a diseased detection to trigger alerts")

    args = parser.parse_args()

    if args.seed:
        run_historical_seed()
    elif args.live:
        send_api_update()
    elif args.test_alert:
        send_api_update(disease_type="Anthracnose", confidence=0.92, high_risk=True)
    else:
        # Interactive menu
        while True:
            choice = show_menu()
            if choice == "1":
                send_api_update()
            elif choice == "2":
                send_api_update(disease_type="Anthracnose", confidence=0.92, high_risk=True)
            elif choice == "3":
                send_api_update(disease_type="Powdery Mildew", confidence=0.85, high_risk=True)
            elif choice == "4":
                run_historical_seed()
            elif choice == "5":
                print("Exiting...")
                break
            else:
                print("[!] Invalid choice.")
