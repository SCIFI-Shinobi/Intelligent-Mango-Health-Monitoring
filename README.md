<div align="center">

# 🥭 Intelligent Mango Health Monitoring
### Edge AI + IoT disease monitoring for smallholder mango farms

<p align="center">
  <img src="https://img.shields.io/badge/TinyML-Edge%20Impulse-6A32C9?style=for-the-badge&logo=edgeimpulse&logoColor=white" />
  <img src="https://img.shields.io/badge/Hardware-Arduino%20Nano%2033%20BLE-00979D?style=for-the-badge&logo=arduino&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Storage-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend%20Deployment-Vercel%20Live-black?style=flat-square&logo=vercel" />
  <img src="https://img.shields.io/badge/Backend%20Deployment-Render%20Ready-46E3B7?style=flat-square&logo=render&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" />
</p>

**Live Demo:** https://mango-guard.vercel.app/  
**Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md) • **Deployment:** [DEPLOYMENT.md](./DEPLOYMENT.md) • **Contributing:** [CONTRIBUTING.md](./CONTRIBUTING.md)

</div>

---

## 🌍 Project Impact
Mango farmers in Ethiopia lose yield because disease signs and risky weather windows are often detected too late. This project combines **on-device AI**, **environment sensors**, and a **bilingual (English/Amharic) dashboard** so farmers can detect disease early, monitor risk, and act quickly.

## ✨ Feature Overview
| Feature | What it does | Visual/UX output |
| :--- | :--- | :--- |
| 📸 Edge AI disease detection | Detects **Anthracnose** and **Powdery Mildew** on-device using quantized MobileNetV1 | Device sends labeled scan + confidence to backend |
| 🌡️ Real-time monitoring | Streams temperature/humidity from gateway sensors | Dashboard cards, trend charts, status indicators |
| 🔮 Risk forecasting | Uses weather history and Edge Impulse logic for next-day risk | Forecast panel + actionable recommendations |
| 🌐 Bilingual dashboard | User interface in English and Amharic | Localized labels, alerts, and recommendations |
| ☁️ Cloud image persistence | Stores field images and training samples in Supabase storage | Historical review and dataset growth workflow |
| 🔔 Alerting | Email alerts for threshold-based detections and risk events | Configurable notifications in user settings |

## 🧩 System Components
- **Edge node:** Arduino Nano 33 BLE (camera + TinyML inference)
- **Gateway:** Raspberry Pi serial bridge + upload service
- **Backend:** FastAPI API/WebSocket server + auth + risk engine
- **Frontend:** React web dashboard
- **Data layer:** PostgreSQL/SQLite + Supabase object storage

For full data flow and interfaces, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## ✅ Prerequisites & System Requirements
### Hardware
- Arduino Nano 33 BLE (camera pipeline)
- Raspberry Pi (gateway)
- Temperature/humidity sensor supported by gateway code

### Software
- Python **3.10+**
- Node.js **18+** and npm **9+**
- Docker + Docker Compose (recommended for local full stack)
- Arduino IDE (for firmware upload)

### Minimum local machine spec (recommended)
- 4 CPU cores
- 8 GB RAM
- 10 GB free disk

## 🚀 Getting Started (Step-by-step)
### 1) Clone and enter repository
```bash
git clone https://github.com/SCIFI-Shinobi/Intelligent-Mango-Health-Monitoring.git
cd Intelligent-Mango-Health-Monitoring
```

### 2) Configure environment variables
Use provided templates:
- `backend/.env.example` → copy to `backend/.env`
- `frontend/.env.example` → copy to `frontend/.env`

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3) Start with Docker (recommended)
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

### 4) Optional: run services locally without Docker
#### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

### 5) Firmware/Gateway quick start
- Flash Arduino sketch in `firmware/nano33_edgeAI_serial/`
- Configure Raspberry Pi gateway in `firmware/raspberry_gateway/gateway_serial.py`
- Start gateway:
```bash
cd firmware/raspberry_gateway
pip install -r requirements.txt
python gateway_serial.py
```

## 🔐 Environment Variables
### Backend (`backend/.env`)
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `DATABASE_URL` | No | DB URL (defaults to local SQLite if unset) |
| `SUPABASE_URL` | Optional | Supabase project URL for storage |
| `SUPABASE_KEY` | Optional | Supabase service key |
| `BREVO_API_KEY` | Optional | Email alert provider key |
| `BREVO_SENDER_EMAIL` | Optional | Email sender identity |
| `ALERT_EMAIL_TO` | Optional | Default notification recipient |
| `CONFIDENCE_THRESHOLD` | Optional | Detection confidence threshold (percent) |
| `REQUEST_SLOW_MS` | Optional | Slow-request monitoring threshold |
| `NOTIFICATION_DEDUPE_MINUTES` | Optional | Notification dedupe window |
| `SECRET_KEY` | Yes (prod) | JWT signing key |
| `ADMIN_USERNAME` | Optional | Seed/default admin username |
| `ADMIN_PASSWORD` | Optional | Seed/default admin password |

### Frontend (`frontend/.env`)
| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `REACT_APP_API_BASE_URL` | Yes | Backend base URL consumed by frontend |

## 🤖 AI Model & Data
- **Edge model:** MobileNetV1 (quantized) + Edge Impulse deployment artifacts
- **Reported accuracy:** **86.45%** on project dataset
- **Leaf classes:** Anthracnose, Powdery Mildew, Healthy
- **Weather risk context:** Historical Bahir Dar weather (2016–2026) with threshold-based risk labels
- **Dataset docs:** [dataset/README.md](./dataset/README.md)

## 🛠️ Troubleshooting
### 1) Frontend cannot reach backend
- Verify `frontend/.env` has correct `REACT_APP_API_BASE_URL`
- Ensure backend is running on expected host/port

### 2) Gateway uploads fail (offline mode)
- Check `API_BASE_URL` and `DEVICE_API_KEY` in `firmware/raspberry_gateway/gateway_serial.py`
- Confirm device has internet and backend endpoint is reachable

### 3) Supabase storage not working
- Confirm `SUPABASE_URL` and `SUPABASE_KEY`
- Check backend logs for Supabase initialization errors

### 4) Email alerts not sent
- Set `BREVO_API_KEY`
- Optionally set `BREVO_SENDER_EMAIL` and `ALERT_EMAIL_TO`

### 5) Docker startup issues
- Run `docker compose config` to validate compose file
- Rebuild containers: `docker compose up --build --force-recreate`

## 📚 Documentation Index
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [frontend/README.md](./frontend/README.md)
- [dataset/README.md](./dataset/README.md)

## 📄 License
This project is licensed under the MIT License. See [LICENSE](./LICENSE).
