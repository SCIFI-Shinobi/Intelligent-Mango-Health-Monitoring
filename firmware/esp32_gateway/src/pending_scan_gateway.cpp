#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <NimBLEDevice.h>
#include <DHT.h>

#include "Config.h"

static const uint8_t DHT_PIN = 4;
static const uint8_t DHT_SENSOR_TYPE = DHT22;
static const unsigned long RESULT_TIMEOUT_MS = 30000;

static DHT dht(DHT_PIN, DHT_SENSOR_TYPE);

static NimBLEClient* nanoClient = nullptr;
static NimBLERemoteCharacteristic* nanoResultCharacteristic = nullptr;
static NimBLERemoteCharacteristic* nanoCommandCharacteristic = nullptr;

static String latestNanoPayload = "";
static volatile bool nanoPayloadUpdated = false;
static unsigned long lastScanPollMs = 0;


String jsonEscape(const String& value) {
    String escaped;
    escaped.reserve(value.length() + 8);
    for (size_t i = 0; i < value.length(); ++i) {
        const char c = value[i];
        if (c == '"') {
            escaped += "\\\"";
        } else if (c == '\\') {
            escaped += "\\\\";
        } else {
            escaped += c;
        }
    }
    return escaped;
}


void nanoResultNotifyCallback(
    NimBLERemoteCharacteristic* remoteCharacteristic,
    uint8_t* data,
    size_t length,
    bool isNotify
) {
    (void)remoteCharacteristic;
    (void)isNotify;

    latestNanoPayload = "";
    latestNanoPayload.reserve(length);
    for (size_t i = 0; i < length; ++i) {
        latestNanoPayload += static_cast<char>(data[i]);
    }
    nanoPayloadUpdated = true;
    Serial.printf("[BLE] Nano result update: %s\n", latestNanoPayload.c_str());
}


bool connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) {
        return true;
    }

    Serial.printf("[WiFi] Connecting to %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    for (int attempt = 0; attempt < 40; ++attempt) {
        if (WiFi.status() == WL_CONNECTED) {
            Serial.printf("[WiFi] Connected. IP=%s\n", WiFi.localIP().toString().c_str());
            return true;
        }
        delay(500);
        Serial.print('.');
    }
    Serial.println();
    Serial.println("[WiFi] Connection failed");
    return false;
}


bool beginSecureRequest(HTTPClient& http, WiFiClientSecure& client, const char* url) {
    client.setInsecure();
    return http.begin(client, url);
}


bool readEnvironment(float& temperature, float& humidity) {
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    if (!isnan(temperature) && !isnan(humidity)) {
        return true;
    }

    temperature = 25.0f;
    humidity = 70.0f;
    Serial.println("[DHT] Read failed, using fallback values");
    return false;
}


bool parsePendingRequestId(const String& responseBody, int& requestId) {
    String compactResponse;
    compactResponse.reserve(responseBody.length());
    for (size_t i = 0; i < responseBody.length(); ++i) {
        const char c = responseBody[i];
        if (c != ' ' && c != '\n' && c != '\r' && c != '\t') {
            compactResponse += c;
        }
    }

    if (compactResponse.indexOf("\"pending\":true") == -1) {
        return false;
    }

    const int markerIndex = compactResponse.indexOf("\"request_id\":");
    if (markerIndex == -1) {
        return false;
    }

    String requestFragment = compactResponse.substring(markerIndex + 13);
    const int commaIndex = requestFragment.indexOf(',');
    const int braceIndex = requestFragment.indexOf('}');
    int endIndex = commaIndex;
    if (endIndex == -1 || (braceIndex != -1 && braceIndex < endIndex)) {
        endIndex = braceIndex;
    }
    if (endIndex != -1) {
        requestFragment = requestFragment.substring(0, endIndex);
    }
    requestFragment.trim();
    requestId = requestFragment.toInt();
    return requestId > 0;
}


bool fetchPendingScanCommand(int& requestId) {
    requestId = 0;
    if (!connectWiFi()) {
        return false;
    }

    WiFiClientSecure client;
    HTTPClient http;
    if (!beginSecureRequest(http, client, SCAN_PENDING_URL)) {
        Serial.println("[HTTP] Failed to open /scan/pending");
        return false;
    }

    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    const int statusCode = http.GET();
    const String responseBody = statusCode > 0 ? http.getString() : "";
    http.end();

    if (statusCode != 200) {
        Serial.printf("[HTTP] /scan/pending returned %d\n", statusCode);
        return false;
    }

    return parsePendingRequestId(responseBody, requestId);
}


void resetNanoConnection() {
    nanoResultCharacteristic = nullptr;
    nanoCommandCharacteristic = nullptr;

    if (nanoClient != nullptr) {
        if (nanoClient->isConnected()) {
            nanoClient->disconnect();
        }
        NimBLEDevice::deleteClient(nanoClient);
        nanoClient = nullptr;
    }
}


bool ensureNanoConnection() {
    if (nanoClient != nullptr &&
        nanoClient->isConnected() &&
        nanoResultCharacteristic != nullptr &&
        nanoCommandCharacteristic != nullptr) {
        return true;
    }

    resetNanoConnection();

    NimBLEScan* scan = NimBLEDevice::getScan();
    scan->setActiveScan(true);
    scan->clearResults();

    NimBLEScanResults results = scan->start(5, false);
    for (int i = 0; i < results.getCount(); ++i) {
        NimBLEAdvertisedDevice* device = results.getDevice(i);
        if (device == nullptr) {
            continue;
        }

        const bool matchesName = device->getName() == NANO_DEVICE_NAME;
        const bool matchesService = device->isAdvertisingService(NimBLEUUID(NANO_SERVICE_UUID));
        if (!matchesName && !matchesService) {
            continue;
        }

        Serial.printf("[BLE] Connecting to %s\n", device->getName().c_str());
        nanoClient = NimBLEDevice::createClient();
        if (!nanoClient->connect(device)) {
            Serial.println("[BLE] Nano connection failed");
            resetNanoConnection();
            return false;
        }

        NimBLERemoteService* service = nanoClient->getService(NANO_SERVICE_UUID);
        if (service == nullptr) {
            Serial.println("[BLE] Nano service missing");
            resetNanoConnection();
            return false;
        }

        nanoResultCharacteristic = service->getCharacteristic(NANO_RESULT_CHAR_UUID);
        nanoCommandCharacteristic = service->getCharacteristic(NANO_COMMAND_CHAR_UUID);
        if (nanoResultCharacteristic == nullptr || nanoCommandCharacteristic == nullptr) {
            Serial.println("[BLE] Nano characteristics missing");
            resetNanoConnection();
            return false;
        }

        if (nanoResultCharacteristic->canNotify()) {
            nanoResultCharacteristic->subscribe(true, nanoResultNotifyCallback);
        }

        Serial.println("[BLE] Nano connected and ready");
        return true;
    }

    Serial.println("[BLE] Nano33-Classifier not found");
    return false;
}


bool parseNanoInference(const String& payload, String& diseaseType, float& confidenceScore) {
    String trimmedPayload = payload;
    trimmedPayload.trim();

    if (trimmedPayload.length() == 0 ||
        trimmedPayload.startsWith("waiting") ||
        trimmedPayload.startsWith("pending")) {
        return false;
    }

    const int commaIndex = trimmedPayload.indexOf(',');
    if (commaIndex <= 0) {
        return false;
    }

    diseaseType = trimmedPayload.substring(0, commaIndex);
    diseaseType.trim();
    confidenceScore = trimmedPayload.substring(commaIndex + 1).toFloat();
    return diseaseType.length() > 0;
}


bool waitForNanoInference(String& diseaseType, float& confidenceScore) {
    const unsigned long startMs = millis();
    while (millis() - startMs < RESULT_TIMEOUT_MS) {
        if (nanoPayloadUpdated) {
            nanoPayloadUpdated = false;
            if (parseNanoInference(latestNanoPayload, diseaseType, confidenceScore)) {
                return true;
            }
        }

        if (nanoClient == nullptr || !nanoClient->isConnected()) {
            Serial.println("[BLE] Nano disconnected while waiting for result");
            resetNanoConnection();
            return false;
        }

        delay(50);
    }

    Serial.println("[BLE] Timed out waiting for Nano inference result");
    return false;
}


bool uploadInferenceResult(
    int requestId,
    const String& diseaseType,
    float confidenceScore,
    float temperature,
    float humidity
) {
    if (!connectWiFi()) {
        return false;
    }

    WiFiClientSecure client;
    HTTPClient http;
    if (!beginSecureRequest(http, client, TEST_SERVER_URL)) {
        Serial.println("[HTTP] Failed to open upload endpoint");
        return false;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);

    String payload = "{";
    payload += "\"device_id\":\"" + jsonEscape(String(DEVICE_ID)) + "\",";
    payload += "\"temperature\":" + String(temperature, 2) + ",";
    payload += "\"humidity\":" + String(humidity, 2) + ",";
    payload += "\"disease_type\":\"" + jsonEscape(diseaseType) + "\",";
    payload += "\"confidence_score\":" + String(confidenceScore, 5) + ",";
    payload += "\"request_id\":" + String(requestId);
    payload += "}";

    const int statusCode = http.POST(payload);
    const String responseBody = statusCode > 0 ? http.getString() : "";
    http.end();

    if (statusCode >= 200 && statusCode < 300) {
        Serial.printf("[HTTP] Upload ok (%d): %s\n", statusCode, responseBody.c_str());
        return true;
    }

    Serial.printf("[HTTP] Upload failed (%d): %s\n", statusCode, responseBody.c_str());
    return false;
}


bool triggerOnDemandNanoScan(int requestId) {
    if (!ensureNanoConnection()) {
        return false;
    }

    latestNanoPayload = "";
    nanoPayloadUpdated = false;

    const std::string command = "scan";
    if (!nanoCommandCharacteristic->writeValue(command, true)) {
        Serial.println("[BLE] Failed to send scan command to Nano");
        resetNanoConnection();
        return false;
    }

    Serial.printf("[BLE] Triggered Nano scan for request_id=%d\n", requestId);

    String diseaseType;
    float confidenceScore = 0.0f;
    if (!waitForNanoInference(diseaseType, confidenceScore)) {
        return false;
    }

    float temperature = 0.0f;
    float humidity = 0.0f;
    readEnvironment(temperature, humidity);

    return uploadInferenceResult(
        requestId,
        diseaseType,
        confidenceScore,
        temperature,
        humidity
    );
}


void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n[ESP32] Pending scan gateway starting");
    dht.begin();
    connectWiFi();
    NimBLEDevice::init("ESP32-Pending-Scan-Gateway");
}


void loop() {
    const unsigned long now = millis();
    if (now - lastScanPollMs < SCAN_POLL_INTERVAL_MS) {
        delay(50);
        return;
    }
    lastScanPollMs = now;

    int requestId = 0;
    if (!fetchPendingScanCommand(requestId)) {
        return;
    }

    Serial.printf("[SCAN] Pending request received: %d\n", requestId);
    const bool uploadOk = triggerOnDemandNanoScan(requestId);
    if (!uploadOk) {
        Serial.printf("[SCAN] Request %d did not complete successfully\n", requestId);
    }
}
