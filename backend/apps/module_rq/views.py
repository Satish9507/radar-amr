from datetime import datetime, timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.module_compounds.models import CompoundReference
from apps.config.models import ModuleConfig
from .calculator import parse_excel, run_rq_calculation, calculate_rq, get_risk_label

# Fallback values used only when module_config row is missing from DB
_FALLBACK_THRESHOLDS = [
    {'label': 'Low Risk',      'min': 0,  'max': 1,    'color': '#059669'},
    {'label': 'Moderate Risk', 'min': 1,  'max': 10,   'color': '#D97706'},
    {'label': 'High Risk',     'min': 10, 'max': None, 'color': '#DC2626'},
]
_FALLBACK_INPUT_SCHEMA = {
    'unit_row': 1,
    'header_row': 2,
    'data_start_row': 3,
    'fixed_columns': ['Sample_ID', 'Site', 'Month', 'Date', 'Category', 'Sub_category'],
    'accepted_formats': ['.xlsx', '.xls'],
}


def _load_module_config():
    """Load RQ module config from DB. Returns (thresholds, input_schema, version)."""
    try:
        cfg = ModuleConfig.objects.get(module_code='RQ', is_active=True)
        return (
            cfg.risk_thresholds.get('levels', _FALLBACK_THRESHOLDS),
            cfg.input_schema if cfg.input_schema else _FALLBACK_INPUT_SCHEMA,
            cfg.version,
        )
    except ModuleConfig.DoesNotExist:
        return _FALLBACK_THRESHOLDS, _FALLBACK_INPUT_SCHEMA, '1.0'


class RQCalculateView(APIView):
    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'status': 'error', 'code': 'NO_FILE', 'message': 'No file provided. Send Excel as multipart/form-data with key "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thresholds, input_schema, module_version = _load_module_config()

        accepted_formats = input_schema.get('accepted_formats', ['.xlsx', '.xls'])
        fixed_columns    = input_schema.get('fixed_columns', [])
        data_start_row   = input_schema.get('data_start_row', 3)

        file_ok = any(file.name.endswith(fmt) for fmt in accepted_formats)
        if not file_ok:
            return Response(
                {
                    'status': 'error',
                    'code': 'INVALID_FILE_TYPE',
                    'message': f'Only {", ".join(accepted_formats)} files are accepted.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            records, compound_map, parse_warnings = parse_excel(file, fixed_columns, data_start_row)
        except ValueError as e:
            return Response(
                {'status': 'error', 'code': 'PARSE_ERROR', 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {'status': 'error', 'code': 'PARSE_ERROR', 'message': f'Failed to read Excel file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not records:
            return Response(
                {'status': 'error', 'code': 'EMPTY_FILE', 'message': 'No data rows found in the uploaded file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compound_codes = [cm['code'] for cm in compound_map]
        compounds_db = {
            c.compound_code: c
            for c in CompoundReference.objects.filter(compound_code__in=compound_codes, is_active=True)
        }

        results, calc_errors = run_rq_calculation(records, compound_map, compounds_db, thresholds)

        matched   = len([c for c in compound_codes if c in compounds_db])
        unmatched = len(compound_codes) - matched

        return Response({
            'status': 'success',
            'module': 'RQ',
            'version': module_version,
            'meta': {
                'total_results':          len(results),
                'total_samples':          len(records),
                'compounds_in_template':  len(compound_map),
                'compounds_matched':      matched,
                'compounds_unmatched':    unmatched,
                'processed_at':           datetime.now(timezone.utc).isoformat(),
            },
            'results':  results,
            'errors':   calc_errors,
            'warnings': parse_warnings,
        }, status=status.HTTP_200_OK)


class RQCalculateSingleView(APIView):
    def post(self, request):
        data = request.data
        missing = [f for f in ['compound_code', 'mec', 'mec_unit'] if not data.get(f)]
        if missing:
            return Response(
                {'status': 'error', 'code': 'MISSING_FIELDS', 'message': f'Missing required fields: {", ".join(missing)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            compound = CompoundReference.objects.get(compound_code=data['compound_code'].upper(), is_active=True)
        except CompoundReference.DoesNotExist:
            return Response(
                {'status': 'error', 'code': 'COMPOUND_NOT_FOUND', 'message': f'Compound "{data["compound_code"]}" not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        thresholds, _, _ = _load_module_config()

        from decimal import Decimal
        mec      = Decimal(str(data['mec']))
        mec_unit = data['mec_unit']

        rq_eco = calculate_rq(mec, compound.pnec_eco_value, mec_unit, compound.pnec_unit, compound.preferred_calc_unit)
        rq_amr = calculate_rq(mec, compound.pnec_amr_value, mec_unit, compound.pnec_unit, compound.preferred_calc_unit)

        return Response({
            'status':        'success',
            'module':        'RQ',
            'compound_code': compound.compound_code,
            'compound_name': compound.compound_name,
            'mec':           float(mec),
            'mec_unit':      mec_unit,
            'pnec_eco':      float(compound.pnec_eco_value) if compound.pnec_eco_value else None,
            'pnec_amr':      float(compound.pnec_amr_value) if compound.pnec_amr_value else None,
            'pnec_unit':     compound.pnec_unit,
            'calc_unit':     compound.preferred_calc_unit,
            'rq_eco':        round(rq_eco, 6) if rq_eco is not None else None,
            'rq_amr':        round(rq_amr, 6) if rq_amr is not None else None,
            'risk_eco':      get_risk_label(rq_eco, thresholds) if rq_eco is not None else 'No PNEC',
            'risk_amr':      get_risk_label(rq_amr, thresholds) if rq_amr is not None else 'No PNEC',
        })
