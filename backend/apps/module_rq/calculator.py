import re
import openpyxl
from decimal import Decimal

UNIT_TO_UGL = {'ng/L': Decimal('0.001'), 'μg/L': Decimal('1'), 'mg/L': Decimal('1000')}


def _extract_code(header: str) -> str | None:
    """Extract compound code from parentheses e.g. 'Ciprofloxacin (CIPX)' → 'CIPX'.
    Returns None if no parentheses found — caller should warn and skip the column."""
    match = re.search(r'\(([^)]+)\)', header)
    return match.group(1).upper() if match else None


def convert_to_unit(value: Decimal, from_unit: str, to_unit: str) -> Decimal:
    if from_unit == to_unit:
        return value
    value_in_ugl = value * UNIT_TO_UGL.get(from_unit, Decimal('1'))
    return value_in_ugl / UNIT_TO_UGL.get(to_unit, Decimal('1'))


def get_risk_label(rq: float, thresholds: list) -> str:
    for level in sorted(thresholds, key=lambda x: x['min'], reverse=True):
        if rq >= level['min']:
            return level['label']
    return 'Unknown'


def parse_excel(file, fixed_columns: list, data_start_row: int) -> tuple[list, list, list]:
    """
    Parse the uploaded Excel file.
    - fixed_columns: list of metadata column names from module_config input_schema
    - data_start_row: 1-indexed row where data begins (from module_config input_schema)
    Returns (records, compound_map, warnings).
    """
    wb = openpyxl.load_workbook(file, data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    num_fixed = len(fixed_columns)
    # data_start_row is 1-indexed; rows list is 0-indexed
    # rows[0] = unit row, rows[1] = header row, rows[data_start_row-1:] = data
    header_row_idx = data_start_row - 2  # row before data start
    unit_row_idx = header_row_idx - 1

    if len(rows) < data_start_row:
        raise ValueError(
            f'Template must have at least {data_start_row} rows '
            f'(unit row, header row, and at least one data row).'
        )

    units_row = rows[unit_row_idx]
    headers_row = rows[header_row_idx]

    warnings = []
    seen_codes = {}
    compound_map = []

    for col_idx in range(num_fixed, len(headers_row)):
        header = headers_row[col_idx]
        if not header:
            continue
        header = str(header).strip()

        code = _extract_code(header)
        if code is None:
            warnings.append({
                'code': 'NO_COMPOUND_CODE',
                'message': (
                    f'Column "{header}" (col {col_idx + 1}) has no compound code in parentheses — skipped. '
                    f'Update template to use format: "Compound Name (CODE)".'
                ),
            })
            continue

        if code in seen_codes:
            warnings.append({
                'code': 'DUPLICATE_COLUMN',
                'message': f'Duplicate column "{header}" (code: {code}) at column {col_idx + 1} — skipped.',
            })
            continue

        unit = (
            str(units_row[col_idx]).strip()
            if col_idx < len(units_row) and units_row[col_idx]
            else 'ng/L'
        )
        seen_codes[code] = col_idx
        compound_map.append({'header': header, 'code': code, 'unit': unit, 'col_index': col_idx})

    records = []
    for row in rows[data_start_row - 1:]:
        if not any(row):
            continue
        record = {
            fixed_columns[i]: row[i] for i in range(num_fixed) if i < len(row)
        }
        # Normalise the known fixed keys frontend expects
        record['sample_id']    = record.pop('Sample_ID',    row[0] if len(row) > 0 else None)
        record['site']         = record.pop('Site',         row[1] if len(row) > 1 else None)
        record['month']        = record.pop('Month',        row[2] if len(row) > 2 else None)
        record['date']         = str(record.pop('Date',     row[3] if len(row) > 3 else None)) if len(row) > 3 and row[3] else None
        record['category']     = record.pop('Category',     row[4] if len(row) > 4 else None)
        record['sub_category'] = record.pop('Sub_category', row[5] if len(row) > 5 else None)
        record['compounds']    = {}

        for cm in compound_map:
            raw = row[cm['col_index']] if cm['col_index'] < len(row) else None
            try:
                val = Decimal(str(raw)) if raw is not None and str(raw).strip() not in ('', 'None') else None
            except Exception:
                val = None
            record['compounds'][cm['code']] = {'value': val, 'unit': cm['unit'], 'header': cm['header']}

        records.append(record)

    return records, compound_map, warnings


def calculate_rq(mec: Decimal, pnec: Decimal, input_unit: str, pnec_unit: str, calc_unit: str) -> float:
    if mec is None or pnec is None or pnec == 0:
        return None
    mec_converted = convert_to_unit(mec, input_unit, calc_unit)
    pnec_converted = convert_to_unit(pnec, pnec_unit, calc_unit)
    return float(mec_converted / pnec_converted)


def run_rq_calculation(records: list, compound_map: list, compounds_db: dict, thresholds: list) -> tuple[list, list]:
    results = []
    errors = []

    for record in records:
        for cm in compound_map:
            code = cm['code']
            compound_data = record['compounds'].get(code, {})
            mec = compound_data.get('value')
            input_unit = compound_data.get('unit', 'ng/L')

            if mec is None:
                continue

            compound_ref = compounds_db.get(code)
            if not compound_ref:
                errors.append({
                    'code': 'MISSING_COMPOUND',
                    'compound': code,
                    'compound_header': cm['header'],
                    'sample_id': record.get('sample_id'),
                    'message': f'No PNEC reference found for compound "{code}". Add it via the admin panel.',
                })
                continue

            rq_eco = calculate_rq(mec, compound_ref.pnec_eco_value, input_unit, compound_ref.pnec_unit, compound_ref.preferred_calc_unit)
            rq_amr = calculate_rq(mec, compound_ref.pnec_amr_value, input_unit, compound_ref.pnec_unit, compound_ref.preferred_calc_unit)

            results.append({
                'sample_id':      record.get('sample_id'),
                'site':           record.get('site'),
                'month':          record.get('month'),
                'date':           record.get('date'),
                'category':       record.get('category'),
                'sub_category':   record.get('sub_category'),
                'compound_code':  code,
                'compound_name':  compound_ref.compound_name,
                'compound_class': compound_ref.compound_class,
                'mec':            float(mec),
                'mec_unit':       input_unit,
                'pnec_eco':       float(compound_ref.pnec_eco_value) if compound_ref.pnec_eco_value else None,
                'pnec_amr':       float(compound_ref.pnec_amr_value) if compound_ref.pnec_amr_value else None,
                'pnec_unit':      compound_ref.pnec_unit,
                'calc_unit':      compound_ref.preferred_calc_unit,
                'rq_eco':         round(rq_eco, 6) if rq_eco is not None else None,
                'rq_amr':         round(rq_amr, 6) if rq_amr is not None else None,
                'risk_eco':       get_risk_label(rq_eco, thresholds) if rq_eco is not None else 'No PNEC',
                'risk_amr':       get_risk_label(rq_amr, thresholds) if rq_amr is not None else 'No PNEC',
            })

    return results, errors
