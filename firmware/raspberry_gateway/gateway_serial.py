import serial
import serial.tools.list_ports
import requests
import logging
import time
import threading

try:
    from lcd_driver import LCD
    lcd = LCD(port=1, address=0x3F)
    lcd.print_line("MangoGuard v1.0", 1)
    lcd.print_line("Initializing...", 2)
    time.sleep(1)
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

SERIAL_PORT    = "/dev/ttyACM0"
SERIAL_BAUD    = 115200
# =================================================

lcd_lock = threading.Lock()
current_scroll_text = ""
_offline_notice_until = 0.0   # epoch time until which we show the offline notice
_last_recommendation   = ""   # recommendation to restore after offline notice expires


def scroll_lcd_task():
    """Continuously scrolls long text on LCD line 2."""
    global current_scroll_text, _offline_notice_until, _last_recommendation
    while True:
        # If an offline notice is active, show it; restore recommendation when it expires
        now = time.time()
        if _offline_notice_until > now:
            text = "Offline - No Net"
        else:
            if current_scroll_text == "Offline - No Net":
                # Notice just expired — restore the last recommendation
                current_scroll_text = _last_recommendation
            text = current_scroll_text

        if len(text) > 16:
            padded_text = text + " *** "
            for i in range(len(padded_text)):
                # Abort scroll early if state changed
                if current_scroll_text != text and _offline_notice_until <= time.time():
                    break
                display_text = (padded_text[i:] + padded_text[:i])[:16]
                with lcd_lock:
                    lcd.print_line(display_text, 2)
                time.sleep(0.35)
        elif len(text) > 0:
            with lcd_lock:
                lcd.print_line(text.ljust(16), 2)
            time.sleep(0.5)
        else:
            time.sleep(0.5)


def _post(payload: dict) -> bool:
    """Send payload to backend. Returns True on success, False if offline/error."""
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY,
    }
    try:
        response = requests.post(INGEST_URL, json=payload, headers=headers, timeout=10)
        logging.info(f"Upload response: {response.status_code}")
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        logging.warning("Backend unreachable - operating offline, data not uploaded.")
        return False
    except Exception as e:
        logging.error(f"Upload error: {e}")
        return False


def upload_scan(disease_type: str, confidence: float, temp: float, hum: float,
                recommendation_en: str, recommendation_am: str) -> None:
    """
    Forward the Nano's scan result directly to the backend.
    The Nano already computed the recommendation — the gateway just passes it through.
    Offline is handled gracefully: log a warning, show on LCD, no crash.
    """
    payload = {
        "device_id":        "rpi_gateway_001",
        "temperature":      temp,
        "humidity":         hum,
        "disease_type":     disease_type,
        "confidence_score": confidence,
    }

    # Only attach recommendation block for diseased plants.
    # The text itself came directly from the Nano — no logic here.
    if disease_type.lower() != "healthy":
        if disease_type == "Anthracnose":
            title_am = "አንትራክኖዝ ማስጠንቀቂያ"
        elif disease_type == "Powdery Mildew":
            title_am = "የዱቄት ሻጋታ ማስጠንቀቂያ"
        else:
            title_am = "ማስጠንቀቂያ"

        payload["recommendations"] = [{
            "title":          f"{disease_type} Alert",
            "description":    recommendation_en,
            "title_am":       title_am,
            "description_am": recommendation_am,
        }]

    logging.info(f"Uploading payload: {payload}")

    success = _post(payload)

    global current_scroll_text, _offline_notice_until, _last_recommendation
    if success:
        logging.info("Upload successful")
        # Clear any lingering offline notice immediately on reconnect
        _offline_notice_until = 0.0
        # Keep the Nano's recommendation on screen
    else:
        # Show offline hint for 3 s — non-blocking, scroll_lcd_task handles timing
        logging.warning("Running in offline mode - scan displayed locally only.")
        _last_recommendation  = recommendation_en
        _offline_notice_until = time.time() + 3.0
        current_scroll_text   = "Offline - No Net"


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
                confidence        = float(parts[1])
                temp              = float(parts[2])
                hum               = float(parts[3])
                recommendation_en = parts[4]
                recommendation_am = parts[5]
            except ValueError:
                logging.warning(f"Could not parse SCAN values: {parts}")
                return

        elif len(parts) >= 5:
            disease_type = parts[0]
            try:
                confidence        = float(parts[1])
                temp              = float(parts[2])
                hum               = float(parts[3])
                recommendation_en = parts[4]
                recommendation_am = parts[4]  # fallback: same text for both languages
            except ValueError:
                logging.warning(f"Could not parse SCAN values: {parts}")
                return

        elif len(parts) == 4:
            disease_type = parts[0]
            try:
                confidence        = float(parts[1])
                temp              = float(parts[2])
                hum               = float(parts[3])
                recommendation_en = "Your Trees Look Healthy"
                recommendation_am = "ዛፎችዎ ጤናማ ናቸው"
            except ValueError:
                logging.warning(f"Could not parse SCAN values: {parts}")
                return

        else:
            logging.warning(f"Malformed SCAN payload: {line}")
            return

        logging.info(
            f"Scan -> {disease_type} ({confidence*100:.1f}%)  "
            f"T:{temp}C  H:{hum}%  Rec:{recommendation_en}"
        )

        # --- LCD Line 1: disease + temp ---
        short_disease = disease_type[:8] if disease_type != "Powdery Mildew" else "Powdery"
        with lcd_lock:
            lcd.print_line(f"D:{short_disease} T:{int(temp)}C", 1)

        # --- LCD Line 2: scroll the Nano's recommendation ---
        global current_scroll_text
        current_scroll_text = recommendation_en

        # Upload in background so serial reading is never blocked
        t = threading.Thread(
            target=upload_scan,
            args=(disease_type, confidence, temp, hum, recommendation_en, recommendation_am)
        )
        t.daemon = True
        t.start()


def find_nano_port() -> str:
    ports = serial.tools.list_ports.comports()
    for p in ports:
        if "ACM" in p.device or "Arduino" in (p.description or ""):
            logging.info(f"Auto-detected Nano at {p.device}")
            return p.device
    return SERIAL_PORT


def run_gateway() -> None:
    port = find_nano_port()
    logging.info(f"MangoGuard Serial Gateway starting on {port} @ {SERIAL_BAUD} baud...")

    while True:
        try:
            with serial.Serial(port, SERIAL_BAUD, timeout=2) as ser:
                logging.info(f"Connected to Nano on {port}. Listening...")
                with lcd_lock:
                    lcd.print_line("Edge AI Ready", 1)
                global current_scroll_text
                current_scroll_text = "Auto-scan (10s)"

                while True:
                    try:
                        raw = ser.readline()
                        if raw:
                            line = raw.decode("utf-8", errors="ignore")
                            handle_line(line)
                    except Exception as e:
                        logging.error(f"Read error: {e}")
                        lcd.print_line("Read Error!", 1)
                        lcd.print_line("Reconnecting...", 2)
                        break

        except serial.SerialException as e:
            logging.error(f"Cannot open {port}: {e}")
            lcd.print_line("Connect Edge AI", 1)
            lcd.print_line("Device...", 2)
            logging.info("Retrying in 5 seconds...")
            time.sleep(5)

        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            lcd.print_line("Gateway Error!", 1)
            lcd.print_line("Restarting...", 2)
            time.sleep(5)


if __name__ == "__main__":
    t_scroll = threading.Thread(target=scroll_lcd_task)
    t_scroll.daemon = True
    t_scroll.start()

    with lcd_lock:
        lcd.print_line("Gateway Ready", 1)
        lcd.print_line("Starting up...", 2)
    time.sleep(1)
    run_gateway()
