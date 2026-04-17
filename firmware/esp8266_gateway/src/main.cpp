#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <DHT.h>

#include "secrets.h"
#include "edge-impulse-sdk/classifier/ei_run_classifier.h"
#include "model-parameters/model_metadata.h"
#include "model-parameters/model_variables.h"
// ================= DISEASE PROFILES =================
struct DiseaseProfile {
    const char* name;
    float minTemp;
    float maxTemp;
    float humidityThreshold;
    const char* targetedActionEn;
    const char* preventiveActionEn;
    const char* targetedActionAm;
    const char* preventiveActionAm;
    const char* titleEn;
    const char* titleAm;
};

const DiseaseProfile profiles[] = {
    {
        "Anthracnose", 24.0, 30.0, 80.0,
        "Spray copper fungicide.",
        "Remove diseased branches.",
        "ፈንገስ ማጥፊያ ይርጩ",
        "የታመሙ ቅርንጫፎችን ያስወግዱ",
        "Anthracnose Detected",
        "አንትራክኖዝ ተገኝቷል"
    },
    {
        "Powdery_Mildew", 18.0, 26.0, 60.0,
        "Apply sulfur fungicide.",
        "Prune overcrowded branches.",
        "ሶልፈር ሊሊት ይሳሩ",
        "ተክሎችን ዙሪያ የአየር ስርጭት ይሻሻሉ",
        "Powdery Mildew Alert",
        "ነጩ ሽንት አስጠንቅ"
    }
};

// Recommendation engine state
struct ClassificationResult {
    String className;
    float confidence;
    int classIndex;
};

ClassificationResult lastClassification = {"Healthy", 1.0, -1};
ClassificationResult nanoClassification = {"", 0.0, -1}; 
bool nanoResultAvailable = false;
const float ALERT_THRESHOLD = 0.7;
bool showRecommendation = false;
unsigned long recommendationStart = 0;
int recommendationProfileIdx = -1;
bool showAmharic = false;
unsigned long lastLangSwitch = 0;
const unsigned long RECOMMENDATION_DISPLAY_MS = 6000;
const unsigned long LANG_SWITCH_MS = 2000;

float lastTemperatureC = NAN;
float lastHumidityPct = NAN;

// Run Edge Impulse model for forecasting
void runEdgeImpulseModel(float temp, float humidity) {
    static float features[48];
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

    ei_impulse_handle_t handle(&impulse_916176_2);

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
            nanoClassification.className = ei_classifier_inferencing_categories_916176_2[max_idx];
            nanoClassification.confidence = max_val;
            nanoClassification.classIndex = max_idx;
            nanoResultAvailable = true;
        }
    }
}

void parseNanoSerialLine(const String& line) {
    int commaIdx = line.indexOf(',');
    if (commaIdx > 0) {
        String disease = line.substring(0, commaIdx);
        String confStr = line.substring(commaIdx + 1);
        float conf = confStr.toFloat();
        nanoClassification.className = disease;
        nanoClassification.confidence = conf;
        nanoClassification.classIndex = -1;
        for (size_t i = 0; i < sizeof(profiles)/sizeof(profiles[0]); ++i) {
            if (disease == profiles[i].name) {
                nanoClassification.classIndex = i;
                break;
            }
        }
        nanoResultAvailable = true;
    }
}

void simulateClassification() {
    String diseases[] = {"Healthy", "Anthracnose", "Powdery_Mildew"};
    int idx = random(0, 3);
    lastClassification.className = diseases[idx];
    if (lastClassification.className == "Healthy") {
        lastClassification.confidence = 1.0;
        lastClassification.classIndex = -1;
    } else {
        lastClassification.confidence = random(70, 100) / 100.0;
        lastClassification.classIndex = -1;
        for (size_t i = 0; i < sizeof(profiles)/sizeof(profiles[0]); ++i) {
            if (lastClassification.className == profiles[i].name) {
                lastClassification.classIndex = i;
                break;
            }
        }
    }
}

void checkAndShowRecommendation() {
    if (isnan(lastTemperatureC) || isnan(lastHumidityPct)) return;
    ClassificationResult* result = &lastClassification;
    if (nanoResultAvailable) {
        result = &nanoClassification;
    } else {
        simulateClassification();
    }
    if (result->className != "Healthy" &&
        result->confidence >= ALERT_THRESHOLD &&
        result->classIndex >= 0) {
        const DiseaseProfile& prof = profiles[result->classIndex];
        if (lastTemperatureC >= prof.minTemp && lastTemperatureC <= prof.maxTemp && lastHumidityPct >= prof.humidityThreshold) {
            showRecommendation = true;
            recommendationStart = millis();
            recommendationProfileIdx = result->classIndex;
            lastLangSwitch = millis();
            showAmharic = false;
            return;
        }
    }
    showRecommendation = false;
    recommendationProfileIdx = -1;
}

// ---------- NODEMCU PINS ----------
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
    String body = "{\"device\":\"ESP8266\",\"message\":\"" + jsonEscape(message) + "\"}";
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

void readAndDisplayDht() {
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (!isnan(h) && !isnan(t)) {
        lastTemperatureC = t;
        lastHumidityPct = h;
        String msg = "Temp=" + String(t, 1) + "C Humidity=" + String(h, 0) + "%";
        sendLog(msg);
        runEdgeImpulseModel(t, h); // Run the model after reading sensors
    }

    String line1;
    if (isnan(lastTemperatureC) || isnan(lastHumidityPct)) {
        line1 = "DHT read failed";
        sendLog("DHT read failed");
    } else {
        line1 = "T:" + String(lastTemperatureC, 1) + "C H:" + String(lastHumidityPct, 0) + "%";
    }

    // Show model result on LCD if available
    String line2 = lastHttpStatus;
    if (nanoResultAvailable) {
        line2 = nanoClassification.className + ":" + String(nanoClassification.confidence, 2);
    }

    checkAndShowRecommendation();
    if (!showRecommendation) {
        showOnLcd(line1, line2);
    }
}

void connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    showOnLcd("WiFi connecting", "Please wait...");
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(YELLOW_LED_PIN, LOW);
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(400);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        String ip = WiFi.localIP().toString();
        showOnLcd("WiFi Connected", ip);
        Serial.print("Connected. IP: ");
        Serial.println(ip);
        sendLog("WiFi connected, IP=" + ip);
    } else {
        showOnLcd("WiFi Failed", "Check SSID/PASS");
        Serial.println("WiFi connection failed.");
        digitalWrite(GREEN_LED_PIN, LOW);
        digitalWrite(YELLOW_LED_PIN, LOW);
        beep(80, 80, 3);
    }
}

void sendSensorData() {
    if (WiFi.status() != WL_CONNECTED) {
        showOnLcd("WiFi Disconn", "Reconnecting...");
        digitalWrite(GREEN_LED_PIN, LOW);
        digitalWrite(YELLOW_LED_PIN, LOW);
        return;
    }

    HTTPClient http;
    http.setTimeout(5000);

    String url = String(TEST_SERVER_URL);
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

    if (!beginSuccess) {
        showOnLcd("HTTP Begin Err", "Bad URL?");
        beep(120, 120, 2);
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", DEVICE_API_KEY);
    randomSeed(analogRead(0));

        float humidity = isnan(lastHumidityPct) ? 0.0 : lastHumidityPct;
        float temperature = isnan(lastTemperatureC) ? 0.0 : lastTemperatureC;

        // Only send if we have a real result from Nano or forecasting model
        if (!nanoResultAvailable) {
            // No valid result, skip sending
            return;
        }

        String disease_type = nanoClassification.className;
        float confidence_score = nanoClassification.confidence;

    String payload = "{";
    payload += "\"device_id\":\"ESP32_001\",";
    payload += "\"humidity\":" + String(humidity, 2) + ",";
    payload += "\"temperature\":" + String(temperature, 2) + ",";
    payload += "\"disease_type\":\"" + disease_type + "\",";
    payload += "\"confidence_score\":" + String(confidence_score, 3);
    payload += "}";

    Serial.println("Sending: " + payload);

    if (disease_type == "Healthy") {
        digitalWrite(GREEN_LED_PIN, HIGH);
    }

    if (disease_type != "Healthy" && confidence_score >= 0.7) {
        for (int i = 0; i < 2; ++i) {
            digitalWrite(RED_LED_PIN, HIGH);
            beep(800, 200, 1);
            digitalWrite(RED_LED_PIN, LOW);
            delay(200);
        }
    }

    int code = http.POST(payload);
    lastHttpStatus = "HTTP: " + String(code > 0 ? code : 0);
    digitalWrite(YELLOW_LED_PIN, LOW);

    if (code > 0) {
        String response = http.getString();
        Serial.println("HTTP " + String(code));
        Serial.println(response);
    } else {
        Serial.println("Error: " + http.errorToString(code));
    }

    http.end();
}

void setup() {
    Serial.begin(9600);
    delay(500);

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

    showOnLcd("ESP8266 Test", "LCD+WiFi+Web+DHT");
    delay(1200);

    connectWiFi();
}
void loop() {
    unsigned long now = millis();


    // --- Simulate Nano serial every 20 seconds ---
    static unsigned long lastNanoSim = 0;
    if (now - lastNanoSim >= 20000) {
        lastNanoSim = now;
        // Simulate a random disease classification as if received from Nano
        String diseases[] = {"Healthy", "Anthracnose", "Powdery_Mildew"};
        int idx = random(0, 3);
        nanoClassification.className = diseases[idx];
        if (nanoClassification.className == "Healthy") {
            nanoClassification.confidence = 1.0;
            nanoClassification.classIndex = -1;
        } else {
            nanoClassification.confidence = random(70, 100) / 100.0;
            nanoClassification.classIndex = -1;
            for (size_t i = 0; i < sizeof(profiles)/sizeof(profiles[0]); ++i) {
                if (nanoClassification.className == profiles[i].name) {
                    nanoClassification.classIndex = i;
                    break;
                }
            }
        }
        nanoResultAvailable = true;
    }

    if (WiFi.status() != WL_CONNECTED) {
        if (now - lastReconnectAttemptMs >= WIFI_RECONNECT_INTERVAL_MS) {
            lastReconnectAttemptMs = now;
            connectWiFi();
        }
        delay(100);
        return;
    }

    if (now - lastDhtReadMs >= DHT_READ_INTERVAL_MS) {
        lastDhtReadMs = now;
        readAndDisplayDht();
    }

    if (showRecommendation && recommendationProfileIdx >= 0) {
        if (now - recommendationStart < RECOMMENDATION_DISPLAY_MS) {
            if (now - lastLangSwitch > LANG_SWITCH_MS) {
                showAmharic = !showAmharic;
                lastLangSwitch = now;
            }
            const DiseaseProfile& prof = profiles[recommendationProfileIdx];
            String l1 = showAmharic ? prof.titleAm : prof.titleEn;
            String l2 = showAmharic ? prof.targetedActionAm : prof.targetedActionEn;
            showOnLcd(l1, l2);
        } else {
            showRecommendation = false;
            recommendationProfileIdx = -1;
        }
    }

        // Only send if we have a real result from Nano or forecasting model
        if (nanoResultAvailable && (now - lastDataUploadMs >= DATA_UPLOAD_INTERVAL_MS)) {
            lastDataUploadMs = now;
            sendSensorData();
            nanoResultAvailable = false; // Reset after sending
        }

    delay(50);
}