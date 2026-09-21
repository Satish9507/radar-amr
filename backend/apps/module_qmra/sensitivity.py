import math
import numpy as np
import scipy.stats as st

# ─── Fixed dose-response parameters ───────────────────────────────────────────
_ALPHA_ETEC = 0.1778      # beta-Poisson α
_N50_ETEC   = 8.6e7       # beta-Poisson N50
_K_UPEC     = 1.95e-6     # exponential k
_P_UTI      = 0.067       # P(UTI | urinary colonisation)

# ─── Supported exposure types (Drinking Water excluded by design) ──────────────
_EXPOSURE_MAP = {
    'Primary Contact (Swimming)':          'swim',
    'Secondary Contact (Kayaking/Wading)': 'kay',
}

_ECOLI_KEYWORDS = ('coli', 'escherichia')


def _fit_lognormal(values):
    """Fit log-normal to positive values. Returns (meanlog, sdlog) or (None, None)."""
    arr = np.array([v for v in values if v is not None and v > 0], dtype=float)
    if len(arr) < 2:
        return None, None
    log_v = np.log(arr)
    return float(np.mean(log_v)), max(float(np.std(log_v, ddof=1)), 0.10)


def _sample_lognormal(meanlog, sdlog, n):
    if meanlog is None:
        return np.random.lognormal(0.0, 1.0, n)   # 1 CFU/mL with wide uncertainty
    return np.random.lognormal(meanlog, sdlog, n)


def _p_etec(dose, frac):
    """Beta-Poisson infection probability for ETEC."""
    beta_factor = 2 ** (1.0 / _ALPHA_ETEC) - 1.0
    return 1.0 - (1.0 + dose * frac / _N50_ETEC * beta_factor) ** (-_ALPHA_ETEC)


def _p_upec(dose, frac, p_col):
    """Exponential → urinary colonisation → UTI (three-step UPEC pathway)."""
    return (1.0 - np.exp(-_K_UPEC * dose * frac)) * p_col * _P_UTI


def _annualise(p_event, s):
    return 1.0 - (1.0 - np.clip(p_event, 0.0, 1.0 - 1e-12)) ** s


def _spearman_pair(x, y):
    """Spearman ρ and two-sided p-value for two vectors."""
    rho, pval = st.spearmanr(x, y)
    return float(rho), float(pval)


def _build_matrix(row_defs_swim, row_defs_kay, swim_outs, kay_outs):
    """
    Build 11×8 Spearman matrix by computing swim correlations (cols 0-3)
    and kayak correlations (cols 4-7) with their respective input vectors,
    then hstack — matching the R script's cbind(Ms, Mk) approach.
    """
    n_rows = len(row_defs_swim)
    rho_mat = np.zeros((n_rows, 8))
    p_mat   = np.zeros((n_rows, 8))

    col_keys = ['P_inf_ETEC', 'P_inf_UPEC', 'DALY_ETEC', 'DALY_UPEC']

    for i, (_, x) in enumerate(row_defs_swim):
        for j, key in enumerate(col_keys):
            rho, pv = _spearman_pair(x, swim_outs[key])
            rho_mat[i, j]     = round(rho, 4)
            p_mat[i, j]       = pv

    for i, (_, x) in enumerate(row_defs_kay):
        for j, key in enumerate(col_keys):
            rho, pv = _spearman_pair(x, kay_outs[key])
            rho_mat[i, j + 4] = round(rho, 4)
            p_mat[i, j + 4]   = pv

    row_labels = [name for name, _ in row_defs_swim]
    return rho_mat.tolist(), p_mat.tolist(), row_labels


def run_sensitivity_analysis(records: list, n_sim: int = 10_000) -> dict:
    """
    Monte Carlo Spearman rank sensitivity analysis for E. coli (ETEC + UPEC).

    Scope:
      - Pathogens:      E. coli only (other pathogens have no validated distributions)
      - Exposure types: Swimming and Kayaking only (Drinking Water excluded)
      - Strains:        Susceptible | ESBL/ARB (two panels)

    Returns a JSON-serialisable dict ready for the status endpoint.
    """
    # ── Filter eligible records ────────────────────────────────────────────────
    all_ecoli_rows = [
        r for r in records
        if any(kw in r.get('pathogen', '').lower() for kw in _ECOLI_KEYWORDS)
    ]
    ecoli_rows = [
        r for r in all_ecoli_rows
        if r.get('exposure_type') in _EXPOSURE_MAP
    ]

    if not ecoli_rows:
        return {
            'status': 'no_data',
            'message': (
                'Sensitivity analysis requires E. coli rows with Swimming or '
                'Kayaking/Wading exposure type. No matching rows were found in the results.'
            ),
        }

    # ── Fit log-normals per activity × strain ──────────────────────────────────
    conc_stats = {}   # (act_key, 's'|'r') → (meanlog, sdlog)
    for exposure_label, act_key in _EXPOSURE_MAP.items():
        act_rows  = [r for r in ecoli_rows if r.get('exposure_type') == exposure_label]
        fallback  = ecoli_rows   # use all E. coli if activity too sparse

        sus_vals = [r['concentration'] for r in act_rows if r.get('concentration')]
        arb_vals = [r.get('arb_concentration') for r in act_rows if r.get('arb_concentration')]

        if len(sus_vals) < 2:
            sus_vals = [r['concentration'] for r in fallback if r.get('concentration')]
        if len(arb_vals) < 2:
            arb_vals = [r.get('arb_concentration') for r in fallback if r.get('arb_concentration')]

        conc_stats[(act_key, 's')] = _fit_lognormal(sus_vals)
        conc_stats[(act_key, 'r')] = _fit_lognormal(arb_vals) if arb_vals else (None, None)

    has_arb = any(conc_stats[(ak, 'r')][0] is not None for ak in ('swim', 'kay'))

    # ── Monte Carlo draws ─────────────────────────────────────────────────────
    n = n_sim
    rng = np.random.default_rng()   # non-seeded for independent runs

    # Shared across activities
    s          = rng.uniform(30.44, 52.18, n)       # events / year

    # Pathogenic fractions — ESBL jointly from Dirichlet (Jeffreys prior)
    frac_esbl   = rng.dirichlet([7.5, 1.5, 47.5], size=n)
    p_upec_esbl = frac_esbl[:, 0]   # UPEC share of ESBL, mean ≈ 0.133
    p_etec_esbl = frac_esbl[:, 1]   # ETEC share of ESBL, mean ≈ 0.027

    p_etec_sus  = rng.beta(1.5, 28.5, n)           # ETEC fraction, mean ≈ 0.05
    p_upec_sus  = rng.uniform(0.05, 0.084, n)       # UPEC fraction, mean ≈ 0.067

    # UPEC three-step progression: P(urinary colonisation | GI colonisation)
    P_ucol_s    = rng.uniform(0.50, 0.875, n)
    P_ucol_r    = rng.uniform(0.35, 0.46,  n)

    # ETEC DALY (YLD only — no CFR/YLL term)
    DW_ETEC     = rng.uniform(0.074, 0.188, n)
    L_D_ETEC_s  = rng.uniform(3.0,   5.0,  n)
    L_D_ETEC_r  = rng.uniform(3.0,   5.0,  n)

    # UPEC DALY (YLD only — CFR = 0 for uncomplicated cystitis)
    DW_UPEC     = rng.uniform(0.039, 0.152, n)
    L_D_UPEC_s  = rng.uniform(4.0,  11.0,  n)
    L_D_UPEC_r  = rng.uniform(5.0,  12.0,  n)

    # Activity-specific exposure params
    # Swimming: corrected gamma (rate=0.6 not 60 — fixes factor-100 error in R script)
    vol_swim = rng.standard_gamma(0.45, n) / 0.6 / 0.9   # mL/hr, mean ≈ 0.83
    t_swim   = rng.uniform(0.5, 1.0, n)                   # hr

    # Kayaking: log-normal from R script (Schets et al. source)
    vol_kay  = rng.lognormal(0.788, 0.838, n)              # mL/hr
    t_kay    = rng.uniform(1.5, 3.0, n)                    # hr

    # Concentrations per activity × strain
    C_swim_s = _sample_lognormal(*conc_stats[('swim', 's')], n)
    C_swim_r = _sample_lognormal(*conc_stats[('swim', 'r')], n)
    C_kay_s  = _sample_lognormal(*conc_stats[('kay',  's')], n)
    C_kay_r  = _sample_lognormal(*conc_stats[('kay',  'r')], n)

    # ── Compute outputs per activity ───────────────────────────────────────────
    def compute(C_s, C_r, vol, t):
        dose_s = C_s * vol * t   # CFU per event (concentration CFU/mL × vol mL/hr × t hr)
        dose_r = C_r * vol * t

        pe_etec_s = _p_etec(dose_s, p_etec_sus)
        pe_upec_s = _p_upec(dose_s, p_upec_sus, P_ucol_s)
        pe_etec_r = _p_etec(dose_r, p_etec_esbl)
        pe_upec_r = _p_upec(dose_r, p_upec_esbl, P_ucol_r)

        pa_etec_s = _annualise(pe_etec_s, s)
        pa_upec_s = _annualise(pe_upec_s, s)
        pa_etec_r = _annualise(pe_etec_r, s)
        pa_upec_r = _annualise(pe_upec_r, s)

        return {
            's': {
                'P_inf_ETEC': pa_etec_s,
                'P_inf_UPEC': pa_upec_s,
                'DALY_ETEC':  pa_etec_s * DW_ETEC * L_D_ETEC_s / 365.25,
                'DALY_UPEC':  pa_upec_s * DW_UPEC * L_D_UPEC_s / 365.25,
            },
            'r': {
                'P_inf_ETEC': pa_etec_r,
                'P_inf_UPEC': pa_upec_r,
                'DALY_ETEC':  pa_etec_r * DW_ETEC * L_D_ETEC_r / 365.25,
                'DALY_UPEC':  pa_upec_r * DW_UPEC * L_D_UPEC_r / 365.25,
            },
        }

    swim_out = compute(C_swim_s, C_swim_r, vol_swim, t_swim)
    kay_out  = compute(C_kay_s,  C_kay_r,  vol_kay,  t_kay)

    # ── Build row definitions ─────────────────────────────────────────────────
    # Exposure inputs vary per activity; model inputs are shared.
    # The heatmap row label is the same for both activities — only the vector changes.
    def sus_rows(act_C, act_vol, act_t):
        return [
            ('C (susceptible)',  act_C),
            ('Volume (mL/hr)',   act_vol),
            ('Duration (hr)',    act_t),
            ('Events / yr',      s),
            ('F_ETEC (sus)',     p_etec_sus),
            ('F_UPEC (sus)',     p_upec_sus),
            ('P(ucol|gut) s',   P_ucol_s),
            ('DW ETEC',          DW_ETEC),
            ('L_D ETEC (s)',     L_D_ETEC_s),
            ('DW UPEC',          DW_UPEC),
            ('L_D UPEC (s)',     L_D_UPEC_s),
        ]

    def esbl_rows(act_C, act_vol, act_t):
        return [
            ('C (ESBL/ARB)',     act_C),
            ('Volume (mL/hr)',   act_vol),
            ('Duration (hr)',    act_t),
            ('Events / yr',      s),
            ('F_ETEC (ESBL)',    p_etec_esbl),
            ('F_UPEC (ESBL)',    p_upec_esbl),
            ('P(ucol|gut) r',   P_ucol_r),
            ('DW ETEC',          DW_ETEC),
            ('L_D ETEC (r)',     L_D_ETEC_r),
            ('DW UPEC',          DW_UPEC),
            ('L_D UPEC (r)',     L_D_UPEC_r),
        ]

    # ── Compute Spearman matrices ──────────────────────────────────────────────
    sus_rho, sus_p, sus_row_labels = _build_matrix(
        sus_rows(C_swim_s, vol_swim, t_swim),
        sus_rows(C_kay_s,  vol_kay,  t_kay),
        swim_out['s'], kay_out['s'],
    )
    esbl_rho, esbl_p, esbl_row_labels = _build_matrix(
        esbl_rows(C_swim_r, vol_swim, t_swim),
        esbl_rows(C_kay_r,  vol_kay,  t_kay),
        swim_out['r'], kay_out['r'],
    )

    col_labels = [
        'Swim: P(inf) ETEC', 'Swim: P(inf) UPEC',
        'Swim: DALY ETEC',   'Swim: DALY UPEC',
        'Kayak: P(inf) ETEC', 'Kayak: P(inf) UPEC',
        'Kayak: DALY ETEC',   'Kayak: DALY UPEC',
    ]

    return {
        'status':       'complete',
        'n_sim':        n_sim,
        'n_ecoli_rows':  len(ecoli_rows),
        'n_ecoli_total': len(all_ecoli_rows),
        'has_arb':      has_arb,
        'col_labels':   col_labels,
        'susceptible': {
            'row_labels': sus_row_labels,
            'rho':        sus_rho,
            'pvalues':    sus_p,
        },
        'esbl': {
            'row_labels': esbl_row_labels,
            'rho':        esbl_rho,
            'pvalues':    esbl_p,
        },
    }
