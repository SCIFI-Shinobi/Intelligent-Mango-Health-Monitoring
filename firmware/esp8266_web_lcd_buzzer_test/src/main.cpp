#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <DHT.h>
#include "secrets.h" 

// ---------- NODEMCU PINS ----------
static const uint8_t BUZZER_PIN = D0;
static const uint8_t DHT_PIN = D4;
static const uint8_t SDA_PIN = D2;
static const uint8_t SCL_PIN = D1;

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

float lastTemperatureC = NAN;
float lastHumidityPct = NAN;
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
        clientSecure.setInsecure(); // Accept any SSL certificate
        beginSuccess = http.begin(clientSecure, url);
    } else {
        beginSuccess = http.begin(client, url);
    }

    if (!beginSuccess) return;

    http.addHeader("Content-Type", "application/json");

    // ✅ Escape the message before embedding it in JSON
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
    }

    String line1;
    if (isnan(lastTemperatureC) || isnan(lastHumidityPct)) {
        line1 = "DHT read failed";
        sendLog("DHT read failed"); 
    } else {
        line1 = "T:" + String(lastTemperatureC, 1) + "C H:" + String(lastHumidityPct, 0) + "%";
    }

    showOnLcd(line1, lastHttpStatus);
}

void connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    showOnLcd("WiFi connecting", "Please wait...");
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
        // Move beep after LCD update
        beep(120, 100, 1);
        sendLog("WiFi connected, IP=" + ip); // ✅
    } else {
        showOnLcd("WiFi Failed", "Check SSID/PASS");
        Serial.println("WiFi connection failed.");
        beep(80, 80, 3);
    }
}

void sendSensorData() {
    if (WiFi.status() != WL_CONNECTED) {
        showOnLcd("WiFi Disconn", "Reconnecting...");
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
        clientSecure.setInsecure(); // Required for Render HTTPS domains        
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

    float humidity = isnan(lastHumidityPct) ? random(3000, 9000) / 100.0 : lastHumidityPct;
    float temperature = isnan(lastTemperatureC) ? random(1500, 3500) / 100.0 : lastTemperatureC;


    String diseases[] = {"healthy", "anthracnose", "powdery_mildew"};
    String disease_type = diseases[random(0, 3)];

    float confidence_score = random(500, 1000) / 1000.0;


    String payload = "{";
    payload += "\"device_id\":\"ESP32_001\",";
    payload += "\"humidity\":" + String(humidity, 2) + ",";
    payload += "\"temperature\":" + String(temperature, 2) + ",";
    payload += "\"disease_type\":\"" + disease_type + "\",";
    payload += "\"confidence_score\":" + String(confidence_score, 3);
    payload += "}";

    Serial.println("Sending: " + payload);

    // 🔔 Beep if confidence_score >= 0.7
    if (confidence_score >= 0.7) {
        beep(800, 200, 2); // Long beep, 2 times
    }

    int code = http.POST(payload);
    lastHttpStatus = "HTTP: " + String(code > 0 ? code : 0);

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

    dht.begin();
    Wire.begin(SDA_PIN, SCL_PIN);

    lcd.init();
    lcd.backlight();

    showOnLcd("ESP8266 Test", "LCD+WiFi+Web+DHT");
    delay(1200);

    connectWiFi();
    sendLog("Device booted"); 
}

void loop() {
    unsigned long now = millis();

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

    if (now - lastDataUploadMs >= DATA_UPLOAD_INTERVAL_MS) {
        lastDataUploadMs = now;
        sendSensorData();
    }

    delay(50);
}