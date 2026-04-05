"""
Seed script - populates the database with realistic sample data.
Run from the backend directory:  python seed.py
"""

import os
import sys
import random
from datetime import datetime, timedelta

# Add parent dir so we can import the app package
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal, Base
from app.models import SensorData, InferenceResult, Recommendation, ForecastContext, ForecastData, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed():
    # Create all tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # --- 1. Create a demo user (admin / admin123) ---
        existing = db.query(User).filter(User.username == "admin").first()
        if not existing:
            db.add(User(
                username="admin",
                password=pwd_context.hash("admin123")
            ))
            db.commit()
            print("[+] Created user: admin / admin123")
        else:
            print("[=] User 'admin' already exists")

        # --- 2. Sensor data (last 7 days, every 30 minutes) ---
        now = datetime.utcnow()
        sensor_count = db.query(SensorData).count()
        if sensor_count > 10:
            print(f"[=] Sensor data already has {sensor_count} records, skipping")
        else:
            print("[+] Seeding sensor data (7 days, every 30 min)...")
            base_temp = 26.0
            base_humidity = 72.0
            entries = []

            for i in range(7 * 48):  # 7 days * 48 half-hours
                ts = now - timedelta(minutes=30 * (7 * 48 - i))
                hour = ts.hour

                # Simulate day/night temperature cycle
                if 6 <= hour <= 14:
                    temp = base_temp + random.uniform(1, 6)
                elif 15 <= hour <= 18:
                    temp = base_temp + random.uniform(-1, 3)
                else:
                    temp = base_temp + random.uniform(-4, 0)

                # Humidity inversely correlated with temp
                hum = base_humidity + random.uniform(-5, 15) - (temp - base_temp) * 1.5
                hum = max(40, min(95, hum))

                entries.append(SensorData(
                    device_id="ESP32-001",
                    temperature=round(temp, 1),
                    humidity=round(hum, 1),
                    timestamp=ts
                ))

            db.bulk_save_objects(entries)
            db.commit()
            print(f"    Added {len(entries)} sensor readings")

        # --- 3. Inference results (detections every 2 hours) ---
        inference_count = db.query(InferenceResult).count()
        if inference_count > 5:
            print(f"[=] Inference results already has {inference_count} records, skipping")
        else:
            print("[+] Seeding detection results...")
            detections = []
            disease_options = [
                ("Healthy", 0.92, 0.99),
                ("Healthy", 0.85, 0.97),
                ("Anthracnose", 0.70, 0.95),
                ("Powdery Mildew", 0.65, 0.90),
                ("Healthy", 0.90, 0.98),
            ]

            for i in range(7 * 12):  # 7 days * 12 (every 2 hours)
                ts = now - timedelta(hours=2 * (7 * 12 - i))
                disease, conf_low, conf_high = random.choice(disease_options)
                confidence = round(random.uniform(conf_low, conf_high), 2)

                detections.append(InferenceResult(
                    device_id="NANO33-001",
                    disease_type=disease,
                    confidence_score=confidence,
                    timestamp=ts
                ))

            db.bulk_save_objects(detections)
            db.commit()
            print(f"    Added {len(detections)} detection results")

        # --- 4. Recommendations (bilingual: English + Amharic) - Disease-specific from ESP32 ---
        rec_count = db.query(Recommendation).count()
        if rec_count > 3:
            print(f"[=] Recommendations already has {rec_count} records, skipping")
        else:
            print("[+] Seeding recommendations...")
            recs = [
                # Anthracnose - Targeted (High Risk)
                ("Anthracnose Control",
                 "Spray with copper-based fungicide (Copper oxychloride). High risk conditions detected.",
                 "አንትራክኖዝ ቆጣቢ",
                 "በፈንገስ ማጥፊያ (Copper) ይርጩ"),
                # Anthracnose - Preventive (Medium Risk)
                ("Anthracnose Prevention",
                 "Remove diseased branches and improve air circulation around trees.",
                 "አንትራክኖዝ መከላከያ",
                 "የታመሙ ቅርንጫፎችን ያስወግዱ"),
                # Powdery Mildew - Targeted (High Risk)
                ("Powdery Mildew Control",
                 "Spray with sulfur-based medicine (Sulfur fungicide). High risk conditions detected.",
                 "የዱቄት ሻጋታ ቆጣቢ",
                 "ሰልፈር (Sulfur) ያለው መድሃኒት ይርጩ"),
                # Powdery Mildew - Preventive (Medium Risk)
                ("Powdery Mildew Prevention",
                 "Prune tree branches to allow air circulation.",
                 "የዱቄት ሻጋታ መከላከያ",
                 "አየር እንዲገባ የዛፉን ቅርንጫፎች ይቀንሱ"),
                # Healthy/General
                ("Regular Monitoring",
                 "Continue regular monitoring and maintenance. Monitor humidity and pruning.",
                 "መደበኛ ክትትል",
                 "መደበኛ ክትትልና ጽዳት ያድርጉ"),
            ]
            for i, (title, desc, title_am, desc_am) in enumerate(recs):
                db.add(Recommendation(
                    device_id="ESP32-001",
                    title=title,
                    description=desc,
                    title_am=title_am,
                    description_am=desc_am,
                    timestamp=now - timedelta(hours=i * 8)
                ))
            db.commit()
            print(f"    Added {len(recs)} recommendations")

        # --- 5. Forecast context + 5-day forecast ---
        fc_count = db.query(ForecastContext).count()
        if fc_count > 0:
            print(f"[=] Forecast already has {fc_count} records, skipping")
        else:
            print("[+] Seeding forecast data...")
            ctx = ForecastContext(
                device_id="ESP32-001",
                timestamp=now - timedelta(hours=1)
            )
            db.add(ctx)
            db.commit()
            db.refresh(ctx)

            risk_levels = ["Stable", "Stable", "High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"]
            for i, risk in enumerate(risk_levels):
                db.add(ForecastData(
                    device_id="ESP32-001",
                    day_index=i,
                    risk_level=risk,
                    forecast_date=now + timedelta(days=i + 1),
                    context_id=ctx.id
                ))
            db.commit()
            print(f"    Added forecast context + 5-day forecast")

        print("\n[OK] Database seeded successfully!")
        print("     Login with:  admin / admin123")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
