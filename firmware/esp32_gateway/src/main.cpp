#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <NimBLEDevice.h>
#include <time.h>
#include "Config.h"

// ================= HARDWARE =================
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);
DHT dht(DHT_PIN, DHT_TYPE);

// ================= BLE UUIDs (must match Nano) =================
#define NANO_SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
#define CLASSIFICATION_CHAR_UUID "19B10001-E8F2-537E-4F6C-D104768A1214"

// ================= CONFIDENCE THRESHOLD =================
// Only generate recommendations if AI confidence exceeds this threshold
#define CONFIDENCE_THRESHOLD 0.70

// ================= STRUCTS & STATE =================
struct DiseaseProfile {
    const char* name;
    float minTemp;
    float maxTemp;
    float humidityThreshold;
    // English recommendations
    const char* targetedActionEn;
    const char* preventiveActionEn;
    // Amharic recommendations
    const char* targetedActionAm;
    const char* preventiveActionAm;
    // Titles
    const char* titleEn;
    const char* titleAm;
};

const DiseaseProfile profiles[] = {
    {
        "Anthracnose", 24.0, 30.0, 80.0,
        "Spray with copper-based fungicide (Copper oxychloride). High risk conditions detected.",
        "Remove diseased branches and improve air circulation.",
        "በፈንገስ ማጥፊያ (Copper) ይርጩ",
        "የታመሙ ቅርንጫፎችን ያስወግዱ",
        "Anthracnose Detected",
        "አንትራክኖዝ ተገኝቷል"
    },
    {
        "Powdery Mildew", 10.0, 31.0, 80.0,
        "Spray with sulfur-based medicine (Sulfur fungicide). High risk conditions detected.",
        "Prune tree branches to allow air circulation.",
        "ሰልፈር (Sulfur) ያለው መድሃኒት ይርጩ",
        "አየር እንዲገባ የዛፉን ቅርንጫፎች ይቀንሱ",
        "Powdery Mildew Detected",
        "የዱቄት ሻጋታ ተገኝቷል"
    }
};
const int NUM_PROFILES = sizeof(profiles) / sizeof(profiles[0]);

// Healthy profile for when plant is healthy
const DiseaseProfile healthyProfile = {
    "Healthy", 0.0, 100.0, 100.0,
    "Continue regular monitoring and maintenance.",
    "Maintain field sanitation and monitor regularly.",
    "መደበኛ ክትትልና ጽዳት ያድርጉ",
    "መደበኛ ክትትል ያድርጉ",
    "Plant Healthy",
    "ተክሉ ጤናማ ነው"
};

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

// Current recommendation details (for sending to backend)
const DiseaseProfile* currentProfile = nullptr;
bool isHighRisk = false;

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

// Convert analog rain sensor value to approximate precipitation in mm
// Rain sensor: 4095 = completely dry, 0 = heavy rain
float estimatePrecipitation() {
    if (!currentIsRaining && currentRainValue > RAIN_INTENSITY_THRESHOLD) {
        return 0.0;  // No rain
    }
    // Map 0-RAIN_INTENSITY_THRESHOLD to 0-50mm (rough estimation)
    float intensity = (float)(RAIN_INTENSITY_THRESHOLD - currentRainValue) / RAIN_INTENSITY_THRESHOLD;
    return intensity * 50.0;  // Max ~50mm for heavy rain reading
}

// ================= RISK EVALUATION =================
void evaluateRisk() {
    // Reset state
    currentProfile = nullptr;
    isHighRisk = false;

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

    // Check for healthy or unknown state
    if (strcmp(currentDisease, "Healthy") == 0 || strcmp(currentDisease, "Unknown") == 0) {
        riskLevel = "LOW RISK";
        recommendation = (strcmp(currentDisease, "Unknown") == 0) ? "Wait..." : "Monitor Crop";
        farmerAction = "መደበኛ ክትትልና ጽዳት ያድርጉ"; // General monitoring and sanitation
        currentProfile = &healthyProfile;
        alertActive = false;
        return;
    }

    // CONFIDENCE CHECK: Only proceed with disease recommendations if confidence is high enough
    if (currentConfidence < CONFIDENCE_THRESHOLD) {
        riskLevel = "LOW RISK";
        recommendation = "Low confidence - continue monitoring";
        farmerAction = "እርግጠኛ አይደለም - ክትትል ያድርጉ";
        Serial.printf("Confidence %.1f%% below threshold %.1f%%, skipping recommendation\n",
                      currentConfidence * 100, CONFIDENCE_THRESHOLD * 100);
        alertActive = false;
        return;
    }

    // Find matching disease profile
    const DiseaseProfile* profile = nullptr;
    for (int i = 0; i < NUM_PROFILES; i++) {
        if (strcmp(currentDisease, profiles[i].name) == 0) {
            profile = &profiles[i];
            currentProfile = profile;
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
        recommendation = profile->targetedActionEn;
        farmerAction = profile->targetedActionAm;
        isHighRisk = true;
        alertActive = true;
    }
    // Rain + one other factor = elevated risk
    else if (isRaining && (tempSuitable || moistureSuitable)) {
        riskLevel = "HIGH RISK";
        recommendation = profile->targetedActionEn;
        farmerAction = profile->targetedActionAm;
        isHighRisk = true;
        alertActive = true;
    }
    // Medium Risk: Only temp OR humidity matches
    else if (tempSuitable || moistureSuitable) {
        riskLevel = "MEDIUM RISK";
        recommendation = profile->preventiveActionEn;
        farmerAction = profile->preventiveActionAm;
        alertActive = false;
    }
    // Rain alone with disease detected = medium risk
    else if (isRaining) {
        riskLevel = "MEDIUM RISK";
        recommendation = profile->preventiveActionEn;
        farmerAction = profile->preventiveActionAm;
        alertActive = false;
    }
    // Low Risk: Neither condition matches
    else {
        riskLevel = "LOW RISK";
        recommendation = "Monitoring & Cultural Practices";
        farmerAction = "መደበኛ ክትትል ያድርጉ";
        alertActive = false;
    }

    Serial.printf("Risk Evaluation: %s (Conf: %.1f%%, Temp: %.1f°C, Hum: %.1f%%, Rain: %s)\n",
                  riskLevel, currentConfidence * 100, currentTemperature, currentHumidity,
                  isRaining ? "Yes" : "No");
}

// ================= LCD DISPLAY =================
void updateDisplay() {
    String line1 = String(WiFi.status() == WL_CONNECTED ? "W:OK " : "W:-- ") +
                   String(bleConnected ? "B:OK" : "B:--");

    char envBuf[17];
    snprintf(envBuf, sizeof(envBuf), "T:%2.0f H:%2.0f %s", currentTemperature, currentHumidity,
             currentIsRaining ? "R" : "D");
    String line2 = String(envBuf);

    if (alertActive) {
        line1 = "ALERT " + String(currentDisease);
        line2 = String(riskLevel);
    }

    if (line1.length() > LCD_COLUMNS) {
        line1 = line1.substring(0, LCD_COLUMNS);
    }
    if (line2.length() > LCD_COLUMNS) {
        line2 = line2.substring(0, LCD_COLUMNS);
    }

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);
}

// ================= CLOUD UPLOAD =================
void sendDataToCloud() {
    if (WiFi.status() != WL_CONNECTED) return;
    if (String(DEVICE_API_KEY) == "mg_your_api_key_here") {
        Serial.println("Cloud sync skipped: set DEVICE_API_KEY in Config.h");
        return;
    }

    HTTPClient http;
    String url = String(API_BASE_URL) + String(API_INGEST_PATH);
    bool began = false;
    WiFiClientSecure secureClient;

    if (url.startsWith("https://")) {
        secureClient.setInsecure();
        began = http.begin(secureClient, url);
    } else {
        began = http.begin(url);
    }

    if (!began) {
        Serial.println("Cloud sync failed: could not initialize HTTP client");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);

    // Build JSON payload matching DataIngestPayload schema
    String json = "{";
    json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    json += "\"temperature\":" + String(currentTemperature, 1) + ",";
    json += "\"humidity\":" + String(currentHumidity, 1) + ",";
    json += "\"disease_type\":\"" + String(currentDisease) + "\",";
    json += "\"confidence_score\":" + String(currentConfidence, 2) + ",";

    // Add recommendations array (only if we have a valid profile and confidence is high enough)
    if (currentProfile != nullptr && currentConfidence >= CONFIDENCE_THRESHOLD) {
        json += "\"recommendations\":[{";
        json += "\"title\":\"" + String(isHighRisk ? currentProfile->titleEn : "Risk Assessment") + "\",";
        json += "\"description\":\"" + String(isHighRisk ? currentProfile->targetedActionEn : currentProfile->preventiveActionEn) + "\",";
        json += "\"title_am\":\"" + String(isHighRisk ? currentProfile->titleAm : "የስጋት ግምገማ") + "\",";
        json += "\"description_am\":\"" + String(isHighRisk ? currentProfile->targetedActionAm : currentProfile->preventiveActionAm) + "\"";
        json += "}],";

        // Add simple 5-day forecast based on current conditions
        json += "\"forecast\":[";
        for (int day = 1; day <= 5; day++) {
            String dayRisk = "Stable";

            if (strcmp(currentDisease, "Healthy") != 0 && currentConfidence >= CONFIDENCE_THRESHOLD) {
                bool highHumidity = currentHumidity > 75;
                if (highHumidity) {
                    // Disease-specific forecast
                    if (strcmp(currentDisease, "Anthracnose") == 0) {
                        dayRisk = (day <= 2) ? "High_Anthracnose_Risk" : "Moderate_Anthracnose_Risk";
                    } else if (strcmp(currentDisease, "Powdery Mildew") == 0) {
                        dayRisk = (day <= 2) ? "High_Mildew_Risk" : "Moderate_Mildew_Risk";
                    }
                } else {
                    dayRisk = "Moderate";
                }
            }

            json += "{\"day\":" + String(day) + ",\"risk_level\":\"" + dayRisk + "\"}";
            if (day < 5) json += ",";
        }
        json += "]";
    } else {
        // No recommendations when healthy or low confidence
        json += "\"recommendations\":null,";
        json += "\"forecast\":null";
    }

    json += "}";

    Serial.println("Sending to cloud:");
    Serial.println(json);

    int code = http.POST(json);
    Serial.print("Cloud sync HTTP: ");
    Serial.println(code);

    if (code > 0) {
        String response = http.getString();
        Serial.println("Response: " + response);
    }

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

    // 16x2 I2C LCD
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Mango Monitor");
    lcd.setCursor(0, 1);
    lcd.print("Starting...");

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

    // Configure NTP for Ethiopian Time (UTC+3)
    if (WiFi.status() == WL_CONNECTED) {
        configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
        Serial.println("NTP configured for Ethiopian Time (EAT)");

        // Wait for time sync
        struct tm timeinfo;
        int ntpRetry = 0;
        while (!getLocalTime(&timeinfo) && ntpRetry < 10) {
            Serial.println("Waiting for NTP time sync...");
            delay(1000);
            ntpRetry++;
        }
        if (getLocalTime(&timeinfo)) {
            Serial.printf("Current time: %02d/%02d/%04d %02d:%02d:%02d\n",
                          timeinfo.tm_mday, timeinfo.tm_mon + 1, timeinfo.tm_year + 1900,
                          timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
        }
    }

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
    if (millis() - lastSync > CLOUD_SYNC_INTERVAL_MS) {
        sendDataToCloud();
        lastSync = millis();
    }

    delay(200);
}