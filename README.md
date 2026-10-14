# RADAR — Risk Assessment Dashboard for AMR Response

A free, browser-based full-stack platform for environmental AMR risk assessment. Supports four specialist modules: **Risk Quotient (RQ)**, **Quantitative Microbial Risk Assessment (QMRA)**, **Combined AMR Relative Index (CAMRI)**, and **RADAR Score** (multi-criteria composite integration).

Designed for environmental scientists, public health researchers, and water quality engineers. No login required, no data stored — all calculations run server-side and return results directly.

---

## Modules

### Risk Quotient (RQ)
Calculates ecological and antimicrobial resistance risk quotients from measured environmental concentrations.

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| RQ_Eco | MEC / PNEC_Eco | Ecological toxicity risk |
| RQ_AMR | MEC / PNEC_AMR | Antimicrobial resistance risk |

Risk thresholds: `< 1` Low, `1–10` Moderate, `≥ 10` High.
Reference: Tran et al. 2019, *Science of The Total Environment* 692, 157–174.

---

### QMRA — Quantitative Microbial Risk Assessment
Evaluates probability of infection, probability of illness, and Disability-Adjusted Life Years (DALYs) from pathogenic microorganisms in water.

| Output | Description |
|--------|-------------|
| P(infection) | Annual probability of infection per pathogen |
| P(illness) | Annual probability of illness |
| DALYs/yr | Disability-adjusted life years per year |
| dDALY | Additional DALY burden from AMR (if ARB concentration provided) |

WHO benchmark: `10⁻⁶ DALYs/person/year`.
Reference: Haas et al. 1999; Harb & Hong 2017; Goh et al. 2023.

---

### CAMRI — Combined AMR Relative Index
A 6-step relative AMR burden pipeline combining antibiotic-resistant bacteria (ARB) and resistance genes (ARG) into a single normalised burden score.

| Mode | Score | Description |
|------|-------|-------------|
| ARB only | ℜ_ARB | Burden from resistant bacteria |
| ARG only | ℜ_ARG | Burden from resistance genes |
| Combined | ℜ_AMR = α × ℜ_ARB + (1−α) × ℜ_ARG | Weighted dual-track score (default α = 0.6) |

Risk thresholds: `< 0.40` Low, `0.40–0.65` Medium, `≥ 0.65` High.
Reference: Goh et al. 2022, *Journal of Hazardous Materials*.

---

### RADAR Score — Multi-Criteria Composite Risk Index
Integrates outputs from QMRA, CAMRI (ARG only), and RQ into a single normalised composite score (0–1) per sample, with user-adjustable weights.

**Formula:**
```
RADAR = (W_A × S_ARB) + (W_B × S_ARG) + (W_C × S_PPCP)
```

| Component | Source | Normalisation | Default Weight |
|-----------|--------|---------------|----------------|
| S_ARB | QMRA — DALYs/yr | `min(Σ DALY / 1×10⁻⁶, 1.0)` | W_A = 0.50 |
| S_ARG | CAMRI ARG — ℜ_ARG | Used directly (already 0–1) | W_B = 0.30 |
| S_PPCP | RQ — Hazard Index | `min(Σ max(AMR_RQ, ECO_RQ), 1.0)` | W_C = 0.20 |

Constraint: W_A + W_B + W_C = 1.0 at all times. Missing modules redistribute their weight proportionally.

| Risk Tier | RADAR Score | Colour |
|-----------|-------------|--------|
| Negligible | 0.00 – 0.25 | Green |
| Low | 0.25 – 0.50 | Blue |
| Moderate | 0.50 – 0.75 | Amber |
| High | 0.75 – 1.00 | Red |

Samples are matched across modules by **Site + Date**. At least 2 of the 3 module files must be provided.
Reference: WHO GDWQ 4th ed. (2022) · EPA Cumulative Risk Assessment (2000) · Bengtsson-Palme & Larsson (2016) · Goh et al. (2022).
Methodology: [`docs/methodology/radar_methodology.md`](docs/methodology/radar_methodology.md)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS, Recharts |
| Backend | Django 4.2, Django REST Framework 3.15 |
| Database | PostgreSQL (Neon in production) |
| Static files | WhiteNoise |
| WSGI server | Gunicorn |

---

## Project Structure

```
amr-tool/
├── frontend/
│   ├── src/
│   │   ├── main.jsx                      # React entry point
│   │   ├── App.jsx                       # Router — all module routes
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx           # Home page with tool overview
│   │   │   ├── RQPage.jsx                # Risk Quotient module
│   │   │   ├── QMRAPage.jsx              # QMRA module
│   │   │   ├── CAMRIPage.jsx             # CAMRI module
│   │   │   ├── RADARPage.jsx             # RADAR Score module
│   │   │   └── ComingSoon.jsx            # Placeholder for future modules
│   │   ├── components/
│   │   │   ├── Header.jsx                # Page header (links back to home)
│   │   │   ├── NavBar.jsx                # Module navigation bar
│   │   │   ├── Footer.jsx                # Shared footer
│   │   │   └── SensitivityHeatmap.jsx    # Monte Carlo heatmap (QMRA)
│   │   ├── services/
│   │   │   └── api.js                    # All API calls
│   │   ├── utils/
│   │   │   └── dateUtils.js              # Shared fmtDate() — ISO → "DD Mmm YYYY"
│   │   └── hooks/
│   │       └── useBreakpoint.js
│   ├── vercel.json                       # SPA routing config for Vercel
│   └── vite.config.js
│
├── backend/
│   ├── core/
│   │   ├── settings.py                   # Django settings (env-driven)
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── module_compounds/             # PNEC compound reference data
│   │   ├── config/                       # Module config & risk thresholds
│   │   ├── module_rq/                    # RQ calculation engine & API
│   │   ├── module_qmra/                  # QMRA calculation engine & API
│   │   ├── module_camri/                 # CAMRI calculation engine & API
│   │   └── module_radar/                 # RADAR Score engine & API (stateless)
│   ├── Procfile                          # Gunicorn start for deployment
│   ├── railway.json                      # Railway deploy config (optional)
│   ├── requirements.txt
│   └── manage.py
│
└── docs/
    ├── methodology/
    │   ├── rq_methodology.md             # RQ methodology spec
    │   ├── qmra_methodology.md           # QMRA methodology spec
    │   ├── camri_methodology.md          # CAMRI methodology spec
    │   └── radar_methodology.md          # RADAR Score methodology spec
    ├── dataset/
    │   ├── RQ_Test_Dataset.xlsx          # RQ module test data
    │   ├── QMRA_Test_Dataset_v2.xlsx     # QMRA module test data
    │   ├── CAMRI_ARB_Test_Dataset.xlsx   # CAMRI ARB test data
    │   ├── CAMRI_ARG_Test_Dataset.xlsx   # CAMRI ARG test data
    │   ├── RADAR_Test_QMRA.xlsx          # RADAR — QMRA input test data
    │   ├── RADAR_Test_CAMRI_ARG.xlsx     # RADAR — CAMRI ARG input test data
    │   └── RADAR_Test_RQ.xlsx            # RADAR — RQ input test data
    ├── templates/
    │   ├── RQ_Input_Template.xlsx        # RQ Excel input template
    │   ├── QMRA_Input_Template.xlsx      # QMRA Excel input template
    │   ├── CAMRI_ARB_Input_Template.xlsx # CAMRI ARB Excel input template
    │   └── CAMRI_ARG_Input_Template.xlsx # CAMRI ARG Excel input template
    ├── reference/
    │   └── PNEC_Reference_Table.xlsx     # PNEC reference values for seeding
    └── deployment/
        ├── tmp_deployment.md             # Step-by-step free deployment guide (Render + Vercel)
        └── DEPLOYMENT.md                 # Additional deployment notes
```

---

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+

### 1. Database

```bash
psql postgres -c "CREATE DATABASE amr_tool;"
```

### 2. Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=amr_tool
DB_USER=your_postgres_username
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

Run migrations and seed all reference data:

```bash
python manage.py migrate

python manage.py load_compounds              # PNEC compound reference values
python manage.py load_module_config          # RQ module config & thresholds
python manage.py load_qmra_module_config     # QMRA module config & thresholds
python manage.py load_pathogen_profiles      # QMRA pathogen dose-response data
python manage.py load_camri_module_config    # CAMRI module config & thresholds
python manage.py load_camri_coefficients     # CAMRI ARB/ARG burden coefficients
python manage.py load_radar_module_config    # RADAR Score module config

python manage.py runserver 8000
```

### 3. Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_API_TOKEN=your-token-here
```

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## API Endpoints

All requests require a token in the `Authorization` header:

```
Authorization: Token <your-token>
```

To generate a token locally:

```bash
python manage.py createsuperuser
python manage.py drf_create_token <username>
```

In production, the token is stored as `VITE_API_TOKEN` in the Vercel environment and injected into every request by the frontend — end users never handle it directly.

### RQ

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/rq/calculate/` | Upload Excel file, returns full RQ results |
| `GET` | `/api/v1/compounds/` | List all PNEC compound reference values |
| `GET` | `/api/v1/config/RQ/` | Get RQ module config and risk thresholds |

### QMRA

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/qmra/calculate/` | Upload Excel file, returns P(infection), DALYs, dDALY |
| `POST` | `/api/v1/qmra/sensitivity/` | Start Monte Carlo sensitivity analysis |
| `GET` | `/api/v1/qmra/sensitivity/status/<task_id>/` | Poll sensitivity analysis result |
| `GET` | `/api/v1/config/QMRA/` | Get QMRA module config and risk thresholds |

### CAMRI

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/camri/validate/` | Validate ARB and/or ARG files before calculation |
| `POST` | `/api/v1/camri/calculate/` | Upload ARB/ARG files, returns ℜ_AMR results |
| `GET` | `/api/v1/camri/template/arb/` | Download ARB Excel template |
| `GET` | `/api/v1/camri/template/arg/` | Download ARG Excel template |
| `GET` | `/api/v1/config/CAMRI/` | Get CAMRI module config and risk thresholds |

### RADAR Score

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/radar/calculate/` | Upload 2–3 module files, returns per-sample RADAR scores and site rollup |

**Request fields (multipart/form-data):**

| Field | Type | Required |
|-------|------|----------|
| `qmra_file` | File (.xlsx/.xls) | Optional (at least 2 of 3) |
| `camri_arg_file` | File (.xlsx/.xls) | Optional (at least 2 of 3) |
| `rq_file` | File (.xlsx/.xls) | Optional (at least 2 of 3) |
| `w_a` | Float 0–1 | Optional (default 0.50) |
| `w_b` | Float 0–1 | Optional (default 0.30) |
| `w_c` | Float 0–1 | Optional (default 0.20) |

**Response fields:**

| Field | Description |
|-------|-------------|
| `results` | Per-sample list: site, date, s_arb, s_arg, s_ppcp, radar_score, risk_tier, w_a/b/c_used, modules_used |
| `site_summary` | Per-site rollup: mean RADAR, mean component scores, risk tier |
| `warnings` | Samples excluded due to single-module match |
| `errors` | Rows excluded during individual module processing |

---

## Excel Template Formats

All templates follow the same 3-row structure:

| Row | Content |
|-----|---------|
| Row 1 | Units row |
| Row 2 | Column headers |
| Row 3+ | Data |

Fixed columns across all templates: `Sample_ID`, `Site`, `Month`, `Date`, `Category`, `Sub_category`

**RQ template** — data columns are compound names with codes e.g. `Ciprofloxacin (CIPX)`, units `ng/L`. Download via the RQ page or generate dynamically from `/api/v1/compounds/`.

**QMRA template** — columns: `Pathogen`, `Concentration`, `Volume_L`, `Exposure_freq`, `ARB_Concentration` (optional). Units: `per 100 mL`.

**CAMRI ARB template** — data columns are resistant bacteria types: `Ec_CAZ`, `Pseu_MEM`, `Kleb_CAZ`, `Kleb_MEM`, `Ent_VAN`, `Ec_MEM`. Units: `CFU/mL`.

**CAMRI ARG template** — data columns are resistance genes: `blaKPC`, `blaCTX_M`, `vanA`, `blaNDM`, `blaSHV`, `tetO`, `tetM`, `qnrA`. Units: `copies/mL`.

**RADAR Score** — uses the same raw Excel files as the individual modules above. No separate template. Upload the QMRA, CAMRI ARG, and/or RQ files directly. Test datasets are provided in `docs/dataset/`.

---

## Reference Data

### RQ Compounds (34 total)

| Class | Compounds |
|-------|-----------|
| Antibiotics | LIN, CLI, CIPX, ENFLX, ERY-H2O, AZT, CLAR |
| Personal Care | TCC, TCS, BP-3, BPA |
| Pharmaceuticals | ATN, SUL, CBZ, SA, LOP, GFZ |
| Food Additives | CF, CYC, SAC |
| Pesticides | DEET, FIP, FIP-DESULF, FIP-SULF, FIP-SULF2 |
| Quaternary Ammonium | BDDACI, BENZ-CL, DDACI |
| Heavy Metals | AS, CR, CD, CU, PB, ZN |

### QMRA Pathogens

| Pathogen | Model |
|----------|-------|
| Cryptosporidium | Exponential |
| Giardia | Beta-Poisson |
| Rotavirus | Beta-Poisson |
| E. coli (pathogenic) | Beta-Poisson |
| Klebsiella pneumoniae | Beta-Poisson |
| Enterococcus faecium | Beta-Poisson |

### CAMRI Coefficients

ARB burden coefficients from Cassini et al. 2019 (DALY database). ARG risk ranks from Zhang et al. 2019 (ARG Ranker).

---

## Module Configuration

All risk thresholds and calculation parameters are stored in the `module_config` database table and can be updated without code changes. The frontend reads thresholds at runtime via `/api/v1/config/<MODULE>/`.

To update thresholds locally, edit the seed command for the relevant module and re-run it:

```bash
python manage.py load_module_config          # RQ
python manage.py load_qmra_module_config     # QMRA
python manage.py load_camri_module_config    # CAMRI
python manage.py load_radar_module_config    # RADAR Score
```

---

## Deployment

For a full step-by-step free deployment guide using Render and Vercel, see:

[docs/deployment/tmp_deployment.md](docs/deployment/tmp_deployment.md)

**Summary:**

| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel | Free forever |
| Backend | Render | Free forever |
| Database | Neon PostgreSQL | Free forever (512 MB) |

---

## Admin Panel

Visit `/admin` to manage compounds, pathogen profiles, module configs, and API tokens.

```bash
python manage.py createsuperuser
```
