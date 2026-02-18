<div align="center">

# 🌿 Intelligent Plant Health Monitoring
### *Edge AI for Resilient Mango Agriculture in Ethiopia*

<p>
  <img src="https://img.shields.io/badge/TinyML-Edge%20Impulse-6A32C9?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Nano%2033%20BLE-00979D?style=for-the-badge&logo=arduino&logoColor=white" />
  <img src="https://img.shields.io/badge/Gateway-ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Containerized-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

> An end-to-end TinyML system that detects mango leaf diseases in the field, evaluates outbreak risk using expert agronomic thresholds, and syncs diagnostics to a cloud dashboard — all without an internet connection at the point of sensing.

</div>

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIELD DEVICE                             │
│                                                                 │
│  ┌──────────────────────┐   BLE Wireless   ┌─────────────────┐ │
│  │  Arduino Nano 33 BLE │ ───────────────► │     ESP32       │ │
│  │                      │  "Anthracnose,   │                 │ │
│  │  📷 Camera (OV7675)  │   0.92"          │  🌡️ DHT22       │ │
│  │  🧠 TinyML Model     │                  │  📊 Risk Engine │ │
│  │  (MobileNetV1)       │                  │  📟 OLED + 🔔   │ │
│  └──────────────────────┘                  └────────┬────────┘ │
└───────────────────────────────────────────────────── │ ─────────┘
                                                       │ Wi-Fi
                                              ┌────────▼────────┐
                                              │  FastAPI Backend │
                                              │  + PostgreSQL DB │
                                              └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │  Web Dashboard  │
                                              │  (Frontend)     │
                                              └─────────────────┘
```

### How It Works

| Step | Component | Action |
| :---: | :--- | :--- |
| 1 | **Nano 33 BLE** | Captures leaf image with OV7675 camera |
| 2 | **Nano 33 BLE** | Runs quantized MobileNetV1 TinyML model on-device |
| 3 | **Nano 33 BLE** | Advertises result via BLE: `"Anthracnose,0.92"` |
| 4 | **ESP32** | Receives BLE notification wirelessly (no wires!) |
| 5 | **ESP32** | Reads local DHT22 for temperature & humidity |
| 6 | **ESP32** | Evaluates disease risk using expert agronomic thresholds |
| 7 | **ESP32** | Shows result on OLED, sounds buzzer if HIGH RISK |
| 8 | **ESP32** | POSTs data to FastAPI backend over Wi-Fi |
| 9 | **Backend** | Stores data, re-evaluates risk, serves dashboard |

---

## ✨ Key Features

### 🧠 On-Device TinyML Inference
- Runs a **quantized MobileNetV1** model directly on the Arduino Nano 33 BLE Sense — no cloud needed for inference.
- Trained on **5,210 high-resolution images** from the *Woramit Horticultural Research Center*, Ethiopia.
- Detects **Anthracnose**, **Powdery Mildew**, and **Healthy** leaf states.

### 📡 Wireless BLE Communication
- The Nano advertises its classification result as a BLE characteristic.
- The ESP32 acts as BLE Central, automatically scanning and connecting — **no wires between the two boards**.

### 🌡️ Expert-Backed Risk Engine
The same risk logic runs on both the ESP32 (in real-time) and the FastAPI backend (for historical analysis):

| Disease | High-Risk Condition | Action |
| :--- | :--- | :--- |
| **Anthracnose** | 24°C–30°C **AND** Humidity > 80% | 🔴 HIGH RISK |
| **Powdery Mildew** | 10°C–31°C **AND** Humidity > 80% | 🔴 HIGH RISK |
| Any disease, wrong env | Disease detected, conditions not met | 🟡 MEDIUM RISK |
| Healthy | — | 🟢 LOW RISK |

### 📟 Field-Ready UI
- **OLED Display**: shows Wi-Fi/BLE status, temperature, humidity, AI result, risk level, and recommendation.
- **Buzzer**: pulses when risk is HIGH.
- **Inverted display text** for HIGH RISK to make it unmissable.

### ☁️ Cloud-Connected Backend
- **FastAPI** REST API with PostgreSQL database.
- Fully **Dockerized** — one command to start the entire backend stack.
- Returns `risk_level`, `recommendation`, and `forecast_alert` on every upload.

---

## 🛠️ Hardware

| Component | Role | Pin |
| :--- | :--- | :--- |
| **Arduino Nano 33 BLE Sense** | TinyML inference + BLE Peripheral | — |
| **OV7675 Camera** | Leaf image capture | (built-in on Nano) |
| **ESP32** | BLE Central + Wi-Fi gateway + risk engine | — |
| **DHT22** | Temperature & humidity sensing | GPIO 4 |
| **SSD1306 OLED** | Local display | I2C (GPIO 21/22) |
| **Buzzer** | HIGH RISK alert | GPIO 5 |

---

## 📂 Repository Structure

```
Intelligent-Plant-Health-Monitoring/
├── firmware/
│   ├── nano33ble_edge_ai/        # Arduino Nano: TinyML + BLE Peripheral
│   │   ├── src/
│   │   │   ├── main.cpp          # Inference + BLE advertising
│   │   │   ├── Config.h          # Thresholds & settings
│   │   │   ├── Camera_OV7675.*   # Camera driver
│   │   │   └── Image_Utils.*     # RGB565→RGB888 conversion
│   │   └── platformio.ini
│   │
│   └── esp32_gateway/            # ESP32: BLE Central + sensor hub + gateway
│       ├── src/
│       │   ├── main.cpp          # BLE scan, DHT22, risk engine, OLED, cloud
│       │   └── Config.h          # Pins, Wi-Fi, API URL, thresholds
│       └── platformio.ini
│
├── backend/                      # FastAPI + PostgreSQL
│   ├── app/
│   │   ├── main.py               # API endpoints (/upload, /history)
│   │   ├── logic.py              # Expert risk evaluation logic
│   │   ├── models.py             # SQLAlchemy DB models
│   │   ├── schemas.py            # Pydantic validation schemas
│   │   └── database.py           # DB connection
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                     # Web dashboard (in development)
├── docker-compose.yml
└── README.md
```

---

## 🚀 Getting Started

### 1. Firmware (PlatformIO)

**Configure** `firmware/esp32_gateway/src/Config.h`:
```cpp
#define WIFI_SSID     "your_wifi_name"
#define WIFI_PASSWORD "your_wifi_password"
#define API_URL       "http://<your-server-ip>:8000/upload"
#define DEVICE_ID     "esp32_gateway_001"
```

**Flash both boards:**
```bash
# Flash Nano 33 BLE
cd firmware/nano33ble_edge_ai
pio run --target upload

# Flash ESP32
cd firmware/esp32_gateway
pio run --target upload
```

### 2. Backend (Docker)

```bash
# Copy and configure environment variables
cp backend/.env.example backend/.env

# Start the backend + database
docker-compose up -d
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### 3. API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | GET | Health check |
| `/upload` | POST | Ingest sensor + inference data |
| `/history` | GET | Retrieve historical records (`?limit=100`) |

**Example `/upload` payload:**
```json
{
  "device_id": "esp32_gateway_001",
  "temperature": 26.5,
  "humidity": 85.0,
  "disease_type": "Anthracnose",
  "confidence_score": 0.92
}
```

**Example response:**
```json
{
  "status": "success",
  "risk_level": "HIGH RISK",
  "recommendation": "DANGER: Apply targeted fungicides immediately.",
  "forecast_alert": "High Risk: Conditions are optimal for Anthracnose outbreak."
}
```

---

## 📊 Model Performance

| Metric | Value |
| :--- | :--- |
| Architecture | MobileNetV1 (8-bit quantized) |
| Input size | 160 × 160 px |
| Training images | 5,210 |
| Accuracy | **86.45%** |
| Classes | Anthracnose, Powdery Mildew, Healthy |
| Dataset source | Woramit Horticultural Research Center, Ethiopia |

---

<div align="center">

*Built to bridge the gap between AI and smallholder agriculture.*

</div>
