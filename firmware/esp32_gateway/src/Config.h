#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ================= WI-FI CONFIGURATION =================
// TODO: User must update these credentials
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ================= API CONFIGURATION =================
// TODO: User must update this URL to their backend
#define API_BASE_URL  "https://your-backend-api.com"
#define DEVICE_ID     "esp32_gateway_001"

// API endpoint for gateway uploads
#define API_INGEST_PATH "/data/ingest"

// Device API key for authenticated data submission.
// Generate this from the dashboard: Settings > Devices > Register Device
#define DEVICE_API_KEY "mg_your_api_key_here"

// ================= TIMEZONE CONFIGURATION =================
// Ethiopian Time (EAT) is UTC+3
#define NTP_SERVER    "pool.ntp.org"
#define GMT_OFFSET    10800   // UTC+3 in seconds (3 * 60 * 60)
#define DST_OFFSET    0       // No daylight saving in Ethiopia

// ================= HARDWARE CONFIGURATION =================
#define BUZZER_PIN    5
#define DHT_PIN       4
#define DHT_TYPE      DHT22
#define RX_PIN        16
#define TX_PIN        17
#define LCD_I2C_ADDR  0x27
#define LCD_COLUMNS   16
#define LCD_ROWS      2

// Rain Sensor (FC-37 / YL-83)
// Analog output: rain intensity (lower value = more rain)
// Digital output: rain detected threshold (HIGH = no rain, LOW = rain)
#define RAIN_SENSOR_ANALOG_PIN  34
#define RAIN_SENSOR_DIGITAL_PIN 35
#define RAIN_INTENSITY_THRESHOLD 2000  // Below this = raining (0-4095 range on ESP32)

// ================= LOGIC & THRESHOLDS =================
// Alert duration in milliseconds
#define ALERT_DURATION_MS 5000

// Cloud sync interval in milliseconds (default: 10 seconds)
#define CLOUD_SYNC_INTERVAL_MS 10000

// Disease classes that trigger alerts
// Any classification matching these strings will trigger the buzzer and recommendation
const char* DISEASE_CLASSES[] = {"Anthracnose", "Powdery Mildew"};
const int DISEASE_CLASSES_LENGTH = 2; // Number of disease classes

#endif // CONFIG_H
