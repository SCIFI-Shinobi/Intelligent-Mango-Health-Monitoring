import asyncio
import requests
import logging
from bleak import BleakClient, BleakScanner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ================= CONFIGURATION =================
API_BASE_URL = "https://mango-guard-backend.onrender.com"
INGEST_URL   = f"{API_BASE_URL}/data/ingest"
DEVICE_API_KEY = "mg_c2a2bc944471a63f0ea2b5c9f4f432fc361172d5a76acd74"

NANO_DEVICE_NAME     = "Nano33-Classifier"
NANO_SERVICE_UUID    = "19B10010-E8F2-537E-4F6C-D104768A1214"
NANO_RESULT_CHAR_UUID  = "19B10011-E8F2-537E-4F6C-D104768A1214"
NANO_COMMAND_CHAR_UUID = "19B10012-E8F2-537E-4F6C-D104768A1214"
# =================================================


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_high_risk_conditions(disease_type: str, temp: float, hum: float) -> bool:
    if disease_type == "Anthracnose":
        return 24.0 <= temp <= 30.0 and hum >= 80.0
    elif disease_type == "Powdery Mildew":
        return 18.0 <= temp <= 26.0 and hum >= 60.0
    return False


def _post(payload: dict) -> None:
    """Blocking HTTP POST — always call via run_in_executor."""
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY,
    }
    try:
        response = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        logging.info(f"Upload response: {response.status_code}")
    except Exception as e:
        logging.error(f"Upload error: {e}")


def upload_scan(disease_type: str, confidence: float, temp: float, hum: float) -> None:
    """Build scan payload and POST to /data/ingest.
    The backend auto-runs the TFLite forecast model after every ingest
    once >= 24 sensor readings are stored — no forecast field needed here.
    """
    is_high_risk = is_high_risk_conditions(disease_type, temp, hum)

    payload = {
        "device_id":        "rpi_gateway_001",
        "temperature":      temp,
        "humidity":         hum,
        "disease_type":     disease_type,
        "confidence_score": confidence,
    }

    if disease_type != "Healthy":
        payload["recommendations"] = [{
            "title":          f"{disease_type} Alert",
            "description":    "Targeted action required" if is_high_risk else "Preventive action required",
            "title_am":       "ማስጠንቀቂያ",
            "description_am": "እርምጃ ይውሰዱ",
        }]

    _post(payload)


# ---------------------------------------------------------------------------
# BLE notification handler
# ---------------------------------------------------------------------------

def notification_handler(sender, data: bytearray) -> None:
    """
    Called by bleak on the asyncio thread.
    Only SCAN: payloads are expected from the Nano.
    Forecasting is handled automatically by the backend.
    """
    payload = data.decode("utf-8").strip()
    logging.info(f"BLE message: {payload}")

    loop = asyncio.get_event_loop()

    if payload.startswith("SCAN:"):
        parts = payload[5:].split(",")
        if len(parts) != 4:
            logging.warning(f"Malformed SCAN payload: {payload}")
            return

        disease_type = parts[0]
        try:
            confidence = float(parts[1])
            temp       = float(parts[2])
            hum        = float(parts[3])
        except ValueError:
            logging.warning(f"Could not parse SCAN values: {parts}")
            return

        logging.info(f"Scan → {disease_type} ({confidence*100:.1f}%)  T:{temp}°C  H:{hum}%")
        loop.run_in_executor(None, upload_scan, disease_type, confidence, temp, hum)

    else:
        logging.warning(f"Unknown BLE payload: {payload}")


# ---------------------------------------------------------------------------
# Main gateway loop
# ---------------------------------------------------------------------------

async def run_gateway() -> None:
    while True:
        logging.info(f"Scanning for '{NANO_DEVICE_NAME}'...")
        device = await BleakScanner.find_device_by_name(NANO_DEVICE_NAME, timeout=10.0)

        if not device:
            logging.warning("Nano not found. Retrying in 5 s...")
            await asyncio.sleep(5)
            continue

        logging.info(f"Found Nano at {device.address}. Connecting...")

        try:
            async with BleakClient(device, timeout=20.0) as client:
                logging.info("Connected! Subscribed to BLE notifications.")
                await client.start_notify(NANO_RESULT_CHAR_UUID, notification_handler)

                while client.is_connected:
                    await asyncio.sleep(5)

                logging.warning("Nano disconnected.")

        except Exception as e:
            logging.error(f"BLE connection error: {e}")

        logging.info("Reconnecting in 3 s...")
        await asyncio.sleep(3)


if __name__ == "__main__":
    logging.info("MangoGuard Raspberry Pi BLE Gateway starting...")
    asyncio.run(run_gateway())