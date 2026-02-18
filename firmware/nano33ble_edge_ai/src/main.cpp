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
static uint8_t rgb888_buffer[EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 3];

// BLE Service — only one characteristic: the classification result
// Format sent: "DiseaseName,Confidence"  e.g. "Anthracnose,0.92"
BLEService mangoHealthService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic classificationCharacteristic(
    "19B10001-E8F2-537E-4F6C-D104768A1214",
    BLERead | BLENotify,
    32
);

// ================= IMAGE CONVERSION =================
void convertRGB565toRGB888(const uint8_t* rgb565, uint8_t* rgb888, size_t pixelCount) {
    for (size_t i = 0; i < pixelCount; i++) {
        uint16_t pixel = (rgb565[i * 2] << 8) | rgb565[i * 2 + 1];
        uint8_t r5 = (pixel >> 11) & 0x1F;
        uint8_t g6 = (pixel >> 5)  & 0x3F;
        uint8_t b5 = pixel          & 0x1F;
        rgb888[i * 3 + 0] = (r5 * 527 + 23) >> 6;
        rgb888[i * 3 + 1] = (g6 * 259 + 33) >> 6;
        rgb888[i * 3 + 2] = (b5 * 527 + 23) >> 6;
    }
}

// ================= CLASSIFIER CALLBACK =================
int get_image_data(size_t offset, size_t length, float *out_ptr) {
    size_t numPixels = length / 3;
    if (offset + numPixels > EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS) {
        numPixels = EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS - offset;
    }
    for (size_t i = 0; i < numPixels * 3; i++) {
        out_ptr[i] = (float)rgb888_buffer[(offset * 3) + i] / 255.0f;
    }
    return EI_IMPULSE_OK;
}

// ================= INFERENCE + BLE PUBLISH =================
void runInferenceAndPublish() {
    Serial.println("Capturing image...");
    uint8_t image_buffer[EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 2];
    Cam.readFrame(image_buffer);
    convertRGB565toRGB888(image_buffer, rgb888_buffer,
                          EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS);

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
        // Format: "DiseaseName,Confidence"
        payload = String(result.classification[maxIndex].label) + "," + String(maxConfidence, 2);
    } else {
        payload = "Unknown,0.00";
    }

    Serial.print("Publishing via BLE: ");
    Serial.println(payload);

    // Update BLE characteristic — ESP32 will be notified automatically
    classificationCharacteristic.writeValue(payload);
}

// ================= SETUP =================
void setup() {
    Serial.begin(115200);

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

    // Initialize Camera
    if (Cam.begin(QQVGA, RGB565, 1)) {
        Serial.println("Camera initialized");
    } else {
        Serial.println("Camera init failed!");
    }

    run_classifier_init();
    Serial.println("Edge Impulse classifier ready.");
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
