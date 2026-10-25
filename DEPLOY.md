# ResolveX — Railway.app Deployment Guide

## Prerequisites

- A **GitHub** account with this repo pushed
- A **Railway** account → [railway.app](https://railway.app)
- Your **Neon** (or other hosted PostgreSQL) `DATABASE_URL`

---

## Step 1 — Push Your Code to GitHub

```bash
git add .
git commit -m "chore: deployment files added"
git push origin main
```

---

## Step 2 — Create the Backend Service on Railway

1. Go to [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**
2. Select your repository
3. When asked for the **Root Directory**, set it to: `backend`
4. Railway will auto-detect the `Dockerfile`

### Set Backend Environment Variables

In your Railway backend service → **Settings → Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://USER:PASS@HOST/DB?sslmode=require` |
| `JWT_SECRET_KEY` | A strong random string (see below) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `PLATFORM_ADMIN_EMAIL` | `admin@yourdomain.com` |
| `PLATFORM_ADMIN_PASSWORD` | A strong password |
| `PLATFORM_ADMIN_ALLOWED_DOMAIN` | `yourdomain.com` |
| `ALLOWED_ORIGINS` | Leave blank for now — fill in **after** frontend deploys |
| `ENVIRONMENT` | `production` |

**Generate a JWT secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

5. Click **Deploy** and wait for it to go green ✅
6. Note your backend URL: `https://your-backend.up.railway.app`

---

## Step 3 — Create the Frontend Service on Railway

1. In the same Railway project → **New Service → GitHub Repo**
2. Select the same repository
3. Set **Root Directory** to: `frontend`
4. Railway will use the `Dockerfile`

### Set Frontend Environment Variables

In your Railway frontend service → **Settings → Variables**, add:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.up.railway.app/api/v1` |

> ⚠️ **Important**: This is a **build-time** variable for Vite. You must set it as a Railway variable AND Railway will pass it as a Docker build arg. The `railway.toml` in `/frontend` handles the wiring.

5. Deploy and note your frontend URL: `https://your-frontend.up.railway.app`

---

## Step 4 — Wire CORS

Now that you have both URLs, go back to the **backend** service variables and set:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://your-frontend.up.railway.app` |

Then **redeploy** the backend. This unlocks cross-origin requests from your frontend.

---

## Step 5 — Verify Deployment

1. **Health check**: `https://your-backend.up.railway.app/api/v1/health`
   - Should return: `{"status": "healthy", "service": "ResolveX API", "version": "0.1.0"}`
2. **API docs**: `https://your-backend.up.railway.app/docs`
3. **Frontend**: `https://your-frontend.up.railway.app`
4. **Admin login**: Go to `/platform-admin/login` and sign in with your `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`

---

## Running Migrations Manually

If you ever need to run migrations outside a deploy:

```bash
# In the Railway CLI (install: npm i -g @railway/cli)
railway run --service backend alembic upgrade head
```

Or via the Railway console in the UI.

---

## Custom Domain (Optional)

In each Railway service → **Settings → Networking → Custom Domain**, add your domain and Railway will provision a TLS certificate automatically.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Backend `500` on startup | Check the `DATABASE_URL` is correct and has `sslmode=require` |
| Frontend shows blank page | Check `VITE_API_BASE_URL` is set and matches your backend URL exactly |
| CORS errors in browser | Make sure `ALLOWED_ORIGINS` on the backend matches your frontend URL (no trailing `/`) |
| Admin login fails | Verify `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` env vars are set on the backend |
| Migration errors | Check that the database user has `CREATE TABLE` privileges |
