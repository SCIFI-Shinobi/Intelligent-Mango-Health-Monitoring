
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
#include "edge-impulse-sdk/classifier/ei_run_classifier.h"
#include "model-parameters/model_metadata.h"
#include "model-parameters/model_variables.h"



// ESP8266 to ESP32 pin mapping (D0-D7 to GPIOs)
#define D0 5
#define D1 18
#define D2 19
#define D3 21
#define D4 22
#define D5 23
#define D6 25
#define D7 26

static const uint8_t BUZZER_PIN = D0;
static const uint8_t DHT_PIN = D4;
static const uint8_t SDA_PIN = D2;
static const uint8_t SCL_PIN = D1;
static const uint8_t RED_LED_PIN = D5;
static const uint8_t GREEN_LED_PIN = D6;
static const uint8_t YELLOW_LED_PIN = D7;

static const uint8_t DHT_TYPE = DHT22;
static const uint8_t LCD_I2C_ADDR = 0x3f;
static const uint8_t LCD_COLUMNS = 16;
static const uint8_t LCD_ROWS = 2;

static const unsigned long DATA_UPLOAD_INTERVAL_MS = 10000;
static const unsigned long WIFI_RECONNECT_INTERVAL_MS = 8000;
static const unsigned long DHT_READ_INTERVAL_MS = 2000;

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastDataUploadMs = 0;
unsigned long lastReconnectAttemptMs = 0;
unsigned long lastDhtReadMs = 0;

String lastHttpStatus = "HTTP: N/A";
// Utility: JSON escape
String jsonEscape(const String& s) {
    String out;
    out.reserve(s.length() + 8);
    for (int i = 0; i < (int)s.length(); i++) {
        char c = s[i];
        if      (c == '"')  out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else                out += c;
    }
    return out;
}

void sendLog(const String& message) {
    if (WiFi.status() != WL_CONNECTED) return;
    HTTPClient http;
    http.setTimeout(3000);
    String url = String(LOG_SERVER_URL) + "/log";
    bool isHttps = url.startsWith("https");
    WiFiClientSecure clientSecure;
    WiFiClient client;
    bool beginSuccess = false;
    if (isHttps) {
        clientSecure.setInsecure();
        beginSuccess = http.begin(clientSecure, url);
    } else {
        beginSuccess = http.begin(client, url);
    }
    if (!beginSuccess) return;
    http.addHeader("Content-Type", "application/json");
    String body = "{\"device\":\"ESP32\",\"message\":\"" + jsonEscape(message) + "\"}";
    int code = http.POST(body);
    Serial.printf("[sendLog] HTTP %d\n", code > 0 ? code : 0);
    http.end();
}

void beep(unsigned int onMs, unsigned int offMs, int repeat) {
    for (int i = 0; i < repeat; ++i) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(onMs);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < repeat - 1) delay(offMs);
    }
}

void showOnLcd(const String& line1, const String& line2) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1.substring(0, LCD_COLUMNS));
    lcd.setCursor(0, 1);
    lcd.print(line2.substring(0, LCD_COLUMNS));
}

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);
DHT dht(DHT_PIN, DHT_TYPE);

// BLE UUIDs are now in secrets.h

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
bool  currentIsRaining   = false; // Digital rain sensor
// Remove rain sensor variables
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

// ...removed rain sensor code...

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

    Serial.printf("Risk Evaluation: %s (Conf: %.1f%%, Temp: %.1f°C, Hum: %.1f%%)\n",
                  riskLevel, currentConfidence * 100, currentTemperature, currentHumidity);
}

// ================= LCD DISPLAY =================
void updateDisplay() {
    String line1 = String(WiFi.status() == WL_CONNECTED ? "W:OK " : "W:-- ") +
                   String(bleConnected ? "B:OK" : "B:--");


    char envBuf[17];
    snprintf(envBuf, sizeof(envBuf), "T:%2.0f H:%2.0f", currentTemperature, currentHumidity);
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
        Serial.println("Cloud sync skipped: set DEVICE_API_KEY in secrets.h");
        return;
    }

    HTTPClient http;
    String url = String(TEST_SERVER_URL);
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
    json += "\"device_id\":\"esp32_gateway_001\",";
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

// ================= FORECASTING (Edge Impulse) =================
void runEdgeImpulseModel(float temp, float humidity) {
    float features[48];
    for (int i = 0; i < 24; ++i) {
        features[i * 2] = temp;
        features[i * 2 + 1] = humidity;
    }

    ei_impulse_result_t result = { 0 };
    signal_t signal;
    signal.total_length = 48;
    signal.get_data = [](size_t offset, size_t length, float *out_ptr) -> int {
        memcpy(out_ptr, &features[offset], length * sizeof(float));
        return 0;
    };

    ei_impulse_handle_t handle;
    handle.impulse = &impulse_916176_2;
    handle.state.clear();

    EI_IMPULSE_ERROR res = process_impulse(&handle, &signal, &result, false);

    if (res == EI_IMPULSE_OK && result.classification) {
        float max_val = 0.0f;
        int max_idx = -1;
        for (size_t i = 0; i < 3; ++i) {
            if (result.classification[i].value > max_val) {
                max_val = result.classification[i].value;
                max_idx = i;
            }
        }
        if (max_idx >= 0) {
            strncpy(currentDisease, ei_classifier_inferencing_categories_916176_2[max_idx], sizeof(currentDisease) - 1);
            currentDisease[sizeof(currentDisease) - 1] = '\0';
            currentConfidence = max_val;
        }
    }
}

void setup() {
    Serial.begin(115200);

    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW);
    pinMode(RED_LED_PIN, OUTPUT);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(YELLOW_LED_PIN, OUTPUT);
    digitalWrite(RED_LED_PIN, LOW);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(YELLOW_LED_PIN, LOW);

    dht.begin();
    Wire.begin(SDA_PIN, SCL_PIN);

    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ESP32 Test");
    lcd.setCursor(0, 1);
    lcd.print("LCD+WiFi+Web+DHT");
    delay(1200);

    Serial.print("Connecting to Wi-Fi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int timeout = 0;
    while (WiFi.status() != WL_CONNECTED && timeout < 20) {
        delay(500);
        Serial.print(".");
        timeout++;
    }
    Serial.println(WiFi.status() == WL_CONNECTED ? "\nWi-Fi OK" : "\nWi-Fi Failed");

    if (WiFi.status() == WL_CONNECTED) {
        configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
        Serial.println("NTP configured for Ethiopian Time (EAT)");
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

    NimBLEDevice::init("ESP32-Gateway");
    Serial.println("BLE Central initialized.");
}

// ================= LOOP =================
void loop() {
    unsigned long now = millis();

    // --- BLE disease result ---
    if (!bleConnected || (pClient && !pClient->isConnected())) {
        bleConnected = false;
        if (pClient) {
            NimBLEDevice::deleteClient(pClient);
            pClient = nullptr;
        }
        bleConnected = connectToNano();
    }

    // --- DHT read and forecast ---
    if (now - lastDhtReadMs >= DHT_READ_INTERVAL_MS) {
        lastDhtReadMs = now;
        float h = dht.readHumidity();
        float t = dht.readTemperature();
        if (!isnan(h) && !isnan(t)) {
            currentTemperature = t;
            currentHumidity = h;
            String msg = "Temp=" + String(t, 1) + "C Humidity=" + String(h, 0) + "%";
            sendLog(msg);
            runEdgeImpulseModel(t, h);
        }
        evaluateRisk();
        updateDisplay();
    }

    // --- Cloud upload ---
    if (now - lastDataUploadMs >= DATA_UPLOAD_INTERVAL_MS) {
        lastDataUploadMs = now;
        sendDataToCloud();
    }

    // --- Buzzer logic ---
    if (alertActive) {
        digitalWrite(BUZZER_PIN, (millis() / 500) % 2 == 0 ? HIGH : LOW);
    } else {
        digitalWrite(BUZZER_PIN, LOW);
    }

    delay(50);
}