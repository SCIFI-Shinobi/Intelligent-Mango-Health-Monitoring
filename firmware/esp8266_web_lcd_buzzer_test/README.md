ESP8266 Web + LCD + Buzzer + DHT22 Test

This is a standalone PlatformIO project for testing only:
- Wi-Fi connection
- HTTP request to your demo server
- LCD display
- Buzzer beeps
- DHT22 temperature/humidity reading

No Nano 33 BLE serial communication is used here.

Quick start
1. Open this folder in VS Code:
   firmware/esp8266_web_lcd_buzzer_test
2. Edit src/main.cpp:
   - WIFI_SSID
   - WIFI_PASSWORD
   - TEST_SERVER_URL
3. Build:
   platformio run
4. Upload:
   platformio run -t upload
5. Serial monitor:
   platformio device monitor -b 115200

Networking note
- For local demo server, do not use localhost in TEST_SERVER_URL.
- Use your PC IP (for example 10.161.116.54) and server port.
- Start your server on 0.0.0.0 so ESP8266 can reach it.

Hotspot note
- Internet is not required if ESP8266 only talks to your laptop server on the same hotspot.
- Internet is required only if the URL points to an external website/cloud endpoint.
