#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ================= SYSTEM MODES =================
#define DEMO_MODE 1   // 1 = demo, 0 = deployment

// ================= FEATURE FLAGS =================
// Set to 1 to enable hardware components
#define ENABLE_OLED 0
#define ENABLE_BUZZER 0

// ================= DEPLOYMENT CONFIG =================
const unsigned long SCAN_INTERVAL_MS = 20UL * 60UL * 1000UL; // 20 minutes
const unsigned long DEMO_INTERVAL_MS = 2000UL; // 2 seconds

// ================= ALERT CONFIG =================
const float DISEASE_CONFIDENCE_THRESHOLD = 0.80f;
const float CONFIDENCE_MARGIN = 0.20f;

// ================= PIN DEFINITIONS =================
const uint8_t BUZZER_PIN = 9;

// ================= HARDWARE CONFIG =================
// Camera Constants
#define EI_CAMERA_RAW_FRAME_BUFFER_COLS     160
#define EI_CAMERA_RAW_FRAME_BUFFER_ROWS     120
#define EI_CAMERA_FRAME_BYTE_SIZE           3

// OLED Config
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_I2C_ADDR 0x3C

#endif // CONFIG_H
