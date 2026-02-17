#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ================= WI-FI CONFIGURATION =================
// TODO: User must update these credentials
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ================= API CONFIGURATION =================
// TODO: User must update this URL to their backend
#define API_URL       "http://your-backend-api.com/api/measurements"

// ================= HARDWARE CONFIGURATION =================
#define BUZZER_PIN    13
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_I2C_ADDR 0x3C

// ================= LOGIC & THRESHOLDS =================
// Alert duration in milliseconds
#define ALERT_DURATION_MS 5000

// Disease classes that trigger alerts
// Any classification matching these strings will trigger the buzzer and recommendation
const char* DISEASE_CLASSES[] = {"Anthracnose", "Powdery Mildew"};
const int DISEASE_JAVA_LENGTH = 2; // Number of disease classes

#endif // CONFIG_H
