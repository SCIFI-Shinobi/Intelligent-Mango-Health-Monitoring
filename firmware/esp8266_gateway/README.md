# ESP8266 Gateway - UART Serial Communication

## Overview
This is the firmware for the ESP8266-based gateway. It communicates with the Nano 33 BLE edge AI device via **UART serial connection** (no BLE capability on ESP8266).

Features:
- Serial (UART) communication with Nano 33 BLE
- WiFi connectivity for cloud sync
- DHT22 temperature/humidity sensor
- Rain sensor integration
- 16x2 I2C LCD display
- Buzzer alert system
- JSON-based serial protocol

## Hardware Requirements
- ESP8266 (NodeMCU v2 or similar)
- DHT22 temperature/humidity sensor
- 16x2 I2C LCD display (PCF8574 backpack)
- FC-37 / YL-83 rain sensor
- Active buzzer
- 3.3V power supply

## Wiring

### ESP8266 Pinout (D0-D8 = GPIO mapping)
- **D0 (GPIO16)**: Buzzer
- **D1 (GPIO5)**: I2C SCL (LCD)
- **D2 (GPIO4)**: I2C SDA (LCD)
- **D4 (GPIO2)**: DHT22 data
- **D5 (GPIO14)**: UART RX (from Nano 33 BLE TX)
- **D6 (GPIO12)**: UART TX (to Nano 33 BLE RX)
- **A0**: Rain sensor analog input

### UART Connection to Nano 33 BLE
```
ESP8266 D5 (RX) ←→ Nano 33 BLE TX (Serial1)
ESP8266 D6 (TX) ←→ Nano 33 BLE RX (Serial1)
ESP8266 GND ←→ Nano 33 BLE GND (Common ground)
```

## Installation

### 1. Install PlatformIO CLI
```bash
pip install platformio
```

### 2. Build & Upload
```bash
cd firmware/esp8266_gateway
pio run -e nodemcuv2 -t upload
```

### 3. Monitor Serial Output
```bash
pio device monitor -b 115200
```

## Configuration

Edit `src/Config.h`:
```cpp
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"
#define API_BASE_URL "http://your-backend-api.com"
```

## Communication Protocol

### Data from Nano 33 BLE (JSON over UART)
```json
{
  "class": "Anthracnose",
  "confidence": 0.85
}
```

### Sensor Data Sent to Backend
```json
{
  "device_id": "esp8266_gateway_001",
  "temperature": 25.5,
  "humidity": 65.2,
  "rain_intensity": 256,
  "is_raining": false,
  "last_disease": "Anthracnose",
  "confidence": 0.85
}
```

### Alert Data Format
```json
{
  "device_id": "esp8266_gateway_001",
  "disease_name": "Anthracnose",
  "confidence": 0.85,
  "temperature": 25.5,
  "humidity": 65.2,
  "is_raining": false,
  "action_en": "Spray with copper-based fungicide...",
  "action_am": "ፈንገስ ማጥፊያ..."
}
```

## Troubleshooting

### Serial Communication Issues
- Check baud rate: 115200 on both devices
- Verify wiring, especially RX/TX swap
- Monitor serial output: `pio device monitor`

### WiFi Issues
- Verify SSID and password in Config.h
- Check if using correct frequency (2.4GHz only)
- Check available logs for connection failures

### DHT Sensor
- Try different GPIO pin if not reading
- Ensure 1kΩ pull-up resistor on data line

### LCD Display
- Check I2C address (default: 0x27)
- Use `i2cdetect` command to scan I2C bus
- Verify SDA/SCL connections

## Dependencies (in platformio.ini)
- LiquidCrystal_I2C (16x2 I2C LCD)
- DHT sensor library
- ArduinoJson (JSON handling)
- Built-in: WiFi, HTTP client

## Performance Notes
- Slower than ESP32 (~160MHz vs 240MHz)
- Limited RAM (80KB vs 520KB on ESP32)
- Good for simple IoT applications with serial communication
- 10-15 second cloud sync interval recommended

## Development Tips
- Use `pio run -t clean` before rebuilding if issues occur
- Comment out WiFi code temporarily to test local serial communication
- Use mock JSON data in Serial monitor to test parsing
