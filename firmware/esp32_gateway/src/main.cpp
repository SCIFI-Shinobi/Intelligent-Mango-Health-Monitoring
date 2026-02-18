#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <NimBLEDevice.h>
#include "Config.h"

// ================= HARDWARE =================
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
DHT dht(DHT_PIN, DHT_TYPE);

// ================= BLE UUIDs (must match Nano) =================
#define NANO_SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CLASSIFICATION_CHAR_UUID "19B10001-E8F2-537E-4F6C-D104768A1214"

// ================= STATE =================
String currentDisease    = "Unknown";
float  currentConfidence = 0.0;
float  currentTemperature = 0.0;
float  currentHumidity    = 0.0;
bool   alertActive        = false;
String riskLevel          = "Evaluating...";
String recommendation     = "Waiting for data...";

// BLE client objects
NimBLEClient* pClient = nullptr;
bool bleConnected     = false;

// ================= FORWARD DECLARATIONS =================
void evaluateRisk();
void updateDisplay();
void sendDataToCloud();
void parseClassification(const std::string& value);

// ================= BLE NOTIFY CALLBACK =================
// Called whenever the Nano sends a new classification value
void notifyCallback(NimBLERemoteCharacteristic* pChar,
                    uint8_t* pData, size_t length, bool isNotify) {
    std::string value((char*)pData, length);
    Serial.print("BLE Notify received: ");
    Serial.println(value.c_str());
    parseClassification(value);
    evaluateRisk();
    updateDisplay();
}

// ================= PARSE "DiseaseName,Confidence" =================
void parseClassification(const std::string& value) {
    String s = String(value.c_str());
    int commaIdx = s.indexOf(',');
    if (commaIdx > 0) {
        currentDisease    = s.substring(0, commaIdx);
        currentConfidence = s.substring(commaIdx + 1).toFloat();
    } else {
        currentDisease    = s;
        currentConfidence = 0.0;
    }
}

// ================= BLE SCAN + CONNECT =================
bool connectToNano() {
    Serial.println("Scanning for MangoHealthMonitor...");
    NimBLEScan* pScan = NimBLEDevice::getScan();
    pScan->setActiveScan(true);
    NimBLEScanResults results = pScan->start(5, false); // 5-second scan

    for (int i = 0; i < results.getCount(); i++) {
        NimBLEAdvertisedDevice device = results.getDevice(i);
        if (device.getName() == "MangoHealthMonitor") {
            Serial.println("Found Nano! Connecting...");
            pScan->stop();

            pClient = NimBLEDevice::createClient();
            if (!pClient->connect(&device)) {
                Serial.println("Connection failed.");
                return false;
            }
            Serial.println("Connected to Nano.");

            NimBLERemoteService* pService =
                pClient->getService(NANO_SERVICE_UUID);
            if (!pService) {
                Serial.println("Service not found.");
                pClient->disconnect();
                return false;
            }

            NimBLERemoteCharacteristic* pChar =
                pService->getCharacteristic(CLASSIFICATION_CHAR_UUID);
            if (!pChar) {
                Serial.println("Characteristic not found.");
                pClient->disconnect();
                return false;
            }

            if (pChar->canNotify()) {
                pChar->subscribe(true, notifyCallback);
                Serial.println("Subscribed to classification notifications.");
            }

            return true;
        }
    }
    Serial.println("Nano not found in scan.");
    return false;
}

// ================= RISK EVALUATION =================
void evaluateRisk() {
    riskLevel      = "LOW RISK";
    recommendation = "Monitor & maintain sanitation.";
    alertActive    = false;

    if (currentDisease == "Healthy" || currentDisease == "Unknown") {
        if (currentDisease == "Unknown")
            recommendation = "Waiting for classification...";
        return;
    }

    bool envFavorable = false;

    if (currentDisease == "Anthracnose") {
        // High risk: 24°C–30°C AND Humidity > 80%
        if (currentTemperature >= 24 && currentTemperature <= 30 && currentHumidity > 80)
            envFavorable = true;
    } else if (currentDisease == "Powdery Mildew") {
        // High risk: 10°C–31°C AND Humidity > 80%
        if (currentTemperature >= 10 && currentTemperature <= 31 && currentHumidity > 80)
            envFavorable = true;
    }

    if (envFavorable) {
        riskLevel      = "HIGH RISK";
        recommendation = "DANGER: Apply fungicides now!";
        alertActive    = true;
    } else {
        riskLevel      = "MEDIUM RISK";
        recommendation = "Prune branches & improve airflow.";
        alertActive    = false;
    }
}

// ================= OLED DISPLAY =================
void updateDisplay() {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    // Row 0: Wi-Fi status
    display.setCursor(0, 0);
    display.print(WiFi.status() == WL_CONNECTED ? "WiFi:OK" : "WiFi:--");
    display.print("  BLE:");
    display.println(bleConnected ? "OK" : "--");

    // Row 1: Environment
    display.setCursor(0, 10);
    display.print("T:");
    display.print(currentTemperature, 1);
    display.print("C  H:");
    display.print(currentHumidity, 0);
    display.println("%");

    // Row 2: AI result
    display.setCursor(0, 20);
    display.print("AI: ");
    display.println(currentDisease);

    // Row 3: Risk level (inverted if HIGH)
    display.setCursor(0, 32);
    if (riskLevel == "HIGH RISK") {
        display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
    }
    display.println(riskLevel);
    display.setTextColor(SSD1306_WHITE);

    // Row 4: Recommendation
    display.setCursor(0, 45);
    display.println(recommendation);

    display.display();
}

// ================= CLOUD UPLOAD =================
void sendDataToCloud() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    json += "\"disease_type\":\"" + currentDisease + "\",";
    json += "\"confidence_score\":" + String(currentConfidence, 2) + ",";
    json += "\"temperature\":" + String(currentTemperature, 1) + ",";
    json += "\"humidity\":" + String(currentHumidity, 1);
    json += "}";

    int code = http.POST(json);
    Serial.print("Cloud sync HTTP: ");
    Serial.println(code);
    http.end();
}

// ================= SETUP =================
void setup() {
    Serial.begin(115200);

    // Buzzer
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);

    // DHT sensor
    dht.begin();

    // OLED
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
        Serial.println("OLED init failed!");
        while (1);
    }
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Mango Monitor");
    display.println("Starting...");
    display.display();

    // Wi-Fi
    Serial.print("Connecting to Wi-Fi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int timeout = 0;
    while (WiFi.status() != WL_CONNECTED && timeout < 20) {
        delay(500);
        Serial.print(".");
        timeout++;
    }
    Serial.println(WiFi.status() == WL_CONNECTED ? "\nWi-Fi OK" : "\nWi-Fi Failed");

    // BLE Central
    NimBLEDevice::init("ESP32-Gateway");
    Serial.println("BLE Central initialized.");
}

// ================= LOOP =================
void loop() {
    // 1. Read DHT22 (local sensor on ESP32)
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
        currentTemperature = t;
        currentHumidity    = h;
    }

    // 2. Maintain BLE connection to Nano
    if (!bleConnected || (pClient && !pClient->isConnected())) {
        bleConnected = false;
        if (pClient) {
            NimBLEDevice::deleteClient(pClient);
            pClient = nullptr;
        }
        bleConnected = connectToNano();
    }

    // 3. Buzzer logic
    if (alertActive) {
        digitalWrite(BUZZER_PIN, (millis() / 500) % 2 == 0 ? HIGH : LOW);
    } else {
        digitalWrite(BUZZER_PIN, LOW);
    }

    // 4. Refresh display every loop
    updateDisplay();

    // 5. Cloud sync every 10 seconds
    static unsigned long lastSync = 0;
    if (millis() - lastSync > 10000) {
        sendDataToCloud();
        lastSync = millis();
    }

    delay(200);
}
