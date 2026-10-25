# ResolveX — Production Deployment Guide
## Render (Backend) + Vercel (Frontend)

This guide walks you through deploying ResolveX using the industry-recommended, 100% free-tier stack:
- **Backend API**: [Render.com](https://render.com) (FastAPI + Python + Alembic migrations)
- **Frontend SPA**: [Vercel](https://vercel.com) (React 19 + Vite with global Edge CDN and SPA routing)
- **Database**: [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com) (Serverless PostgreSQL)

---

## Architecture Overview

```
[ Browser / Client ]
        │
        ├──────────────────────────────┐
        ▼                              ▼
  Vercel Edge CDN              Render Web Service
 (React 19 / Vite SPA)       (FastAPI + Uvicorn API)
  https://app.vercel.app       https://api.onrender.com
        │                              │
        │ API Requests                 ▼
        └──────────────────────► PostgreSQL (Neon)
                                 sslmode=require
```

---

## Prerequisites

1. A **GitHub** account with this repository pushed.
2. A free account on **[Render.com](https://render.com)**.
3. A free account on **[Vercel](https://vercel.com)**.
4. A hosted PostgreSQL database:
   - **Neon** (recommended free Postgres): [neon.tech](https://neon.tech)
   - Copy your connection string (e.g. `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/resolvex?sslmode=require`).

---

## Step 1 — Push Code to GitHub

Ensure all configuration files are committed and pushed:

```bash
git add .
git commit -m "chore: setup Render and Vercel deployment configs"
git push origin main
```

---

## Step 2 — Deploy Backend on Render

You can deploy the backend using either the automated Blueprint or manual setup.

### Option A: 1-Click Render Blueprint (Fastest)

1. Go to [dashboard.render.com](https://dashboard.render.com/) → Click **New +** → **Blueprint**.
2. Connect your GitHub account and select the **ResolveX** repository.
3. Render reads `render.yaml` automatically and discovers `resolvex-backend`.
4. Enter the required environment values when prompted:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `PLATFORM_ADMIN_EMAIL`: Your initial admin email (e.g. `admin@yourdomain.com`).
   - `PLATFORM_ADMIN_PASSWORD`: Strong password for platform admin.
   - `PLATFORM_ADMIN_ALLOWED_DOMAIN`: Allowed domain for platform admins (or leave empty).
   - `ALLOWED_ORIGINS`: Leave empty for now (set in Step 4 after frontend is deployed).
5. Click **Apply**. Render will automatically provision the service, run migrations (`alembic upgrade head`), and start FastAPI.

---

### Option B: Manual Web Service on Render

If you prefer setting up the Web Service manually:

1. In Render Dashboard, click **New +** → **Web Service**.
2. Select your repository.
3. Configure the service settings:
   - **Name**: `resolvex-backend` (or your preferred name)
   - **Region**: Choose the region closest to your database (e.g., Ohio / Frankfurt / Singapore)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Expand **Advanced**:
   - **Health Check Path**: `/api/v1/health`
5. Under **Environment Variables**, add:

| Key | Value / Description |
|---|---|
| `PYTHON_VERSION` | `3.12.8` |
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | `postgresql://USER:PASS@HOST/DB?sslmode=require` |
| `JWT_SECRET_KEY` | Strong random secret string (see command below) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `PLATFORM_ADMIN_EMAIL` | `admin@yourdomain.com` |
| `PLATFORM_ADMIN_PASSWORD` | Strong password |
| `PLATFORM_ADMIN_ALLOWED_DOMAIN` | `yourdomain.com` (or leave blank) |
| `ALLOWED_ORIGINS` | Leave empty for now (will update in Step 4) |

> **Generate a secure JWT secret locally:**
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(48))"
> ```

6. Click **Create Web Service**.
7. Wait for the build and deployment logs to say `Application startup complete.`
8. Copy your backend service URL:
   `https://resolvex-backend.onrender.com`

#### Verify Backend:
- Open `https://resolvex-backend.onrender.com/api/v1/health` in your browser.
  - Expected response: `{"status":"healthy","service":"ResolveX API","version":"0.1.0"}`
- Open `https://resolvex-backend.onrender.com/docs` to test Swagger UI.

---

## Step 3 — Deploy Frontend on Vercel

Vercel provides instant edge deployment with zero Docker overhead for Vite React apps.

1. Go to [vercel.com/new](https://vercel.com/new).
2. Select your **ResolveX** GitHub repository and click **Import**.
3. In the project configuration screen:
   - **Project Name**: `resolvex` (or custom name)
   - **Framework Preset**: `Vite` (auto-detected)
   - **Root Directory**: Click **Edit** and choose `frontend`
   - **Build and Output Settings**: Defaults are correct (`npm run build`, output: `dist`)
4. Expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://resolvex-backend.onrender.com/api/v1` |

> ⚠️ **Important**: Replace `resolvex-backend.onrender.com` with your actual Render backend URL from Step 2. Include `/api/v1` at the end and DO NOT include a trailing slash `/`.

5. Click **Deploy**.
6. Deployment finishes in ~30 seconds.
7. Note your production frontend URL:
   `https://resolvex.vercel.app`

---

## Step 4 — Configure CORS on Backend

Now that your frontend has a live URL, authorize it to communicate with the backend:

1. Return to **Render Dashboard** → Your `resolvex-backend` service → **Environment**.
2. Find or add `ALLOWED_ORIGINS`.
3. Set its value to your Vercel URL:
   ```text
   https://resolvex.vercel.app
   ```
   *(If you have a custom domain or staging URL, separate them with commas: `https://resolvex.vercel.app,https://www.yourdomain.com`)*
4. Click **Save Changes**. Render will automatically restart the backend with the new origins.

---

## Step 5 — Verify Complete System

1. Visit your Vercel URL (`https://resolvex.vercel.app`).
2. Test the **Platform Admin** flow:
   - Navigate to `/platform-admin/login`.
   - Log in using your `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`.
   - Check that the platform dashboard loads statistics and organization lists.
3. Test the **Tenant / User** flow:
   - Register a new user account.
   - Create an organization.
   - Create a ticket/issue and add a comment.
4. Refresh any sub-route (e.g. `/platform-admin/login`) to ensure SPA routing works seamlessly without 404s (handled by `frontend/vercel.json`).

---

## Troubleshooting Guide

| Issue | Cause | Fix |
|---|---|---|
| **Render backend takes 30-50s on first load** | Render free tier spins down web services after 15 minutes of inactivity | This is normal behavior for free web services. Once awake, it remains active. You can set up a free monitor on [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to ping `/api/v1/health` every 10 minutes to keep it warm. |
| **CORS errors in browser console** | `ALLOWED_ORIGINS` does not match the frontend URL | Ensure `ALLOWED_ORIGINS` exactly matches your frontend URL (e.g. `https://resolvex.vercel.app`) with `https://` and **no trailing slash**. |
| **API calls returning 404 on frontend** | `VITE_API_BASE_URL` is missing `/api/v1` or incorrect | Ensure `VITE_API_BASE_URL` is set to `https://<backend>.onrender.com/api/v1` in Vercel project settings and trigger a Redeploy. |
| **Database connection fails on startup** | Neon requires SSL | Ensure your `DATABASE_URL` ends with `?sslmode=require`. |
| **Page reload gives 404 on Vercel** | Missing SPA rewrite rule | Ensure [`frontend/vercel.json`](./frontend/vercel.json) exists with the rewrite rule to `/index.html`. |
| **Database migration issues** | Missing table privileges | Ensure the database user specified in `DATABASE_URL` has permission to run DDL queries (`CREATE TABLE`, `ALTER TABLE`). |
