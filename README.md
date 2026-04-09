<div align="center">

# Intelligent Plant Health Monitoring
### *Edge AI for Resilient Mango Agriculture in Ethiopia*

<p>
  <img src="https://img.shields.io/badge/TinyML-Edge%20Impulse-6A32C9?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Nano%2033%20BLE-00979D?style=for-the-badge&logo=arduino&logoColor=white" />
  <img src="https://img.shields.io/badge/Gateway-ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Containerized-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</p>

> An end-to-end TinyML system that detects mango leaf diseases in the field, evaluates outbreak risk using expert agronomic thresholds, forecasts disease risk with on-device XGBoost, and serves a bilingual (English/Amharic) real-time dashboard — all without an internet connection at the point of sensing.

</div>

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FIELD DEVICE                               │
│                                                                     │
│  ┌──────────────────────┐   BLE Wireless   ┌──────────────────────┐ │
│  │  Arduino Nano 33 BLE │ ───────────────► │       ESP32          │ │
│  │                      │  "Anthracnose,   │                      │ │
│  │  Camera (OV7675)     │   0.92"          │  DHT22 Sensor        │ │
│  │  TinyML Model        │                  │  XGBoost Forecast    │ │
│  │  (MobileNetV1)       │                  │  Risk Engine         │ │
│  │                      │                  │  OLED Display + Buzz │ │
│  └──────────────────────┘                  └──────────┬───────────┘ │
└──────────────────────────────────────────────────────  │  ──────────┘
                                                        │ Wi-Fi
                                               ┌────────▼─────────┐
                                               │  FastAPI Backend  │
                                               │  PostgreSQL + JWT │
                                               │  WebSocket + REST │
                                               └────────┬─────────┘
                                                        │
                                               ┌────────▼─────────┐
                                               │  React Dashboard  │
                                               │  EN / AM Bilingual│
                                               └──────────────────┘
```

### Data Flow

| Step | Component | Action |
| :---: | :--- | :--- |
| 1 | **Nano 33 BLE** | Captures leaf image with OV7675 camera |
| 2 | **Nano 33 BLE** | Runs quantized MobileNetV1 TinyML model on-device |
| 3 | **Nano 33 BLE** | Advertises result via BLE: `"Anthracnose,0.92"` |
| 4 | **ESP32** | Receives BLE notification wirelessly |
| 5 | **ESP32** | Reads DHT22 for temperature, humidity, and precipitation |
| 6 | **ESP32** | Evaluates disease risk using expert agronomic thresholds |
| 7 | **ESP32** | Runs XGBoost model for 5-day disease risk forecast |
| 8 | **ESP32** | Displays result on OLED (with Amharic support), sounds buzzer if HIGH RISK |
| 9 | **ESP32** | POSTs data to FastAPI backend over Wi-Fi |
| 10 | **Backend** | Stores data, generates notifications, serves REST + WebSocket APIs |
| 11 | **Dashboard** | Displays real-time sensor data, charts, forecasts, and recommendations |

---

## Key Features

### On-Device TinyML Inference
- Runs a **quantized MobileNetV1** model directly on the Arduino Nano 33 BLE Sense — no cloud needed for inference.
- Trained on **11,375 high-resolution images** from the *Woramit Horticultural Research Center*, Ethiopia.
- Detects **Anthracnose**, **Powdery Mildew**, and **Healthy** leaf states.

### Wireless BLE Communication
- The Nano advertises its classification result as a BLE characteristic.
- The ESP32 acts as BLE Central, automatically scanning and connecting — **no wires between the two boards**.

### Expert-Backed Risk Engine
The same risk logic runs on both the ESP32 (in real-time) and the FastAPI backend (for historical analysis):

| Disease | High-Risk Condition | Action |
| :--- | :--- | :--- |
| **Anthracnose** | 24-30 C **AND** Humidity > 80% | HIGH RISK |
| **Powdery Mildew** | 10-31 C **AND** Humidity > 80% | HIGH RISK |
| Any disease, wrong env | Disease detected, conditions not met | MEDIUM RISK |
| Healthy | — | LOW RISK |

### On-Device XGBoost Forecasting
- The ESP32 runs an **XGBoost model** to predict disease risk for the next **5 days**.
- Uses temperature, humidity, and precipitation as inputs.
- Forecast results are displayed locally on OLED and synced to the dashboard.

### Field-Ready Hardware UI
- **OLED Display**: Wi-Fi/BLE status, temperature, humidity, AI result, risk level, and Amharic recommendations via U8g2.
- **Buzzer**: Pulses when risk is HIGH.
- **Inverted display text** for HIGH RISK to make it unmissable.

### Bilingual Web Dashboard (English / Amharic)
- **Real-time monitoring** via WebSocket for live sensor updates.
- **Disease status card** with confidence score and last scan time.
- **Sensor cards** for temperature, humidity, and precipitation with trend indicators.
- **Historical trends chart** with dual Y-axis (temp/humidity + precipitation) and 24h/7d/30d time range toggles.
- **5-day disease risk forecast** from current sensor and inference context.
- **Bilingual recommendations** matching the ESP32 firmware's Amharic output.
- **Notification system** with auto-generated alerts for disease detection, high temperature, and high humidity.
- **Detection history** with paginated logs.
- **Settings page** with configurable alert thresholds.
- **Site-wide language toggle** — every label, button, and message switches between English and Amharic.
- **Responsive design** — desktop grid layout with mobile bottom-tab navigation.

---

## Hardware

| Component | Role | Pin |
| :--- | :--- | :--- |
| **Arduino Nano 33 BLE Sense** | TinyML inference + BLE Peripheral | — |
| **OV7675 Camera** | Leaf image capture | Built-in on Nano |
| **ESP32** | BLE Central + Wi-Fi gateway + risk engine + forecasting | — |
| **DHT22** | Temperature & humidity sensing | GPIO 4 |
| **SSD1306 OLED** | Local display (Amharic via U8g2) | I2C (GPIO 21/22) |
| **Buzzer** | HIGH RISK alert | GPIO 5 |

---

## Repository Structure

```
Intelligent-Plant-Health-Monitoring/
├── firmware/
│   ├── nano33ble_edge_ai/             # Arduino Nano 33 BLE: TinyML + BLE
│   │   ├── src/
│   │   │   ├── main.cpp               # Inference + BLE advertising
│   │   │   ├── Config.h               # Thresholds & settings
│   │   │   ├── Camera_OV7675.*        # Camera driver
│   │   │   └── Image_Utils.*          # RGB565 to RGB888 conversion
│   │   ├── lib/
│   │   │   ├── edge-impulse-sdk/      # TFLite Micro runtime
│   │   │   └── tflite-model/          # Quantized MobileNetV1 model
│   │   └── platformio.ini
│   │
│   └── esp32_gateway/                 # ESP32: BLE Central + gateway
│       ├── src/
│       │   ├── main.cpp               # BLE, DHT22, risk engine, XGBoost, OLED
│       │   └── Config.h               # Pins, Wi-Fi, API URL, thresholds
│       └── platformio.ini
│
├── backend/                           # FastAPI + PostgreSQL
│   ├── app/
│   │   ├── main.py                    # REST + WebSocket API endpoints
│   │   ├── logic.py                   # Bilingual risk evaluation & recommendations
│   │   ├── models.py                  # SQLAlchemy models (User, SensorData, etc.)
│   │   ├── schemas.py                 # Pydantic validation schemas
│   │   └── database.py                # DB connection
│   ├── seed.py                        # Database seeder with sample data
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                          # React 19 Dashboard
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.js              # Top nav with lang toggle & notifications
│   │   │   ├── MobileNav.js           # Bottom tab navigation
│   │   │   ├── DiseaseStatusCard.js   # Health status + confidence
│   │   │   ├── SensorCard.js          # Temperature / Humidity / Precipitation
│   │   │   ├── HistoricalChart.js     # Dual-axis chart (Chart.js)
│   │   │   ├── ForecastCard.js        # 5-day risk forecast
│   │   │   ├── RecommendationsPanel.js# Bilingual recommendations
│   │   │   └── MangoLeafLogo.js       # SVG logo component
│   │   ├── pages/
│   │   │   ├── Dashboard.js           # Main dashboard
│   │   │   ├── Login.js               # JWT auth (login + signup with email)
│   │   │   ├── LogsPage.js            # Paginated detection history
│   │   │   ├── SettingsPage.js        # Alert thresholds & system info
│   │   │   └── AnalysisPage.js        # Analytics (placeholder)
│   │   ├── context/
│   │   │   ├── AuthContext.js         # JWT authentication state
│   │   │   └── LanguageContext.js     # EN/AM language switching
│   │   ├── hooks/
│   │   │   ├── useAPI.js              # Authenticated API call hook
│   │   │   └── useTimeRange.js        # Time range state management
│   │   ├── utils/
│   │   │   ├── translations.js        # All UI strings in EN + AM
│   │   │   ├── formatTime.js          # Ethiopian timezone (EAT) formatting
│   │   │   └── exportCSV.js           # CSV export utility
│   │   ├── App.js
│   │   ├── App.css                    # Full dark theme styling
│   │   └── index.js
│   └── package.json
│
├── dataset/
│   ├── bahir_dar_mango_dataset_numeric.csv
│   ├── aug.py                         # Data augmentation script
│   └── weather_data.py                # Weather data collection
│
├── docker-compose.yml
└── README.md
```

---

## Getting Started

### 1. Firmware (PlatformIO)

**Configure** `firmware/esp32_gateway/src/Config.h`:
```cpp
#define WIFI_SSID     "your_wifi_name"
#define WIFI_PASSWORD "your_wifi_password"
#define API_URL       "http://<your-server-ip>:8000/data/ingest"
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

### 2. Backend

```bash
# Start with Docker
docker-compose up -d

# Or run directly
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Seed sample data (optional)
python seed.py
```

The API will be available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

The dashboard will be available at `http://localhost:3000`.

Create a `.env` file to configure the API URL:
```
REACT_APP_API_BASE_URL=http://localhost:8000
```

---

## API Reference

### Authentication
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/login` | POST | Login with username/password, returns JWT |
| `/register` | POST | Register with username, password, email |

### Sensor Data
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/sensors/latest` | GET | Latest temperature, humidity, precipitation |
| `/sensors/history` | GET | Historical data (`?range=24h\|7d\|30d`) |

### Disease Detection
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/detection/latest` | GET | Latest disease classification result |
| `/detection/history` | GET | Paginated detection log (`?page=1&limit=10`) |

### Forecast & Recommendations
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/forecast/latest` | GET | 5-day disease risk forecast |
| `/forecast/context` | POST | Submit forecast context metadata from ESP32 |
| `/recommendations/latest` | GET | Bilingual recommendations (`?limit=5`) |

### Notifications
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/notifications` | GET | User notifications (requires JWT) |
| `/notifications/{id}/read` | POST | Mark notification as read |
| `/notifications/read-all` | POST | Mark all notifications as read |

### Data Ingestion
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/data/ingest` | POST | Combined ESP32 data payload |
| `/ws` | WebSocket | Real-time sensor + detection updates |

**Example `/data/ingest` payload:**
```json
{
  "device_id": "esp32_gateway_001",
  "temperature": 26.5,
  "humidity": 85.0,
  "precipitation": 12.3,
  "disease_type": "Anthracnose",
  "confidence_score": 0.92
}
```

---

## Model Performance

| Metric | Value |
| :--- | :--- |
| Architecture | MobileNetV1 (8-bit quantized) |
| Input size | 160 x 160 px |
| Training images | 11,375 |
| Accuracy | **86.45%** |
| Classes | Anthracnose, Powdery Mildew, Healthy |
| Dataset source | Woramit Horticultural Research Center, Ethiopia |

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| TinyML Inference | Edge Impulse, TensorFlow Lite Micro |
| Forecasting | XGBoost (on-device, ESP32) |
| Firmware | PlatformIO, Arduino Framework, NimBLE, U8g2 |
| Backend | FastAPI, SQLAlchemy, PostgreSQL, JWT |
| Frontend | React 19, Chart.js, Context API |
| Real-time | WebSocket |
| Deployment | Docker, docker-compose |

---

<div align="center">

*Built to bridge the gap between AI and smallholder agriculture in Ethiopia.*

</div>
