<div align="center">

# 🥭 MangoGuard — Intelligent Mango Health Monitoring
### *Edge AI & IoT for Resilient Agriculture in Ethiopia*

<p align="center">
  <img src="https://img.shields.io/badge/TinyML-Edge%20Impulse-6A32C9?style=for-the-badge&logo=edgeimpulse&logoColor=white" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Nano%2033%20BLE-00979D?style=for-the-badge&logo=arduino&logoColor=white" />
  <img src="https://img.shields.io/badge/Gateway-Raspberry%20Pi-C51A4A?style=for-the-badge&logo=Raspberry-Pi" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Storage-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-Render%20%2B%20Vercel-430098?style=for-the-badge&logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/License-GPLv3-22c55e?style=for-the-badge" />
</p>

**[🌐 Live Demo](https://mango-guard.vercel.app/) &nbsp;|&nbsp; [📐 Architecture](./ARCHITECTURE.md) &nbsp;|&nbsp; [🚀 Deployment](./DEPLOYMENT.md) &nbsp;|&nbsp; [🤝 Contributing](./CONTRIBUTING.md)**

---

> **The Problem:** Ethiopia's mango farmers lose up to 30% of their harvest annually to undetected fungal diseases. Existing solutions require internet connectivity, expensive equipment, or lab access — none of which are realistic for smallholder farmers in rural regions.
>
> **MangoGuard** puts a disease-detection lab in a farmer's pocket. A quantized AI model runs directly on an Arduino microcontroller, identifying disease in seconds with no internet required. Environmental risk data is tracked and forecasted by a Raspberry Pi gateway, and everything flows to a bilingual (English/Amharic) cloud dashboard that any farmer or agronomist can access.

</div>

<br>

## ✨ Feature Map

| Feature | What the user sees |
| :--- | :--- |
| 📸 **Edge AI Detection** | Scan a leaf → get a **Anthracnose / Powdery Mildew / Healthy** result in seconds, entirely offline. Runs a quantized MobileNetV1 model on the Arduino Nano 33 BLE Sense. |
| 🌡️ **Live Environmental Risk Engine** | Real-time temperature & humidity readings from the Arduino Nano (DHT22), forwarded to the Raspberry Pi gateway and scored against agronomic thresholds to produce an instant **Low / Medium / High** risk rating. |
| 🔮 **5-Day Disease Risk Forecast** | The Pi gateway runs an Edge Impulse Linux SDK model on the last 24 h of sensor data to predict the upcoming day's risk — helping farmers act *before* an outbreak. |
| 🌍 **Bilingual Dashboard (EN / አማርኛ)** | Every recommendation, alert and reading is available in both English and Amharic. Farmers see actionable treatment advice in their native language. |
| 📧 **Configurable Email Alerts** | Disease detections above a user-defined confidence threshold trigger an instant branded email alert via Brevo. Forecast alerts fire a day ahead. |
| ☁️ **Supabase Image Storage** | Every scanned leaf image is stored in Supabase for training data collection and audit trail. |
| 🖥️ **Web-Based Cloud Scan** | Upload a leaf photo directly from any browser for AI classification — no hardware required for demonstration or remote diagnosis. |
| ⚙️ **Admin Panel** | Manage maintenance mode, global alert toggles, user registrations and system settings from a protected admin dashboard. |

<br>

## 🏗️ System Architecture

```mermaid
graph LR
  A[🌿 Arduino Nano 33 BLE\nCamera + TinyML Model + DHT22] -->|Serial / USB| B(📡 Raspberry Pi 4\nSerial receiver / Gateway)
  B -->|Wi-Fi / JSON POST| C{☁️ FastAPI Backend\nRender Cloud}
  C -->|SQLAlchemy ORM| D[(PostgreSQL\nSensor & Detection Data)]
  C -->|Supabase SDK| E[(Supabase\nLeaf Image Storage)]
  C -->|WebSocket broadcast| F[💻 React Dashboard\nVercel]
  G[🌐 Browser Upload] -->|REST POST /cloud-scan| C
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full component breakdown and data-flow walkthrough.

<br>

## 🛠️ Prerequisites

### Hardware (for full IoT deployment)
| Component | Purpose |
| :--- | :--- |
| Arduino Nano 33 BLE Sense | Runs the TinyML leaf disease model |
| OV7675 Camera Module | Image capture for edge inference |
| Raspberry Pi 4 (Raspberry Pi OS 64-bit) | Gateway: sensor reading, forecasting, serial relay |
| DHT22 Temperature/Humidity Sensor | Environmental data source (connected to the Arduino Nano 33 BLE; readings forwarded to the Raspberry Pi gateway) |

### Software
| Requirement | Version |
| :--- | :--- |
| Python | ≥ 3.10 |
| Node.js | ≥ 18 |
| Docker & Docker Compose | ≥ 24 (for containerised setup) |
| Arduino IDE | ≥ 2.x |
| Edge Impulse CLI | Latest (`npm install -g edge-impulse-cli`) |
| PostgreSQL | ≥ 15 (handled by Docker) |

<br>

## 🚀 Getting Started

### Step 0 — Clone & configure environment

```bash
git clone https://github.com/SCIFI-Shinobi/Intelligent-Mango-Health-Monitoring.git
cd Intelligent-Mango-Health-Monitoring

# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your real credentials (see [Environment Variables](#-environment-variables) below).

---

### Step 1 — Flash the Edge AI Node (Arduino)

1. Open `firmware/nano33_edgeAI_serial/nano33_edgeAI_serial.ino` in **Arduino IDE**.
2. Install the board package: **Arduino Mbed OS Nano Boards**.
3. Install the Edge Impulse library generated from your trained project.
4. Select **Arduino Nano 33 BLE** and upload.

---

### Step 2 — Configure the Raspberry Pi Gateway

```bash
cd firmware/raspberry_gateway
pip install -r requirements.txt

# Edit gateway_serial.py to set your backend API URL and device key
python gateway_serial.py
```

To install as a persistent system service:
```bash
sudo bash install_service.sh
```

---

### Step 3 — Run the Backend

**Option A: Docker (recommended)**
```bash
# From repository root
docker-compose up -d
```
The backend will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

**Option B: Local Python**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Step 4 — Run the Frontend

```bash
cd frontend
npm install
npm start
```

Open `http://localhost:3000` in your browser.

> **Default admin credentials:** `admin` / `admin` — change these immediately via `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `backend/.env`.

---

### Step 5 — (Optional) Seed demo data

```bash
cd backend
python seed.py
```

<br>

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string. e.g. `postgresql://user:pass@localhost:5432/plant_health` |
| `SECRET_KEY` | ✅ | JWT signing secret — use a long random string in production |
| `ADMIN_USERNAME` | ✅ | Default admin account username (default: `admin`) |
| `ADMIN_PASSWORD` | ✅ | Default admin account password (default: `admin`) |
| `SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_KEY` | ✅ | Supabase service role key (for storage uploads) |
| `BREVO_API_KEY` | ⚠️ | Brevo transactional email API key — disease & forecast alerts won't send without this |
| `BREVO_SENDER_EMAIL` | ⚠️ | Verified sender address on your Brevo account |
| `REQUEST_SLOW_MS` | ❌ | Log requests slower than this threshold in ms (default: `800`) |
| `NOTIFICATION_DEDUPE_MINUTES` | ❌ | Suppress duplicate alerts within this window (default: `0`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `REACT_APP_API_BASE_URL` | ✅ | Base URL of the FastAPI backend. e.g. `http://localhost:8000` |

<br>

## 📊 AI Model Summary

| Property | Detail |
| :--- | :--- |
| **Architecture** | MobileNetV1 (quantized INT8) — optimised for microcontroller inference |
| **Training Platform** | Edge Impulse |
| **Accuracy** | **86.45%** on real-world Ethiopian farm datasets |
| **Classes** | `Anthracnose`, `Powdery Mildew`, `Healthy` |
| **Dataset** | Leaf images collected from smallholder mango farms in Ethiopia |
| **Forecasting Model** | TreeEnsemble `.eim` — runs on Raspberry Pi via Edge Impulse Linux SDK |
| **Forecast Input** | Last 24 h of temperature & humidity readings |
| **Forecast Output** | Low / Medium / High disease risk for the upcoming day |

<br>

## 🐛 Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| `connection refused` on `localhost:8000` | Make sure Docker is running (`docker-compose up -d`) or the local uvicorn process has started |
| Frontend shows `Network Error` | Verify `REACT_APP_API_BASE_URL` in `frontend/.env` matches your backend address |
| Disease email alerts not sending | Confirm `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` are set in `backend/.env` |
| Arduino not detected by Raspberry Pi | Check USB serial port in `gateway_serial.py` (`/dev/ttyACM0` is typical) |
| `tflite-runtime` install fails | Use `pip install tflite-runtime --extra-index-url https://google-coral.github.io/py-repo/` on ARM |
| Supabase images not uploading | Ensure your Supabase bucket is set to **public** and the `SUPABASE_KEY` is a service role key |
| `pg_isready` fails in Docker | Wait a few seconds — the PostgreSQL container has a health-check; backend will retry automatically |

<br>

## 📁 Project Structure

```
Intelligent-Mango-Health-Monitoring/
├── backend/                  # FastAPI application
│   ├── app/
│   │   ├── main.py           # All API routes & WebSocket handlers
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── logic.py          # Disease recommendations engine
│   │   ├── cloud_scan_service.py  # Browser-uploaded leaf classification
│   │   ├── forecast_service.py    # Edge Impulse forecast model runner
│   │   ├── alert_service.py       # Disease alert threshold checker
│   │   └── ml_models/        # TFLite & .eim model files
│   ├── .env.example
│   └── requirements.txt
├── frontend/                 # React dashboard
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Dashboard, Scan, Forecast, Admin pages
│   │   ├── context/          # Global state (language, auth)
│   │   └── hooks/            # Custom React hooks
│   └── .env.example
├── firmware/
│   ├── nano33_edgeAI_serial/ # Arduino sketch (TinyML inference)
│   ├── raspberry_gateway/    # Pi gateway script + systemd service
│   └── esp8266_gateway/      # Alternative ESP8266 gateway
├── scripts/
│   └── simulate_pi.py        # Simulate gateway data for local dev

├── ARCHITECTURE.md
├── DEPLOYMENT.md
├── CONTRIBUTING.md
├── docker-compose.yml
└── LICENSE
```

<br>

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see [LICENSE](./LICENSE) for details.

<br>

<div align="center">
  <i>Built to bridge the gap between AI and smallholder agriculture in Ethiopia. 🌱</i>
</div>
