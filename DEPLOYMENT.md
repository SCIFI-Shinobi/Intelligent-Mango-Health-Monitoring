# 🚀 MangoGuard — Deployment Guide

This guide covers deploying MangoGuard to production using three supported paths:

1. **Render** (backend) + **Vercel** (frontend) — recommended for zero-DevOps cloud hosting
2. **Docker host** — self-hosted on a VPS or on-premise server
3. **Raspberry Pi local** — standalone deployment for offline/demo use

---

## Production Topology

```
  Internet Users
       │
       ▼
  ┌─────────────┐        ┌──────────────────────────────┐
  │   Vercel    │◄──────►│   Render (FastAPI backend)   │
  │  (React)    │  REST  │   • PostgreSQL add-on         │
  └─────────────┘  + WS  │   • Supabase storage          │
                         │   • Brevo email alerts         │
                         └──────────────────────────────┘
                                      ▲
                                      │ HTTPS POST /ingest
                                      │
                         ┌────────────────────────┐
                         │  Raspberry Pi Gateway  │
                         │  (field deployment)    │
                         └────────────────────────┘
```

---

## Option 1 — Render (Backend) + Vercel (Frontend)

### 1a. Deploy the Backend on Render

1. Create a new **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repository.
3. Configure the service:

| Setting | Value |
| :--- | :--- |
| **Root Directory** | `backend` |
| **Environment** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

4. Add a **PostgreSQL** database add-on in Render and copy the connection string into the `DATABASE_URL` environment variable.
5. Set all required environment variables in the Render dashboard:

```
DATABASE_URL          = (from Render PostgreSQL add-on)
SECRET_KEY            = (generate: python -c "import secrets; print(secrets.token_hex(32))")
ADMIN_USERNAME        = your-admin-username
ADMIN_PASSWORD        = your-secure-password
SUPABASE_URL          = https://your-project.supabase.co
SUPABASE_KEY          = your-service-role-key
BREVO_API_KEY         = your-brevo-api-key
BREVO_SENDER_EMAIL    = alerts@yourdomain.com
```

6. Deploy. Note your service URL (e.g. `https://mangoguard.onrender.com`).

> **Free tier note:** Render free services spin down after 15 minutes of inactivity. Use a paid plan or an uptime service for production.

---

### 1b. Deploy the Frontend on Vercel

1. Import your repository on [vercel.com](https://vercel.com).
2. Set the **Root Directory** to `frontend`.
3. Add the environment variable:

```
REACT_APP_API_BASE_URL = https://mangoguard.onrender.com
```

4. Deploy. Vercel will build with `npm run build` and serve the static output.

> **Important:** Environment variables must be set *before* the build runs — CRA bakes them into the bundle at build time.

---

## Option 2 — Docker Host (Self-hosted VPS)

### Prerequisites
- A VPS with Docker and Docker Compose installed
- A domain name (optional, for HTTPS via Caddy/Nginx)

### Steps

```bash
# 1. Clone the repository on your server
git clone https://github.com/SCIFI-Shinobi/Intelligent-Mango-Health-Monitoring.git
cd Intelligent-Mango-Health-Monitoring

# 2. Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit backend/.env with your production values
# Edit frontend/.env — set REACT_APP_API_BASE_URL to your server's public IP/domain

# 3. Start all services
docker-compose up -d

# 4. (First run) Seed demo data (optional)
docker-compose exec backend python seed.py
```

Services will be available at:
- Frontend: `http://your-server:3000`
- Backend API: `http://your-server:8000`
- API Docs: `http://your-server:8000/docs`

### HTTPS with Nginx (optional)

Place an Nginx reverse proxy in front of ports 3000 and 8000, terminating TLS:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://localhost:3000/;
    }
}
```

---

## Option 3 — Raspberry Pi Local (Demo / Offline)

For conference demos or fully offline deployments, the backend and frontend can run directly on the Raspberry Pi alongside the gateway script.

```bash
# Backend
cd backend
pip install -r requirements.txt
DATABASE_URL=sqlite:///./plant_health.db uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Frontend (build first, then serve statically)
cd ../frontend
npm install && npm run build
npx serve -s build -l 3000 &
```

> This uses SQLite instead of PostgreSQL — suitable for demos but not for multi-user production use.

---

## Environment Variable Checklist

Use this checklist before every deployment:

- [ ] `DATABASE_URL` — points to a real, reachable PostgreSQL instance
- [ ] `SECRET_KEY` — a long, random, unique string (not the default)
- [ ] `ADMIN_USERNAME` / `ADMIN_PASSWORD` — changed from defaults
- [ ] `SUPABASE_URL` + `SUPABASE_KEY` — Supabase project configured with a `leaf-images` bucket
- [ ] `BREVO_API_KEY` + `BREVO_SENDER_EMAIL` — Brevo account with a verified sender
- [ ] `REACT_APP_API_BASE_URL` — set to the public backend URL *before* the frontend build

---

## Deploying Gateway Firmware Updates

When you update `firmware/raspberry_gateway/gateway_serial.py`:

```bash
# On the Raspberry Pi
cd ~/Intelligent-Mango-Health-Monitoring
git pull
sudo systemctl restart mangoguard
sudo systemctl status mangoguard
```
