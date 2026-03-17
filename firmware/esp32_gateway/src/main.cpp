#include <Arduino.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <NimBLEDevice.h>
#include "Config.h"

// ================= HARDWARE =================
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
DHT dht(DHT_PIN, DHT_TYPE);

// ================= BLE UUIDs (must match Nano) =================
#define NANO_SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CLASSIFICATION_CHAR_UUID "19B10001-E8F2-537E-4F6C-D104768A1214"

// ================= STRUCTS & STATE =================
struct DiseaseProfile {
    const char* name;
    float minTemp;
    float maxTemp;
    float humidityThreshold;
    const char* targetedAction;
    const char* preventiveAction;
};

const DiseaseProfile profiles[] = {
    {"Anthracnose", 24.0, 30.0, 80.0, "በፈንገስ ማጥፊያ (Copper) ይርጩ", "የታመሙ ቅርንጫፎችን ያስወግዱ"},
    {"Powdery Mildew", 10.0, 31.0, 80.0, "ሰልፈር (Sulfur) ያለው መድሃኒት ይርጩ", "አየር እንዲገባ የዛፉን ቅርንጫፎች ይቀንሱ"}
};
const int NUM_PROFILES = sizeof(profiles) / sizeof(profiles[0]);

char currentDisease[32]  = "Unknown";
float currentConfidence  = 0.0;
float currentTemperature = 0.0;
float currentHumidity    = 0.0;
int   currentRainValue   = 4095;  // Analog rain sensor (4095 = dry, 0 = heavy rain)
bool  currentIsRaining   = false; // Digital rain sensor
bool  alertActive        = false;
const char* riskLevel      = "Evaluating...";
const char* recommendation = "Waiting for data...";
const char* farmerAction   = "ክፍት"; // Default/Unknown

// BLE client objects
NimBLEClient* pClient = nullptr;
bool bleConnected     = false;

// ================= FORWARD DECLARATIONS =================
void evaluateRisk();
void updateDisplay();
void sendDataToCloud();
void parseClassification(const std::string& value);

// ================= BLE NOTIFY CALLBACK =================
void notifyCallback(NimBLERemoteCharacteristic* pChar, uint8_t* pData, size_t length, bool isNotify) {
    std::string value((char*)pData, length);
    Serial.print("BLE Notify received: ");
    Serial.println(value.c_str());
    parseClassification(value);
    evaluateRisk();
    updateDisplay();
}

// ================= PARSE "DiseaseName,Confidence" =================
void parseClassification(const std::string& value) {
    size_t commaIdx = value.find(',');
    if (commaIdx != std::string::npos) {
        std::string disease = value.substr(0, commaIdx);
        strncpy(currentDisease, disease.c_str(), sizeof(currentDisease) - 1);
        currentDisease[sizeof(currentDisease) - 1] = '\0';
        currentConfidence = std::stof(value.substr(commaIdx + 1));
    } else {
        strncpy(currentDisease, value.c_str(), sizeof(currentDisease) - 1);
        currentDisease[sizeof(currentDisease) - 1] = '\0';
        currentConfidence = 0.0;
    }
}

// ================= BLE SCAN + CONNECT =================
bool connectToNano() {
    Serial.println("Scanning for MangoHealthMonitor...");
    NimBLEScan* pScan = NimBLEDevice::getScan();
    pScan->setActiveScan(true);
    NimBLEScanResults results = pScan->start(5, false);

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

            NimBLERemoteService* pService = pClient->getService(NANO_SERVICE_UUID);
            if (!pService) {
                Serial.println("Service not found.");
                pClient->disconnect();
                return false;
            }

            NimBLERemoteCharacteristic* pChar = pService->getCharacteristic(CLASSIFICATION_CHAR_UUID);
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
    // Safety check: ensure temperature and humidity are within valid ranges (0-100)
    if (currentTemperature < 0.0 || currentTemperature > 100.0 || 
        currentHumidity < 0.0 || currentHumidity > 100.0) {
        Serial.println("Warning: Invalid sensor readings detected!");
        riskLevel = "INVALID";
        recommendation = "Check sensors";
        farmerAction = "ሴንሰሩን ይፈትሹ"; // Check/Inspect sensors
        alertActive = false;
        return;
    }

    if (strcmp(currentDisease, "Healthy") == 0 || strcmp(currentDisease, "Unknown") == 0) {
        riskLevel = "LOW RISK";
        recommendation = (strcmp(currentDisease, "Unknown") == 0) ? "Wait..." : "Monitor Crop";
        farmerAction = "መደበኛ ክትትልና ጽዳት ያድርጉ"; // General monitoring and sanitation
        alertActive = false;
        return;
    }

    const DiseaseProfile* profile = nullptr;
    for (int i = 0; i < NUM_PROFILES; i++) {
        if (strcmp(currentDisease, profiles[i].name) == 0) {
            profile = &profiles[i];
            break;
        }
    }

    if (!profile) {
        riskLevel = "MEDIUM RISK";
        recommendation = "Preventive Treatment";
        farmerAction = "መከላከያ"; // Preventive
        alertActive = false;
        return;
    }

    bool tempSuitable = (currentTemperature >= profile->minTemp && currentTemperature <= profile->maxTemp);
    bool moistureSuitable = (currentHumidity > profile->humidityThreshold);
    bool isRaining = currentIsRaining || (currentRainValue < RAIN_INTENSITY_THRESHOLD);
    
    // High Risk: Both temp AND humidity match disease conditions, or rain boosts risk
    if (tempSuitable && moistureSuitable) {
        riskLevel = "HIGH RISK";
        recommendation = "Targeted Control Action & Alert";
        farmerAction = profile->targetedAction;
        alertActive = true;
    }
    // Rain + one other factor = elevated risk
    else if (isRaining && (tempSuitable || moistureSuitable)) {
        riskLevel = "HIGH RISK";
        recommendation = "Rain + conditions favor disease";
        farmerAction = profile->targetedAction;
        alertActive = true;
    }
    // Medium Risk: Only temp OR humidity matches
    else if (tempSuitable || moistureSuitable) {
        riskLevel = "MEDIUM RISK";
        recommendation = "Preventive Treatment";
        farmerAction = profile->preventiveAction;
        alertActive = false;
    }
    // Rain alone with disease detected = medium risk
    else if (isRaining) {
        riskLevel = "MEDIUM RISK";
        recommendation = "Rain detected - monitor closely";
        farmerAction = profile->preventiveAction;
        alertActive = false;
    }
    // Low Risk: Neither condition matches
    else {
        riskLevel = "LOW RISK";
        recommendation = "Monitoring & Cultural Practices";
        farmerAction = "መደበኛ ክትትል ያድርጉ";
        alertActive = false;
    }
}

// ================= OLED DISPLAY =================
void updateDisplay() {
    u8g2.clearBuffer();
    
    // Header
    u8g2.setFont(u8g2_font_ncenB08_tr); 
    u8g2.drawStr(0, 10, WiFi.status() == WL_CONNECTED ? "WiFi:OK" : "WiFi:--");
    u8g2.drawStr(60, 10, bleConnected ? "BLE:OK" : "BLE:--");

    // Environment
    char envBuf[32];
    snprintf(envBuf, sizeof(envBuf), "T:%.1fC H:%.0f%% %s", currentTemperature, currentHumidity,
             currentIsRaining ? "Rain" : "Dry");
    u8g2.drawStr(0, 22, envBuf);

    // AI result & Risk
    char aiBuf[32];
    snprintf(aiBuf, sizeof(aiBuf), "AI: %s", currentDisease);
    u8g2.drawStr(0, 34, aiBuf);
    
    u8g2.drawStr(0, 46, riskLevel);

    // Bottom Amharic UI Action
    u8g2.setFont(u8g2_font_unifont_tr);
    u8g2.enableUTF8Print();
    
    // Draw the Label
    u8g2.setCursor(0, 52);
    u8g2.print("ርምጃ፦"); 

    // Draw the Instruction (Moved down slightly to give it its own line if needed)
    u8g2.setCursor(0, 64); 
    u8g2.print(farmerAction);
    
    u8g2.disableUTF8Print();

    u8g2.sendBuffer();
}

// ================= CLOUD UPLOAD =================
void sendDataToCloud() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    json += "\"disease_type\":\"" + String(currentDisease) + "\",";
    json += "\"confidence_score\":" + String(currentConfidence, 2) + ",";
    json += "\"temperature\":" + String(currentTemperature, 1) + ",";
    json += "\"humidity\":" + String(currentHumidity, 1) + ",";
    json += "\"rainfall\":" + String(currentRainValue) + ",";
    json += "\"is_raining\":" + String(currentIsRaining ? "true" : "false");
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

    // Rain sensor
    pinMode(RAIN_SENSOR_DIGITAL_PIN, INPUT);
    // RAIN_SENSOR_ANALOG_PIN (GPIO 34) is input-only, no pinMode needed

    // DHT sensor
    dht.begin();

    // U8G2 OLED
    u8g2.begin();
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_ncenB08_tr);
    u8g2.drawStr(0, 20, "Mango Monitor");
    u8g2.drawStr(0, 35, "Starting...");
    u8g2.sendBuffer();

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
    // 1. Read DHT22
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t) || isnan(h)) {
        Serial.println("DHT Read Failed");
    } else {
        currentTemperature = t;
        currentHumidity    = h;
    }

    // 1b. Read rain sensor
    currentRainValue = analogRead(RAIN_SENSOR_ANALOG_PIN);
    currentIsRaining = (digitalRead(RAIN_SENSOR_DIGITAL_PIN) == LOW); // LOW = rain detected
    Serial.print("Rain: ");
    Serial.print(currentRainValue);
    Serial.println(currentIsRaining ? " (Raining)" : " (Dry)");

    // 2. Maintain BLE connection
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

    // 4. Update display
    updateDisplay();

    // 5. Cloud sync
    static unsigned long lastSync = 0;
    if (millis() - lastSync > 10000) {
        sendDataToCloud();
        lastSync = millis();
    }

    delay(200);
}