#include <Arduino.h>
#include <ArduinoBLE.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "Config.h"

// OLED Display Configuration
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Variables to store received data
char lastClassification[32] = "Unknown";
float lastTemperature = 0.0;
float lastHumidity = 0.0;
bool alertActive = false;
String recommendation = "Monitoring...";
unsigned long lastAlertTime = 0;

void updateDisplay();
void processClassification(const char* classification);
void sendDataToCloud(const char* classification, float temperature, float humidity);

void setup() {
  Serial.begin(115200);

  // Initialize Buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // Initialize OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("OLED initialization failed!");
    while (1);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("ESP32 Gateway");
  display.println("Initializing...");
  display.display();

  // Initialize Wi-Fi
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int wifi_timeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifi_timeout < 20) {
    delay(500);
    Serial.print(".");
    wifi_timeout++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi Connected!");
    display.println("Wi-Fi Connected");
  } else {
    Serial.println("\nWi-Fi Failed");
    display.println("Wi-Fi Failed");
  }
  display.display();
  delay(1000);

  // Initialize BLE
  if (!BLE.begin()) {
    Serial.println("BLE initialization failed!");
    while (1);
  }
  
  Serial.println("BLE Central initialized. Scanning...");
  BLE.scanForUuid("19B10000-E8F2-537E-4F6C-D104768A1214");
}

void loop() {
  BLEDevice peripheral = BLE.available();

  if (peripheral) {
    if (peripheral.localName() == "MangoHealthMonitor") {
      Serial.print("Found Nano: ");
      Serial.println(peripheral.address());
      BLE.stopScan();

      if (peripheral.connect()) {
        Serial.println("Connected to Nano");
        
        if (peripheral.discoverAttributes()) {
          Serial.println("Attributes discovered");
          
          BLECharacteristic classificationChar = peripheral.characteristic("19B10001-E8F2-537E-4F6C-D104768A1214");
          BLECharacteristic temperatureChar = peripheral.characteristic("19B10002-E8F2-537E-4F6C-D104768A1214");
          BLECharacteristic humidityChar = peripheral.characteristic("19B10003-E8F2-537E-4F6C-D104768A1214");
          
          if (classificationChar && temperatureChar && humidityChar) {
            classificationChar.subscribe();
            temperatureChar.subscribe();
            humidityChar.subscribe();
            
            while (peripheral.connected()) {
              bool newData = false;
              
              if (classificationChar.valueUpdated()) {
                 int len = classificationChar.valueLength();
                 if (len > 0) {
                    // Assuming string is coming in
                    memset(lastClassification, 0, sizeof(lastClassification));
                    classificationChar.readValue(lastClassification, min((int)sizeof(lastClassification)-1, len));
                    Serial.print("Class: ");
                    Serial.println(lastClassification);
                    newData = true;
                    processClassification(lastClassification);
                 }
              }
              
              if (temperatureChar.valueUpdated()) {
                 float temp;
                 temperatureChar.readValue(&temp, sizeof(temp));
                 lastTemperature = temp;
                 Serial.print("Temp: ");
                 Serial.println(lastTemperature);
              }
              
              if (humidityChar.valueUpdated()) {
                 float hum;
                 humidityChar.readValue(&hum, sizeof(hum));
                 lastHumidity = hum;
                 Serial.print("Humidity: ");
                 Serial.println(lastHumidity);
              }

              // Handle Alert Logic
              if (alertActive) {
                if (millis() - lastAlertTime < ALERT_DURATION_MS) {
                    digitalWrite(BUZZER_PIN, HIGH);
                } else {
                    digitalWrite(BUZZER_PIN, LOW);
                    alertActive = false; // Auto reset alert status after buzzer separates
                }
              } else {
                digitalWrite(BUZZER_PIN, LOW);
              }
              
              updateDisplay();
              
              if (newData && WiFi.status() == WL_CONNECTED) {
                sendDataToCloud(lastClassification, lastTemperature, lastHumidity);
              }
              
              delay(10); // Small delay
            }
          }
        }
        peripheral.disconnect();
        Serial.println("Disconnected");
      }
      
      Serial.println("Scanning...");
      BLE.scanForUuid("19B10000-E8F2-537E-4F6C-D104768A1214");
    }
  }
}

void processClassification(const char* classification) {
    if (strcmp(classification, "Anthracnose") == 0) {
        recommendation = "Trim affected branches";
        alertActive = true;
        lastAlertTime = millis();
    } else if (strcmp(classification, "Powdery Mildew") == 0) {
        recommendation = "Apply fungicide";
        alertActive = true;
        lastAlertTime = millis();
    } else if (strcmp(classification, "Healthy") == 0) {
        recommendation = "Plant is healthy";
        alertActive = false;
    } else {
        recommendation = "Analyzing...";
        alertActive = false;
    }
}

void updateDisplay() {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.print("Status: ");
  display.println(WiFi.status() == WL_CONNECTED ? "Online" : "Offline");
  
  display.drawLine(0, 8, 128, 8, SSD1306_WHITE);
  
  display.setCursor(0, 10);
  display.print("Class: ");
  display.println(lastClassification);
  
  display.print("Temp: ");
  display.print(lastTemperature, 1);
  display.print("C  Hum: ");
  display.print(lastHumidity, 0);
  display.println("%");
  
  display.drawLine(0, 35, 128, 35, SSD1306_WHITE);
  
  display.setCursor(0, 37);
  // Wrap text for recommendation if needed
  display.println(recommendation);
  
  display.display();
}

void sendDataToCloud(const char* classification, float temperature, float humidity) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    
    // Simple JSON construction
    String json = "{";
    json += "\"classification\":\"" + String(classification) + "\",";
    json += "\"temperature\":" + String(temperature) + ",";
    json += "\"humidity\":" + String(humidity);
    json += "}";
    
    int httpResponseCode = http.POST(json);
    
    if (httpResponseCode > 0) {
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
    } else {
        Serial.print("Error code: ");
        Serial.println(httpResponseCode);
    }
    
    http.end();
}
