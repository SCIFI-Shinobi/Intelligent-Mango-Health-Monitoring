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
// LCD only supports ASCII — Amharic is never printed to LCD.
// Amharic strings are sent in the JSON payload to the backend
// so the React dashboard can display them properly.
struct DiseaseProfile {
    const char* name;
    float minTemp;
    float maxTemp;
    float humidityThreshold;
    const char* titleEn;             // LCD line 1 (max 16 chars)
    const char* targetedActionEn;    // LCD line 2 — first 4 seconds
    const char* preventiveActionEn;  // LCD line 2 — second 4 seconds
    const char* titleAm;             // Backend/dashboard only
    const char* targetedActionAm;    // Backend/dashboard only
    const char* preventiveActionAm;  // Backend/dashboard only
};

const DiseaseProfile profiles[] = {
    {
        "Anthracnose", 24.0, 30.0, 80.0,
        "Anthracnose Alert",         // 16 chars — fits exactly
        "Spray copper fung.",        // 18 chars trimmed to 16 by showOnLcd
        "Remove sick branch",        // 18 chars trimmed to 16
        "\u12a0\u1295\u1275\u122b\u12ad\u1296\u12d8 \u121b\u1235\u1328\u1295\u1240\u1243",
        "\u134d\u1295\u1308\u1235 \u121b\u1325\u134a\u12eb \u12ed\u122d\u1329",
        "\u12e8\u1273\u1218\u121d\u12c8 \u1245\u122d\u1295\u132b\u134e\u127d\u1295 \u12eb\u1235\u12c8\u130d\u12f1"
    },
    {
        "Powdery_Mildew", 18.0, 26.0, 60.0,
        "Powdery Mildew",            // 14 chars — fits
        "Apply sulfur spray",        // 18 chars trimmed to 16
        "Prune crowded trees",       // 19 chars trimmed to 16
        "\u12f3\u1239\u1273\u121b \u123b\u130b\u1273 \u121b\u1235\u1328\u1295\u1240\u1243",
        "\u1230\u120d\u1348\u122d \u1218\u122d\u1218\u122d \u12ed\u1233\u12f1",
        "\u12e8\u12a0\u12e8\u122d \u12dd\x12c8\u12cd\u12c8\u1275 \u12eb\u1273\u1355\u1260\u1275"
    }
};

// ================= STATE =================
struct ClassificationResult {
    String className;
    float  confidence;
    int    classIndex;
};

// Edge Impulse output order (alphabetical): 0=Anthracnose, 1=Healthy, 2=Powdery_Mildew
// Map EI index to profiles[] index. -1 = Healthy (no disease).
static const int EI_CLASS_COUNT  = 3;
static const int EI_TO_PROFILE[] = { 0, -1, 1 };

ClassificationResult lastClassification = {"Healthy", 1.0, -1};
ClassificationResult nanoClassification = {"",        0.0, -1};
bool nanoResultAvailable = false;

const float ALERT_THRESHOLD = 0.7;

bool          showRecommendation       = false;
unsigned long recommendationStart      = 0;
int           recommendationProfileIdx = -1;
bool          showPreventive           = false;
unsigned long lastActionSwitch         = 0;

const unsigned long RECOMMENDATION_DISPLAY_MS = 8000; // 8s total
const unsigned long ACTION_SWITCH_MS          = 4000; // 4s targeted, 4s preventive

float lastTemperatureC = NAN;
float lastHumidityPct  = NAN;

// ================= PINS =================
static const uint8_t BUZZER_PIN      = D0;
static const uint8_t DHT_PIN         = D4;
static const uint8_t SDA_PIN         = D2;
static const uint8_t SCL_PIN         = D1;
static const uint8_t RED_LED_PIN     = D5;
static const uint8_t GREEN_LED_PIN   = D6;
static const uint8_t YELLOW_LED_PIN  = D7;

static const uint8_t DHT_TYPE     = DHT22;
static const uint8_t LCD_I2C_ADDR = 0x3f;
static const uint8_t LCD_COLUMNS  = 16;
static const uint8_t LCD_ROWS     = 2;

static const unsigned long DATA_UPLOAD_INTERVAL_MS    = 10000;
static const unsigned long WIFI_RECONNECT_INTERVAL_MS = 8000;
static const unsigned long DHT_READ_INTERVAL_MS       = 2000;

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastDataUploadMs       = 0;
unsigned long lastReconnectAttemptMs = 0;
unsigned long lastDhtReadMs          = 0;
String        lastHttpStatus         = "HTTP: N/A";

// ================= HELPERS =================
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

void showOnLcd(const String& line1, const String& line2) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1.substring(0, LCD_COLUMNS));
    lcd.setCursor(0, 1);
    lcd.print(line2.substring(0, LCD_COLUMNS));
}

void beep(unsigned int onMs, unsigned int offMs, int repeat) {
    for (int i = 0; i < repeat; ++i) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(onMs);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < repeat - 1) delay(offMs);
    }
}

// ================= WIFI =================
void connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    showOnLcd("WiFi connecting", "Please wait...");
    digitalWrite(GREEN_LED_PIN, LOW);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(400);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        showOnLcd("WiFi Connected", "Success!");
        digitalWrite(GREEN_LED_PIN, HIGH);
        Serial.println("Connected. IP: " + WiFi.localIP().toString());
    } else {
        showOnLcd("WiFi Failed", "Check SSID/PASS");
        Serial.println("WiFi connection failed.");
        beep(80, 80, 3);
    }
}

// ================= LOGGING =================
void sendLog(const String& message) {
    if (WiFi.status() != WL_CONNECTED) return;
    HTTPClient http;
    http.setTimeout(3000);
    String url = String(LOG_SERVER_URL) + "/log";
    WiFiClientSecure clientSecure;
    clientSecure.setInsecure(); // Allow insecure connection for ESP8266
    WiFiClient client;
    bool ok = url.startsWith("https")
        ? http.begin(clientSecure, url)
        : http.begin(client, url);
    if (!ok) return;
    http.addHeader("Content-Type", "application/json");
    String body = "{\"device\":\"ESP8266\",\"message\":\"" + jsonEscape(message) + "\"}";
    http.POST(body);
    http.end();
}

// ================= EDGE IMPULSE FORECASTING =================
void runEdgeImpulseModel(float temp, float humidity) {
    static float features[48];
    for (int i = 0; i < 24; ++i) {
        features[i * 2]     = temp;
        features[i * 2 + 1] = humidity;
    }
    ei_impulse_result_t result = { 0 };
    signal_t signal;
    signal.total_length = 48;
    signal.get_data = [](size_t offset, size_t length, float* out_ptr) -> int {
        memcpy(out_ptr, &features[offset], length * sizeof(float));
        return 0;
    };
    ei_impulse_handle_t handle(&impulse_916176_2);
    EI_IMPULSE_ERROR res = process_impulse(&handle, &signal, &result, false);
    if (res == EI_IMPULSE_OK && result.classification) {
        float max_val = 0.0f; int max_ei_idx = -1;
        for (int i = 0; i < EI_CLASS_COUNT; ++i) {
            if (result.classification[i].value > max_val) {
                max_val = result.classification[i].value;
                max_ei_idx = i;
            }
        }
        if (max_ei_idx >= 0) {
            int profileIdx = EI_TO_PROFILE[max_ei_idx];
            nanoClassification.classIndex = profileIdx;
            nanoClassification.confidence = max_val;
            nanoClassification.className  = profileIdx >= 0
                ? profiles[profileIdx].name : "Healthy";
            nanoResultAvailable = true;
            Serial.printf("[EI] Forecast: %s (%.2f)\n",
                nanoClassification.className.c_str(), max_val);
        }
    } else {
        Serial.printf("[EI] Error: %d\n", res);
    }
}

// ================= UART PARSER (real Nano when connected) =================
void parseNanoSerialLine(const String& line) {
    int commaIdx = line.indexOf(',');
    if (commaIdx <= 0) return;
    String disease = line.substring(0, commaIdx);
    float  conf    = line.substring(commaIdx + 1).toFloat();
    nanoClassification.className  = disease;
    nanoClassification.confidence = conf;
    nanoClassification.classIndex = -1;
    for (size_t i = 0; i < sizeof(profiles) / sizeof(profiles[0]); ++i) {
        if (disease == profiles[i].name) {
            nanoClassification.classIndex = (int)i;
            break;
        }
    }
    nanoResultAvailable = true;
    Serial.printf("[UART] Nano: %s (%.2f)\n", disease.c_str(), conf);
}

// ================= RECOMMENDATION ENGINE =================
void checkAndShowRecommendation() {
    if (isnan(lastTemperatureC) || isnan(lastHumidityPct)) return;

    ClassificationResult* result = nanoResultAvailable
        ? &nanoClassification : &lastClassification;

    if (result->className == "Healthy" ||
        result->confidence < ALERT_THRESHOLD ||
        result->classIndex < 0) {
        showRecommendation = false;
        recommendationProfileIdx = -1;
        return;
    }

    const DiseaseProfile& prof = profiles[result->classIndex];
    bool tempOk  = lastTemperatureC >= prof.minTemp && lastTemperatureC <= prof.maxTemp;
    bool humidOk = lastHumidityPct  >= prof.humidityThreshold;

    if (tempOk && humidOk) {
        // Full alert: disease detected AND environmental conditions match
        showRecommendation       = true;
        recommendationStart      = millis();
        recommendationProfileIdx = result->classIndex;
        showPreventive           = false;
        lastActionSwitch         = millis();
        Serial.printf("[REC] Alert: %s\n", result->className.c_str());
    } else {
        // Disease detected but env conditions outside profile range
        // Still warn the farmer — don't silently drop it
        showOnLcd(prof.titleEn, "Check your crop");
        showRecommendation = false;
        Serial.printf("[REC] %s detected, env out of range.\n",
                      result->className.c_str());
    }
}

// ================= DHT READ =================
void readAndDisplayDht() {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
        lastTemperatureC = t;
        lastHumidityPct  = h;
        sendLog("T=" + String(t, 1) + "C H=" + String(h, 0) + "%");
        yield(); // Feed the watchdog timer to prevent a crash
        delay(50); // Space out heavy tasks to avoid memory exhaustion
        runEdgeImpulseModel(t, h);
    } else {
        sendLog("DHT read failed");
    }

    String line1 = isnan(lastTemperatureC)
        ? "DHT read failed"
        : "T:" + String(lastTemperatureC, 1) + "C H:" + String(lastHumidityPct, 0) + "%";

    // Show confidence as percentage: "Anthracnose:85%"
    String line2 = lastHttpStatus;
    if (nanoResultAvailable) {
        line2 = nanoClassification.className + ":" +
                String((int)(nanoClassification.confidence * 100)) + "%";
    }

    checkAndShowRecommendation();
    if (!showRecommendation) {
        showOnLcd(line1, line2);
    }
}

// ================= DATA UPLOAD =================
void sendSensorData() {
    if (WiFi.status() != WL_CONNECTED) {
        showOnLcd("WiFi Disconn", "Reconnecting...");
        digitalWrite(GREEN_LED_PIN, LOW);
        return;
    }
    if (!nanoResultAvailable) return;

    HTTPClient http;
    http.setTimeout(5000);
    String url = String(TEST_SERVER_URL);
    WiFiClientSecure clientSecure;
    clientSecure.setInsecure(); // Allow insecure connection for ESP8266
    WiFiClient client;
    bool ok = url.startsWith("https")
        ? http.begin(clientSecure, url)
        : http.begin(client, url);
    if (!ok) { showOnLcd("HTTP Begin Err", "Bad URL?"); beep(120, 120, 2); return; }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", DEVICE_API_KEY);

    float  humidity    = isnan(lastHumidityPct)  ? 0.0f : lastHumidityPct;
    float  temperature = isnan(lastTemperatureC) ? 0.0f : lastTemperatureC;
    String disease     = nanoClassification.className;
    float  confidence  = nanoClassification.confidence;

    // Amharic fields go in payload for dashboard — not printed to LCD
    String titleAm  = "";
    String actionAm = "";
    if (nanoClassification.classIndex >= 0) {
        const DiseaseProfile& prof = profiles[nanoClassification.classIndex];
        titleAm  = prof.titleAm;
        actionAm = prof.targetedActionAm;
    }

    String payload = "{";
    payload += "\"device_id\":\""      + WiFi.macAddress()     + "\",";
    payload += "\"humidity\":"         + String(humidity, 2)   + ",";
    payload += "\"temperature\":"      + String(temperature, 2)+ ",";
    payload += "\"disease_type\":\""   + disease               + "\",";
    payload += "\"confidence_score\":" + String(confidence, 3) + ",";
    payload += "\"title_am\":\""       + jsonEscape(titleAm)   + "\",";
    payload += "\"action_am\":\""      + jsonEscape(actionAm)  + "\"";
    payload += "}";

    Serial.println("Sending: " + payload);

    digitalWrite(YELLOW_LED_PIN, HIGH); // Uploading indicator

    if (disease == "Healthy") {
        digitalWrite(GREEN_LED_PIN, HIGH);
        digitalWrite(RED_LED_PIN, LOW);
    } else if (confidence >= ALERT_THRESHOLD) {
        digitalWrite(RED_LED_PIN, HIGH);
        digitalWrite(GREEN_LED_PIN, LOW);
        beep(800, 200, 2);
        digitalWrite(RED_LED_PIN, LOW);
    }

    int code = http.POST(payload);
    digitalWrite(YELLOW_LED_PIN, LOW);
    lastHttpStatus = "HTTP:" + String(code > 0 ? code : 0);

    if (code > 0) Serial.println("HTTP " + String(code) + ": " + http.getString());
    else          Serial.println("POST error: " + http.errorToString(code));

    http.end();
}

// ================= GLOBALS =================
unsigned long lastNanoSim = 0;

// ================= SETUP =================
void setup() {
    Serial.begin(9600);
    delay(500);

    pinMode(BUZZER_PIN,     OUTPUT); digitalWrite(BUZZER_PIN,     LOW);
    pinMode(RED_LED_PIN,    OUTPUT); digitalWrite(RED_LED_PIN,    LOW);
    pinMode(GREEN_LED_PIN,  OUTPUT); digitalWrite(GREEN_LED_PIN,  LOW);
    pinMode(YELLOW_LED_PIN, OUTPUT); digitalWrite(YELLOW_LED_PIN, LOW);

    dht.begin();
    Wire.begin(SDA_PIN, SCL_PIN);
    lcd.init();
    lcd.backlight();

    showOnLcd("MangoGuard", "Initializing...");
    delay(1200);

    randomSeed(analogRead(A0)); // Once at startup

    connectWiFi();

    // FIX 1: Set lastNanoSim far enough in the past so the disease simulation
    // fires immediately on the very first loop() iteration instead of waiting
    // a full 20 seconds while the LCD sits frozen on "WiFi Connected".
    lastNanoSim = millis() - DISEASE_SIM_INTERVAL_MS;
}

// ================= LOOP =================
void loop() {
    unsigned long now = millis();

    // ── Always generate random disease result every DISEASE_SIM_INTERVAL_MS (from secrets.h) ──
    if (now - lastNanoSim >= DISEASE_SIM_INTERVAL_MS) {
        lastNanoSim = now;
        const char* diseases[] = {"Healthy", "Anthracnose", "Powdery_Mildew"};
        int idx = random(0, 3);
        nanoClassification.className  = diseases[idx];
        if (nanoClassification.className == "Healthy") {
            nanoClassification.confidence = 1.0;
            nanoClassification.classIndex = -1;
            // LED logic: Healthy = Green ON, Red OFF
            digitalWrite(GREEN_LED_PIN, HIGH);
            digitalWrite(RED_LED_PIN, LOW);
        } else {
            nanoClassification.confidence = random(70, 100) / 100.0;
            nanoClassification.classIndex = -1; // reset before search
            for (size_t i = 0; i < sizeof(profiles) / sizeof(profiles[0]); ++i) {
                if (nanoClassification.className == profiles[i].name) {
                    nanoClassification.classIndex = (int)i;
                    break;
                }
            }
            // LED logic: Disease = Red ON, Green OFF if above threshold
            if (nanoClassification.confidence >= ALERT_THRESHOLD) {
                digitalWrite(RED_LED_PIN, HIGH);
                digitalWrite(GREEN_LED_PIN, LOW);
                beep(800, 200, 2);
                digitalWrite(RED_LED_PIN, LOW);
            } else {
                // Below threshold: all LEDs OFF
                digitalWrite(RED_LED_PIN, LOW);
                digitalWrite(GREEN_LED_PIN, LOW);
            }
        }
        nanoResultAvailable = true;
        Serial.printf("[SIM] Disease: %s (%.2f)\n",
            nanoClassification.className.c_str(), nanoClassification.confidence);

        // FIX 3: Only update the LCD from the sim if a recommendation isn't
        // currently being displayed — otherwise it wipes the recommendation mid-display.
        if (!showRecommendation) {
            String line1 = nanoClassification.className;
            String line2 = String((int)(nanoClassification.confidence * 100)) + "%";
            showOnLcd(line1, line2);
        }
    }

    // ── WiFi watchdog ──
    if (WiFi.status() != WL_CONNECTED) {
        if (now - lastReconnectAttemptMs >= WIFI_RECONNECT_INTERVAL_MS) {
            lastReconnectAttemptMs = now;
            connectWiFi();
        }
        delay(100);
        return;
    }

    // ── DHT read + EI forecasting ──
    if (now - lastDhtReadMs >= DHT_READ_INTERVAL_MS) {
        lastDhtReadMs = now;
        readAndDisplayDht();
    }

    // ── Recommendation display (English only on LCD) ──
    // Line 1: disease title   e.g. "Anthracnose Alert"
    // Line 2: action          first 4s = targeted, next 4s = preventive
    if (showRecommendation && recommendationProfileIdx >= 0) {
        if (now - recommendationStart < RECOMMENDATION_DISPLAY_MS) {
            if (!showPreventive && (now - lastActionSwitch >= ACTION_SWITCH_MS)) {
                showPreventive   = true;
                lastActionSwitch = now;
            }
            const DiseaseProfile& prof = profiles[recommendationProfileIdx];
            String l2 = showPreventive
                ? prof.preventiveActionEn
                : prof.targetedActionEn;
            showOnLcd(prof.titleEn, l2);
        } else {
            showRecommendation       = false;
            recommendationProfileIdx = -1;
            showPreventive           = false;
        }
    }

    // ── Data upload ──
    // FIX 2: Don't clear nanoResultAvailable after upload — the DHT display and
    // recommendation engine still need it on the next cycle. The upload timer
    // already prevents sending to the server more than once every 10 seconds.
    if (nanoResultAvailable && (now - lastDataUploadMs >= DATA_UPLOAD_INTERVAL_MS)) {
        lastDataUploadMs = now;
        sendSensorData();
        // nanoResultAvailable intentionally NOT cleared here
    }

    delay(50);
}