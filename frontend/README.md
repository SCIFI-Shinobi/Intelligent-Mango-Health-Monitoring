# MangoGuard Frontend (React)

Frontend dashboard for the Intelligent Mango Health Monitoring system.

## What this app provides
- Real-time farm status dashboards
- Bilingual (English/Amharic) UI
- Disease scan history and recommendations
- Risk/forecast visualization
- Admin/settings views for notifications and thresholds

## Prerequisites
- Node.js 18+
- npm 9+

## Environment setup
Create `frontend/.env` from template:

```bash
cp .env.example .env
```

Required variable:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

## Install and run
```bash
npm install
npm start
```

Runs at: `http://localhost:3000`

## Build
```bash
npm run build
```

## Test
```bash
CI=true npm test -- --watchAll=false
```

## Troubleshooting
- If API calls fail, verify `REACT_APP_API_BASE_URL` and backend CORS settings.
- If dependencies fail to install, remove `node_modules` and run `npm ci`.
