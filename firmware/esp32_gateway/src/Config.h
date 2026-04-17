#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>


// ================= WI-FI CONFIGURATION =================
#define WIFI_SSID     "BDU-Guest"
#define WIFI_PASSWORD ""

// ================= API CONFIGURATION =================
#define TEST_SERVER_URL  "https://mango-guard-backend.onrender.com/upload"
#define LOG_SERVER_URL   "http://localhost:4000"
#define DEVICE_ID        "esp32_gateway_001"
#define DEVICE_API_KEY   "mg_4b67afb3534185d19aa2680575a4ae0649ab591cfb26a321"

// BLE UUIDs (must match Nano)
#define NANO_SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CLASSIFICATION_CHAR_UUID "19B10001-E8F2-537E-4F6C-D104768A1214"



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
