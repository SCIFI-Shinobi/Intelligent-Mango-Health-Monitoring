import asyncio
import random
import time
import requests
import uuid
import logging
from bleak import BleakClient, BleakScanner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ================= CONFIGURATION =================
API_BASE_URL = "https://mango-guard-backend.onrender.com"
TEST_SERVER_URL = f"{API_BASE_URL}/data/ingest"
DEVICE_ID = "rpi_gateway_001"
DEVICE_API_KEY = "mg_c2a2bc944471a63f0ea2b5c9f4f432fc361172d5a76acd74"

NANO_DEVICE_NAME = "Nano33-Classifier"
NANO_SERVICE_UUID = "19B10010-E8F2-537E-4F6C-D104768A1214"
NANO_RESULT_CHAR_UUID = "19B10011-E8F2-537E-4F6C-D104768A1214"
NANO_COMMAND_CHAR_UUID = "19B10012-E8F2-537E-4F6C-D104768A1214"

POLL_INTERVAL_SECONDS = 30
RESULT_TIMEOUT_SECONDS = 30
# =================================================

class GatewayState:
    def __init__(self):
        self.latest_payload = None
        self.payload_event = asyncio.Event()

gateway_state = GatewayState()

def notification_handler(sender, data):
    payload = data.decode('utf-8').strip()
    logging.info(f"BLE Message: {payload}")
    
    if payload.startswith("SCAN:"):
        content = payload[5:]
        parts = content.split(",")
        if len(parts) == 4:
            disease_type = parts[0]
            confidence = float(parts[1])
            temp = float(parts[2])
            hum = float(parts[3])
            logging.info(f"Auto-Scan: {disease_type} ({confidence*100:.1f}%) T:{temp}C H:{hum}%")
            upload_result(disease_type, confidence, temp, hum)
            
    elif payload.startswith("FORECAST:"):
        content = payload[9:]
        days = content.split(",")
        logging.info(f"Auto-Forecast Received: {days}")
        upload_forecast_only(days)

def is_high_risk_conditions(disease_type, temp, hum):
    if disease_type == "Anthracnose":
        return 24.0 <= temp <= 30.0 and hum >= 80.0
    elif disease_type == "Powdery Mildew":
        return 18.0 <= temp <= 26.0 and hum >= 60.0
    return False

def upload_result(disease_type, confidence, temp, hum):
    is_high_risk = is_high_risk_conditions(disease_type, temp, hum)
    
    # We still want the Pi to generate recommendations for the dashboard
    payload = {
        "device_id": DEVICE_ID,
        "temperature": temp,
        "humidity": hum,
        "disease_type": disease_type,
        "confidence_score": confidence,
    }
    
    if disease_type != "Healthy":
        title_en = f"{disease_type} Alert"
        title_am = "ማስጠንቀቂያ"
        desc_en = "Targeted action required" if is_high_risk else "Preventive action required"
        desc_am = "እርምጃ ይውሰዱ"
        payload["recommendations"] = [{
            "title": title_en,
            "description": desc_en,
            "title_am": title_am,
            "description_am": desc_am
        }]
    
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY
    }
    
    try:
        response = requests.post(TEST_SERVER_URL, json=payload, headers=headers, timeout=10)
        logging.info(f"Scan Upload: {response.status_code}")
    except Exception as e:
        logging.error(f"Scan Upload Error: {e}")

def upload_forecast_only(days):
    forecast_data = []
    for i, risk in enumerate(days):
        forecast_data.append({"day": i + 1, "risk_level": risk})
    
    payload = {
        "device_id": DEVICE_ID,
        "temperature": 0,
        "humidity": 0,
        "disease_type": "Healthy",
        "confidence_score": 1.0,
        "forecast": forecast_data
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY
    }
    
    try:
        response = requests.post(TEST_SERVER_URL, json=payload, headers=headers, timeout=10)
        logging.info(f"Forecast Upload: {response.status_code}")
    except Exception as e:
        logging.error(f"Forecast Upload Error: {e}")

async def run_gateway():
    while True:
        logging.info(f"Scanning for {NANO_DEVICE_NAME}...")
        device = await BleakScanner.find_device_by_name(NANO_DEVICE_NAME, timeout=10.0)
        
        if not device:
            logging.warning("Nano not found. Retrying in 5 seconds...")
            await asyncio.sleep(5)
            continue
            
        logging.info(f"Found Nano at {device.address}. Connecting...")
        
        try:
            async with BleakClient(device, timeout=20.0) as client:
                logging.info("Connected! Listening for automated updates...")
                await client.start_notify(NANO_RESULT_CHAR_UUID, notification_handler)
                
                while client.is_connected:
                    await asyncio.sleep(5)
                    
        except Exception as e:
            logging.error(f"BLE Connection Error: {e}")
            await asyncio.sleep(5)
                    
        except Exception as e:
            logging.error(f"BLE Connection Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    logging.info("MangoGuard Raspberry Pi BLE Gateway Starting...")
    asyncio.run(run_gateway())
