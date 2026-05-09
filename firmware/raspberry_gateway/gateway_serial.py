import serial
import serial.tools.list_ports
import requests
import logging
import time
import threading

try:
    from lcd_driver import LCD
    lcd = LCD(port=1, address=0x3F)
    lcd.print_line("Gateway Ready", 1)
    lcd.print_line("Waiting...", 2)
except ImportError:
    logging.warning("lcd_driver not found, LCD will not be used.")
    class DummyLCD:
        def print_line(self, *args): pass
        def clear(self): pass
    lcd = DummyLCD()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ================= CONFIGURATION =================
API_BASE_URL   = "https://mango-guard-backend.onrender.com"
INGEST_URL     = f"{API_BASE_URL}/data/ingest"
DEVICE_API_KEY = "mg_c2a2bc944471a63f0ea2b5c9f4f432fc361172d5a76acd74"

SERIAL_PORT    = "/dev/ttyACM0"   # USB port the Nano appears as on the Pi
SERIAL_BAUD    = 115200
# =================================================


def is_high_risk_conditions(disease_type: str, temp: float, hum: float) -> bool:
    if disease_type == "Anthracnose":
        return 24.0 <= temp <= 30.0 and hum >= 80.0
    elif disease_type == "Powdery Mildew":
        return 18.0 <= temp <= 26.0 and hum >= 60.0
    return False


def _post(payload: dict) -> None:
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY,
    }
    try:
        response = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        logging.info(f"Upload response: {response.status_code}")
    except Exception as e:
        logging.error(f"Upload error: {e}")


def upload_scan(disease_type: str, confidence: float, temp: float, hum: float, recommendation_en: str, recommendation_am: str) -> None:
    payload = {
        "device_id":        "rpi_gateway_001",
        "temperature":      temp,
        "humidity":         hum,
        "disease_type":     disease_type,
        "confidence_score": confidence,
    }

    if disease_type != "Healthy":
        title_am = "ማስጠንቀቂያ"
        if disease_type == "Anthracnose":
            title_am = "አንትራክኖዝ ማስጠንቀቂያ"
        elif disease_type == "Powdery Mildew":
            title_am = "የዱቄት ሻጋታ ማስጠንቀቂያ"

        payload["recommendations"] = [{
            "title":          f"{disease_type} Alert",
            "description":    recommendation_en,
            "title_am":       title_am,
            "description_am": recommendation_am,
        }]

    logging.info(f"Uploading payload: {payload}")
    _post(payload)


def handle_line(line: str) -> None:
    """Process one line received from the Nano over Serial."""
    line = line.strip()
    if not line:
        return

    logging.info(f"Nano: {line}")

    if line.startswith("SCAN:"):
        parts = line[5:].split(",")
        if len(parts) >= 6:
            disease_type = parts[0]
            try:
                confidence = float(parts[1])
                temp       = float(parts[2])
                hum        = float(parts[3])
                recommendation_en = parts[4]
                recommendation_am = parts[5]
            except ValueError:
                logging.warning(f"Could not parse SCAN values: {parts}")
                return
        elif len(parts) >= 5:
            disease_type = parts[0]
            try:
                confidence = float(parts[1])
                temp       = float(parts[2])
                hum        = float(parts[3])
                recommendation_en = parts[4]
                recommendation_am = parts[4]
            except ValueError:
                logging.warning(f"Could not parse SCAN values: {parts}")
                return
        elif len(parts) == 4:
            disease_type = parts[0]
            try:
                confidence = float(parts[1])
                temp       = float(parts[2])
                hum        = float(parts[3])
                recommendation_en = "Your Trees Look Healthy"
                recommendation_am = "ዛፎችዎ ጤናማ ናቸው"
            except ValueError:
                logging.warning(f"Could not parse SCAN values: {parts}")
                return
        else:
            logging.warning(f"Malformed SCAN payload: {line}")
            return

        logging.info(f"Scan → {disease_type} ({confidence*100:.1f}%)  T:{temp}°C  H:{hum}%  Rec:{recommendation_en}")

        # Update LCD
        # Line 1: D:Anthracn T:28C
        short_disease = disease_type[:8] if disease_type != "Powdery Mildew" else "Powdery"
        lcd.print_line(f"D:{short_disease} T:{int(temp)}C", 1)
        
        # Line 2: HIGH RISK
        # Since we don't receive risk_level explicitly, infer from recommendation_en
        if "URGENT" in recommendation_en:
            lcd.print_line("HIGH RISK!", 2)
        elif "Spray Now" in recommendation_en:
            lcd.print_line("MEDIUM RISK!", 2)
        else:
            lcd.print_line("LOW RISK", 2)

        # Upload in background so serial reading isn't blocked
        t = threading.Thread(target=upload_scan, args=(disease_type, confidence, temp, hum, recommendation_en, recommendation_am))
        t.daemon = True
        t.start()


def find_nano_port() -> str:
    """Try to auto-detect the Nano's serial port if /dev/ttyACM0 doesn't work."""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        if "ACM" in p.device or "Arduino" in (p.description or ""):
            logging.info(f"Auto-detected Nano at {p.device}")
            return p.device
    return SERIAL_PORT  # fall back to default


def run_gateway() -> None:
    port = find_nano_port()
    logging.info(f"MangoGuard Serial Gateway starting on {port} @ {SERIAL_BAUD} baud...")

    while True:
        try:
            with serial.Serial(port, SERIAL_BAUD, timeout=2) as ser:
                logging.info(f"Connected to Nano on {port}. Listening...")
                while True:
                    try:
                        raw = ser.readline()
                        if raw:
                            line = raw.decode("utf-8", errors="ignore")
                            handle_line(line)
                    except Exception as e:
                        logging.error(f"Read error: {e}")
                        break

        except serial.SerialException as e:
            logging.error(f"Cannot open {port}: {e}")
            logging.info("Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            time.sleep(5)


if __name__ == "__main__":
    run_gateway()
