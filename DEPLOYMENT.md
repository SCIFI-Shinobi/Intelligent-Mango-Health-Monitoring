# Deployment Guide

## 1. Production architecture
- **Frontend:** Vercel (React)
- **Backend:** Render or any Docker-capable host (FastAPI)
- **Database:** Managed PostgreSQL
- **Object Storage:** Supabase bucket

## 2. Backend deployment

### Option A: Render
1. Create a new Web Service from `backend/`.
2. Build command:
   ```bash
   pip install -r requirements.txt
   ```
3. Start command:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Set environment variables (see `backend/.env.example`).

### Option B: Docker host
```bash
docker compose up --build -d
```

## 3. Frontend deployment (Vercel)
1. Import repository in Vercel.
2. Set root directory to `frontend`.
3. Add environment variable:
   - `REACT_APP_API_BASE_URL=https://<your-backend-domain>`
4. Deploy.

## 4. Required production environment variables

### Backend
- `DATABASE_URL`
- `SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `BREVO_API_KEY` (if email alerts enabled)

### Frontend
- `REACT_APP_API_BASE_URL`

## 5. Post-deploy verification
- Open backend `/docs` route and confirm API is live.
- Verify frontend can authenticate and load dashboard data.
- Submit a test ingest payload and confirm DB persistence.
- Confirm WebSocket/live updates are functioning.
- Trigger a test alert path if email notifications are enabled.
