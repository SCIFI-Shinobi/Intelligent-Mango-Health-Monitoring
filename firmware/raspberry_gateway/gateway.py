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
TEST_SERVER_URL = f"{API_BASE_URL}/upload"
DEVICE_ID = "rpi_gateway_001"
DEVICE_API_KEY = "mg_4b67afb3534185d19aa2680575a4ae0649ab591cfb26a321"

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
    logging.info(f"BLE Notification received: {payload}")
    if not payload.startswith("waiting") and not payload.startswith("pending") and "," in payload:
        gateway_state.latest_payload = payload
        gateway_state.payload_event.set()

def generate_forecast(disease_type, is_high_risk):
    forecast_labels = ["High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"]
    primary_label = "Stable"
    
    if disease_type != "Healthy":
        primary_label = forecast_labels[0] if disease_type == "Anthracnose" else forecast_labels[1]
        if not is_high_risk and random.random() < 0.55:
            primary_label = "Stable"
            
    forecast = []
    for day in range(5):
        day_risk = "Stable"
        if primary_label != "Stable":
            if is_high_risk:
                day_risk = primary_label if (day < 3 or (day == 3 and random.random() < 0.35)) else "Stable"
            else:
                day_risk = primary_label if (day == 0 or (day == 1 and random.random() < 0.30)) else "Stable"
        forecast.append({"day": day + 1, "risk_level": day_risk})
        
    return forecast

def is_high_risk_conditions(disease_type, temp, hum):
    if disease_type == "Anthracnose":
        return 24.0 <= temp <= 30.0 and hum >= 80.0
    elif disease_type == "Powdery Mildew":
        return 18.0 <= temp <= 26.0 and hum >= 60.0
    return False

def upload_result(disease_type, confidence, temp, hum):
    is_high_risk = is_high_risk_conditions(disease_type, temp, hum)
    forecast_data = generate_forecast(disease_type, is_high_risk)
    
    payload = {
        "device_id": DEVICE_ID,
        "temperature": temp,
        "humidity": hum,
        "disease_type": disease_type,
        "confidence_score": confidence,
        "forecast": forecast_data
    }
    
    if disease_type != "Healthy":
        # Simulate generating recommendations
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
        "x-device-key": DEVICE_API_KEY
    }
    
    try:
        response = requests.post(TEST_SERVER_URL, json=payload, headers=headers, timeout=10)
        if 200 <= response.status_code < 300:
            logging.info(f"Upload OK: {response.text}")
        else:
            logging.error(f"Upload Failed ({response.status_code}): {response.text}")
    except Exception as e:
        logging.error(f"HTTP Request Error: {e}")

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
                logging.info("Connected!")
                
                await client.start_notify(NANO_RESULT_CHAR_UUID, notification_handler)
                
                while client.is_connected:
                    logging.info("Triggering scan...")
                    gateway_state.payload_event.clear()
                    gateway_state.latest_payload = None
                    
                    await client.write_gatt_char(NANO_COMMAND_CHAR_UUID, b"scan")
                    
                    logging.info("Waiting for inference result...")
                    try:
                        await asyncio.wait_for(gateway_state.payload_event.wait(), timeout=RESULT_TIMEOUT_SECONDS)
                        
                        parts = gateway_state.latest_payload.split(",")
                        if len(parts) == 4:
                            disease_type = parts[0]
                            confidence = float(parts[1])
                            temp = float(parts[2])
                            hum = float(parts[3])
                            
                            logging.info(f"Result: {disease_type} ({confidence*100:.1f}%) T:{temp}C H:{hum}%")
                            
                            # Blocking HTTP request inside async loop for simplicity
                            upload_result(disease_type, confidence, temp, hum)
                        else:
                            logging.error(f"Malformed payload: {gateway_state.latest_payload}")
                            
                    except asyncio.TimeoutError:
                        logging.error("Timeout waiting for inference result")
                        
                    logging.info(f"Sleeping for {POLL_INTERVAL_SECONDS} seconds before next scan...")
                    await asyncio.sleep(POLL_INTERVAL_SECONDS)
                    
        except Exception as e:
            logging.error(f"BLE Connection Error: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    logging.info("MangoGuard Raspberry Pi BLE Gateway Starting...")
    asyncio.run(run_gateway())
