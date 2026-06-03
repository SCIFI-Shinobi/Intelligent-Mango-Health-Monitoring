import serial
import serial.tools.list_ports
import requests
import logging
import time
import threading
import socket

try:
    import local_forecast
except ImportError:
    local_forecast = None

recent_readings = []

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

# Paste your Device API Key here (found in the MangoGuard
# web dashboard under Settings → Gateways → Copy Key)
DEVICE_API_KEY = "PASTE_YOUR_DEVICE_API_KEY_HERE"

SERIAL_PORT    = "/dev/ttyACM0"
SERIAL_BAUD    = 115200
# =================================================

lcd_lock = threading.Lock()

# --- Shared LCD state (always access under lcd_lock) ---
_lcd_line1 = ""          # what is currently shown on line 1
_lcd_line2_text = ""     # the text the scroller should display on line 2
_lcd_line2_override = "" # temporary override (e.g. "Offline") — clears itself after _override_until
_override_until = 0.0    # epoch time when the override expires

def _sanitize_lcd(text: str) -> str:
    """Removes non-ASCII characters that cause Japanese/garbage letters on HD44780 LCDs."""
    return "".join(c if ord(c) < 128 else "" for c in text).strip()


def _set_line1(text: str) -> None:
    """Set line 1 immediately. Must be called with lcd_lock held."""
    global _lcd_line1
    _lcd_line1 = _sanitize_lcd(text)
    lcd.print_line(_lcd_line1, 1)


def set_line2(text: str) -> None:
    """Set the persistent scroll text for line 2. Thread-safe."""
    global _lcd_line2_text
    with lcd_lock:
        _lcd_line2_text = _sanitize_lcd(text)


def set_line2_override(text: str, duration: float) -> None:
    """Show a temporary override on line 2 for `duration` seconds. Thread-safe."""
    global _lcd_line2_override, _override_until
    with lcd_lock:
        _lcd_line2_override = _sanitize_lcd(text)
        _override_until = time.time() + duration


def scroll_lcd_task() -> None:
    """
    Continuously drives LCD line 2.
    - While an override is active, shows the override text.
    - Otherwise scrolls _lcd_line2_text.
    - Clears the display on the first frame after a text change to prevent ghost chars.
    """
    global _lcd_line2_text, _lcd_line2_override, _override_until

    last_displayed = None   # track what we last put on screen so we can detect changes

    while True:
        try:
            with lcd_lock:
                now = time.time()
                if _lcd_line2_override and now < _override_until:
                    text = _lcd_line2_override
                else:
                    # Override expired — clear it
                    _lcd_line2_override = ""
                    text = _lcd_line2_text

            # If the text changed, clear line 2 first to wipe ghost characters
            if text != last_displayed:
                with lcd_lock:
                    lcd.print_line(" " * 16, 2)
                last_displayed = text

            if not text:
                time.sleep(0.3)
                continue

            if len(text) <= 16:
                with lcd_lock:
                    lcd.print_line(text.ljust(16), 2)
                time.sleep(0.5)
            else:
                # Scroll: one full rotation then re-check for text change
                padded = text + "   "
                for i in range(len(padded)):
                    # Check if something changed mid-scroll
                    with lcd_lock:
                        now = time.time()
                        current = _lcd_line2_override if (_lcd_line2_override and now < _override_until) else _lcd_line2_text
                    if current != text:
                        break
                    window = (padded[i:] + padded)[:16]
                    with lcd_lock:
                        lcd.print_line(window, 2)
                    time.sleep(0.35)
        except Exception as e:
            logging.error(f"Error in scroll_lcd_task: {e}")
            time.sleep(1)


# ---------------------------------------------------------------------------

def check_internet(host="8.8.8.8", port=53, timeout=3) -> bool:
    """Quick internet check — tries a TCP connection to Google DNS.
    Returns True if online, False if offline.
    """
    try:
        socket.setdefaulttimeout(timeout)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
        return True
    except socket.error:
        return False

# ---------------------------------------------------------------------------

def _post(payload: dict) -> bool:
    """POST payload to backend. Returns True on HTTP 200, False otherwise."""
    headers = {
        "Content-Type": "application/json",
        "X-Device-Key": DEVICE_API_KEY,
    }
    try:
        # Increased timeout to 45 seconds because Render free tier backends can take ~40 seconds to wake up from sleep
        r = requests.post(INGEST_URL, json=payload, headers=headers, timeout=45)
        logging.info(f"Upload response: {r.status_code}")
        
        if r.status_code in [401, 403]:
            logging.error("Upload failed: Invalid DEVICE_API_KEY! Please update DEVICE_API_KEY in gateway_serial.py with your key from the MangoGuard dashboard.")
            return False
            
        return r.status_code == 200
    except requests.exceptions.ConnectionError:
        logging.warning("Backend unreachable — operating offline.")
        return False
    except requests.exceptions.Timeout:
        logging.warning("Backend request timed out (it might be waking up). Treating as offline.")
        return False
    except Exception as e:
        logging.error(f"Upload error: {e}")
        return False


def upload_scan(disease_type: str, confidence: float, temp: float, hum: float,
                recommendation_en: str, recommendation_am: str) -> None:
    """Send scan result to backend. Shows a 4-second offline notice on failure."""
    try:
        payload = {
            "device_id":        "rpi_gateway_001",
            "temperature":      temp,
            "humidity":         hum,
            "disease_type":     disease_type,
            "confidence_score": confidence,
        }

        if disease_type.lower() != "healthy":
            title_am_map = {
                "Anthracnose":   "አንትራክኖዝ ማስጠንቀቂያ",
                "Powdery Mildew":"የዱቄት ሻጋታ ማስጠንቀቂያ",
            }
            payload["recommendations"] = [{
                "title":          f"{disease_type} Alert",
                "description":    recommendation_en,
                "title_am":       title_am_map.get(disease_type, "ማስጠንቀቂያ"),
                "description_am": recommendation_am,
            }]

        logging.info(f"Uploading: {payload}")

        if _post(payload):
            logging.info("Upload successful.")
            recent_readings.clear()  # We have internet, clear offline buffer
            # Nothing extra to do — recommendation already showing on line 2
        else:
            logging.warning("Offline — data not uploaded.")

            # Save reading locally since we are offline.
            # The forecast model expects exactly 24 hourly readings (48 features: temp+humidity per hour).
            recent_readings.append({"temperature": temp, "humidity": hum})
            if len(recent_readings) > 24:
                recent_readings.pop(0)

            # Run local forecast only when we have a full 24-reading window — this matches
            # the window size the Edge Impulse model was trained on. Fewer readings would
            # require padding/repetition, which degrades forecast accuracy.
            if local_forecast and local_forecast._model_loaded and len(recent_readings) >= 24:
                logging.info("Running local offline forecast with full 24-reading window...")
                forecast_label = local_forecast.run_forecast(recent_readings)
                logging.info(f"Local forecast result: {forecast_label}")
                
                if forecast_label == "High_Anthracnose_Risk":
                    set_line2(f"{recommendation_en} | Fcast: Anthracnose")
                elif forecast_label == "High_Mildew_Risk":
                    set_line2(f"{recommendation_en} | Fcast: Mildew")
                elif forecast_label == "Stable":
                    set_line2(f"{recommendation_en} | Fcast: Stable")
                else:
                    set_line2(f"{recommendation_en} | Offline")
            else:
                if len(recent_readings) < 24:
                    logging.info(f"Collecting readings for forecast window... ({len(recent_readings)}/24)")
                # Not enough readings yet — show offline status
                set_line2(f"{recommendation_en} | Offline")
    except Exception as e:
        logging.error(f"Error in upload_scan thread: {e}", exc_info=True)


def handle_line(line: str) -> None:
    """Parse one UART line from the Nano and update LCD + trigger upload."""
    line = line.strip()
    if not line:
        return

    # Skip lines that are clearly garbled (non-ASCII heavy, no colon prefix)
    if not line.startswith("SCAN:") and not line.isascii():
        logging.debug(f"Skipping garbled line: {repr(line)}")
        return

    logging.info(f"Nano: {line}")

    if not line.startswith("SCAN:"):
        return

    parts = line[5:].split(",")

    # --- Parse fields ---
    recommendation_en = ""
    recommendation_am = ""

    if len(parts) >= 6:
        disease_type      = parts[0]
        raw_nums          = parts[1:4]
        recommendation_en = parts[4]
        recommendation_am = parts[5]
    elif len(parts) == 5:
        disease_type      = parts[0]
        raw_nums          = parts[1:4]
        recommendation_en = parts[4]
        recommendation_am = parts[4]
    elif len(parts) == 4:
        disease_type      = parts[0]
        raw_nums          = parts[1:4]
        recommendation_en = "Trees Look Healthy"
        recommendation_am = "ዛፎችዎ ጤናማ ናቸው"
    else:
        logging.warning(f"Malformed SCAN: {line}")
        return

    try:
        confidence = float(raw_nums[0])
        temp       = float(raw_nums[1])
        hum        = float(raw_nums[2])
    except (ValueError, IndexError):
        logging.warning(f"Could not parse numbers in SCAN: {parts}")
        return

    logging.info(
        f"Scan → {disease_type} ({confidence*100:.1f}%)  "
        f"T:{temp}°C  H:{hum}%  Rec: {recommendation_en}"
    )

    # --- Update LCD ---
    short_disease = "Powdery" if disease_type == "Powdery Mildew" else disease_type[:8]
    with lcd_lock:
        _set_line1(f"D:{short_disease} T:{int(temp)}C")

    set_line2(recommendation_en)

    # Upload in background — never block serial reading
    t = threading.Thread(
        target=upload_scan,
        args=(disease_type, confidence, temp, hum, recommendation_en, recommendation_am),
        daemon=True,
    )
    t.start()


def find_nano_port() -> str:
    for p in serial.tools.list_ports.comports():
        if "ACM" in p.device or "Arduino" in (p.description or ""):
            logging.info(f"Auto-detected Nano at {p.device}")
            return p.device
    return SERIAL_PORT


def run_gateway() -> None:
    # --- Load local forecast model (always, used only when offline) ---
    if local_forecast:
        local_forecast.load_model()

    # --- Check internet and show mode on LCD ---
    logging.info("Checking internet connectivity...")
    with lcd_lock:
        _set_line1("Checking net...")
    set_line2("Please wait...  ")
    time.sleep(1)

    online = check_internet()
    if online:
        logging.info("MODE: ONLINE — acting as pure gateway.")
        with lcd_lock:
            _set_line1("Mode: Online    ")
        set_line2("Sending to cloud")
    else:
        logging.info("MODE: OFFLINE — local forecasting enabled.")
        with lcd_lock:
            _set_line1("Mode: Offline   ")
        set_line2("Local forecast  ")
    time.sleep(2)

    port = find_nano_port()
    logging.info(f"MangoGuard gateway starting on {port} @ {SERIAL_BAUD} baud...")

    while True:
        try:
            with serial.Serial(port, SERIAL_BAUD, timeout=2) as ser:
                # Flush garbage bytes that accumulate while the device was disconnected
                ser.reset_input_buffer()
                time.sleep(0.1)
                ser.reset_input_buffer()

                logging.info(f"Connected to Nano on {port}.")
                with lcd_lock:
                    _set_line1("Edge AI Ready ")
                set_line2("Auto-scan 1hr  ")

                while True:
                    try:
                        raw = ser.readline()
                        if raw:
                            line = raw.decode("utf-8", errors="ignore")
                            handle_line(line)
                    except Exception as e:
                        logging.error(f"Read error: {e}")
                        with lcd_lock:
                            _set_line1("Read Error!     ")
                        set_line2("Reconnecting...  ")
                        break

        except serial.SerialException as e:
            logging.error(f"Cannot open {port}: {e}")
            with lcd_lock:
                _set_line1("Connect Edge AI ")
            set_line2("Waiting 4 Nano  ")
            logging.info("Retrying in 5 s...")
            time.sleep(5)

        except Exception as e:
            logging.error(f"Unexpected error: {e}")
            with lcd_lock:
                _set_line1("Gateway Error!  ")
            set_line2("Restarting...   ")
            time.sleep(5)


if __name__ == "__main__":
    t_scroll = threading.Thread(target=scroll_lcd_task, daemon=True)
    t_scroll.start()

    with lcd_lock:
        _set_line1("MangoGuard v1.0")
    set_line2("Starting up...  ")
    time.sleep(1)

    run_gateway()