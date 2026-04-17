#include <Arduino.h>
#include <cstring>
#include <cstddef>
#include "Config.h"
#include "Camera_OV7675.h"
#include "Image_Utils.h"

// Edge Impulse includes
#include "edge-impulse-sdk/classifier/ei_run_classifier.h"
#include "edge-impulse-sdk/classifier/ei_classifier_types.h"
#include "edge-impulse-sdk/dsp/numpy_types.h"
#include "model-parameters/model_metadata.h"

// Bluetooth Low Energy
#include <ArduinoBLE.h>

// ================= GLOBAL STATE =================
unsigned long lastScanTime = 0;
static OV7675 Cam;
// RGB565 buffer - kept during inference for on-the-fly conversion
static uint8_t* image_buffer = nullptr;
static const size_t IMG_BUF_SIZE = EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 2;
static bool cameraReady = false;

// BLE Service — only one characteristic: the classification result
// Format sent: "DiseaseName,Confidence"  e.g. "Anthracnose,0.92"
BLEService mangoHealthService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic classificationCharacteristic(
    "19B10001-E8F2-537E-4F6C-D104768A1214",
    BLERead | BLENotify,
    32
);

// ================= IMAGE CONVERSION =================
// Removed: convertRGB565toRGB888 - we now convert directly in the callback

// ================= CLASSIFIER CALLBACK =================
// Convert RGB565 directly to float on-the-fly (saves 76KB RAM!)
int get_image_data(size_t offset, size_t length, float *out_ptr) {
    if (!image_buffer) return EI_IMPULSE_DSP_ERROR;

    size_t pixel_count = length / 3;
    size_t total_pixels = EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS;

    for (size_t i = 0; i < pixel_count && (offset + i) < total_pixels; i++) {
        size_t px = offset + i;
        // Read RGB565 pixel (big-endian in buffer)
        uint16_t pixel = (image_buffer[px * 2] << 8) | image_buffer[px * 2 + 1];

        // Extract and convert to 0.0-1.0 float
        uint8_t r5 = (pixel >> 11) & 0x1F;
        uint8_t g6 = (pixel >> 5) & 0x3F;
        uint8_t b5 = pixel & 0x1F;

        out_ptr[i * 3 + 0] = (float)((r5 * 527 + 23) >> 6) / 255.0f;
        out_ptr[i * 3 + 1] = (float)((g6 * 259 + 33) >> 6) / 255.0f;
        out_ptr[i * 3 + 2] = (float)((b5 * 527 + 23) >> 6) / 255.0f;
    }
    return EI_IMPULSE_OK;
}

// ================= INFERENCE + BLE PUBLISH =================
void runInferenceAndPublish() {
    if (!cameraReady) {
        return;
    }



    // Allocate capture buffer if not already
    if (!image_buffer) {
        image_buffer = (uint8_t*)malloc(IMG_BUF_SIZE);
        if (!image_buffer) {
            Serial.println("!M");  // Malloc failed
            return;
        }
    }

    if (!Cam.readFrame(image_buffer)) {
        Serial.println("X");  // Capture failed
        return;
    }
    Serial.println("OK ");  // Capture succeeded

    // No conversion needed - get_image_data converts RGB565→float on-the-fly

    signal_t signal;
    signal.get_data = &get_image_data;
    signal.total_length = EI_CLASSIFIER_NN_INPUT_FRAME_SIZE;


    ei_impulse_result_t result;
    EI_IMPULSE_ERROR ei_error = run_classifier(&signal, &result, false);

    if (ei_error != EI_IMPULSE_OK) {
        Serial.print("Classifier error: ");
        Serial.println(ei_error);
        return;
    }

    // Find top classification
    float maxConfidence = 0;
    int maxIndex = -1;
    for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
        Serial.print(result.classification[i].label);
        Serial.print(": ");
        Serial.print(result.classification[i].value * 100, 1);
        Serial.println("%");
        if (result.classification[i].value > maxConfidence) {
            maxConfidence = result.classification[i].value;
            maxIndex = i;
        }
    }

    String payload;
    if (maxIndex >= 0 && maxConfidence >= DISEASE_CONFIDENCE_THRESHOLD) {
        payload = String(result.classification[maxIndex].label) + "," + String(maxConfidence, 2);
    } else {
        payload = "Unknown,0.00";
    }

    Serial.print("BLE: ");
    Serial.println(payload);
    classificationCharacteristic.writeValue(payload);
}

// ================= SETUP =================
void setup() {
    Serial.begin(115200); // For USB debug (optional)

#if DEMO_MODE
    while (!Serial) {}
    Serial.println("Mango Monitor (DEMO) — Nano 33 BLE");
#else
    delay(2000);
    Serial.println("Mango Monitor (DEPLOYED) — Nano 33 BLE");
#endif

    // Initialize BLE
    if (!BLE.begin()) {
        Serial.println("BLE init failed!");
        while (1);
    }
    BLE.setLocalName("MangoHealthMonitor");
    BLE.setAdvertisedService(mangoHealthService);
    mangoHealthService.addCharacteristic(classificationCharacteristic);
    BLE.addService(mangoHealthService);
    classificationCharacteristic.writeValue("Unknown,0.00");
    BLE.advertise();
    Serial.println("BLE advertising as 'MangoHealthMonitor'");

    // Initialize Camera (VGA 640x480, resizes cleanly to 160x160 for model)
    if (Cam.begin(VGA, RGB565, 1)) {
        Serial.println("Camera OK");
        cameraReady = true;
    } else {
        Serial.println("Camera FAILED");
        cameraReady = false;
    }

    run_classifier_init();
    Serial.println("System ready.");
}

// ================= LOOP =================
void loop() {
    // Keep BLE alive
    BLE.poll();

    unsigned long now = millis();

#if DEMO_MODE
    static unsigned long lastDemoTime = 0;
    if (now - lastDemoTime >= DEMO_INTERVAL_MS) {
        lastDemoTime = now;
        runInferenceAndPublish();
    }
#else
    if (now - lastScanTime < SCAN_INTERVAL_MS) {
        delay(10);
        return;
    }
    lastScanTime = now;
    runInferenceAndPublish();
#endif
}
