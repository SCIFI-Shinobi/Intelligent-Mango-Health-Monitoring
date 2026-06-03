# 📐 MangoGuard — System Architecture

This document describes the technical components, their responsibilities, and the end-to-end data flow of the MangoGuard system.

---

## System Overview

MangoGuard is a **three-tier IoT + cloud system**:

1. **Edge Tier** — TinyML inference runs directly on an Arduino microcontroller in the field. No internet required.
2. **Gateway Tier** — A Raspberry Pi collects environmental sensor data, relays Arduino results, and runs a local disease risk forecast model.
3. **Cloud Tier** — A FastAPI backend persists all data, serves the REST + WebSocket API, and handles email alerting. A React frontend provides a real-time bilingual dashboard.

---

## Component Responsibilities

### 🌿 Arduino Nano 33 BLE Sense (`firmware/nano33_edgeAI_serial/`)

| Responsibility | Detail |
| :--- | :--- |
| Image capture | OV7675 camera module captures leaf images on demand |
| Edge inference | Quantized MobileNetV1 INT8 model classifies the image into: `Anthracnose`, `Powdery Mildew`, or `Healthy` |
| Result output | Classification result + confidence score sent over USB serial to the Raspberry Pi |

The model runs **entirely offline** — latency is under 2 seconds per inference.

---

### 📡 Raspberry Pi 4 Gateway (`firmware/raspberry_gateway/`)

| Responsibility | Detail |
| :--- | :--- |
| Serial relay | Reads Arduino inference results over `/dev/ttyACM0` and forwards them to the backend REST API |
| Environmental sensing | Reads DHT22 temperature & humidity at a configurable interval |
| Risk evaluation | Scores live sensor readings against agronomic thresholds to produce a real-time Low/Medium/High risk level |
| Forecasting | Runs `forecasting-linux-aarch64-v11-impulse.eim` (Edge Impulse Linux SDK) on the last 24 h of sensor data to predict tomorrow's risk |
| LCD display | Optionally drives an I²C LCD screen showing live readings (via `lcd_driver.py`) |
| Systemd service | `mangoguard.service` keeps the gateway running as a persistent background daemon |

---

### ☁️ FastAPI Backend (`backend/app/`)

| File | Responsibility |
| :--- | :--- |
| `main.py` | All API routes, WebSocket hub, request timing middleware, email alert dispatch |
| `models.py` | SQLAlchemy ORM: `User`, `Device`, `SensorData`, `InferenceResult`, `ScanRequest`, `ForecastContext`, `ForecastData`, `Recommendation`, `SystemSetting` |
| `schemas.py` | Pydantic v2 request/response schemas for every endpoint |
| `logic.py` | Disease recommendation engine — maps disease type + risk level to bilingual treatment advice |
| `cloud_scan_service.py` | Loads the TFLite model and classifies browser-uploaded leaf images |
| `forecast_service.py` | Loads and runs the `.eim` forecasting model via Edge Impulse Linux SDK |
| `alert_service.py` | Checks detection confidence against per-user thresholds and triggers email alerts |
| `disease_labels.py` | Normalises raw disease type strings from multiple sources into canonical labels |
| `database.py` | SQLAlchemy engine and session factory (SQLite for dev, PostgreSQL for production) |

**Key API surface:**

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/ingest` | Receive sensor + inference data from the Raspberry Pi gateway |
| `POST` | `/cloud-scan` | Upload a leaf image for server-side TFLite classification |
| `GET` | `/dashboard` | Aggregate latest sensor, detection, forecast and recommendation data |
| `WS` | `/ws` | WebSocket endpoint — pushes real-time updates to connected dashboards |
| `POST` | `/auth/login` | JWT authentication |
| `GET` | `/scans` | Paginated scan history |
| `GET` | `/forecast` | Latest 5-day forecast for the user's device |
| `POST` | `/admin/*` | Admin settings management |

---

### 💻 React Frontend (`frontend/src/`)

| Directory | Responsibility |
| :--- | :--- |
| `pages/` | Route-level pages: Dashboard, Scan, Cloud Scan, Forecast, Notifications, Settings, Admin |
| `components/` | Reusable UI: Sensor cards, disease result cards, risk badge, chart wrappers, alert list |
| `context/` | React Context providers for authentication state and active language (EN / አማርኛ) |
| `hooks/` | `useWebSocket` — manages the live WS connection and dispatches incoming updates to state |
| `utils/` | Axios API client configured with `REACT_APP_API_BASE_URL` and JWT auth header injection |

---

## End-to-End Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  FIELD                                                               │
│                                                                      │
│  [Arduino Nano 33 BLE]                                               │
│   Camera captures leaf image                                         │
│   → MobileNetV1 INT8 inference (offline, ~1.5 s)                    │
│   → { disease_type, confidence } over USB serial                     │
│                              ↓                                       │
│  [Raspberry Pi 4 Gateway]                                            │
│   Reads serial result + DHT22 sensor                                 │
│   Evaluates environmental risk level                                 │
│   Runs .eim forecast model on last 24h sensor window                 │
│   → HTTP POST /ingest { sensor_data, inference_result, forecast }    │
└──────────────────────────────────────────────────────────────────────┘
                              ↓  (Wi-Fi / internet)
┌──────────────────────────────────────────────────────────────────────┐
│  CLOUD                                                               │
│                                                                      │
│  [FastAPI Backend — Render]                                          │
│   Persists sensor + detection records to PostgreSQL                  │
│   Stores leaf image in Supabase Storage                              │
│   Checks detection confidence → sends Brevo email alert if needed    │
│   Broadcasts WebSocket event to all connected dashboard clients      │
└──────────────────────────────────────────────────────────────────────┘
                              ↓  (WebSocket / REST)
┌──────────────────────────────────────────────────────────────────────┐
│  DASHBOARD                                                           │
│                                                                      │
│  [React Frontend — Vercel]                                           │
│   Live sensor readings update in real time                           │
│   Risk level badge changes colour (green/amber/red)                  │
│   New scan result appears in history table                           │
│   Bilingual recommendations rendered in EN or አማርኛ                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (PostgreSQL)

| Table | Key columns | Purpose |
| :--- | :--- | :--- |
| `users` | `id`, `username`, `email`, `notification_emails_enabled`, `disease_confidence_threshold` | User accounts and alert preferences |
| `devices` | `id`, `user_id`, `device_name`, `api_key`, `last_seen` | Registered Raspberry Pi gateways |
| `sensor_data` | `id`, `device_id`, `temperature`, `humidity`, `risk_level`, `timestamp` | Raw environmental readings |
| `inference_results` | `id`, `device_id`, `disease_type`, `confidence_score`, `source`, `timestamp` | Disease detection records |
| `scan_requests` | `id`, `user_id`, `device_id`, `status`, `source`, `result_*` | Web-initiated scan lifecycle tracking |
| `forecast_context` | `id`, `device_id`, `timestamp` | Groups a set of forecast days per prediction run |
| `forecast_data` | `id`, `context_id`, `risk_level`, `forecast_date` | Individual forecast day records |
| `recommendations` | `id`, `device_id`, `title`, `description`, `title_am`, `description_am` | Bilingual treatment advice |
| `system_settings` | `key`, `value`, `description` | Admin-controlled feature flags |
| `notifications` | `id`, `user_id`, `type`, `title`, `message`, `read`, `timestamp` | In-app notification log |

---

## WebSocket Protocol

The `/ws` endpoint accepts a JWT in the `Authorization` query parameter. Once authenticated, the server pushes JSON events of the form:

```json
{
  "type": "sensor_update" | "scan_result" | "forecast_update" | "alert",
  "data": { ... }
}
```

The React frontend's `useWebSocket` hook dispatches each event type to the appropriate state slice, triggering targeted re-renders without a full page refresh.
