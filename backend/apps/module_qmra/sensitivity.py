import math
import numpy as np
import scipy.stats as st
from scipy.stats import beta as sp_beta

# ─── Fixed dose-response parameters ────────────────────────────────────────────
_ALPHA_DEC = 0.1778      # beta-Poisson α (DEC includes ETEC family)
_N50_DEC   = 8.6e7       # beta-Poisson N50
_K_UPEC    = 1.95e-6     # exponential k for uropathogenic pathway
_P_UTI     = 0.067       # P(UTI | urinary colonisation)

# DEC fraction of total E. coli — logit-normal meta-analysis
# DerSimonian-Laird random-effects: Jarocki 2024, Hamilton 2010, Hamelin 2006
_DEC_PRED_MU = -3.65
_DEC_PRED_SD =  0.86

# ─── Supported exposure types ──────────────────────────────────────────────────
_EXPOSURE_MAP = {
    'Primary Contact (Swimming)':          'swim',
    'Secondary Contact (Kayaking/Wading)': 'kay',
}

_ECOLI_KEYWORDS = ('coli', 'escherichia')


def _pert_rvs(lo, mode, hi, u):
    """Evaluate PERT distribution inverse CDF at quantiles u. λ=4 (classic PERT)."""
    lam = 4.0
    r  = hi - lo
    a1 = 1.0 + lam * (mode - lo) / r
    a2 = 1.0 + lam * (hi - mode) / r
    return lo + r * sp_beta.ppf(u, a1, a2)


def _fit_lognormal(values):
    """Fit log-normal to positive values. Returns (meanlog, sdlog) or (None, None)."""
    arr = np.array([v for v in values if v is not None and v > 0], dtype=float)
    if len(arr) < 2:
        return None, None
    log_v = np.log(arr)
    return float(np.mean(log_v)), max(float(np.std(log_v, ddof=1)), 0.10)


def _sample_lognormal(meanlog, sdlog, n, rng):
    if meanlog is None:
        return rng.lognormal(0.0, 1.0, n)
    return rng.lognormal(meanlog, sdlog, n)


def _p_dec(dose, frac):
    """Beta-Poisson P(infection) for DEC. Numerical stability via expm1/log1p."""
    beta_factor = 2.0 ** (1.0 / _ALPHA_DEC) - 1.0
    y = dose * frac / _N50_DEC * beta_factor
    return -np.expm1(-_ALPHA_DEC * np.log1p(y))


def _p_upec(dose, frac, p_col):
    """Exponential → urinary colonisation → UTI. Numerical stability via expm1."""
    return -np.expm1(-_K_UPEC * dose * frac) * p_col * _P_UTI


def _annualise(p_event, s):
    """Annual probability from per-event probability. Numerical stability via expm1/log1p."""
    p = np.clip(p_event, 0.0, 1.0 - 1e-12)
    return -np.expm1(s * np.log1p(-p))


def _spearman_pair(x, y):
    """Spearman ρ and two-sided p-value."""
    rho, pval = st.spearmanr(x, y)
    return float(rho), float(pval)


def _build_matrix(row_defs, swim_outs, kay_outs, p_key, daly_key):
    """
    4-column Spearman matrix: [Swim P, Swim DALY, Kayak P, Kayak DALY].

    row_defs: list of (label, swim_vec, kay_vec)
      - Activity-specific inputs (C, volume, duration, events/yr) differ per activity.
      - Shared inputs (fractions, DW, duration) pass the same array for both columns.
    """
    n_rows = len(row_defs)
    rho_mat = np.zeros((n_rows, 4))
    p_mat   = np.zeros((n_rows, 4))
    for i, (_, xs, xk) in enumerate(row_defs):
        rho_mat[i, 0], p_mat[i, 0] = _spearman_pair(xs, swim_outs[p_key])
        rho_mat[i, 1], p_mat[i, 1] = _spearman_pair(xs, swim_outs[daly_key])
        rho_mat[i, 2], p_mat[i, 2] = _spearman_pair(xk, kay_outs[p_key])
        rho_mat[i, 3], p_mat[i, 3] = _spearman_pair(xk, kay_outs[daly_key])
    row_labels = [name for name, _, _ in row_defs]
    return (
        [[round(v, 4) for v in row] for row in rho_mat.tolist()],
        p_mat.tolist(),
        row_labels,
    )


def run_sensitivity_analysis(records: list, n_sim: int = 10_000) -> dict:
    """
    Monte Carlo Spearman rank sensitivity analysis for E. coli (DEC + UPEC).

    Three panels:
      - DEC: resistance-independent diarrhoea arm (total E. coli × p_dec_total)
      - UPEC-susceptible: UTI arm, susceptible strain
      - UPEC-ESBL: UTI arm, ESBL-resistant strain

    Exposure types: Swimming and Kayaking only.
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

    # ── Fit log-normals per activity ───────────────────────────────────────────
    conc_stats = {}   # (act_key, 'total'|'arb') → (meanlog, sdlog)
    for exposure_label, act_key in _EXPOSURE_MAP.items():
        act_rows   = [r for r in ecoli_rows if r.get('exposure_type') == exposure_label]
        fallback   = ecoli_rows

        total_vals = [r['concentration'] for r in act_rows if r.get('concentration')]
        arb_vals   = [r.get('arb_concentration') for r in act_rows if r.get('arb_concentration')]

        if len(total_vals) < 2:
            total_vals = [r['concentration'] for r in fallback if r.get('concentration')]
        if len(arb_vals) < 2:
            arb_vals = [r.get('arb_concentration') for r in fallback if r.get('arb_concentration')]

        conc_stats[(act_key, 'total')] = _fit_lognormal(total_vals)
        conc_stats[(act_key, 'arb')]   = _fit_lognormal(arb_vals) if arb_vals else (None, None)

    has_arb = any(conc_stats[(ak, 'arb')][0] is not None for ak in ('swim', 'kay'))

    # ── Monte Carlo draws ─────────────────────────────────────────────────────
    n   = n_sim
    rng = np.random.default_rng()

    # Events / year — split per activity; lower bound corrected to 12 (monthly minimum)
    s_swim = rng.uniform(12.0, 52.18, n)
    s_kay  = rng.uniform(12.0, 52.18, n)

    # DEC fraction of total E. coli — logit-normal random-effects meta-analysis
    p_dec_total = 1.0 / (1.0 + np.exp(-rng.normal(_DEC_PRED_MU, _DEC_PRED_SD, n)))

    # UPEC fractions — literature-pooled Beta priors
    # p_upec_esbl: Franz 2015 + Hussain 2026, 23/339 → Beta(23.5, 316.5)
    # p_upec_sus:  Johnson 2017 + Diallo 2013, 34/696 → Beta(34.5, 662.5)
    p_upec_esbl = rng.beta(23.5, 316.5, n)
    p_upec_sus  = rng.beta(34.5, 662.5, n)

    # UPEC three-step: P(urinary colonisation | gut colonisation)
    P_ucol_s = rng.uniform(0.50, 0.875, n)
    P_ucol_r = rng.uniform(0.35, 0.46,  n)

    # DEC DALY parameters — Watery Diarrhea revised values (Cassini et al. 2019)
    DW_DEC  = rng.uniform(0.092, 0.170, n)    # ±30% of 0.131
    L_D_DEC = rng.uniform(2.5,   4.7,  n)     # ±30% of 3.6 days

    # UPEC DALY parameters
    DW_UPEC = rng.uniform(0.039, 0.152, n)

    # UTI durations — PERT with shared quantile draw (coupled to preserve resistance penalty)
    # L_D_UPEC_s: PERT(4, 7, 11) → mean 7.17 d
    # L_D_UPEC_r: PERT(5, 7, 12) → mean 7.50 d
    u_dur      = rng.uniform(0.0, 1.0, n)
    L_D_UPEC_s = _pert_rvs(4.0, 7.0, 11.0, u_dur)
    L_D_UPEC_r = _pert_rvs(5.0, 7.0, 12.0, u_dur)

    # Swimming: ingestion corrected — Gamma(shape=0.45, scale=60) → mean 27 mL/hr
    vol_swim = rng.gamma(shape=0.45, scale=60.0, size=n)
    t_swim   = rng.uniform(0.5, 1.0, n)

    # Kayaking: updated log-normal parameters (Schets et al.) and triangular duration
    vol_kay = rng.lognormal(np.log(2.2), 0.9394, n)
    t_kay   = rng.triangular(left=1.0, mode=2.0, right=4.0, size=n)

    # Concentrations per activity
    C_swim_total = _sample_lognormal(*conc_stats[('swim', 'total')], n, rng)
    C_swim_esbl  = _sample_lognormal(*conc_stats[('swim', 'arb')],   n, rng)
    C_swim_sus   = np.maximum(C_swim_total - C_swim_esbl, 0.0)

    C_kay_total  = _sample_lognormal(*conc_stats[('kay',  'total')], n, rng)
    C_kay_esbl   = _sample_lognormal(*conc_stats[('kay',  'arb')],   n, rng)
    C_kay_sus    = np.maximum(C_kay_total - C_kay_esbl, 0.0)

    # ── Compute outputs per activity ───────────────────────────────────────────
    def _dec_outputs(C, vol, t, s):
        dose  = C * vol * t
        p_inf = _p_dec(dose, p_dec_total)
        p_ann = _annualise(p_inf, s)
        daly  = p_ann * DW_DEC * L_D_DEC / 365.25
        return {'P_ill': p_ann, 'DALY': daly}

    def _upec_outputs(C, vol, t, s, frac, p_col, L_D):
        dose  = C * vol * t
        p_uti = _p_upec(dose, frac, p_col)
        p_ann = _annualise(p_uti, s)
        daly  = p_ann * DW_UPEC * L_D / 365.25
        return {'P_ill': p_ann, 'DALY': daly}

    swim_dec  = _dec_outputs(C_swim_total, vol_swim, t_swim, s_swim)
    kay_dec   = _dec_outputs(C_kay_total,  vol_kay,  t_kay,  s_kay)

    swim_sus  = _upec_outputs(C_swim_sus,  vol_swim, t_swim, s_swim, p_upec_sus,  P_ucol_s, L_D_UPEC_s)
    kay_sus   = _upec_outputs(C_kay_sus,   vol_kay,  t_kay,  s_kay,  p_upec_sus,  P_ucol_s, L_D_UPEC_s)

    swim_esbl = _upec_outputs(C_swim_esbl, vol_swim, t_swim, s_swim, p_upec_esbl, P_ucol_r, L_D_UPEC_r)
    kay_esbl  = _upec_outputs(C_kay_esbl,  vol_kay,  t_kay,  s_kay,  p_upec_esbl, P_ucol_r, L_D_UPEC_r)

    # ── Build row definitions ──────────────────────────────────────────────────
    # Each tuple: (label, swim_vector, kay_vector)
    # Shared inputs pass the same array for both activities.
    dec_rows = [
        ('C total (E. coli)',    C_swim_total,  C_kay_total),
        ('Volume (mL/hr)',        vol_swim,      vol_kay),
        ('Duration (hr)',         t_swim,        t_kay),
        ('Events / yr',           s_swim,        s_kay),
        ('F_DEC total',           p_dec_total,   p_dec_total),
        ('DW DEC',                DW_DEC,        DW_DEC),
        ('L_D DEC (days)',        L_D_DEC,       L_D_DEC),
    ]

    sus_rows = [
        ('C susceptible',         C_swim_sus,    C_kay_sus),
        ('Volume (mL/hr)',        vol_swim,      vol_kay),
        ('Duration (hr)',         t_swim,        t_kay),
        ('Events / yr',           s_swim,        s_kay),
        ('F_UPEC (sus)',          p_upec_sus,    p_upec_sus),
        ('P(ucol|gut) sus',      P_ucol_s,      P_ucol_s),
        ('DW UPEC',               DW_UPEC,       DW_UPEC),
        ('L_D UPEC sus (days)',   L_D_UPEC_s,    L_D_UPEC_s),
    ]

    esbl_rows = [
        ('C ESBL/ARB',            C_swim_esbl,   C_kay_esbl),
        ('Volume (mL/hr)',        vol_swim,      vol_kay),
        ('Duration (hr)',         t_swim,        t_kay),
        ('Events / yr',           s_swim,        s_kay),
        ('F_UPEC (ESBL)',         p_upec_esbl,   p_upec_esbl),
        ('P(ucol|gut) ESBL',     P_ucol_r,      P_ucol_r),
        ('DW UPEC',               DW_UPEC,       DW_UPEC),
        ('L_D UPEC ESBL (days)', L_D_UPEC_r,    L_D_UPEC_r),
    ]

    # ── Compute Spearman matrices ──────────────────────────────────────────────
    dec_rho,  dec_p,  dec_labels  = _build_matrix(dec_rows,  swim_dec,  kay_dec,  'P_ill', 'DALY')
    sus_rho,  sus_p,  sus_labels  = _build_matrix(sus_rows,  swim_sus,  kay_sus,  'P_ill', 'DALY')
    esbl_rho, esbl_p, esbl_labels = _build_matrix(esbl_rows, swim_esbl, kay_esbl, 'P_ill', 'DALY')

    col_labels = ['Swim: P(ill)', 'Swim: DALY', 'Kayak: P(ill)', 'Kayak: DALY']

    return {
        'status':         'complete',
        'n_sim':          n_sim,
        'n_ecoli_rows':   len(ecoli_rows),
        'n_ecoli_total':  len(all_ecoli_rows),
        'has_arb':        has_arb,
        'col_labels':     col_labels,
        'dec': {
            'row_labels': dec_labels,
            'rho':        dec_rho,
            'pvalues':    dec_p,
        },
        'upec_sus': {
            'row_labels': sus_labels,
            'rho':        sus_rho,
            'pvalues':    sus_p,
        },
        'upec_esbl': {
            'row_labels': esbl_labels,
            'rho':        esbl_rho,
            'pvalues':    esbl_p,
        },
    }
