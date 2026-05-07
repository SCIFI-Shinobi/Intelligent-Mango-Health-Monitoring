/*
 * mango_guard_demo.ino
 *
 * MangoGuard — unified mango disease detection + climate risk forecasting
 *
 * Combines two Edge Impulse models:
 *   • Health model  (MobileNet, camera):
 *       Input : 96×96 RGB image  → 9216 pixels
 *       Output: Anthracnose | Healthy | Powdery Mildew
 *
 *   • Forecast model (time-series, temperature + humidity):
 *       Input : 24 hourly (temperature, humidity) pairs → 48 floats
 *       Output: High_Anthracnose_Risk | High_Mildew_Risk | Stable
 *
 * Hardware assumed: ESP32-EYE (camera) + DHT22 / SHT31 (temp+humidity)
 * Adapt the camera capture and sensor read sections for your board.
 *
 * Copyright (c) 2026 University Program - Bahir Dar Institute of Technology
 * SPDX-License-Identifier: Apache-2.0
 */

#include <mango_guard.h>

// ── Optional: include your camera driver here ──────────────────────────────
// #include "esp_camera.h"    // for ESP32-CAM / ESP32-EYE

// ── Optional: include your environmental sensor driver ─────────────────────
// #include <DHT.h>           // for DHT22
// #include <Adafruit_SHT31.h>

// =============================================================================
//  Configuration
// =============================================================================

static const bool DEBUG_NN = false;   // set true to print DSP features

// Intervals
static const uint32_t CAMERA_INTERVAL_MS   = 5000;   // run health classifier every 5 s
static const uint32_t FORECAST_INTERVAL_MS = 3600000UL; // collect one hourly sample

// =============================================================================
//  Global state
// =============================================================================

MangoGuard mg;

// Forecast ring-buffer: stores the last 24 h of (temperature, humidity) pairs.
// Index into this buffer advances each hour.
static float  forecastBuffer[MangoGuard::FORECAST_DSP_INPUT_FRAME_SIZE]; // 48 floats
static uint8_t forecastSampleCount = 0;   // how many valid pairs we have so far
static uint8_t forecastWriteIdx    = 0;   // next write position (0..23)

static uint32_t lastCameraMs   = 0;
static uint32_t lastForecastMs = 0;

// Camera pixel buffer — 9216 RGB pixels packed as floats (0xRRGGBB per float).
static float pixelBuffer[MangoGuard::HEALTH_RAW_SAMPLE_COUNT];

// =============================================================================
//  Platform stubs — replace with your real implementations
// =============================================================================

/**
 * @brief  Capture a 96×96 RGB image and fill pixelBuffer.
 *         Each element is (R<<16 | G<<8 | B) cast to float.
 * @return true on success, false on failure.
 *
 * Replace the body below with your camera driver calls
 * (esp_camera_fb_get, crop_and_interpolate_rgb888, etc.).
 */
bool captureImage(float *buf, size_t numPixels) {
    // ── STUB: fill with a test pattern so the sketch compiles out-of-the-box ──
    for (size_t i = 0; i < numPixels; i++) {
        uint8_t r = (uint8_t)(i * 3);
        uint8_t g = (uint8_t)(i * 5);
        uint8_t b = (uint8_t)(i * 7);
        buf[i] = (float)((r << 16) | (g << 8) | b);
    }
    return true;
    // ── END STUB ──
}

/**
 * @brief  Read current temperature (°C) and relative humidity (%).
 * @return true on success, false on failure.
 *
 * Replace the body below with your sensor driver calls.
 */
bool readEnvironment(float &temperature, float &humidity) {
    // ── STUB: return plausible values ──
    temperature = 22.5f + (float)(millis() % 30) * 0.1f;
    humidity    = 60.0f + (float)(millis() % 20) * 0.1f;
    return true;
    // ── END STUB ──
}

// =============================================================================
//  Setup
// =============================================================================

void setup() {
    Serial.begin(115200);
    while (!Serial) { /* wait for USB on native-USB boards */ }

    Serial.println("==============================");
    Serial.println("  MangoGuard — Unified Demo   ");
    Serial.println("==============================");
    Serial.print  ("  Health model input:   ");
    Serial.print  (MangoGuard::HEALTH_INPUT_WIDTH);
    Serial.print  ("x");
    Serial.print  (MangoGuard::HEALTH_INPUT_HEIGHT);
    Serial.println(" px");
    Serial.print  ("  Forecast model input: ");
    Serial.print  (MangoGuard::FORECAST_RAW_SAMPLE_COUNT);
    Serial.println(" hourly (temp+hum) samples");
    Serial.println();

    // ── Initialise your camera here ──────────────────────────────────────────
    // if (!ei_camera_init()) { Serial.println("Camera init failed!"); }

    // ── Initialise your environmental sensor here ─────────────────────────────
    // dht.begin();

    // Pre-fill forecast buffer with one real reading so we have something
    // to show immediately (optional).
    float t = 0.0f, h = 0.0f;
    if (readEnvironment(t, h)) {
        for (uint8_t i = 0; i < MangoGuard::FORECAST_RAW_SAMPLE_COUNT; i++) {
            forecastBuffer[i * 2]     = t;
            forecastBuffer[i * 2 + 1] = h;
        }
        forecastSampleCount = MangoGuard::FORECAST_RAW_SAMPLE_COUNT;
        Serial.println("Forecast buffer pre-filled with current sensor values.");
    }

    lastCameraMs   = millis();
    lastForecastMs = millis();
}

// =============================================================================
//  Main loop
// =============================================================================

void loop() {
    uint32_t now = millis();

    // ── 1. Health classifier (camera) ─────────────────────────────────────────
    if (now - lastCameraMs >= CAMERA_INTERVAL_MS) {
        lastCameraMs = now;

        Serial.println("\n── Health inference (camera) ──────────────");
        if (captureImage(pixelBuffer, MangoGuard::HEALTH_RAW_SAMPLE_COUNT)) {
            MangoGuard::HealthResult hr =
                mg.runHealthClassifier(pixelBuffer,
                                       MangoGuard::HEALTH_RAW_SAMPLE_COUNT,
                                       DEBUG_NN);
            if (hr.error == 0) {
                Serial.print("  Result : "); Serial.println(hr.label);
                Serial.print("  Confidence: "); Serial.print(hr.confidence * 100.0f, 1);
                Serial.println(" %");
                Serial.println("  All scores:");
                for (uint8_t i = 0; i < MangoGuard::HEALTH_LABEL_COUNT; i++) {
                    Serial.print("    ");
                    Serial.print(MangoGuard::HEALTH_LABELS[i]);
                    Serial.print(": ");
                    Serial.print(hr.scores[i] * 100.0f, 2);
                    Serial.println(" %");
                }
            } else {
                Serial.print("  Health inference error: "); Serial.println(hr.error);
            }
        } else {
            Serial.println("  Camera capture failed.");
        }
    }

    // ── 2. Collect hourly environmental sample ────────────────────────────────
    if (now - lastForecastMs >= FORECAST_INTERVAL_MS) {
        lastForecastMs = now;

        float temperature = 0.0f, humidity = 0.0f;
        if (readEnvironment(temperature, humidity)) {
            // Write into ring-buffer
            forecastBuffer[forecastWriteIdx * 2]     = temperature;
            forecastBuffer[forecastWriteIdx * 2 + 1] = humidity;
            forecastWriteIdx = (forecastWriteIdx + 1) % MangoGuard::FORECAST_RAW_SAMPLE_COUNT;
            if (forecastSampleCount < MangoGuard::FORECAST_RAW_SAMPLE_COUNT) {
                forecastSampleCount++;
            }

            Serial.println("\n── Forecast inference (temp+hum) ──────────");
            Serial.print("  New sample — T: "); Serial.print(temperature, 2);
            Serial.print(" °C  H: "); Serial.print(humidity, 2); Serial.println(" %");

            // Only run once the ring-buffer is full (24 h of data)
            if (forecastSampleCount == MangoGuard::FORECAST_RAW_SAMPLE_COUNT) {
                // Build a contiguous buffer starting from the oldest sample
                float contiguous[MangoGuard::FORECAST_DSP_INPUT_FRAME_SIZE];
                for (uint8_t i = 0; i < MangoGuard::FORECAST_RAW_SAMPLE_COUNT; i++) {
                    uint8_t idx = (forecastWriteIdx + i) % MangoGuard::FORECAST_RAW_SAMPLE_COUNT;
                    contiguous[i * 2]     = forecastBuffer[idx * 2];
                    contiguous[i * 2 + 1] = forecastBuffer[idx * 2 + 1];
                }

                MangoGuard::ForecastResult fr =
                    mg.runForecastClassifier(contiguous,
                                             MangoGuard::FORECAST_DSP_INPUT_FRAME_SIZE,
                                             DEBUG_NN);
                if (fr.error == 0) {
                    Serial.print("  Result : "); Serial.println(fr.label);
                    Serial.print("  Confidence: "); Serial.print(fr.confidence * 100.0f, 1);
                    Serial.println(" %");
                    Serial.println("  All scores:");
                    for (uint8_t i = 0; i < MangoGuard::FORECAST_LABEL_COUNT; i++) {
                        Serial.print("    ");
                        Serial.print(MangoGuard::FORECAST_LABELS[i]);
                        Serial.print(": ");
                        Serial.print(fr.scores[i] * 100.0f, 2);
                        Serial.println(" %");
                    }
                } else {
                    Serial.print("  Forecast inference error: "); Serial.println(fr.error);
                }
            } else {
                Serial.print("  Waiting for full 24 h window (");
                Serial.print(forecastSampleCount);
                Serial.print("/");
                Serial.print(MangoGuard::FORECAST_RAW_SAMPLE_COUNT);
                Serial.println(" samples collected).");
            }
        } else {
            Serial.println("  Environmental sensor read failed.");
        }
    }
}
