# Raspberry Pi Plant Health Gateway Configuration

import os
from datetime import timedelta

# ================= LOGGING =================
LOG_LEVEL = "INFO"  # DEBUG, INFO, WARNING, ERROR
LOG_FILE = "/var/log/plant_health_gateway.log"

# ================= DEVICE CONFIGURATION =================
DEVICE_ID = "rpi_gateway_001"
DEVICE_NAME = "Raspberry Pi Plant Health Gateway"

# ================= API CONFIGURATION =================
# TODO: Update this to your backend URL
API_BASE_URL = "http://your-backend-api.com"
API_TIMEOUT = 10  # seconds

# Optional: Device API key for authenticated data submission
# DEVICE_API_KEY = "mg_your_api_key_here"

# ================= TIMEZONE CONFIGURATION =================
# Ethiopian Time (EAT) is UTC+3
TIMEZONE = "Africa/Addis_Ababa"
TZ_UTC_OFFSET = 3  # hours from UTC

# ================= SERIAL CONFIGURATION =================
# Communication with edge AI device (Nano 33 BLE) via UART
SERIAL_PORT = "/dev/ttyUSB0"  # Change to /dev/ttyAMA0 for Pi GPIO serial
SERIAL_BAUD_RATE = 115200
SERIAL_TIMEOUT = 1.0  # seconds

# ================= GPIO CONFIGURATION =================
# Raspberry Pi GPIO pins (BCM numbering)
GPIO_BUZZER = 17      # GPIO 17
GPIO_RAIN_SENSOR = 27  # GPIO 27 (digital)
GPIO_STATUS_LED = 22   # GPIO 22

# ================= SENSOR CONFIGURATION =================
# DHT22 sensor connected to GPIO 4
DHT_PIN = 4
DHT_TYPE = "DHT22"
DHT_READ_INTERVAL = 2000  # milliseconds

# Rain Sensor
RAIN_CHECK_INTERVAL = 1000  # milliseconds
RAIN_INTENSITY_THRESHOLD = 512

# ================= ALERT CONFIGURATION =================
ALERT_THRESHOLD = 0.70  # 70% confidence minimum
ALERT_DURATION_MS = 5000  # 5 seconds

# ================= DISEASE PROFILES =================
DISEASE_PROFILES = {
    "Anthracnose": {
        "min_temp": 24.0,
        "max_temp": 30.0,
        "humidity_threshold": 80.0,
        "targeted_action_en": "Spray with copper-based fungicide (Copper oxychloride). High risk conditions detected.",
        "preventive_action_en": "Remove diseased branches and improve air circulation.",
        "targeted_action_am": "ፈንገስ ማጥፊያ (Copper) ይርጩ",
        "preventive_action_am": "የታመሙ ቅርንጫፎችን ያስወግዱ",
        "title_en": "Anthracnose Detected",
        "title_am": "አንትራክኖዝ ተገኝቷል"
    },
    "Powdery Mildew": {
        "min_temp": 18.0,
        "max_temp": 26.0,
        "humidity_threshold": 60.0,
        "targeted_action_en": "Apply sulfur-based fungicide. Improve ventilation around plants.",
        "preventive_action_en": "Prune overcrowded branches to reduce humidity.",
        "targeted_action_am": "ሶልፈር ሊሊት ይሳሩ",
        "preventive_action_am": "ተክሎችን ዙሪያ የአየር ስርጭት ይሻሻሉ",
        "title_en": "Powdery Mildew Alert",
        "title_am": "ነጩ ሽንት አስጠንቅ"
    },
    "Rust": {
        "min_temp": 15.0,
        "max_temp": 22.0,
        "humidity_threshold": 75.0,
        "targeted_action_en": "Apply sulfur or copper fungicide. Ensure good air circulation.",
        "preventive_action_en": "Remove infected leaves and improve drainage.",
        "targeted_action_am": "ሶልፈር ወይም Copper ይሳሩ",
        "preventive_action_am": "ተያይዞ የሞተ ቅጠሎችን ያስወግዱ",
        "title_en": "Rust Detected",
        "title_am": "ዝንጠቱ ተገኝቷል"
    }
}

# ================= CLOUD SYNC =================
CLOUD_SYNC_INTERVAL = 15  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

# ================= DISPLAY CONFIGURATION =================
# For optional I2C 16x2 LCD display
LCD_I2C_ADDRESS = 0x27
LCD_COLUMNS = 16
LCD_ROWS = 2
I2C_BUS = 1

# ================= DATABASE (Optional) =================
# Local SQLite for caching sensor data
USE_LOCAL_DB = True
DB_PATH = "/home/pi/plant_health_gateway/sensor_data.db"
DB_RETENTION_DAYS = 30

# ================= ENVIRONMENT =================
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
MOCK_SENSORS = os.getenv("MOCK_SENSORS", "False").lower() == "true"  # For testing without hardware
