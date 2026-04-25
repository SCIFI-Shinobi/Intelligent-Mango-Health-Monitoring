#include <Arduino.h>
#include <Wire.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>

#if __has_include(<WiFi.h>)
#include <WiFi.h>
#else
#error "Install a WiFi library for your Raspberry Pi Arduino core."
#endif

#if __has_include(<WiFiClientSecure.h>)
#include <WiFiClientSecure.h>
#define MG_HAS_WIFI_CLIENT_SECURE 1
#else
#define MG_HAS_WIFI_CLIENT_SECURE 0
#endif

// Set to 1 after you add your exported Edge Impulse forecast library below.
#define MG_USE_EDGE_IMPULSE_FORECAST 0

#if MG_USE_EDGE_IMPULSE_FORECAST
// Example:
// #include <your_forecast_model_inferencing.h>
// #include <edge-impulse-sdk/classifier/ei_run_classifier.h>
#endif

// ============================================================================
// USER CONFIG
// ============================================================================
static const char* WIFI_SSID     = "YOUR_WIFI_NAME";
static const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

static const char* API_HOST      = "mango-guard-backend.onrender.com";
static const uint16_t API_PORT   = 443;
static const bool API_USE_TLS    = true;
static const char* API_PATH      = "/data/ingest";
static const char* DEVICE_API_KEY = "mg_replace_me";
static const char* DEVICE_ID      = "raspberry_pi_pico_w_gateway_001";

static const unsigned long WIFI_RETRY_INTERVAL_MS  = 10000UL;
static const unsigned long MIN_UPLOAD_INTERVAL_MS  = 5000UL;
static const float ALERT_THRESHOLD                 = 0.70f;

// Change these pins to match your wiring.
static const uint8_t NANO_TX_TO_PICO_RX_PIN = 1;   // Pico RX, connect to Nano TX
static const uint8_t NANO_RX_TO_PICO_TX_PIN = 0;   // Pico TX, optional
static const uint8_t DHT_PIN                = 16;
static const uint8_t BUZZER_PIN             = 15;
static const uint8_t RED_LED_PIN            = 13;
static const uint8_t GREEN_LED_PIN          = 14;
static const uint8_t YELLOW_LED_PIN         = LED_BUILTIN;
static const uint8_t I2C_SDA_PIN            = 4;
static const uint8_t I2C_SCL_PIN            = 5;

static const uint8_t DHT_TYPE               = DHT22;
static const uint8_t LCD_I2C_ADDR           = 0x27;
static const uint8_t LCD_COLS               = 16;
static const uint8_t LCD_ROWS               = 2;

// ============================================================================
// DATA MODELS
// ============================================================================
struct DiseaseProfile {
    const char* name;
    float minTemp;
    float maxTemp;
    float humidityThreshold;
    const char* titleEn;
    const char* targetedActionEn;
    const char* preventiveActionEn;
    const char* titleAm;
    const char* targetedActionAm;
    const char* preventiveActionAm;
};

struct NanoInference {
    String disease;
    float confidence;
    bool available;
    unsigned long receivedAtMs;
};

struct RecommendationBundle {
    bool includeRecommendation;
    String titleEn;
    String descriptionEn;
    String titleAm;
    String descriptionAm;
};

struct ForecastBundle {
    String summaryLabel;
    float summaryConfidence;
    String dayRisk[5];
    int dayCount;
};

const DiseaseProfile profiles[] = {
    {
        "Anthracnose", 24.0f, 30.0f, 80.0f,
        "Anthracnose Alert",
        "Spray copper fungicide.",
        "Remove sick branches.",
        "አንትራክኖዝ ማስጠንቀቂያ",
        "የኮፐር ፈንገስ መድሀኒት ይርጩ",
        "የታመሙ ቅርንጫፎችን ያስወግዱ"
    },
    {
        "Powdery Mildew", 18.0f, 30.0f, 70.0f,
        "Powdery Mildew",
        "Apply sulfur spray.",
        "Prune crowded branches.",
        "የዱቄት ሻጋታ ማስጠንቀቂያ",
        "የሰልፈር መድሀኒት ይርጩ",
        "ቅርንጫፎችን ያቀኑ"
    }
};

static const int NUM_PROFILES = sizeof(profiles) / sizeof(profiles[0]);

// ============================================================================
// GLOBALS
// ============================================================================
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
DHT dht(DHT_PIN, DHT_TYPE);

NanoInference currentInference = {"Unknown", 0.0f, false, 0};
String nanoLineBuffer;

unsigned long lastWiFiAttemptMs = 0;
unsigned long lastUploadMs = 0;
bool pendingUpload = false;

// ============================================================================
// HELPERS
// ============================================================================
void safePinMode(uint8_t pin) {
    if (pin == 255) return;
    pinMode(pin, OUTPUT);
}

void safeDigitalWrite(uint8_t pin, uint8_t value) {
    if (pin == 255) return;
    digitalWrite(pin, value);
}

void lcdShow(const String& line1, const String& line2) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1.substring(0, LCD_COLS));
    lcd.setCursor(0, 1);
    lcd.print(line2.substring(0, LCD_COLS));
}

void beep(unsigned int onMs, unsigned int offMs, int times) {
    if (BUZZER_PIN == 255) return;

    for (int i = 0; i < times; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(onMs);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < times - 1) delay(offMs);
    }
}

String jsonEscape(const String& input) {
    String out;
    out.reserve(input.length() + 8);

    for (size_t i = 0; i < input.length(); i++) {
        const char c = input[i];
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }

    return out;
}

String normalizeDiseaseType(String rawDisease) {
    rawDisease.trim();
    rawDisease.replace("_", " ");

    if (rawDisease.equalsIgnoreCase("powdery mildew")) return "Powdery Mildew";
    if (rawDisease.equalsIgnoreCase("anthracnose")) return "Anthracnose";
    if (rawDisease.equalsIgnoreCase("healthy")) return "Healthy";
    if (rawDisease.length() == 0) return "Unknown";

    return rawDisease;
}

int findProfileIndex(const String& disease) {
    for (int i = 0; i < NUM_PROFILES; i++) {
        if (disease == profiles[i].name) return i;
    }
    return -1;
}

bool isHighRiskConditions(int profileIndex, float temperature, float humidity) {
    if (profileIndex < 0 || profileIndex >= NUM_PROFILES) return false;

    const DiseaseProfile& profile = profiles[profileIndex];
    return temperature >= profile.minTemp &&
           temperature <= profile.maxTemp &&
           humidity >= profile.humidityThreshold;
}

bool readDhtWithFallback(float& temperature, float& humidity) {
    temperature = NAN;
    humidity = NAN;

    for (int attempt = 0; attempt < 3; attempt++) {
        delay(200);
        temperature = dht.readTemperature();
        humidity = dht.readHumidity();
        if (!isnan(temperature) && !isnan(humidity)) {
            return true;
        }
    }

    temperature = 25.0f;
    humidity = 70.0f;
    return false;
}

RecommendationBundle buildRecommendationBundle(const String& disease,
                                               float confidence,
                                               int profileIndex,
                                               bool highRiskConditions) {
    RecommendationBundle bundle;
    bundle.includeRecommendation = false;

    if (disease == "Healthy" || profileIndex < 0) {
        return bundle;
    }

    const DiseaseProfile& profile = profiles[profileIndex];
    bundle.includeRecommendation = true;

    if (confidence < ALERT_THRESHOLD) {
        bundle.titleEn = "Low Confidence Result";
        bundle.descriptionEn = "Retake leaf image and continue monitoring.";
        bundle.titleAm = "ዝቅተኛ እምነት ውጤት";
        bundle.descriptionAm = "ምስሉን ደግመው ያንሱ እና ክትትል ይቀጥሉ";
        return bundle;
    }

    bundle.titleEn = profile.titleEn;
    bundle.titleAm = profile.titleAm;

    if (highRiskConditions) {
        bundle.descriptionEn = profile.targetedActionEn;
        bundle.descriptionAm = profile.targetedActionAm;
    } else {
        bundle.descriptionEn = profile.preventiveActionEn;
        bundle.descriptionAm = profile.preventiveActionAm;
    }

    return bundle;
}

ForecastBundle buildFallbackForecast(const String& disease,
                                     float confidence,
                                     int profileIndex,
                                     bool highRiskConditions) {
    ForecastBundle forecast;
    forecast.summaryLabel = "Stable";
    forecast.summaryConfidence = 0.88f;
    forecast.dayCount = 5;

    for (int i = 0; i < 5; i++) {
        forecast.dayRisk[i] = "Stable";
    }

    if (disease == "Healthy" || confidence < ALERT_THRESHOLD || profileIndex < 0) {
        return forecast;
    }

    if (disease == "Anthracnose") {
        forecast.summaryLabel = highRiskConditions ? "High_Anthracnose_Risk" : "Moderate_Anthracnose_Risk";
    } else if (disease == "Powdery Mildew") {
        forecast.summaryLabel = highRiskConditions ? "High_Mildew_Risk" : "Moderate_Mildew_Risk";
    } else {
        forecast.summaryLabel = highRiskConditions ? "High_Risk" : "Moderate_Risk";
    }

    forecast.summaryConfidence = highRiskConditions ? 0.84f : 0.73f;

    for (int day = 0; day < 5; day++) {
        if (highRiskConditions) {
            if (day < 3) forecast.dayRisk[day] = forecast.summaryLabel;
            else if (disease == "Anthracnose") forecast.dayRisk[day] = "Moderate_Anthracnose_Risk";
            else if (disease == "Powdery Mildew") forecast.dayRisk[day] = "Moderate_Mildew_Risk";
            else forecast.dayRisk[day] = "Moderate_Risk";
        } else {
            if (day < 2) forecast.dayRisk[day] = forecast.summaryLabel;
        }
    }

    return forecast;
}

bool tryRunEdgeImpulseForecast(const String& disease,
                               float confidence,
                               float temperature,
                               float humidity,
                               ForecastBundle& forecast) {
#if MG_USE_EDGE_IMPULSE_FORECAST
    /*
     * Replace this block with your exported Edge Impulse forecast model.
     *
     * Suggested flow:
     * 1. Build the feature vector in the same order used during training.
     * 2. Call run_classifier() or process_impulse().
     * 3. Map the top class into MangoGuard risk labels:
     *    - High_Anthracnose_Risk
     *    - Moderate_Anthracnose_Risk
     *    - High_Mildew_Risk
     *    - Moderate_Mildew_Risk
     *    - Stable
     * 4. Fill forecast.summaryLabel, forecast.summaryConfidence, and forecast.dayRisk[0..4].
     *
     * Example context inputs you may want in the feature vector:
     * - temperature
     * - humidity
     * - disease one-hot or numeric encoding
     * - confidence
     * - recent rolling averages if your model expects a sequence
     */
    (void)disease;
    (void)confidence;
    (void)temperature;
    (void)humidity;
    (void)forecast;
    return false;
#else
    (void)disease;
    (void)confidence;
    (void)temperature;
    (void)humidity;
    (void)forecast;
    return false;
#endif
}

ForecastBundle buildForecastBundle(const String& disease,
                                   float confidence,
                                   int profileIndex,
                                   float temperature,
                                   float humidity,
                                   bool highRiskConditions) {
    ForecastBundle forecast;

    if (tryRunEdgeImpulseForecast(disease, confidence, temperature, humidity, forecast)) {
        return forecast;
    }

    return buildFallbackForecast(disease, confidence, profileIndex, highRiskConditions);
}

String buildUploadPayload(const NanoInference& inference,
                          float temperature,
                          float humidity,
                          const RecommendationBundle& recommendation,
                          const ForecastBundle& forecast) {
    String payload = "{";
    payload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"temperature\":" + String(temperature, 2) + ",";
    payload += "\"humidity\":" + String(humidity, 2) + ",";
    payload += "\"disease_type\":\"" + jsonEscape(inference.disease) + "\",";
    payload += "\"confidence_score\":" + String(inference.confidence, 3) + ",";

    if (recommendation.includeRecommendation) {
        payload += "\"recommendations\":[{";
        payload += "\"title\":\"" + jsonEscape(recommendation.titleEn) + "\",";
        payload += "\"description\":\"" + jsonEscape(recommendation.descriptionEn) + "\",";
        payload += "\"title_am\":\"" + jsonEscape(recommendation.titleAm) + "\",";
        payload += "\"description_am\":\"" + jsonEscape(recommendation.descriptionAm) + "\"";
        payload += "}],";
    } else {
        payload += "\"recommendations\":null,";
    }

    payload += "\"forecast\":[";
    for (int day = 0; day < forecast.dayCount; day++) {
        payload += "{";
        payload += "\"day\":" + String(day + 1) + ",";
        payload += "\"risk_level\":\"" + jsonEscape(forecast.dayRisk[day]) + "\"";
        payload += "}";
        if (day < forecast.dayCount - 1) payload += ",";
    }
    payload += "]";
    payload += "}";

    return payload;
}

int parseHttpStatusCode(const String& statusLine) {
    const int firstSpace = statusLine.indexOf(' ');
    if (firstSpace < 0) return -1;

    const int secondSpace = statusLine.indexOf(' ', firstSpace + 1);
    if (secondSpace < 0) return statusLine.substring(firstSpace + 1).toInt();

    return statusLine.substring(firstSpace + 1, secondSpace).toInt();
}

int postJsonOverClient(Client& client, const String& payload) {
    if (!client.connect(API_HOST, API_PORT)) {
        Serial.println("[HTTP] Connection failed");
        return -1;
    }

    client.print(String("POST ") + API_PATH + " HTTP/1.1\r\n");
    client.print(String("Host: ") + API_HOST + "\r\n");
    client.print("User-Agent: MangoGuard-PicoW/1.0\r\n");
    client.print("Content-Type: application/json\r\n");
    client.print(String("x-device-key: ") + DEVICE_API_KEY + "\r\n");
    client.print(String("Content-Length: ") + payload.length() + "\r\n");
    client.print("Connection: close\r\n\r\n");
    client.print(payload);

    const unsigned long deadline = millis() + 12000UL;
    String statusLine;
    String responseBody;
    bool bodyStarted = false;

    while (millis() < deadline && (client.connected() || client.available())) {
        while (client.available()) {
            String line = client.readStringUntil('\n');

            if (!bodyStarted) {
                line.trim();
                if (statusLine.length() == 0) {
                    statusLine = line;
                } else if (line.length() == 0) {
                    bodyStarted = true;
                }
            } else {
                responseBody += line;
                responseBody += '\n';
            }
        }
        delay(10);
    }

    const int statusCode = parseHttpStatusCode(statusLine);
    Serial.print("[HTTP] Status: ");
    Serial.println(statusCode);
    if (responseBody.length() > 0) {
        Serial.println("[HTTP] Response:");
        Serial.println(responseBody);
    }

    client.stop();
    return statusCode;
}

int uploadPayload(const String& payload) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[HTTP] WiFi not connected");
        return -1;
    }

#if MG_HAS_WIFI_CLIENT_SECURE
    if (API_USE_TLS) {
        WiFiClientSecure secureClient;
        secureClient.setInsecure();
        return postJsonOverClient(secureClient, payload);
    }
#endif

    if (API_USE_TLS) {
        Serial.println("[HTTP] TLS requested but WiFiClientSecure is unavailable in this core");
        return -1;
    }

    WiFiClient client;
    return postJsonOverClient(client, payload);
}

void connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    lastWiFiAttemptMs = millis();
    Serial.print("[WiFi] Connecting to ");
    Serial.println(WIFI_SSID);

    lcdShow("Connecting WiFi", String(WIFI_SSID).substring(0, LCD_COLS));
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    const unsigned long deadline = millis() + 15000UL;
    while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
        delay(400);
        Serial.print('.');
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        safeDigitalWrite(GREEN_LED_PIN, HIGH);
        lcdShow("WiFi Connected", WiFi.localIP().toString());
        Serial.print("[WiFi] IP: ");
        Serial.println(WiFi.localIP());
        delay(1200);
    } else {
        safeDigitalWrite(GREEN_LED_PIN, LOW);
        lcdShow("WiFi Failed", "Retrying...");
        Serial.println("[WiFi] Connection failed");
        beep(80, 80, 2);
        delay(1000);
    }
}

void updateAlertOutputs(const String& disease, float confidence, bool highRiskConditions) {
    safeDigitalWrite(RED_LED_PIN, LOW);
    safeDigitalWrite(GREEN_LED_PIN, LOW);
    safeDigitalWrite(YELLOW_LED_PIN, LOW);

    if (disease == "Healthy") {
        safeDigitalWrite(GREEN_LED_PIN, HIGH);
        return;
    }

    if (confidence >= ALERT_THRESHOLD && highRiskConditions) {
        safeDigitalWrite(RED_LED_PIN, HIGH);
        beep(250, 120, 2);
    } else if (confidence >= ALERT_THRESHOLD) {
        safeDigitalWrite(YELLOW_LED_PIN, HIGH);
        beep(120, 100, 1);
    }
}

void parseNanoLine(String line) {
    line.trim();
    if (line.length() == 0) return;

    const int commaIndex = line.indexOf(',');
    if (commaIndex < 0) {
        Serial.print("[Nano] Invalid line: ");
        Serial.println(line);
        return;
    }

    String disease = normalizeDiseaseType(line.substring(0, commaIndex));
    String confidencePart = line.substring(commaIndex + 1);
    confidencePart.trim();
    float confidence = confidencePart.toFloat();

    currentInference.disease = disease;
    currentInference.confidence = confidence;
    currentInference.available = true;
    currentInference.receivedAtMs = millis();
    pendingUpload = true;

    Serial.print("[Nano] Disease: ");
    Serial.print(currentInference.disease);
    Serial.print(" | Confidence: ");
    Serial.println(currentInference.confidence, 3);

    lcdShow(currentInference.disease,
            String((int)(currentInference.confidence * 100.0f)) + "%");
}

void pollNanoSerial() {
    while (Serial1.available()) {
        char c = (char)Serial1.read();

        if (c == '\r') continue;
        if (c == '\n') {
            parseNanoLine(nanoLineBuffer);
            nanoLineBuffer = "";
            continue;
        }

        if (nanoLineBuffer.length() < 96) {
            nanoLineBuffer += c;
        }
    }
}

void processPendingInference() {
    if (!pendingUpload || !currentInference.available) return;
    if (millis() - lastUploadMs < MIN_UPLOAD_INTERVAL_MS) return;

    float temperature = 0.0f;
    float humidity = 0.0f;
    const bool dhtReadOk = readDhtWithFallback(temperature, humidity);

    if (!dhtReadOk) {
        Serial.println("[DHT] Read failed, using fallback values");
    }

    const int profileIndex = findProfileIndex(currentInference.disease);
    const bool highRiskConditions = isHighRiskConditions(profileIndex, temperature, humidity);

    RecommendationBundle recommendation = buildRecommendationBundle(
        currentInference.disease,
        currentInference.confidence,
        profileIndex,
        highRiskConditions
    );

    ForecastBundle forecast = buildForecastBundle(
        currentInference.disease,
        currentInference.confidence,
        profileIndex,
        temperature,
        humidity,
        highRiskConditions
    );

    updateAlertOutputs(currentInference.disease, currentInference.confidence, highRiskConditions);

    lcdShow("T:" + String(temperature, 1) + "C",
            "H:" + String(humidity, 0) + "%");
    delay(1200);

    if (recommendation.includeRecommendation) {
        lcdShow(recommendation.titleEn, recommendation.descriptionEn);
        delay(1800);
    }

    lcdShow("Forecast", forecast.dayRisk[0]);
    delay(1600);

    const String payload = buildUploadPayload(
        currentInference,
        temperature,
        humidity,
        recommendation,
        forecast
    );

    Serial.println("[UPLOAD] Payload:");
    Serial.println(payload);

    lcdShow("Uploading...", currentInference.disease);
    safeDigitalWrite(YELLOW_LED_PIN, HIGH);
    const int httpCode = uploadPayload(payload);
    safeDigitalWrite(YELLOW_LED_PIN, LOW);

    if (httpCode >= 200 && httpCode < 300) {
        lcdShow("Dashboard Sync", "HTTP " + String(httpCode));
        Serial.println("[UPLOAD] Success");
    } else {
        lcdShow("Upload Failed", "HTTP " + String(httpCode));
        Serial.println("[UPLOAD] Failed");
    }

    lastUploadMs = millis();
    pendingUpload = false;
    delay(1200);
}

// ============================================================================
// ARDUINO
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(600);

#if defined(ARDUINO_ARCH_RP2040)
    Serial1.setRX(NANO_TX_TO_PICO_RX_PIN);
    Serial1.setTX(NANO_RX_TO_PICO_TX_PIN);
#endif
    Serial1.begin(115200);

    safePinMode(BUZZER_PIN);
    safePinMode(RED_LED_PIN);
    safePinMode(GREEN_LED_PIN);
    safePinMode(YELLOW_LED_PIN);
    safeDigitalWrite(BUZZER_PIN, LOW);
    safeDigitalWrite(RED_LED_PIN, LOW);
    safeDigitalWrite(GREEN_LED_PIN, LOW);
    safeDigitalWrite(YELLOW_LED_PIN, LOW);

#if defined(ARDUINO_ARCH_RP2040)
    Wire.setSDA(I2C_SDA_PIN);
    Wire.setSCL(I2C_SCL_PIN);
#endif
    Wire.begin();

    lcd.init();
    lcd.backlight();
    lcdShow("MangoGuard", "Pico W Boot");

    dht.begin();

    Serial.println("====== MangoGuard Pico W Gateway ======");
    Serial.println("Expecting Nano UART lines: Disease,Confidence");

    connectWiFi();
}

void loop() {
    pollNanoSerial();

    if (WiFi.status() != WL_CONNECTED) {
        safeDigitalWrite(GREEN_LED_PIN, LOW);
        if (millis() - lastWiFiAttemptMs >= WIFI_RETRY_INTERVAL_MS) {
            connectWiFi();
        }
    }

    processPendingInference();

    if (!currentInference.available) {
        static unsigned long lastIdleLcdMs = 0;
        if (millis() - lastIdleLcdMs >= 2000UL) {
            lastIdleLcdMs = millis();
            lcdShow("Waiting Nano...", WiFi.status() == WL_CONNECTED ? "WiFi OK" : "WiFi Down");
        }
    }

    delay(20);
}
