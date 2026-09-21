import math
import openpyxl
from datetime import date

# ─── Unit volume factors ───────────────────────────────────────────────────────
_UNIT_FACTOR = {
    'CFU/100ml':  0.01,
    'MPN/100ml':  0.01,
    'oocysts/L':  1.0,
    'copies/L':   1.0,
    'FFU/L':      1.0,
    'PFU/L':      1.0,
}

# ─── Supported Sample_Type values ─────────────────────────────────────────────
_SUPPORTED_SAMPLE_TYPES = {'Water'}

# ─── Exposure type defaults (volume/ingestion + events) ───────────────────────
# volume_l: standard accidental ingestion per exposure event (WHO/EPA values)
_EXPOSURE_DEFAULTS = {
    # Water
    'Drinking Water': {
        'volume_l': 1.0,
        'events_per_year': 365,
    },
    'Primary Contact (Swimming)': {
        'volume_l': 0.1,           # WHO/EPA adult swimmer standard
        'events_per_year': 50,
    },
    'Secondary Contact (Kayaking/Wading)': {
        'volume_l': 0.01,          # splash/incidental ingestion
        'events_per_year': 20,
    },
    # Food (future)
    'Consumption - General': {
        'serving_weight_g': 100.0,
        'events_per_year': 365,
    },
    'Consumption - Shellfish': {
        'serving_weight_g': 90.0,
        'events_per_year': 24,
    },
    'Consumption - Leafy Vegetables': {
        'serving_weight_g': 57.0,
        'events_per_year': 104,
    },
    # Aerosol (future)
    'Inhalation - Occupational': {
        'inhalation_m3_hr': 1.0,
        'duration_hr': 8.0,
        'events_per_year': 250,
    },
    'Inhalation - Residential': {
        'inhalation_m3_hr': 0.6,
        'duration_hr': 1.0,
        'events_per_year': 365,
    },
    # Soil (future)
    'Incidental Ingestion - Child': {
        'soil_ingestion_mg': 100.0,
        'events_per_year': 365,
    },
    'Incidental Ingestion - Adult': {
        'soil_ingestion_mg': 10.0,
        'events_per_year': 250,
    },
}

# ─── Default endpoint DALY params (fallback when pathogen has no endpoint_daly_params) ──
_DEFAULT_ENDPOINT_PARAMS = {
    'cfr_baseline':          0.010,
    'cfr_resistant':         0.010,
    'duration_baseline_days':  7.5,
    'duration_resistant_days': 7.5,
    'disability_weight':     0.067,
}


# ─── Dose calculation (branches by Sample_Type) ───────────────────────────────

def _calc_dose(sample_type: str, concentration: float, unit: str,
               log_reduction: float, volume_l: float,
               pathogenic_fraction: float = 1.0) -> float:
    if sample_type == 'Water':
        factor = _UNIT_FACTOR.get(unit, 1.0)
        return concentration * pathogenic_fraction * factor * volume_l * (10 ** (-log_reduction))
    # Food, Aerosol, Soil — stubs for future implementation
    raise NotImplementedError(
        f'Dose calculation for Sample_Type "{sample_type}" is not yet implemented.'
    )


# ─── Dose-response models ──────────────────────────────────────────────────────


def _exponential(k: float, dose: float) -> float:
    return 1.0 - math.exp(-k * dose)


def _beta_poisson(alpha: float, beta: float, dose: float) -> float:
    return 1.0 - (1.0 + dose / beta) ** (-alpha)


def _annual_prob(p_single: float, n: int) -> float:
    return 1.0 - (1.0 - p_single) ** n


def _apply_dose_response(profile, dose: float) -> float:
    if profile.model_type == 'exponential':
        return _exponential(profile.k, dose)
    return _beta_poisson(profile.alpha, profile.beta, dose)


def _calc_daly_track(p_infection: float, illness_ratio: float, ep: dict,
                     events_per_year: int, l_yll: float, resistant: bool) -> tuple:
    """
    Compute (p_annual, p_illness_annual, daly_per_person_year) for one resistance track.

    DALY = YLL + YLD
    YLL = p_illness × CFR × L_YLL
    YLD = p_illness × (1 − CFR) × DW × (duration / 365)
    """
    cfr = ep['cfr_resistant'] if resistant else ep['cfr_baseline']
    dur = (ep['duration_resistant_days'] if resistant else ep['duration_baseline_days']) / 365.0
    dw  = ep['disability_weight']

    p_annual     = _annual_prob(p_infection, events_per_year)
    p_ill_annual = _annual_prob(p_infection * illness_ratio, events_per_year)

    yll  = p_ill_annual * cfr * l_yll
    yld  = p_ill_annual * (1.0 - cfr) * dw * dur
    daly = yll + yld

    return p_annual, p_ill_annual, daly, cfr


# ─── Excel parsing ─────────────────────────────────────────────────────────────

def _to_float(val, default=None):
    if val is None or str(val).strip() in ('', 'None'):
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def _to_str(val):
    return str(val).strip() if val is not None else ''


def parse_excel(file, input_schema: dict) -> tuple[list, list]:
    """
    Parse the QMRA input Excel file.

    Required columns: Site, Date, Sample_Type, Exposure_Type, Pathogen, Endpoint,
                      Concentration, Unit, Events_Per_Year
    Optional columns: Volume_L (defaults from Exposure_Type), ARB_Concentration,
                      Log_Reduction (default 0)
    """
    header_row     = input_schema.get('header_row',     4)
    data_start_row = input_schema.get('data_start_row', 5)
    required_cols  = input_schema.get('required_columns', [
        'Site', 'Date', 'Sample_Type', 'Exposure_Type', 'Pathogen', 'Endpoint',
        'Concentration', 'Unit', 'Events_Per_Year',
    ])

    wb = openpyxl.load_workbook(file, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    if len(rows) < data_start_row:
        raise ValueError(
            f'Template must have at least {data_start_row} rows '
            f'(header at row {header_row}, data from row {data_start_row}).'
        )

    header_row_vals = rows[header_row - 1]
    col_map = {}
    for idx, cell in enumerate(header_row_vals):
        if cell is not None:
            key = str(cell).split('\n')[0].strip()
            col_map[key] = idx

    missing = [c for c in required_cols if c not in col_map]
    if missing:
        raise ValueError(
            f'Required column(s) not found in row {header_row}: {", ".join(missing)}. '
            f'Please use the official QMRA template.'
        )

    warnings = []
    records  = []

    for row_num, row in enumerate(rows[data_start_row - 1:], start=data_start_row):
        if not any(row):
            continue

        def get(col):
            idx = col_map.get(col)
            return row[idx] if idx is not None and idx < len(row) else None

        site          = _to_str(get('Site'))
        raw_date      = get('Date')
        sample_type   = _to_str(get('Sample_Type'))
        exposure_type = _to_str(get('Exposure_Type'))
        pathogen      = _to_str(get('Pathogen'))
        endpoint      = _to_str(get('Endpoint'))
        conc_raw      = _to_float(get('Concentration'))
        unit          = _to_str(get('Unit'))

        if not any([site, pathogen, conc_raw]):
            continue

        row_errors = []
        if not site:
            row_errors.append('Site is blank')
        if not pathogen:
            row_errors.append('Pathogen is blank')
        if conc_raw is None:
            row_errors.append('Concentration is blank')
        if not unit:
            row_errors.append('Unit is blank')
        if not sample_type:
            row_errors.append('Sample_Type is blank')
        if not exposure_type:
            row_errors.append('Exposure_Type is blank')

        # Validate Sample_Type is supported
        if sample_type and sample_type not in _SUPPORTED_SAMPLE_TYPES:
            warnings.append({
                'row':     row_num,
                'code':    'UNSUPPORTED_SAMPLE_TYPE',
                'message': (
                    f'Row {row_num}: Sample_Type "{sample_type}" is not yet supported '
                    f'— row skipped. Supported types: {", ".join(sorted(_SUPPORTED_SAMPLE_TYPES))}.'
                ),
            })
            continue

        # Volume_L is optional — fall back to Exposure_Type default
        exp_defaults = _EXPOSURE_DEFAULTS.get(exposure_type, {})
        volume_l = _to_float(get('Volume_L'))
        volume_l_source = 'user'
        if volume_l is None:
            volume_l = exp_defaults.get('volume_l')
            volume_l_source = 'default'
        if volume_l is None:
            row_errors.append(
                f'Volume_L is blank and no default found for Exposure_Type "{exposure_type}"'
            )

        events_per_year = _to_float(get('Events_Per_Year'))
        if events_per_year is None:
            row_errors.append('Events_Per_Year is required but blank')

        if row_errors:
            warnings.append({
                'row':     row_num,
                'code':    'MISSING_REQUIRED',
                'message': f'Row {row_num}: {"; ".join(row_errors)} — row skipped.',
            })
            continue

        if isinstance(raw_date, date):
            date_str = raw_date.strftime('%Y-%m-%d')
        elif raw_date:
            date_str = str(raw_date).strip()
        else:
            date_str = ''

        log_reduction = _to_float(get('Log_Reduction'), default=0.0)
        if log_reduction is None:
            log_reduction = 0.0

        arb_concentration = _to_float(get('ARB_Concentration'))

        if unit not in _UNIT_FACTOR:
            warnings.append({
                'row':     row_num,
                'code':    'UNKNOWN_UNIT',
                'message': (
                    f'Row {row_num}: Unit "{unit}" not recognised — '
                    f'treated as organisms/L (factor 1.0).'
                ),
            })

        records.append({
            'row':              row_num,
            'site':             site,
            'date':             date_str,
            'sample_type':      sample_type,
            'exposure_type':    exposure_type,
            'pathogen':         pathogen,
            'endpoint':         endpoint,
            'concentration':    conc_raw,
            'arb_concentration': arb_concentration,
            'unit':             unit,
            'log_reduction':    log_reduction,
            'volume_l':         volume_l,
            'volume_l_source':  volume_l_source,
            'events_per_year':  int(events_per_year),
        })

    return records, warnings


# ─── Main calculation ──────────────────────────────────────────────────────────

def get_risk_label(daly: float, thresholds: list) -> str:
    result = thresholds[0]['label'] if thresholds else 'Unknown'
    for t in thresholds:
        if daly >= t['min']:
            result = t['label']
    return result


def run_qmra_calculation(
    records: list,
    pathogen_profiles: dict,
    thresholds: list,
) -> tuple[list, list]:
    results = []
    errors  = []

    for i, rec in enumerate(records, start=1):
        pathogen = rec['pathogen']
        profile  = pathogen_profiles.get(pathogen)

        if profile is None:
            errors.append({
                'row':     rec['row'],
                'code':    'UNKNOWN_PATHOGEN',
                'message': (
                    f'Row {rec["row"]}: Pathogen "{pathogen}" not found in the database. '
                    f'Please use a pathogen from the dropdown list in the template.'
                ),
            })
            continue

        try:
            endpoint_name = rec['endpoint'] or 'Infection'
            ep_params     = profile.endpoint_daly_params or {}
            ep            = ep_params.get(endpoint_name) or ep_params.get('Infection') or _DEFAULT_ENDPOINT_PARAMS
            l_yll         = profile.life_expectancy_at_death
            illness_ratio = profile.illness_ratio
            res_illness_ratio = profile.resistant_illness_ratio if profile.resistant_illness_ratio is not None else illness_ratio

            # ── Susceptible track ─────────────────────────────────────────────
            dose_baseline = _calc_dose(
                rec['sample_type'],
                rec['concentration'],
                rec['unit'],
                rec['log_reduction'],
                rec['volume_l'],
                profile.pathogenic_fraction,
            )

            p_inf_baseline = _apply_dose_response(profile, dose_baseline)
            p_annual, p_illness, daly_baseline, cfr_baseline = _calc_daly_track(
                p_inf_baseline, illness_ratio, ep, rec['events_per_year'], l_yll, resistant=False,
            )

            model_label = 'Exponential' if profile.model_type == 'exponential' else 'Beta-Poisson'

            # ── AMR track (only if ARB_Concentration provided) ────────────────
            daly_arb    = None
            d_daly      = None
            p_inf_arb   = None
            dose_arb    = None
            cfr_resistant = ep['cfr_resistant']
            risk_label_arb = None

            arb_conc = rec.get('arb_concentration')
            if arb_conc is not None and arb_conc > 0:
                # ARB organisms: pathogenic_fraction = 1.0 (all resistant organisms assumed pathogenic)
                dose_arb = _calc_dose(
                    rec['sample_type'],
                    arb_conc,
                    rec['unit'],
                    rec['log_reduction'],
                    rec['volume_l'],
                    1.0,
                )
                p_inf_arb = _apply_dose_response(profile, dose_arb)
                _, _, daly_arb, _ = _calc_daly_track(
                    p_inf_arb, res_illness_ratio, ep, rec['events_per_year'], l_yll, resistant=True,
                )
                d_daly         = daly_arb - daly_baseline
                risk_label_arb = get_risk_label(daly_arb, thresholds)

            results.append({
                'id':               i,
                'site':             rec['site'],
                'date':             rec['date'],
                'sample_type':      rec['sample_type'],
                'exposure_type':    rec['exposure_type'],
                'pathogen':         pathogen,
                'strain':           profile.display_strain,
                'endpoint':         endpoint_name,
                'model':            model_label,
                'concentration':    rec['concentration'],
                'arb_concentration': arb_conc,
                'unit':             rec['unit'],
                'log_reduction':    rec['log_reduction'],
                'volume_l':         rec['volume_l'],
                'volume_l_source':  rec['volume_l_source'],
                'events_per_year':  rec['events_per_year'],
                'pathogenic_fraction': profile.pathogenic_fraction,
                'dose':             round(dose_baseline, 8),
                'dose_arb':         round(dose_arb, 8) if dose_arb is not None else None,
                'p_infection':      round(p_inf_baseline, 8),
                'p_infection_arb':  round(p_inf_arb, 8) if p_inf_arb is not None else None,
                'p_annual':         round(p_annual, 6),
                'p_illness':        round(p_illness, 6),
                'cfr_baseline':     cfr_baseline,
                'cfr_resistant':    cfr_resistant,
                'daly_method':      'YLL+YLD',
                'daly':             round(daly_baseline, 10),   # kept for backward compat
                'daly_baseline':    round(daly_baseline, 10),
                'daly_arb':         round(daly_arb, 10) if daly_arb is not None else None,
                'd_daly':           round(d_daly, 10) if d_daly is not None else None,
                'risk_label':       get_risk_label(daly_baseline, thresholds),
                'risk_label_arb':   risk_label_arb,
                'param_source':     profile.param_source,
                'param_source_amr': profile.param_source_amr,
            })

        except Exception as exc:
            errors.append({
                'row':     rec['row'],
                'code':    'CALC_ERROR',
                'message': f'Row {rec["row"]}: Calculation failed for "{pathogen}" — {exc}',
            })

    return results, errors


from apps.module_qmra.models import PathogenProfile  # noqa: E402
