<div align="center">

# Intelligent Mango Health Monitoring
### *Edge AI for Resilient Mango Agriculture in Ethiopia*

<p>
  <img src="https://img.shields.io/badge/TinyML-Edge%20Impulse-6A32C9?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Nano%2033%20BLE-00979D?style=for-the-badge&logo=arduino&logoColor=white" />
  <img src="https://img.shields.io/badge/Gateway-ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

<p>
  <a href="https://mango-guard.vercel.app/">Live Demo</a>
</p>

> An end-to-end smart agriculture system that detects mango leaf diseases in the field, evaluates environmental risk, generates a 5-day forecast, and serves a bilingual real-time dashboard for monitoring and decision support.

</div>

---

## Overview

This project combines embedded AI, environmental sensing, and a full-stack dashboard into one field-ready monitoring system for mango disease management.

It is designed to:

- detect **Anthracnose**, **Powdery Mildew**, and **Healthy** leaf states on-device
- monitor **temperature**, **humidity**, and precipitation context from the gateway
- evaluate disease risk using agronomic thresholds
- produce a **5-day forecast** for disease risk trends
- deliver results to a bilingual **English / Amharic** dashboard

---

## System Architecture

```text
+------------------------+      BLE Wireless      +----------------------+
| Arduino Nano 33 BLE    | ---------------------> | ESP32 Gateway        |
| + OV7675 Camera        |                        | + DHT22 Sensor       |
| + TinyML Inference     |                        | + Risk Engine        |
| + Disease Detection    |                        | + Forecasting        |
+------------------------+                        | + Local Alerts       |
                                                  +----------+-----------+
                                                             |
                                                             | Wi-Fi
                                                  +----------v-----------+
                                                  | FastAPI Backend      |
                                                  | PostgreSQL + JWT     |
                                                  | REST API + WebSocket |
                                                  +----------+-----------+
                                                             |
                                                  +----------v-----------+
                                                  | React Dashboard      |
                                                  | Real-time + Bilingual|
                                                  +----------------------+
```

### Data Flow

| Step | Component | Action |
| :---: | :--- | :--- |
| 1 | **Nano 33 BLE Sense** | Captures mango leaf image with camera |
| 2 | **Nano 33 BLE Sense** | Runs quantized MobileNetV1 inference on-device |
| 3 | **Nano 33 BLE Sense** | Sends disease label and confidence over BLE |
| 4 | **ESP32 Gateway** | Receives inference result and reads sensor data |
| 5 | **ESP32 Gateway** | Applies threshold-based disease risk logic |
| 6 | **ESP32 Gateway** | Generates 5-day disease risk forecast |
| 7 | **Backend** | Stores data, notifications, forecast history, and recommendations |
| 8 | **Dashboard** | Displays live readings, alerts, trends, and recommendations |

---

## Key Features

### On-Device TinyML Inference

- Runs a **quantized MobileNetV1** model directly on the Arduino Nano 33 BLE Sense
- No cloud dependency for disease classification
- Supports **Anthracnose**, **Powdery Mildew**, and **Healthy** classes

### BLE-Based Device Communication

- The Nano acts as the field inference node
- The ESP32 acts as the gateway and BLE central
- No wired connection is needed between the boards

### Expert-Backed Risk Evaluation

The risk engine combines inference results with environmental conditions:

| Disease | High-Risk Condition | Result |
| :--- | :--- | :--- |
| **Anthracnose** | 24-30 C and humidity above 80% | HIGH RISK |
| **Powdery Mildew** | 10-31 C and humidity above 80% | HIGH RISK |
| Disease detected but conditions not met | Disease present in weaker conditions | MEDIUM RISK |
| Healthy | No disease detected | LOW RISK |

### 5-Day Forecasting

- Forecast output is generated from gateway-side disease and environmental context
- Results are stored in the backend and surfaced in the dashboard
- Forecast cards help the farmer see short-term disease risk trends

### Dashboard Experience

- real-time sensor monitoring
- disease status with confidence score
- history and trend charts
- bilingual recommendations in **English** and **Amharic**
- notification feed and device management
- responsive layout for desktop and mobile use

---

## Hardware

| Component | Role | Notes |
| :--- | :--- | :--- |
| **Arduino Nano 33 BLE Sense** | TinyML inference + BLE peripheral | Main field inference board |
| **OV7675 Camera** | Leaf image capture | Connected to Nano |
| **ESP32** | Gateway, BLE central, Wi-Fi uplink, forecasting | Main bridge device |
| **DHT22** | Temperature and humidity sensing | Used by gateway |
| **OLED / LCD Display** | Local device feedback | Shows status and alerts |
| **Buzzer** | High-risk alerting | Triggered during urgent conditions |

---

## Repository Structure

```text
Intelligent-Mango-Health-Monitoring/
├── firmware/
│   ├── nano33ble_edge_ai/
│   │   ├── src/
│   │   ├── lib/
│   │   └── platformio.ini
│   └── esp32_gateway/
│       ├── src/
│       ├── lib/
│       └── platformio.ini
├── backend/
│   ├── app/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── seed.py
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
├── dataset/
│   ├── bahir_dar_mango_dataset_numeric.csv
│   ├── aug.py
│   └── weather_data.py
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### 1. Firmware

Configure `firmware/esp32_gateway/src/Config.h`:

```cpp
#define WIFI_SSID "your_wifi_name"
#define WIFI_PASSWORD "your_wifi_password"
#define API_BASE_URL "https://your-backend.example.com"
#define API_INGEST_PATH "/data/ingest"
#define DEVICE_API_KEY "mg_your_api_key_here"
#define DEVICE_ID "esp32_gateway_001"
```

Flash both boards:

```bash
cd firmware/nano33ble_edge_ai
pio run --target upload

cd ../esp32_gateway
pio run --target upload
```

### 2. Backend

Run with Docker:

```bash
docker-compose up -d
```

If the Docker build times out while downloading Python packages, pre-download the
entire Python 3.11 wheel set first:

```bash
./backend/download_wheels.sh
docker compose up --build
```

This uses a temporary `python:3.11-slim` container to download all wheels into
`backend/wheelhouse/`, then marks the folder as complete so the real backend
image can install fully offline.

If you only want to pre-download a few packages, Docker will still prefer any
files you place in `backend/wheelhouse/` before falling back to PyPI.

Example for TensorFlow only:

```bash
mkdir -p backend/wheelhouse
python3 -m pip download \
  --no-deps \
  --only-binary=:all: \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 311 \
  --abi cp311 \
  --dest backend/wheelhouse \
  tensorflow-cpu==2.18.0
```

Or run locally:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Optional seed:

```bash
python seed.py
```

Backend URLs:

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Create `frontend/.env`:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

Frontend URL:

- Dashboard: `http://localhost:3000`

---

## API Reference

### Authentication

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/login` | POST | Login and return JWT |
| `/register` | POST | Register a new user |
| `/me` | GET | Current user profile |
| `/profile` | PUT | Update profile |

### Sensor and Detection

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/sensors/latest` | GET | Latest sensor snapshot |
| `/history` | GET | Historical sensor and detection data |
| `/detection/latest` | GET | Latest disease detection |
| `/detection/history` | GET | Paginated detection history |

### Forecast and Recommendations

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/forecast/latest` | GET | Latest 5-day forecast |
| `/forecast/context` | POST | Submit forecast context from ESP32 |
| `/recommendations/latest` | GET | Latest bilingual recommendations |

### Notifications and Streaming

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/notifications` | GET | Fetch notifications |
| `/notifications/{id}/read` | POST | Mark notification as read |
| `/notifications/read-all` | POST | Mark all notifications as read |
| `/ws` | WebSocket | Real-time updates |

### Ingestion and Health

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/data/ingest` | POST | Combined ESP32 payload |
| `/health` | GET | Backend health check |

---

## Model Summary

### Disease Detection Model

| Metric | Value |
| :--- | :--- |
| Architecture | MobileNetV1 (quantized) |
| Input Size | 160 x 160 |
| Training Images | 11,375 |
| Accuracy | **86.45%** |
| Classes | Anthracnose, Powdery Mildew, Healthy |
| Dataset Source | Woramit Horticultural Research Center, Ethiopia |

### Forecasting

| Metric | Value |
| :--- | :--- |
| Horizon | 5 days |
| Context Inputs | Temperature, humidity, disease status, field conditions |
| Output | Daily disease-risk categories and trend indicators |

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| TinyML Inference | Edge Impulse, TensorFlow Lite Micro |
| Firmware | PlatformIO, Arduino Framework, NimBLE |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, JWT |
| Frontend | React, Chart.js, Context API |
| Real-Time Transport | WebSocket |
| Deployment | Docker, Docker Compose |

---

<div align="center">

*Built to bridge the gap between AI and smallholder agriculture in Ethiopia.*

</div>
