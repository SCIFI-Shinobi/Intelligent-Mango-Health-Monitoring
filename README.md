# Intelligent Mango Health Monitoring

Edge AI and IoT for mango disease detection, environmental monitoring, and risk forecasting.

## Overview

This project combines TinyML inference on the field device, environmental sensing on the gateway, and a full-stack monitoring dashboard for mango disease management.

The system is built to:

- detect mango leaf diseases on-device with a quantized MobileNetV1 model
- monitor field temperature, humidity, and precipitation
- evaluate disease risk using agronomic rules
- generate a 5-day forecast using LightGBM and Random Forest Classifier models
- sync results to a bilingual web dashboard in English and Amharic

## System Architecture

```text
Arduino Nano 33 BLE Sense
  -> captures leaf image
  -> runs TinyML disease classification
  -> sends result over BLE

ESP32 Gateway
  -> receives BLE result
  -> reads DHT22 and rainfall context
  -> evaluates disease risk
  -> runs forecasting logic
  -> sends data to backend over Wi-Fi

FastAPI Backend + PostgreSQL
  -> stores sensor, detection, recommendation, and forecast data
  -> exposes REST and WebSocket APIs

React Dashboard
  -> shows live readings, disease status, recommendations, and forecast trends
```

## Data Flow

| Step | Component | Action |
| :-- | :-- | :-- |
| 1 | Nano 33 BLE Sense | Captures mango leaf image |
| 2 | Nano 33 BLE Sense | Runs quantized MobileNetV1 disease inference |
| 3 | Nano 33 BLE Sense | Sends disease label and confidence via BLE |
| 4 | ESP32 Gateway | Receives BLE result and reads environmental sensors |
| 5 | ESP32 Gateway | Applies threshold-based disease risk logic |
| 6 | ESP32 Gateway | Produces 5-day disease-risk forecast |
| 7 | Backend | Stores readings, notifications, recommendations, and forecast history |
| 8 | Frontend | Displays real-time dashboard analytics and alerts |

## Core Features

### On-device disease detection

- Quantized MobileNetV1 runs on the Arduino Nano 33 BLE Sense
- Supports detection of Anthracnose, Powdery Mildew, and Healthy leaf states
- Keeps inference close to the farm with no cloud dependency for classification

### Environmental risk evaluation

The risk engine combines disease output with field conditions:

| Disease | High-risk condition | Result |
| :-- | :-- | :-- |
| Anthracnose | 24-30 C and humidity above 80% | High risk |
| Powdery Mildew | 10-31 C and humidity above 80% | High risk |
| Disease detected but conditions not met | Any disease under weaker conditions | Medium risk |
| Healthy | No disease detected | Low risk |

### Forecasting

- 5-day disease-risk forecasting is documented as using LightGBM and Random Forest Classifier models
- Forecast results are surfaced in the dashboard and stored in the backend
- Forecast context is tied to live sensor and inference data for review and analysis

### Dashboard

- real-time sensor cards for temperature, humidity, and precipitation
- disease status with confidence score and scan timing
- forecast cards and trend visuals
- bilingual recommendations in English and Amharic
- notifications and alert history
- settings page for system preferences and alert thresholds

## Hardware

| Component | Role | Pin / Notes |
| :-- | :-- | :-- |
| Arduino Nano 33 BLE Sense | TinyML inference and BLE peripheral | Main field inference board |
| OV7675 Camera | Leaf image capture | Connected to Nano 33 BLE |
| ESP32 | BLE central, Wi-Fi gateway, risk engine, forecasting | Main gateway board |
| DHT22 | Temperature and humidity sensing | GPIO 4 |
| OLED / LCD display | Local field status display | I2C |
| Buzzer | High-risk alerting | GPIO 5 |

## Repository Structure

```text
Intelligent-Mango-Health-Monitoring/
|-- firmware/
|   |-- nano33ble_edge_ai/
|   |   |-- src/
|   |   |-- lib/
|   |   `-- platformio.ini
|   `-- esp32_gateway/
|       |-- src/
|       |-- lib/
|       `-- platformio.ini
|-- backend/
|   |-- app/
|   |-- requirements.txt
|   |-- Dockerfile
|   `-- seed.py
|-- frontend/
|   |-- public/
|   |-- src/
|   |-- package.json
|   `-- package-lock.json
|-- dataset/
|   |-- bahir_dar_mango_dataset_numeric.csv
|   |-- aug.py
|   `-- weather_data.py
|-- docker-compose.yml
`-- README.md
```

## Getting Started

### 1. Firmware

Configure `firmware/esp32_gateway/src/Config.h` with your Wi-Fi and backend values.

```cpp
#define WIFI_SSID "your_wifi_name"
#define WIFI_PASSWORD "your_wifi_password"
#define API_BASE_URL "https://your-backend.example.com"
#define API_INGEST_PATH "/data/ingest"
#define DEVICE_API_KEY "mg_your_api_key_here"
#define DEVICE_ID "esp32_gateway_001"
```

Flash the boards:

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

Create `frontend/.env` with:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

Frontend URL:

- Dashboard: `http://localhost:3000`

## API Reference

### Authentication

| Endpoint | Method | Description |
| :-- | :-- | :-- |
| `/login` | POST | Login and return JWT |
| `/register` | POST | Register a new user |
| `/me` | GET | Current user profile |
| `/profile` | PUT | Update profile |

### Sensor and detection

| Endpoint | Method | Description |
| :-- | :-- | :-- |
| `/sensors/latest` | GET | Latest sensor snapshot |
| `/history` | GET | Historical sensor and detection data |
| `/detection/latest` | GET | Latest disease detection |
| `/detection/history` | GET | Paginated detection history |

### Forecast and recommendations

| Endpoint | Method | Description |
| :-- | :-- | :-- |
| `/forecast/latest` | GET | Latest 5-day forecast |
| `/forecast/context` | POST | Submit forecast context from ESP32 |
| `/recommendations/latest` | GET | Latest bilingual recommendations |

### Notifications and streaming

| Endpoint | Method | Description |
| :-- | :-- | :-- |
| `/notifications` | GET | Fetch notifications |
| `/notifications/{id}/read` | POST | Mark notification as read |
| `/notifications/read-all` | POST | Mark all notifications as read |
| `/ws` | WebSocket | Real-time updates |

### Ingestion and health

| Endpoint | Method | Description |
| :-- | :-- | :-- |
| `/data/ingest` | POST | Combined ESP32 payload |
| `/health` | GET | Backend health check |

## Model Summary

### Disease detection model

| Item | Value |
| :-- | :-- |
| Model | MobileNetV1 |
| Deployment | Quantized TinyML |
| Classes | Anthracnose, Powdery Mildew, Healthy |
| Input size | 160 x 160 |
| Training images | 11,375 |
| Accuracy | 86.45% |
| Dataset source | Woramit Horticultural Research Center, Ethiopia |

### Forecasting models

| Item | Value |
| :-- | :-- |
| Forecast horizon | 5 days |
| Models in use | LightGBM, Random Forest Classifier |
| Main inputs | Temperature, humidity, precipitation, disease context |
| Output | Disease risk categories for upcoming days |

## Tech Stack

| Layer | Technology |
| :-- | :-- |
| Edge inference | Edge Impulse, TensorFlow Lite Micro |
| Forecasting | LightGBM, Random Forest Classifier |
| Firmware | PlatformIO, Arduino framework, NimBLE |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, JWT |
| Frontend | React, Chart.js, Context API |
| Real-time transport | WebSocket |
| Deployment | Docker, Docker Compose |

## Notes

- The README has been updated to reflect LightGBM and Random Forest Classifier as the forecasting models in use.
- Current uncommitted code changes already existed in `frontend/src/pages/Dashboard.js` and `frontend/src/pages/SettingsPage.js`; this update keeps those intact and adds the README cleanup on top.
