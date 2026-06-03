# 🥭 MangoGuard — React Dashboard

The frontend for **MangoGuard**, a bilingual (English/Amharic) IoT dashboard for real-time mango disease monitoring and risk forecasting. Built with **React 19** and **Create React App**.

## Purpose & Capabilities

| Page / Feature | What it does |
| :--- | :--- |
| **Live Dashboard** | Real-time temperature, humidity, and disease risk readings streamed via WebSocket from the FastAPI backend |
| **Scan History** | Table of all past leaf scans with disease classification, confidence score, and timestamp |
| **Cloud Scan** | Upload any leaf image from the browser for instant AI classification — no hardware needed |
| **5-Day Forecast** | Visual risk calendar showing predicted disease risk levels for the next 5 days |
| **Notifications** | In-app and email alert history for disease detections and forecast warnings |
| **Language Toggle** | Full English ↔ Amharic (አማርኛ) UI switch — all recommendations and alerts are bilingual |
| **Settings** | User profile, email alert preferences, and detection confidence threshold |
| **Admin Panel** | (Admin users only) System settings, maintenance mode, global alert controls |

## Environment Setup

Copy the example env file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# URL of the running FastAPI backend
REACT_APP_API_BASE_URL=http://localhost:8000
```

> For production deployments pointing at Render, set this to your Render backend URL:
> `REACT_APP_API_BASE_URL=https://your-backend.onrender.com`

## Available Commands

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm start

# Run tests
npm test

# Build for production
npm run build
```

## Key Dependencies

| Package | Purpose |
| :--- | :--- |
| `react-router-dom` | Client-side routing between dashboard pages |
| `chart.js` + `react-chartjs-2` | Sensor trend charts and forecast visualisations |
| `react-icons` | Icon set used throughout the UI |

## Troubleshooting

| Issue | Fix |
| :--- | :--- |
| Dashboard shows no live data | Verify `REACT_APP_API_BASE_URL` points to a running backend instance |
| WebSocket disconnects immediately | Ensure the backend is running and CORS is allowing your origin |
| Amharic text not rendering correctly | The app uses system fonts — Noto Sans Ethiopic is recommended on the OS |
| `npm install` fails on `node_modules` | Delete `node_modules/` and `package-lock.json`, then re-run `npm install` |
| Blank page after `npm run build` | Make sure `REACT_APP_API_BASE_URL` is set before building; CRA bakes env vars at build time |

## Project Structure

```
frontend/src/
├── components/       # Reusable UI components (cards, charts, modals)
├── context/          # React Context for language and auth state
├── hooks/            # Custom hooks (useWebSocket, useSensorData, etc.)
├── pages/            # Route-level page components
└── utils/            # Helper functions and API client
```
