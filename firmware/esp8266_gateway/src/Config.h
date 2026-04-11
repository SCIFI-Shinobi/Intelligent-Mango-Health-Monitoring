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
#define DEVICE_ID     "esp8266_gateway_001"

// API endpoint for gateway uploads
#define API_INGEST_PATH "/data/ingest"

// Device API key for authenticated data submission
#define DEVICE_API_KEY "mg_your_api_key_here"

// ================= TIMEZONE CONFIGURATION =================
// Ethiopian Time (EAT) is UTC+3
#define NTP_SERVER    "pool.ntp.org"
#define GMT_OFFSET    10800   // UTC+3 in seconds (3 * 60 * 60)
#define DST_OFFSET    0       // No daylight saving in Ethiopia

// ================= UART SERIAL CONFIGURATION =================
// Communication with Nano 33 BLE edge AI device via UART
#define UART_BAUD_RATE 115200
#define RX_PIN D5  // GPIO14 - UART RX
#define TX_PIN D6  // GPIO12 - UART TX

// ================= HARDWARE CONFIGURATION =================
#define BUZZER_PIN    D0  // GPIO16
#define DHT_PIN       D4  // GPIO2
#define DHT_TYPE      DHT22
#define LCD_I2C_ADDR  0x27
#define LCD_COLUMNS   16
#define LCD_ROWS      2
#define SDA_PIN       D2  // GPIO4
#define SCL_PIN       D1  // GPIO5

// Rain Sensor (FC-37 / YL-83)
// Analog output: rain intensity (lower value = more rain)
// Digital output: rain detected threshold (HIGH = no rain, LOW = rain)
#define RAIN_SENSOR_ANALOG_PIN A0  // ADC on ESP8266
#define RAIN_INTENSITY_THRESHOLD 512  // Below this = raining (0-1023 range on ESP8266)

// ================= LOGIC & THRESHOLDS =================
// Alert duration in milliseconds
#define ALERT_DURATION_MS 5000

// Cloud sync interval in milliseconds (default: 15 seconds for ESP8266 - slower device)
#define CLOUD_SYNC_INTERVAL_MS 15000

// Disease classes that trigger alerts
#define ALERT_THRESHOLD 0.70  // 70% confidence minimum

// ================= SENSOR CALIBRATION =================
#define DHT_READ_INTERVAL 2000  // Read DHT every 2 seconds
#define RAIN_CHECK_INTERVAL 1000  // Check rain sensor every 1 second

#endif
