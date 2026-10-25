# ResolveX

**ResolveX** is a scalable multi-tenant issue and service management SaaS platform.

- **Frontend**: React 19 + TypeScript + Vite + React Router v7
- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic
- **Database**: PostgreSQL (hosted on Neon / Supabase)
- **Auth**: JWT (HS256) + Argon2 password hashing
- **Deployment**: Render (Backend) + Vercel (Frontend)

---

##  Quick Start (Local Dev)

### Prerequisites
- Node.js 22+
- Python 3.12+
- PostgreSQL (or use Docker Compose)

### Option A — Docker Compose (Full Stack)
```bash
# From repo root
docker compose up --build
```
- Frontend → http://localhost:3000
- Backend  → http://localhost:8000
- API Docs → http://localhost:8000/docs

### Option B — Manual

**Backend**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # fill in your values
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                   # runs on http://localhost:3000
```

---

##  Deployment — Render + Vercel

See [`DEPLOY.md`](./DEPLOY.md) for the full step-by-step guide.

**TL;DR:**
1. Push this repo to GitHub
2. Deploy backend on **Render** (via `render.yaml` Blueprint or Web Service targeting `/backend`)
3. Deploy frontend on **Vercel** (pointing to `/frontend` root directory with `VITE_API_BASE_URL`)
4. Set `ALLOWED_ORIGINS` on Render with your Vercel URL
5. Done!

---

##  Project Structure

```
ResolveX/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # FastAPI route handlers
│   │   ├── core/            # Config, security (JWT, Argon2)
│   │   ├── db/              # SQLAlchemy models + session
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Business logic layer
│   │   └── scripts/         # Admin bootstrap
│   ├── migrations/          # Alembic migration history
│   ├── Dockerfile
│   ├── Procfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # All React pages
│   │   ├── components/      # Shared UI components
│   │   ├── context/         # Auth + Org React contexts
│   │   ├── services/api.ts  # Typed API client
│   │   └── types/           # TypeScript type definitions
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vercel.json
├── render.yaml              # Render blueprint config
├── docker-compose.yml
└── DEPLOY.md
```

---

## Default Platform Admin

On first boot the backend auto-creates the platform admin from env vars:
- `PLATFORM_ADMIN_EMAIL`
- `PLATFORM_ADMIN_PASSWORD`

**Change these before deploying to production.**