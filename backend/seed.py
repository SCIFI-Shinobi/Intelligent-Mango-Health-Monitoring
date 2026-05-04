"""
Seed script - populates the database with realistic sample data and simulates live gateway updates.
Usage:
  python seed.py --seed         (Populates historical data)
  python seed.py --live         (Simulates a live gateway sending one update)
  python seed.py --test-email   (Simulates a diseased scan to test email alerts)
"""

import os
import sys
import random
import secrets
import requests
import argparse
from datetime import datetime, timedelta

# Add parent dir so we can import the app package
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal, Base
from app.models import SensorData, InferenceResult, Recommendation, ForecastContext, ForecastData, User, Device
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
API_BASE_URL = "http://localhost:8000"

def get_or_create_device(db):
    user = db.query(User).filter(User.username == "admin").first()
    if not user:
        user = User(
            username="admin",
            password=pwd_context.hash("admin123"),
            email="test@example.com", # Set a default email for testing
            notification_emails_enabled=True,
            disease_confidence_threshold=70
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[+] Created user: {user.username} / admin123")

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
        print(f"[+] Created device: {device.device_name} with API Key: {device.api_key}")
    
    return device

def run_historical_seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        device = get_or_create_device(db)
        internal_device_id = f"device:{device.id}"

        # --- Sensor data (last 7 days, every 30 minutes) ---
        now = datetime.utcnow()
        sensor_count = db.query(SensorData).filter(SensorData.device_id == internal_device_id).count()
        if sensor_count > 100:
            print(f"[=] Sensor data for {internal_device_id} already exists, skipping")
        else:
            print(f"[+] Seeding sensor data for {internal_device_id}...")
            base_temp = 26.0
            base_humidity = 72.0
            entries = []
            for i in range(7 * 48):
                ts = now - timedelta(minutes=30 * (7 * 48 - i))
                hour = ts.hour
                temp = base_temp + random.uniform(1, 6) if 6 <= hour <= 14 else base_temp + random.uniform(-4, 0)
                hum = max(40, min(95, base_humidity + random.uniform(-5, 15) - (temp - base_temp) * 1.5))
                entries.append(SensorData(device_id=internal_device_id, temperature=round(temp, 1), humidity=round(hum, 1), timestamp=ts))
            db.bulk_save_objects(entries)
            db.commit()

        # --- Inference results ---
        inf_count = db.query(InferenceResult).filter(InferenceResult.device_id == internal_device_id).count()
        if inf_count > 20:
            print(f"[=] Inference results already exist, skipping")
        else:
            print("[+] Seeding detection results...")
            detections = []
            options = [("Healthy", 0.85, 0.99), ("Anthracnose", 0.70, 0.95), ("Powdery Mildew", 0.65, 0.90)]
            for i in range(7 * 12):
                ts = now - timedelta(hours=2 * (7 * 12 - i))
                disease, l, h = random.choice(options)
                detections.append(InferenceResult(device_id=internal_device_id, disease_type=disease, confidence_score=round(random.uniform(l, h), 2), timestamp=ts))
            db.bulk_save_objects(detections)
            db.commit()

        print("[OK] Historical seed completed!")
    finally:
        db.close()

def send_api_update(disease_type="Healthy", confidence=0.98, is_test_email=False):
    db = SessionLocal()
    device = get_or_create_device(db)
    api_key = device.api_key
    db.close()

    payload = {
        "device_id": f"device:{device.id}",
        "temperature": 28.5 if not is_test_email else 32.0,
        "humidity": 65.0 if not is_test_email else 85.0,
        "disease_type": disease_type,
        "confidence_score": confidence,
        "recommendations": [
            {
                "title": f"{disease_type} Treatment" if disease_type != "Healthy" else "Maintenance",
                "description": f"Standard protocol for {disease_type}." if disease_type != "Healthy" else "Plants look good. Continue normal watering.",
                "title_am": "የአያያዝ መመሪያ" if disease_type != "Healthy" else "መደበኛ ክትትል",
                "description_am": "መደበኛ የህክምና ክትትል ያድርጉ።" if disease_type != "Healthy" else "ተክሉ በጥሩ ሁኔታ ላይ ነው። ውሃ ማጠጣትዎን ይቀጥሉ።"
            }
        ],
        "forecast": [
            {"day": 1, "risk_level": "Stable", "date": (datetime.now() + timedelta(days=1)).isoformat()},
            {"day": 2, "risk_level": "High_Anthracnose_Risk" if is_test_email else "Stable", "date": (datetime.now() + timedelta(days=2)).isoformat()},
            {"day": 3, "risk_level": "Stable", "date": (datetime.now() + timedelta(days=3)).isoformat()},
            {"day": 4, "risk_level": "Stable", "date": (datetime.now() + timedelta(days=4)).isoformat()},
            {"day": 5, "risk_level": "Stable", "date": (datetime.now() + timedelta(days=5)).isoformat()}
        ]
    }

    print(f"[+] Sending live update to {API_BASE_URL}/data/ingest...")
    headers = {"X-Device-Key": api_key, "Content-Type": "application/json"}
    try:
        response = requests.post(f"{API_BASE_URL}/data/ingest", json=payload, headers=headers)
        if response.ok:
            print(f"[SUCCESS] Data ingested. Server responded: {response.json()}")
            if is_test_email:
                print("[INFO] Check your console/SMTP logs for an alert email trigger.")
        else:
            print(f"[FAILED] HTTP {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[ERROR] Could not connect to API: {e}")

def show_menu():
    print("\n" + "="*40)
    print("   MangoGuard System Utility")
    print("="*40)
    print("1. Seed Historical Data (7 Days)")
    print("2. Send Live 'Healthy' Update (API)")
    print("3. Test Email Alert (Send Diseased Scan)")
    print("4. Exit")
    print("="*40)
    choice = input("Select an option (1-4): ")
    return choice

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MangoGuard Seed & Test Utility")
    parser.add_argument("--seed", action="store_true", help="Populate historical data")
    parser.add_argument("--live", action="store_true", help="Send a live 'Healthy' update via API")
    parser.add_argument("--test-email", action="store_true", help="Send a 'Diseased' update to test email alerts")
    
    args = parser.parse_args()

    # If no arguments provided, show interactive menu
    if not any(vars(args).values()):
        while True:
            choice = show_menu()
            if choice == "1":
                run_historical_seed()
            elif choice == "2":
                send_api_update()
            elif choice == "3":
                send_api_update(disease_type="Anthracnose", confidence=0.92, is_test_email=True)
            elif choice == "4":
                print("Exiting...")
                break
            else:
                print("[!] Invalid choice, try again.")
    else:
        # Handle command line arguments
        if args.seed:
            run_historical_seed()
        elif args.live:
            send_api_update()
        elif args.test_email:
            send_api_update(disease_type="Anthracnose", confidence=0.92, is_test_email=True)
