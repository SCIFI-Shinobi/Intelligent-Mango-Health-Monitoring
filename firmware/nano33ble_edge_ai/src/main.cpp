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

// Bluetooth Low Energy includes
#include <ArduinoBLE.h>

// DHT Sensor includes
#include <DHT.h>

// DHT Sensor Configuration
#define DHT_PIN 2
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);


// ================= GLOBAL STATE =================
unsigned long lastScanTime = 0;

// Hardware Objects
static OV7675 Cam;


// Image buffers
static uint8_t rgb888_buffer[EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 3];

// BLE Service and Characteristics
BLEService mangoHealthService("19B10000-E8F2-537E-4F6C-D104768A1214");
BLEStringCharacteristic classificationCharacteristic("19B10001-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWrite | BLENotify, 32);
BLEFloatCharacteristic temperatureCharacteristic("19B10002-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWrite | BLENotify);
BLEFloatCharacteristic humidityCharacteristic("19B10003-E8F2-537E-4F6C-D104768A1214", BLERead | BLEWrite | BLENotify);

// ================= IMAGE CONVERSION =================
// Convert RGB565 (16-bit) to RGB888 (24-bit)
void convertRGB565toRGB888(const uint8_t* rgb565, uint8_t* rgb888, size_t pixelCount) {
    for (size_t i = 0; i < pixelCount; i++) {
        uint16_t pixel = (rgb565[i * 2] << 8) | rgb565[i * 2 + 1];
        
        // Extract RGB565 components
        uint8_t r5 = (pixel >> 11) & 0x1F;
        uint8_t g6 = (pixel >> 5) & 0x3F;
        uint8_t b5 = pixel & 0x1F;
        
        // Convert to 8-bit (scale 5/6-bit to 8-bit)
        rgb888[i * 3 + 0] = (r5 * 527 + 23) >> 6;  // Red
        rgb888[i * 3 + 1] = (g6 * 259 + 33) >> 6;  // Green
        rgb888[i * 3 + 2] = (b5 * 527 + 23) >> 6;  // Blue
    }
}

// ================= CLASSIFIER CALLBACK =================
int get_image_data(size_t offset, size_t length, float *out_ptr) {
    // Calculate how many pixels we need
    size_t numPixels = length / 3;  
    
    // Ensure we don't go out of bounds
    if (offset + numPixels > EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS) {
        numPixels = EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS - offset;
    }
    
    // Copy image data and normalize to 0-1 range
    for (size_t i = 0; i < numPixels * 3; i++) {
        out_ptr[i] = (float)rgb888_buffer[(offset * 3) + i] / 255.0f;
    }
    
    return EI_IMPULSE_OK;
}

// ================= SETUP =================
void setup()
{
    Serial.begin(115200);

#if DEMO_MODE
    while (!Serial)
    {
    } // Wait for USB
    Serial.println("Mango Health Monitoring (DEMO)");
#else
    delay(2000); // 2s stabilization
    Serial.println("Mango Health Monitoring (DEPLOYED)");
#endif


    // Initialize BLE
    if (!BLE.begin()) {
        Serial.println("BLE initialization failed");
        while (1);
    }

    BLE.setLocalName("MangoHealthMonitor");
    BLE.setAdvertisedService(mangoHealthService);
    mangoHealthService.addCharacteristic(classificationCharacteristic);
    mangoHealthService.addCharacteristic(temperatureCharacteristic);
    mangoHealthService.addCharacteristic(humidityCharacteristic);
    BLE.addService(mangoHealthService);

    classificationCharacteristic.writeValue("Unknown");
    temperatureCharacteristic.writeValue(0.0);
    humidityCharacteristic.writeValue(0.0);

    BLE.advertise();
    Serial.println("BLE initialized and advertising");

    if (Cam.begin(QQVGA, RGB565, 1))
    {
        Serial.println("Camera initialized successfully");
    }
    else
    {
        Serial.println("Camera Config Failed");
    }
    
    // Initialize DHT sensor
    dht.begin();
    Serial.println("DHT sensor initialized");

    // Initialize classifier
    run_classifier_init();
    Serial.println("Edge Impulse classifier initialized");
}

void loop()
{
    unsigned long now = millis();

    // Read DHT sensor data
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (isnan(temperature) || isnan(humidity)) {
        Serial.println("Failed to read DHT sensor data");
    } else {
        Serial.print("Temperature: ");
        Serial.print(temperature);
        Serial.println(" °C");
        Serial.print("Humidity: ");
        Serial.print(humidity);
        Serial.println(" %");
    }

#if DEMO_MODE
    static unsigned long lastDemoTime = 0;
    if (now - lastDemoTime >= DEMO_INTERVAL_MS)
    {
        lastDemoTime = now;
        
        Serial.println("Taking photo...");
        
        // Capture image (RGB565 format)
        uint8_t image_buffer[EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 2];
        
        Cam.readFrame(image_buffer);
        
        Serial.println("Photo captured!");
        Serial.print("Image size: ");
        Serial.print(sizeof(image_buffer));
        Serial.println(" bytes");
        
        // Convert RGB565 to RGB888
        convertRGB565toRGB888(image_buffer, rgb888_buffer, EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS);
        
        // Run classifier
        Serial.println("Running classifier...");
        
        signal_t signal;
        signal.get_data = &get_image_data;
        signal.total_length = EI_CLASSIFIER_NN_INPUT_FRAME_SIZE;
        
        ei_impulse_result_t result;
        EI_IMPULSE_ERROR ei_error = run_classifier(&signal, &result, false);
        
        if (ei_error != EI_IMPULSE_OK) {
            Serial.print("Classifier error: ");
            Serial.println(ei_error);
        }
        else {
            // Print classification results
            Serial.println("Classification results:");
            Serial.println("======================");
            
            for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
                Serial.print(result.classification[i].label);
                Serial.print(": ");
                Serial.print(result.classification[i].value * 100);
                Serial.println("%");
            }
            
            // Find the dominant classification
            float maxConfidence = 0;
            int maxIndex = -1;
            for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
                if (result.classification[i].value > maxConfidence) {
                    maxConfidence = result.classification[i].value;
                    maxIndex = i;
                }
            }
            
            if (maxIndex >= 0 && maxConfidence >= DISEASE_CONFIDENCE_THRESHOLD) {
                Serial.print("Detected: ");
                Serial.println(result.classification[maxIndex].label);
                
                // Send data via BLE if connected
                BLEDevice central = BLE.central();
                if (central) {
                    classificationCharacteristic.writeValue(result.classification[maxIndex].label);
                    temperatureCharacteristic.writeValue(temperature);
                    humidityCharacteristic.writeValue(humidity);
                    Serial.println("Data sent via BLE");
                }
            }
            
            Serial.print("DSP processing time: ");
            Serial.print(result.timing.dsp_us / 1000.0);
            Serial.println(" ms");
            
            Serial.print("Classification time: ");
            Serial.print(result.timing.classification_us / 1000.0);
            Serial.println(" ms");
        }
        
    }
#else
    if (now - lastScanTime < SCAN_INTERVAL_MS)
    {
        delay(10);
        return;
    }
    lastScanTime = now;
    
    Serial.println("Taking photo...");
    
    // Capture image (RGB565 format)
    uint8_t image_buffer[EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS * 2];
    
    Cam.readFrame(image_buffer);
    
    Serial.println("Photo captured!");
    
    // Convert RGB565 to RGB888
    convertRGB565toRGB888(image_buffer, rgb888_buffer, EI_CAMERA_RAW_FRAME_BUFFER_COLS * EI_CAMERA_RAW_FRAME_BUFFER_ROWS);
    
    // Run classifier
    Serial.println("Running classifier...");
    
    signal_t signal;
    signal.get_data = &get_image_data;
    signal.total_length = EI_CLASSIFIER_NN_INPUT_FRAME_SIZE;
    
    ei_impulse_result_t result;
    EI_IMPULSE_ERROR ei_error = run_classifier(&signal, &result, false);
    
    if (ei_error != EI_IMPULSE_OK) {
        Serial.print("Classifier error: ");
        Serial.println(ei_error);
    }
    else {
        // Print classification results
        Serial.println("Classification results:");
        Serial.println("======================");
        
        for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
            Serial.print(result.classification[i].label);
            Serial.print(": ");
            Serial.print(result.classification[i].value * 100);
            Serial.println("%");
        }
        
        // Find the dominant classification
        float maxConfidence = 0;
        int maxIndex = -1;
        for (size_t i = 0; i < EI_CLASSIFIER_LABEL_COUNT; i++) {
            if (result.classification[i].value > maxConfidence) {
                maxConfidence = result.classification[i].value;
                maxIndex = i;
            }
        }
        
        if (maxIndex >= 0 && maxConfidence >= DISEASE_CONFIDENCE_THRESHOLD) {
            Serial.print("Detected: ");
            Serial.println(result.classification[maxIndex].label);
            
            // Send data via BLE if connected
            BLEDevice central = BLE.central();
            if (central) {
                classificationCharacteristic.writeValue(result.classification[maxIndex].label);
                temperatureCharacteristic.writeValue(temperature);
                humidityCharacteristic.writeValue(humidity);
                Serial.println("Data sent via BLE");
            }
        }
    }
#endif
}

