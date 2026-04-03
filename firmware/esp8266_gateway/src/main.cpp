#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <time.h>
#include <SoftwareSerial.h>
#include "Config.h"

// ================= HARDWARE INITIALIZATION =================
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);
DHT dht(DHT_PIN, DHT_TYPE);
SoftwareSerial serialToNano(RX_PIN, TX_PIN);  // RX, TX

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
        "Spray with copper-based fungicide (Copper oxychloride). High risk conditions detected.",
        "Remove diseased branches and improve air circulation.",
        "ፈንገስ ማጥፊያ (Copper) ይርጩ",
        "የታመሙ ቅርንጫፎችን ያስወግዱ",
        "Anthracnose Detected",
        "አንትራክኖዝ ተገኝቷል"
    },
    {
        "Powdery Mildew", 18.0, 26.0, 60.0,
        "Apply sulfur-based fungicide. Improve ventilation around plants.",
        "Prune overcrowded branches to reduce humidity.",
        "ሶልፈር ሊሊት ይሳሩ",
        "ተክሎችን ዙሪያ የአየር ስርጭት ይሻሻሉ",
        "Powdery Mildew Alert",
        "ነጩ ሽንት አስጠንቅ"
    }
};

// ================= STATE & SENSORS =================
struct SensorData {
    float temperature;
    float humidity;
    float rainIntensity;
    bool isRaining;
    unsigned long timestamp;
};

struct ClassificationResult {
    String className;
    float confidence;
    int classIndex;
};

SensorData currentSensorData;
ClassificationResult lastClassification = {"None", 0.0, -1};
unsigned long lastDHTRead = 0;
unsigned long lastRainCheck = 0;
unsigned long lastCloudSync = 0;
unsigned long alertStartTime = 0;
bool alertActive = false;
int alertBuzzerPattern = 0;  // Pattern counter for buzzer

// ================= FUNCTION DECLARATIONS =================
void setupWiFi();
void setupSerial();
void readSensors();
void checkRainSensor();
void handleSerialData();
void displayStatus();
void displayAlert();
void triggerAlert(const DiseaseProfile& profile);
void syncToCloud();
void playBuzzer(int pattern);
void handleBuzzerAlert();
void setupTime();

// ================= SETUP =================
void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n\nESP8266 Gateway Initializing...");
    
    // Initialize hardware
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(RAIN_SENSOR_ANALOG_PIN, INPUT);
    digitalWrite(BUZZER_PIN, LOW);
    
    // Initialize I2C and display
    Wire.begin(SDA_PIN, SCL_PIN);
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("ESP8266 Gateway");
    lcd.setCursor(0, 1);
    lcd.print("Booting...");
    
    // Initialize sensors
    dht.begin();
    
    // Initialize UART to Nano
    setupSerial();
    
    // Initialize WiFi and time
    setupWiFi();
    setupTime();
    
    Serial.println("Setup complete. Waiting for serial data...");
    displayStatus();
}

// ================= MAIN LOOP =================
void loop() {
    unsigned long now = millis();
    
    // Read sensors at intervals
    if (now - lastDHTRead >= DHT_READ_INTERVAL) {
        readSensors();
        lastDHTRead = now;
    }
    
    // Check rain sensor
    if (now - lastRainCheck >= RAIN_CHECK_INTERVAL) {
        checkRainSensor();
        lastRainCheck = now;
    }
    
    // Handle incoming serial data from Nano
    handleSerialData();
    
    // Handle alert buzzer pattern
    handleBuzzerAlert();
    
    // Sync to cloud periodically
    if (now - lastCloudSync >= CLOUD_SYNC_INTERVAL_MS) {
        syncToCloud();
        lastCloudSync = now;
    }
    
    // Update display
    displayStatus();
    
    delay(50);  // Small delay to prevent watchdog trigger
}

// ================= WIFI & TIME SETUP =================
void setupWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi failed. Continuing offline...");
    }
}

void setupTime() {
    // Configure time with NTP
    configTime(GMT_OFFSET, DST_OFFSET, NTP_SERVER);
    Serial.println("Waiting for NTP time sync...");
    time_t now = time(nullptr);
    int attempts = 0;
    while (now < 24 * 3600 && attempts < 20) {
        delay(500);
        Serial.print(".");
        now = time(nullptr);
        attempts++;
    }
    Serial.println();
    Serial.print("NTP time set: ");
    Serial.println(ctime(&now));
}

void setupSerial() {
    serialToNano.begin(UART_BAUD_RATE);
    Serial.println("UART initialized at 115200 baud");
}

// ================= SENSOR READING =================
void readSensors() {
    // Read DHT22
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    
    if (!isnan(h) && !isnan(t)) {
        currentSensorData.temperature = t;
        currentSensorData.humidity = h;
        currentSensorData.timestamp = millis();
        
        Serial.print("DHT - Temp: ");
        Serial.print(t);
        Serial.print("°C, Humidity: ");
        Serial.print(h);
        Serial.println("%");
    } else {
        Serial.println("DHT read failed!");
    }
}

void checkRainSensor() {
    int rainAnalog = analogRead(RAIN_SENSOR_ANALOG_PIN);
    currentSensorData.rainIntensity = rainAnalog;
    currentSensorData.isRaining = (rainAnalog < RAIN_INTENSITY_THRESHOLD);
    
    if (currentSensorData.isRaining) {
        Serial.println("Rain detected!");
    }
}

// ================= SERIAL COMMUNICATION WITH NANO =================
void handleSerialData() {
    if (serialToNano.available()) {
        // Read incoming JSON from Nano 33 BLE
        String jsonString = serialToNano.readStringUntil('\n');
        
        if (jsonString.length() > 0) {
            Serial.print("Received from Nano: ");
            Serial.println(jsonString);
            
            // Parse JSON
            DynamicJsonDocument doc(256);
            DeserializationError error = deserializeJson(doc, jsonString);
            
            if (!error) {
                // Extract classification result
                if (doc.containsKey("class") && doc.containsKey("confidence")) {
                    lastClassification.className = doc["class"].as<String>();
                    lastClassification.confidence = doc["confidence"].as<float>();
                    
                    Serial.print("Classification: ");
                    Serial.print(lastClassification.className);
                    Serial.print(" (");
                    Serial.print(lastClassification.confidence);
                    Serial.println(")");
                    
                    // Check if classification exceeds threshold and matches a disease
                    if (lastClassification.confidence >= ALERT_THRESHOLD) {
                        for (int i = 0; i < sizeof(profiles) / sizeof(profiles[0]); i++) {
                            if (lastClassification.className == profiles[i].name) {
                                lastClassification.classIndex = i;
                                // Check environmental conditions match disease profile
                                if (currentSensorData.temperature >= profiles[i].minTemp &&
                                    currentSensorData.temperature <= profiles[i].maxTemp &&
                                    currentSensorData.humidity >= profiles[i].humidityThreshold) {
                                    triggerAlert(profiles[i]);
                                }
                                break;
                            }
                        }
                    }
                }
            } else {
                Serial.print("JSON parse error: ");
                Serial.println(error.c_str());
            }
        }
    }
}

// ================= ALERT HANDLING =================
void triggerAlert(const DiseaseProfile& profile) {
    alertActive = true;
    alertStartTime = millis();
    alertBuzzerPattern = 0;
    
    Serial.println("ALERT TRIGGERED!");
    Serial.print("Disease: ");
    Serial.println(profile.name);
    
    // Send alert to backend
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = String(API_BASE_URL) + "/api/alerts";
        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        
        DynamicJsonDocument alertDoc(512);
        alertDoc["device_id"] = DEVICE_ID;
        alertDoc["disease_name"] = profile.name;
        alertDoc["confidence"] = lastClassification.confidence;
        alertDoc["temperature"] = currentSensorData.temperature;
        alertDoc["humidity"] = currentSensorData.humidity;
        alertDoc["is_raining"] = currentSensorData.isRaining;
        alertDoc["action_en"] = profile.targetedActionEn;
        alertDoc["action_am"] = profile.targetedActionAm;
        
        String jsonString;
        serializeJson(alertDoc, jsonString);
        
        int httpCode = http.POST(jsonString);
        Serial.print("Alert POST response: ");
        Serial.println(httpCode);
        
        http.end();
    }
}

void handleBuzzerAlert() {
    if (alertActive) {
        unsigned long alertDuration = millis() - alertStartTime;
        
        if (alertDuration < ALERT_DURATION_MS) {
            // Buzzer pattern: 3 short beeps
            int patternPhase = (alertDuration % 600) / 100;
            if (patternPhase < 3) {
                digitalWrite(BUZZER_PIN, HIGH);
            } else {
                digitalWrite(BUZZER_PIN, LOW);
            }
        } else {
            alertActive = false;
            digitalWrite(BUZZER_PIN, LOW);
        }
    }
}

// ================= CLOUD SYNC =================
void syncToCloud() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        String url = String(API_BASE_URL) + "/api/sensor-data";
        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        
        DynamicJsonDocument doc(256);
        doc["device_id"] = DEVICE_ID;
        doc["temperature"] = currentSensorData.temperature;
        doc["humidity"] = currentSensorData.humidity;
        doc["rain_intensity"] = currentSensorData.rainIntensity;
        doc["is_raining"] = currentSensorData.isRaining;
        doc["last_disease"] = lastClassification.className;
        doc["confidence"] = lastClassification.confidence;
        
        String jsonString;
        serializeJson(doc, jsonString);
        
        int httpCode = http.POST(jsonString);
        Serial.print("Cloud sync response: ");
        Serial.println(httpCode);
        
        http.end();
    }
}

// ================= DISPLAY =================
void displayStatus() {
    if (alertActive) {
        displayAlert();
    } else {
        char line1[17];
        snprintf(line1, sizeof(line1), "T:%2.1fC H:%2.0f%%", currentSensorData.temperature, currentSensorData.humidity);

        String disease = lastClassification.className.length() ? lastClassification.className : "None";
        String line2Text = (currentSensorData.isRaining ? "Rain " : "") + disease;
        if (line2Text.length() > LCD_COLUMNS) {
            line2Text = line2Text.substring(0, LCD_COLUMNS);
        }

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print(line1);
        lcd.setCursor(0, 1);
        lcd.print(line2Text);
    }
}

void displayAlert() {
    String line1 = "ALERT " + lastClassification.className;
    if (line1.length() > LCD_COLUMNS) {
        line1 = line1.substring(0, LCD_COLUMNS);
    }

    String line2 = "Check app action";
    if (lastClassification.classIndex >= 0) {
        const DiseaseProfile& profile = profiles[lastClassification.classIndex];
        line2 = profile.name;
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
