import numpy as np
import openpyxl
from datetime import date as date_type

from .coefficients import (
    ARB_COEFFICIENTS, ARG_COEFFICIENTS,
    ARB_LABELS, ARG_LABELS, FIXED_META_COLS,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _minmax(arr: np.ndarray) -> np.ndarray:
    lo, hi = arr.min(), arr.max()
    if hi == lo:
        return np.zeros_like(arr, dtype=float)
    return (arr - lo) / (hi - lo)


def _to_float(val, default=0.0):
    if val is None or str(val).strip() in ('', 'None'):
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _to_str(val):
    return str(val).strip() if val is not None else ''


# ── Excel parser ───────────────────────────────────────────────────────────────

def parse_camri_excel(file, file_type: str) -> tuple:
    """
    Parse an ARB or ARG Excel file using the standard CAMRI template format.

    Template layout (matches RQ template convention):
      Row 1 — units row  (CFU/mL or copies/mL per data column)
      Row 2 — headers    (Sample_ID, Site, Month, Date, Category, Sub_category, [data cols…])
      Row 3+ — data

    file_type: 'arb' | 'arg'
    Returns: (records, matched_cols, unmatched_cols, warnings)
    """
    coeff_map = ARB_COEFFICIENTS if file_type == 'arb' else ARG_COEFFICIENTS

    wb = openpyxl.load_workbook(file, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    if len(rows) < 3:
        raise ValueError(
            'File must have at least 3 rows (row 1 = units, row 2 = headers, row 3+ = data). '
            'Please use the official CAMRI template.'
        )

    header_vals = rows[1]  # row 2 (0-indexed: 1)
    col_map = {}
    for idx, cell in enumerate(header_vals):
        if cell is not None:
            col_map[str(cell).strip()] = idx

    if 'Sample_ID' not in col_map:
        raise ValueError(
            'Column "Sample_ID" not found in row 2. Please use the official CAMRI template.'
        )

    data_cols      = [c for c in col_map if c not in FIXED_META_COLS]
    matched_cols   = [c for c in data_cols if c in coeff_map]
    unmatched_cols = [c for c in data_cols if c not in coeff_map]

    warnings = []
    records  = []

    for row_num, row in enumerate(rows[2:], start=3):
        if not any(row):
            continue

        def get(col):
            idx = col_map.get(col)
            return row[idx] if idx is not None and idx < len(row) else None

        sample_id = _to_str(get('Sample_ID'))
        if not sample_id:
            continue

        raw_date = get('Date')
        if isinstance(raw_date, date_type):
            date_str = raw_date.strftime('%Y-%m-%d')
        elif raw_date:
            date_str = str(raw_date).strip()
        else:
            date_str = ''

        data = {col: _to_float(get(col), default=0.0) for col in matched_cols}

        records.append({
            'sample_id':    sample_id,
            'site':         _to_str(get('Site')),
            'month':        _to_str(get('Month')),
            'date':         date_str,
            'category':     _to_str(get('Category')),
            'sub_category': _to_str(get('Sub_category')),
            'data':         data,
        })

    return records, matched_cols, unmatched_cols, warnings


# ── Site validation ────────────────────────────────────────────────────────────

def validate_sites(arb_records: list, arg_records: list) -> dict:
    arb_ids  = {r['sample_id'] for r in arb_records}
    arg_ids  = {r['sample_id'] for r in arg_records}
    matched  = sorted(arb_ids & arg_ids)
    arb_only = sorted(arb_ids - arg_ids)
    arg_only = sorted(arg_ids - arb_ids)
    return {
        'arb_count':  len(arb_ids),
        'arg_count':  len(arg_ids),
        'matched':    matched,
        'arb_only':   arb_only,
        'arg_only':   arg_only,
        'valid':      len(matched) > 0,
    }


# ── Risk label ─────────────────────────────────────────────────────────────────

def get_risk_label(score: float, thresholds=None) -> str:
    if thresholds:
        label = thresholds[0]['label']
        for t in sorted(thresholds, key=lambda x: x.get('min', 0)):
            if score >= t['min']:
                label = t['label']
        return label
    if score >= 0.65:
        return 'High'
    if score >= 0.40:
        return 'Medium'
    return 'Low'


# ── ARB-only pipeline (steps 1–5) ─────────────────────────────────────────────

def _run_arb_track(records: list) -> tuple:
    """Return (NS_arb, S_arb_matrix, arb_keys) for the given records."""
    arb_keys = list(ARB_COEFFICIENTS.keys())
    C_arb = np.array(
        [[r['data'].get(k, 0.0) for k in arb_keys] for r in records],
        dtype=float,
    )
    N_arb = np.apply_along_axis(_minmax, 0, C_arb)
    w_arb = np.array([ARB_COEFFICIENTS[k] for k in arb_keys], dtype=float)
    S_arb_matrix = N_arb * w_arb
    NS_arb = _minmax(S_arb_matrix.sum(axis=1))
    return NS_arb, S_arb_matrix, arb_keys


def _run_arg_track(records: list) -> tuple:
    """Return (NS_arg, S_arg_matrix, arg_keys) for the given records."""
    arg_keys = list(ARG_COEFFICIENTS.keys())
    C_arg = np.array(
        [[r['data'].get(k, 0.0) for k in arg_keys] for r in records],
        dtype=float,
    )
    N_arg = np.apply_along_axis(_minmax, 0, C_arg)
    w_arg = np.array([ARG_COEFFICIENTS[k] for k in arg_keys], dtype=float)
    S_arg_matrix = N_arg * w_arg
    NS_arg = _minmax(S_arg_matrix.sum(axis=1))
    return NS_arg, S_arg_matrix, arg_keys


# ── Main pipeline (Goh et al. 2022, Fig. 1) ───────────────────────────────────

def run_camri(
    arb_records: list | None = None,
    arg_records: list | None = None,
    alpha: float = 0.6,
    thresholds=None,
) -> dict:
    """
    6-step relative AMR burden pipeline — supports three modes:
      'combined'  — both ARB and ARG records provided (full ℜ_AMR output)
      'arb_only'  — only ARB records; returns ℜ_ARB per sample
      'arg_only'  — only ARG records; returns ℜ_ARG per sample

    alpha must be in (0.5, 1.0) — ARBs always carry more weight (Manaia 2017).
    """
    alpha = max(0.5, min(1.0, float(alpha)))

    has_arb = bool(arb_records)
    has_arg = bool(arg_records)

    if not has_arb and not has_arg:
        raise ValueError('At least one of ARB or ARG records must be provided.')

    # ── ARB-only ──────────────────────────────────────────────────────
    if has_arb and not has_arg:
        NS_arb, S_arb_matrix, arb_keys = _run_arb_track(arb_records)
        results = []
        for i, rec in enumerate(arb_records):
            score = float(NS_arb[i])
            results.append({
                'sample_id':    rec['sample_id'],
                'site':         rec['site'],
                'month':        rec['month'],
                'date':         rec['date'],
                'category':     rec['category'],
                'sub_category': rec['sub_category'],
                'r_arb':        round(score, 4),
                'r_arg':        None,
                'r_amr':        None,
                'risk_level':   get_risk_label(score, thresholds),
            })
        return {
            'mode':          'arb_only',
            'sample_ids':    [r['sample_id'] for r in arb_records],
            'arb_keys':      arb_keys,
            'arg_keys':      [],
            'arb_labels':    ARB_LABELS,
            'arg_labels':    ARG_LABELS,
            'results':       results,
            'arb_matrix':    S_arb_matrix.tolist(),
            'arg_matrix':    [],
            'sensitivity':   {},
            'alpha':         None,
            'k':             len(arb_records),
        }

    # ── ARG-only ──────────────────────────────────────────────────────
    if has_arg and not has_arb:
        NS_arg, S_arg_matrix, arg_keys = _run_arg_track(arg_records)
        results = []
        for i, rec in enumerate(arg_records):
            score = float(NS_arg[i])
            results.append({
                'sample_id':    rec['sample_id'],
                'site':         rec['site'],
                'month':        rec['month'],
                'date':         rec['date'],
                'category':     rec['category'],
                'sub_category': rec['sub_category'],
                'r_arb':        None,
                'r_arg':        round(score, 4),
                'r_amr':        None,
                'risk_level':   get_risk_label(score, thresholds),
            })
        return {
            'mode':          'arg_only',
            'sample_ids':    [r['sample_id'] for r in arg_records],
            'arb_keys':      [],
            'arg_keys':      arg_keys,
            'arb_labels':    ARB_LABELS,
            'arg_labels':    ARG_LABELS,
            'results':       results,
            'arb_matrix':    [],
            'arg_matrix':    S_arg_matrix.tolist(),
            'sensitivity':   {},
            'alpha':         None,
            'k':             len(arg_records),
        }

    # ── Combined ─────────────────────────────────────────────────────
    arb_by_id = {r['sample_id']: r for r in arb_records}
    arg_by_id = {r['sample_id']: r for r in arg_records}
    matched_ids = sorted(set(arb_by_id) & set(arg_by_id))

    if not matched_ids:
        raise ValueError('No matching Sample_IDs between ARB and ARG files.')

    matched_arb = [arb_by_id[sid] for sid in matched_ids]
    matched_arg = [arg_by_id[sid] for sid in matched_ids]

    NS_arb, S_arb_matrix, arb_keys = _run_arb_track(matched_arb)
    NS_arg, S_arg_matrix, arg_keys = _run_arg_track(matched_arg)

    NS_amr = alpha * NS_arb + (1.0 - alpha) * NS_arg

    sensitivity = {
        str(a): (a * NS_arb + (1.0 - a) * NS_arg).tolist()
        for a in [0.6, 0.7, 0.8, 0.9]
    }

    results = []
    for i, sid in enumerate(matched_ids):
        meta  = arb_by_id[sid]
        score = float(NS_amr[i])
        results.append({
            'sample_id':    sid,
            'site':         meta['site'],
            'month':        meta['month'],
            'date':         meta['date'],
            'category':     meta['category'],
            'sub_category': meta['sub_category'],
            'r_arb':        round(float(NS_arb[i]), 4),
            'r_arg':        round(float(NS_arg[i]), 4),
            'r_amr':        round(score, 4),
            'risk_level':   get_risk_label(score, thresholds),
        })

    return {
        'mode':          'combined',
        'sample_ids':    matched_ids,
        'arb_keys':      arb_keys,
        'arg_keys':      arg_keys,
        'arb_labels':    ARB_LABELS,
        'arg_labels':    ARG_LABELS,
        'results':       results,
        'arb_matrix':    S_arb_matrix.tolist(),
        'arg_matrix':    S_arg_matrix.tolist(),
        'sensitivity':   sensitivity,
        'alpha':         alpha,
        'k':             len(matched_ids),
    }
