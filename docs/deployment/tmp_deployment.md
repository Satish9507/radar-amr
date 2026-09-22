# RADAR Deployment Guide

Free deployment using **Neon** (database) + **Render** (backend) + **Vercel** (frontend).
No credit card required. All services are free forever on the tiers used here.

---

## Prerequisites — Create 4 free accounts

Sign up at each before starting:

- [github.com](https://github.com) — code hosting
- [neon.tech](https://neon.tech) — PostgreSQL database
- [render.com](https://render.com) — backend hosting
- [vercel.com](https://vercel.com) — frontend hosting

---

## Phase 1 — Push Code to GitHub

Open Terminal and navigate to the project root:

```bash
cd /Users/gunamarimuthu/amr-tool
git init
git add .
git status          # review staged files — venv/ and .env must NOT appear
git commit -m "RADAR initial deployment"
```

Go to **github.com → New repository** → name it `radar-amr` → create it (keep it public). Then:

```bash
git remote add origin https://github.com/Satish9507/radar-amr.git
git branch -M main
git push -u origin main
```

---

## Phase 2 — Create the Database on Neon

1. Go to **neon.tech → Sign up → Create project**
2. Name it `radar-db`, choose the region closest to you (US East or Singapore)
3. Once created, go to **Dashboard → Connection Details**
4. Switch the view to **Parameters only** — note down the individual values:
   - Host, Database, User, Password
5. Keep this tab open — you will need these values in Phase 3

---

## Phase 3 — Deploy the Backend on Render

1. Go to **render.com → New → Web Service**
2. Connect your GitHub account → select the `radar-amr` repo
3. Fill in the service form:

| Field | Value |
|---|---|
| Name | `radar-backend` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt && python manage.py collectstatic --noinput` |
| Start Command | see below |
| Instance Type | Free |

**Start Command** — paste this exactly:

```
python manage.py migrate && python manage.py load_compounds && python manage.py load_pnec_values && python manage.py load_module_config && python manage.py load_qmra_module_config && python manage.py load_pathogen_profiles && python manage.py load_camri_module_config && python manage.py setup_auth && gunicorn core.wsgi --log-file -
```

4. Scroll down to **Environment Variables** and add each of these:

| Key | Value |
|---|---|
| `SECRET_KEY` | any 50-character random string — generate one at [djecrety.ir](https://djecrety.ir) |
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `radar-backend-njsx.onrender.com,radar-amr.vercel.app` |
| `DB_NAME` | from Neon |
| `DB_USER` | from Neon |
| `DB_PASSWORD` | from Neon |
| `DB_HOST` | from Neon |
| `DB_PORT` | `5432` |
| `DB_SSLMODE` | `require` |
| `CORS_ALLOWED_ORIGINS` | `https://radar-amr.vercel.app` |
| `RADAR_ADMIN_USER` | `admin` |
| `RADAR_ADMIN_PASSWORD` | any password you choose |
| `RADAR_ADMIN_EMAIL` | your email |

5. Click **Create Web Service** — the first deploy takes 3–5 minutes
6. When status shows **Live**, your backend is live at `https://radar-backend-njsx.onrender.com`

---

## Phase 4 — Get the API Token

The `setup_auth` command in the start command automatically creates the admin user and token on every deploy. The token is printed to the deploy logs.

1. In Render, go to **radar-backend → Logs**
2. Look for a line like:
   ```
   RADAR_API_TOKEN=abc123def456...
   ```
3. **Copy that token value** — you will need it in Phase 5

> The token is stable across redeploys — it is only created once. If you ever need to rotate it, delete the token row from the Neon database and redeploy.

---

## Phase 5 — Deploy the Frontend on Vercel

1. Go to **vercel.com → Add New Project → Import Git Repository**
2. Select the `radar-amr` repo
3. Fill in the form:

| Field | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | `npm run build` |
| Output Directory | `dist` |

4. Under **Environment Variables** add both of these:

| Key | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://radar-backend-njsx.onrender.com/api/v1` |
| `VITE_API_TOKEN` | the token copied from Phase 4 |

5. Click **Deploy** — takes about 1 minute
6. Frontend is live at `https://radar-amr.vercel.app`

---

## Phase 6 — Final Wiring

Confirm these two env vars are set correctly in Render → radar-backend → Environment:

```
ALLOWED_HOSTS=radar-backend-njsx.onrender.com,radar-amr.vercel.app
CORS_ALLOWED_ORIGINS=https://radar-amr.vercel.app
```

If you changed anything, click **Save** — Render will auto-redeploy in about 1 minute.

---

## Phase 7 — Verify Everything Works

Open `https://radar-amr.vercel.app` and test each module:

- Landing page loads with all 3 tool cards (RQ, QMRA, CAMRI)
- RQ: download template → upload a file → calculate → export
- QMRA: download template → upload a file → calculate → export
- CAMRI: download ARB and ARG templates → upload files → calculate → export

---

## What You End Up With

| Service | URL | Cost |
|---|---|---|
| Frontend | `https://radar-amr.vercel.app` | Free forever |
| Backend | `https://radar-backend-njsx.onrender.com` | Free forever |
| Database | Neon | Free forever (512 MB — this app uses under 5 MB) |

---

## Notes

- The database holds only seeded reference data (compounds, pathogen profiles, module configs). No user data is ever stored. If the database is ever wiped, run the seed commands in Phase 3 again and everything is restored.
- The API uses token authentication. The token is embedded in the frontend build at deploy time — public users interact with the tool normally and never see or handle the token directly.
- If you need to rotate the token, delete the token row in Neon and redeploy the backend — a new token will be printed in the logs. Update `VITE_API_TOKEN` in Vercel and redeploy the frontend.
- Future code changes: push to GitHub and both Render and Vercel will auto-redeploy within minutes.
- Render's free tier sleeps after 15 minutes of no traffic. The backend takes ~30 seconds to wake on the first request. Open the live URL once before a demo to pre-warm it.
