/*
 * MangoGuard ESP8266 — main.cpp
 *
 * FLOW (every DISEASE_SIM_INTERVAL_MS):
 *   1. Read DHT22 (temp + humidity)
 *   2. Generate random disease + confidence
 *   3. Display on LCD — buzz if above threshold
 *   4. Show recommendation on LCD (temp/humidity aware)
 *   5. Generate 5-day forecast when due
 *   6. Display forecast on LCD
 *   7. Send one unified payload to backend dashboard
 *   8. Wait, then repeat
 */

#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <DHT.h>

#include "secrets.h"

// =====================================================================
// DISEASE PROFILES
// =====================================================================
struct DiseaseProfile {
    const char* name;
    float       minTemp;
    float       maxTemp;
    float       humidityThreshold;
    const char* titleEn;
    const char* targetedActionEn;
    const char* preventiveActionEn;
    const char* titleAm;
    const char* targetedActionAm;
    const char* preventiveActionAm;
};

const DiseaseProfile profiles[] = {
    {
        "Anthracnose", 24.0f, 30.0f, 80.0f,
        "Anthracnose Alert",
        "Spray copper fung.",
        "Remove sick branch",
        "\u12a0\u1295\u1275\u122b\u12ad\u1296\u12d8 \u121b\u1235\u1328\u1295\u1240\u1243",
        "\u134d\u1295\u1308\u1235 \u121b\u1325\u134a\u12eb \u12ed\u122d\u1329",
        "\u12e8\u1273\u1218\u121d\u12c8 \u1245\u122d\u1295\u132b\u134e\u127d\u1295 \u12eb\u1235\u12c8\u130d\u12f1"
    },
    {
        "Powdery Mildew", 18.0f, 26.0f, 60.0f,
        "Powdery Mildew",
        "Apply sulfur spray",
        "Prune crowded trees",
        "\u12f3\u1239\u1273\u121b \u123b\u130b\u1273 \u121b\u1235\u1328\u1295\u1240\u1243",
        "\u1230\u120d\u1348\u122d \u1218\u122d\u1218\u122d \u12ed\u1233\u12f1",
        "\u12e8\u12a0\u12e8\u122d \u12dd\u12c8\u12cd\u12c8\u1275 \u12eb\u1273\u1355\u1260\u1275"
    }
};
static const int NUM_PROFILES = sizeof(profiles) / sizeof(profiles[0]);

// =====================================================================
// FORECAST LABELS
// =====================================================================
const char* forecastLabels[] = {
    "High_Anthracnose_Risk",
    "High_Mildew_Risk",
    "Stable"
};

// =====================================================================
// PINS & HARDWARE
// =====================================================================
static const uint8_t BUZZER_PIN     = D0;
static const uint8_t DHT_PIN        = D4;
static const uint8_t SDA_PIN        = D2;
static const uint8_t SCL_PIN        = D1;
static const uint8_t RED_LED_PIN    = D5;
static const uint8_t GREEN_LED_PIN  = D6;
static const uint8_t YELLOW_LED_PIN = D7;

static const uint8_t LCD_I2C_ADDR = 0x3F;
static const uint8_t LCD_COLS     = 16;
static const uint8_t LCD_ROWS     = 2;
static const uint8_t DHT_TYPE     = DHT22;

static const float ALERT_THRESHOLD = 0.70f;

LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
DHT               dht(DHT_PIN, DHT_TYPE);

// =====================================================================
// HELPERS
// =====================================================================
void lcdShow(const String& l1, const String& l2) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print(l1.substring(0, LCD_COLS));
    lcd.setCursor(0, 1); lcd.print(l2.substring(0, LCD_COLS));
}

void beep(unsigned int onMs, unsigned int offMs, int times) {
    for (int i = 0; i < times; i++) {
        digitalWrite(BUZZER_PIN, HIGH); delay(onMs);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < times - 1) delay(offMs);
    }
}

String jsonEscape(const String& s) {
    String o; o.reserve(s.length() + 8);
    for (char c : s) {
        if      (c == '"')  o += "\\\"";
        else if (c == '\\') o += "\\\\";
        else if (c == '\n') o += "\\n";
        else if (c == '\r') o += "\\r";
        else if (c == '\t') o += "\\t";
        else                o += c;
    }
    return o;
}

int findProfile(const String& name) {
    for (int i = 0; i < NUM_PROFILES; i++)
        if (name == profiles[i].name) return i;
    return -1;
}

bool isHighRiskConditions(int profIdx, float temp, float hum) {
    if (profIdx < 0 || profIdx >= NUM_PROFILES) return false;

    return temp >= profiles[profIdx].minTemp &&
           temp <= profiles[profIdx].maxTemp &&
           hum >= profiles[profIdx].humidityThreshold;
}

String buildUploadPayload(const String& disease, float conf,
                          float temp, float hum, int profIdx,
                          bool includeRecommendation,
                          bool targetedAction,
                          bool includeForecast,
                          const String forecastDays[],
                          int forecastDayCount) {
    String p = "{";
    p += "\"device_id\":\""      + WiFi.macAddress()    + "\",";
    p += "\"humidity\":"         + String(hum,  2)      + ",";
    p += "\"temperature\":"      + String(temp, 2)      + ",";
    p += "\"disease_type\":\""   + disease              + "\",";
    p += "\"confidence_score\":" + String(conf,  3);

    if (includeRecommendation && profIdx >= 0) {
        const DiseaseProfile& prof = profiles[profIdx];
        const char* titleEn = prof.titleEn;
        const char* actionEn = targetedAction ? prof.targetedActionEn : prof.preventiveActionEn;
        const char* titleAm = prof.titleAm;
        const char* actionAm = targetedAction ? prof.targetedActionAm : prof.preventiveActionAm;

        p += ",\"recommendations\":[{";
        p += "\"title\":\"" + jsonEscape(titleEn) + "\",";
        p += "\"description\":\"" + jsonEscape(actionEn) + "\",";
        p += "\"title_am\":\"" + jsonEscape(titleAm) + "\",";
        p += "\"description_am\":\"" + jsonEscape(actionAm) + "\"";
        p += "}]";
    }

    if (includeForecast && forecastDayCount > 0) {
        p += ",\"forecast\":[";
        for (int day = 0; day < forecastDayCount; day++) {
            p += "{";
            p += "\"day\":" + String(day + 1) + ",";
            p += "\"risk_level\":\"" + forecastDays[day] + "\"";
            p += "}";
            if (day < forecastDayCount - 1) p += ",";
        }
        p += "]";
    }

    p += "}";
    return p;
}

// =====================================================================
// WIFI
// =====================================================================
void connectWiFi() {
    Serial.println("[WiFi] Connecting to: " + String(WIFI_SSID));
    lcdShow("Connecting WiFi", String(WIFI_SSID).substring(0, LCD_COLS));
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    digitalWrite(GREEN_LED_PIN, LOW);

    for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
        delay(400);
        Serial.print('.');
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[WiFi] Connected! IP: " + WiFi.localIP().toString());
        lcdShow("WiFi Connected!", WiFi.localIP().toString());
        digitalWrite(GREEN_LED_PIN, HIGH);
        delay(1500);
    } else {
        Serial.println("[WiFi] FAILED");
        lcdShow("WiFi FAILED", "Check settings");
        beep(80, 80, 3);
        delay(2000);
    }
}

// =====================================================================
// HTTP POST
// =====================================================================
int httpPost(const String& payload) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[HTTP] No WiFi — skipping");
        return -1;
    }

    WiFiClientSecure sc;
    sc.setInsecure();

    HTTPClient http;
    http.setTimeout(10000);

    if (!http.begin(sc, TEST_SERVER_URL)) {
        Serial.println("[HTTP] begin() failed");
        return -1;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key",  DEVICE_API_KEY);

    Serial.println("[HTTP] Sending: " + payload);
    digitalWrite(YELLOW_LED_PIN, HIGH);
    int code = http.POST(payload);
    String responseBody = (code > 0) ? http.getString() : "";
    digitalWrite(YELLOW_LED_PIN, LOW);

    if (code >= 200 && code < 300) {
        Serial.printf("[HTTP] OK %d: %s\n", code, responseBody.c_str());
    } else if (code > 0) {
        Serial.printf("[HTTP] SERVER %d: %s\n", code, responseBody.c_str());
    } else {
        Serial.printf("[HTTP] FAIL: %s\n", http.errorToString(code).c_str());
    }

    http.end();
    return code;
}

// =====================================================================
// SETUP
// =====================================================================
void setup() {
    Serial.begin(9600);
    delay(600);
    Serial.println("\n====== MangoGuard Starting ======");

    pinMode(BUZZER_PIN,     OUTPUT); digitalWrite(BUZZER_PIN,     LOW);
    pinMode(RED_LED_PIN,    OUTPUT); digitalWrite(RED_LED_PIN,    LOW);
    pinMode(GREEN_LED_PIN,  OUTPUT); digitalWrite(GREEN_LED_PIN,  LOW);
    pinMode(YELLOW_LED_PIN, OUTPUT); digitalWrite(YELLOW_LED_PIN, LOW);

    Wire.begin(SDA_PIN, SCL_PIN);
    lcd.init();
    lcd.backlight();
    lcdShow("MangoGuard", "Booting...");

    dht.begin();
    delay(1000);
    randomSeed(analogRead(A0));

    connectWiFi();
    Serial.println("====== Setup Done ======\n");
}

// =====================================================================
// LOOP
// =====================================================================
void loop() {

    Serial.println("========== NEW CYCLE ==========");

    // ------------------------------------------------------------------
    // READ DHT22
    // ------------------------------------------------------------------
    Serial.println("[1/7] Reading DHT22...");
    float temperature = NAN, humidity = NAN;

    for (int attempt = 0; attempt < 3 && (isnan(temperature) || isnan(humidity)); attempt++) {
        delay(500);
        temperature = dht.readTemperature();
        humidity    = dht.readHumidity();
    }

    if (isnan(temperature) || isnan(humidity)) {
        Serial.println("[DHT] FAILED — using fallback values");
        lcdShow("DHT FAIL", "Using defaults");
        temperature = 25.0f;
        humidity    = 70.0f;
        delay(2000);
    } else {
        Serial.printf("[DHT] T=%.1fC  H=%.0f%%\n", temperature, humidity);
        lcdShow("T:" + String(temperature, 1) + "C",
                "H:" + String(humidity,    0) + "%");
        delay(2000);
    }

    // ------------------------------------------------------------------
    // STEP 1 — Random disease + confidence
    // ------------------------------------------------------------------
    Serial.println("[2/7] Generating random disease...");

    const char* diseaseNames[] = { "Healthy", "Anthracnose", "Powdery Mildew" };
    int    pick     = random(0, 3);
    String simName  = diseaseNames[pick];
    float  simConf;
    int    simProf;

    if (simName == "Healthy") {
        simConf = 1.0f;
        simProf = -1;
    } else {
        simConf = (float)random(70, 100) / 100.0f;
        simProf = findProfile(simName);
    }

    Serial.printf("[SIM] %s  conf=%.2f  profIdx=%d\n",
        simName.c_str(), simConf, simProf);

    // ------------------------------------------------------------------
    // STEP 2 — Display on LCD + buzz if above threshold
    // ------------------------------------------------------------------
    Serial.println("[3/7] Displaying disease + buzzer...");

    String confPct = String((int)(simConf * 100)) + "%";
    lcdShow(simName, confPct);

    if (simName == "Healthy") {
        digitalWrite(GREEN_LED_PIN, HIGH);
        digitalWrite(RED_LED_PIN,   LOW);
    } else if (simConf >= ALERT_THRESHOLD) {
        digitalWrite(RED_LED_PIN,   HIGH);
        digitalWrite(GREEN_LED_PIN, LOW);
        Serial.println("[BUZZ] Above threshold — alerting!");
        beep(800, 200, 3);
        digitalWrite(RED_LED_PIN, LOW);
    } else {
        digitalWrite(RED_LED_PIN,   LOW);
        digitalWrite(GREEN_LED_PIN, LOW);
    }

    delay(3000);

    // ------------------------------------------------------------------
    // STEP 3 — Recommendation (temp + humidity aware)
    // ------------------------------------------------------------------
    Serial.println("[4/7] Showing recommendation...");

    bool highRiskConditions = isHighRiskConditions(simProf, temperature, humidity);

    if (simProf < 0) {
        lcdShow("Crop is Healthy", "No action needed");
        Serial.println("[REC] Healthy — no recommendation");
        delay(3000);
    } else {
        const DiseaseProfile& prof = profiles[simProf];
        bool tempOk  = (temperature >= prof.minTemp && temperature <= prof.maxTemp);
        bool humidOk = (humidity >= prof.humidityThreshold);

        Serial.printf("[REC] tempOk=%d humidOk=%d\n", tempOk, humidOk);

        if (highRiskConditions) {
            lcdShow(prof.titleEn, prof.targetedActionEn);
            delay(4000);
            lcdShow(prof.titleEn, prof.preventiveActionEn);
            delay(4000);
        } else {
            lcdShow(prof.titleEn, "Check your crop");
            delay(3000);
        }
    }


    // ------------------------------------------------------------------
    // FORECAST TIMING CONTROL
    // ------------------------------------------------------------------
    static unsigned long lastForecastMillis = 0;
    static bool forecastInitialized = false;
    unsigned long nowMillis = millis();
    bool doForecast = !forecastInitialized;
    if (!doForecast && nowMillis - lastForecastMillis >= FORECAST_INTERVAL_MS) {
        doForecast = true;
    }
    if (doForecast) {
        forecastInitialized = true;
        lastForecastMillis = nowMillis;
    }

    String forecastDays[5];
    int forecastDayCount = 0;
    String primaryForecastLabel = "Stable";
    float primaryForecastConfidence = 0.0f;

    if (doForecast) {
        // STEP 4 — 5-day forecast simulation
        Serial.println("[5/7] Generating forecast...");
        lcdShow("Forecasting...", "Please wait");
        delay(1500); // brief pause so LCD is visible

        if (simProf < 0) {
            primaryForecastLabel = "Stable";
        } else {
            primaryForecastLabel = (simName == "Anthracnose")
                ? forecastLabels[0]
                : forecastLabels[1];

            if (!highRiskConditions && random(0, 100) < 55) {
                primaryForecastLabel = "Stable";
            }
        }

        if (primaryForecastLabel == "Stable") {
            primaryForecastConfidence = (float)random(85, 100) / 100.0f;
        } else {
            primaryForecastConfidence = (float)random(65, 99) / 100.0f;
        }

        for (int day = 0; day < 5; day++) {
            String dayRisk = "Stable";

            if (primaryForecastLabel != "Stable") {
                if (highRiskConditions) {
                    dayRisk = (day < 3 || (day == 3 && random(0, 100) < 35))
                        ? primaryForecastLabel
                        : "Stable";
                } else {
                    dayRisk = (day == 0 || (day == 1 && random(0, 100) < 30))
                        ? primaryForecastLabel
                        : "Stable";
                }
            }

            forecastDays[day] = dayRisk;
            forecastDayCount++;
        }

        Serial.printf("[FORECAST] Day1=%s  conf=%.2f\n",
            forecastDays[0].c_str(), primaryForecastConfidence);

        // STEP 5 — Display forecast on LCD
        Serial.println("[6/7] Displaying forecast...");

        String fPct = String((int)(primaryForecastConfidence * 100)) + "%";

        // LCD is only 16 chars — shorten long forecast labels for display
        String fDisplay = forecastDays[0];
        if (forecastDays[0] == "High_Anthracnose_Risk") fDisplay = "Anthracnose Risk";
        else if (forecastDays[0] == "High_Mildew_Risk")  fDisplay = "Mildew Risk";
        // "Stable" fits fine

        lcdShow("Forecast:", fDisplay + " " + fPct);
        Serial.printf("[LCD] %s %s\n", fDisplay.c_str(), fPct.c_str());
        delay(3000);
    }

    // ------------------------------------------------------------------
    // STEP 6 — Upload dashboard payload
    // ------------------------------------------------------------------
    Serial.println("[7/7] Uploading dashboard payload...");
    lcdShow("Uploading...", simName.substring(0, LCD_COLS));

    String uploadPayload = buildUploadPayload(
        simName,
        simConf,
        temperature,
        humidity,
        simProf,
        simProf >= 0,
        highRiskConditions,
        doForecast,
        forecastDays,
        forecastDayCount
    );
    int uploadCode = httpPost(uploadPayload);

    if (uploadCode >= 200 && uploadCode < 300) {
        lcdShow("Dashboard Sync", "HTTP " + String(uploadCode));
        Serial.println("[Upload] Dashboard payload OK");
    } else {
        lcdShow("Upload FAILED", "HTTP " + String(uploadCode));
        Serial.println("[Upload] Dashboard payload FAILED");
    }
    delay(2000);

    // ------------------------------------------------------------------
    // WIFI WATCHDOG
    // ------------------------------------------------------------------
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Dropped — reconnecting");
        connectWiFi();
    }

    // ------------------------------------------------------------------
    // WAIT for next cycle
    // ------------------------------------------------------------------
    unsigned long waitSec = DISEASE_SIM_INTERVAL_MS / 1000;
    Serial.printf("[DONE] Waiting %lus for next cycle\n\n", waitSec);
    lcdShow("Next scan in:", String(waitSec) + "s");
    delay(DISEASE_SIM_INTERVAL_MS);
}
