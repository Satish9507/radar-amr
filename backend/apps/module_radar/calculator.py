"""
RADAR Score calculator.

Combines outputs from QMRA, CAMRI (ARG-only), and RQ modules into a single
normalised composite risk score per water sample.

Formula:
    RADAR = W_A * S_ARB + W_B * S_ARG + W_C * S_PPCP

Where:
    S_ARB  = min(total_DALY / 1e-6, 1.0)        — from QMRA
    S_ARG  = r_arg                                — from CAMRI ARG-only
    S_PPCP = min(sum_of_max_rq_per_compound, 1.0) — from RQ (Hazard Index)
"""

from collections import defaultdict

WHO_DALY_BENCHMARK = 1e-6  # DALYs/person/year — WHO GDWQ 4th edition


def _norm_key(site, date) -> tuple:
    """Normalise (site, date) to (str, str) for reliable cross-module matching.
    Strips time component from dates like '2024-01-01 00:00:00' → '2024-01-01'.
    """
    site_str = str(site).strip() if site is not None else ''
    date_str = str(date).strip() if date is not None else ''
    # '2024-01-01 00:00:00' → '2024-01-01'
    if len(date_str) > 10 and date_str[4:5] == '-':
        date_str = date_str[:10]
    return (site_str, date_str)


# ── Risk tier ─────────────────────────────────────────────────────────────────

RADAR_TIERS = [
    {'label': 'Negligible', 'min': 0.00, 'max': 0.25, 'color': '#059669'},
    {'label': 'Low',        'min': 0.25, 'max': 0.50, 'color': '#0EA5E9'},
    {'label': 'Moderate',   'min': 0.50, 'max': 0.75, 'color': '#D97706'},
    {'label': 'High',       'min': 0.75, 'max': 1.01, 'color': '#DC2626'},
]


def _radar_tier(score: float) -> dict:
    for t in reversed(RADAR_TIERS):
        if score >= t['min']:
            return {'label': t['label'], 'color': t['color']}
    return {'label': 'Negligible', 'color': '#059669'}


# ── Weight redistribution ─────────────────────────────────────────────────────

def _redistribute_weights(w_a: float, w_b: float, w_c: float,
                          has_qmra: bool, has_camri: bool, has_rq: bool) -> tuple:
    """Return (w_a_used, w_b_used, w_c_used) summing to 1.0.
    Absent modules get weight 0; remaining weights scale proportionally."""
    wa = w_a if has_qmra  else 0.0
    wb = w_b if has_camri else 0.0
    wc = w_c if has_rq    else 0.0
    total = wa + wb + wc
    if total == 0:
        return 0.0, 0.0, 0.0
    return round(wa / total, 6), round(wb / total, 6), round(wc / total, 6)


# ── QMRA aggregation ──────────────────────────────────────────────────────────

def aggregate_qmra(qmra_results: list) -> dict:
    """
    Sum daly_baseline per (site, date).
    Returns {(site, date): total_daly}.
    """
    totals = defaultdict(float)
    for r in qmra_results:
        key = _norm_key(r.get('site'), r.get('date'))
        totals[key] += r.get('daly_baseline') or r.get('daly') or 0.0
    return dict(totals)


def normalise_daly(total_daly: float) -> float:
    return min(total_daly / WHO_DALY_BENCHMARK, 1.0)


# ── CAMRI ARG aggregation ─────────────────────────────────────────────────────

def aggregate_camri(camri_results: list) -> dict:
    """
    Map (site, date) → r_arg.
    CAMRI ARG-only mode returns one r_arg per sample_id; site+date come from
    the metadata columns parsed alongside it.
    """
    mapping = {}
    for r in camri_results:
        key = _norm_key(r.get('site'), r.get('date'))
        r_arg = r.get('r_arg')
        if r_arg is not None:
            mapping[key] = float(r_arg)
    return mapping


# ── RQ aggregation ────────────────────────────────────────────────────────────

def aggregate_rq(rq_results: list) -> dict:
    """
    For each (site, date), compute the Mixture Risk Quotient (Hazard Index):
        MRQ = sum of max(rq_eco, rq_amr) per compound
    Returns {(site, date): mrq}.
    """
    compound_rq: dict = defaultdict(dict)   # (site, date) → {compound_code: max_rq}

    for r in rq_results:
        key  = _norm_key(r.get('site'), r.get('date'))
        code = r.get('compound_code', '')
        rq_eco = r.get('rq_eco') or 0.0
        rq_amr = r.get('rq_amr') or 0.0
        compound_rq[key][code] = max(rq_eco, rq_amr)

    return {
        key: sum(compounds.values())
        for key, compounds in compound_rq.items()
    }


def normalise_mrq(mrq: float) -> float:
    return min(mrq, 1.0)


# ── Main RADAR computation ────────────────────────────────────────────────────

def compute_radar(
    qmra_by_key: dict | None,
    camri_by_key: dict | None,
    rq_by_key: dict | None,
    w_a: float = 0.50,
    w_b: float = 0.30,
    w_c: float = 0.20,
) -> tuple[list, list, list]:
    """
    Compute per-sample RADAR Scores and site-level rollup.

    Returns (sample_results, site_results, warnings).
    """
    has_qmra  = bool(qmra_by_key)
    has_camri = bool(camri_by_key)
    has_rq    = bool(rq_by_key)

    w_a_global, w_b_global, w_c_global = _redistribute_weights(
        w_a, w_b, w_c, has_qmra, has_camri, has_rq
    )

    # All site+date keys that appear in at least one uploaded module
    all_keys = (
        (set(qmra_by_key)  if has_qmra  else set()) |
        (set(camri_by_key) if has_camri else set()) |
        (set(rq_by_key)    if has_rq    else set())
    )

    warnings = []
    sample_results = []

    for key in sorted(all_keys, key=lambda k: (str(k[0]), str(k[1]))):
        site, date = key

        # Determine which modules have data for this key
        key_has_qmra  = has_qmra  and key in qmra_by_key
        key_has_camri = has_camri and key in camri_by_key
        key_has_rq    = has_rq    and key in rq_by_key

        modules_present = sum([key_has_qmra, key_has_camri, key_has_rq])
        modules_used = (
            (['QMRA']  if key_has_qmra  else []) +
            (['CAMRI'] if key_has_camri else []) +
            (['RQ']    if key_has_rq    else [])
        )

        # Warn if a sample is only in one module after cross-module matching
        if modules_present < 2:
            warnings.append({
                'code':    'SINGLE_MODULE_SAMPLE',
                'site':    site,
                'date':    date,
                'message': (
                    f'Site "{site}" / {date}: only found in {modules_used[0]} — '
                    f'excluded from RADAR Score (minimum 2 modules required per sample).'
                ),
            })
            continue

        # Per-key weight redistribution (handles partial matches within a dataset)
        wa, wb, wc = _redistribute_weights(
            w_a, w_b, w_c, key_has_qmra, key_has_camri, key_has_rq
        )

        # Component scores
        daly_raw   = qmra_by_key[key]  if key_has_qmra  else None
        r_arg_raw  = camri_by_key[key] if key_has_camri else None
        mrq_raw    = rq_by_key[key]    if key_has_rq    else None

        s_arb  = normalise_daly(daly_raw)  if daly_raw  is not None else 0.0
        s_arg  = float(r_arg_raw)          if r_arg_raw is not None else 0.0
        s_ppcp = normalise_mrq(mrq_raw)    if mrq_raw   is not None else 0.0

        radar_score = round(wa * s_arb + wb * s_arg + wc * s_ppcp, 6)
        tier = _radar_tier(radar_score)

        sample_results.append({
            'site':           site,
            'date':           date,
            'daly_raw':       round(daly_raw, 12)  if daly_raw  is not None else None,
            's_arb':          round(s_arb, 6),
            'r_arg_raw':      round(r_arg_raw, 6)  if r_arg_raw is not None else None,
            's_arg':          round(s_arg, 6),
            'mixture_rq_raw': round(mrq_raw, 6)    if mrq_raw   is not None else None,
            's_ppcp':         round(s_ppcp, 6),
            'w_a_used':       wa,
            'w_b_used':       wb,
            'w_c_used':       wc,
            'radar_score':    radar_score,
            'risk_tier':      tier['label'],
            'risk_color':     tier['color'],
            'modules_used':   modules_used,
        })

    # ── Site-level rollup ─────────────────────────────────────────────────────
    site_groups: dict = defaultdict(list)
    for r in sample_results:
        site_groups[r['site']].append(r)

    site_results = []
    for site, samples in sorted(site_groups.items()):
        n = len(samples)
        mean_radar = round(sum(s['radar_score'] for s in samples) / n, 6)
        mean_arb   = round(sum(s['s_arb']       for s in samples) / n, 6)
        mean_arg   = round(sum(s['s_arg']        for s in samples) / n, 6)
        mean_ppcp  = round(sum(s['s_ppcp']       for s in samples) / n, 6)
        tier = _radar_tier(mean_radar)

        site_results.append({
            'site':            site,
            'sample_count':    n,
            'mean_radar':      mean_radar,
            'mean_s_arb':      mean_arb,
            'mean_s_arg':      mean_arg,
            'mean_s_ppcp':     mean_ppcp,
            'risk_tier':       tier['label'],
            'risk_color':      tier['color'],
        })

    return sample_results, site_results, warnings
