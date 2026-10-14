from datetime import datetime, timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.config.models import ModuleConfig
from apps.module_qmra.models import PathogenProfile
from apps.module_compounds.models import CompoundReference

from apps.module_qmra.calculator import (
    parse_excel as qmra_parse_excel,
    run_qmra_calculation,
)
from apps.module_camri.calculator import parse_camri_excel, run_camri
from apps.module_rq.calculator import (
    parse_excel as rq_parse_excel,
    run_rq_calculation,
)
from .calculator import (
    aggregate_qmra, aggregate_camri, aggregate_rq,
    compute_radar, RADAR_TIERS,
)

# ── Fallback configs (mirrors what each module uses internally) ───────────────

_QMRA_FALLBACK_THRESHOLDS = [
    {'label': 'Negligible', 'min': 0,    'max': 1e-6, 'color': '#059669'},
    {'label': 'Low',        'min': 1e-6, 'max': 1e-5, 'color': '#0EA5E9'},
    {'label': 'Moderate',   'min': 1e-5, 'max': 1e-4, 'color': '#D97706'},
    {'label': 'Very High',  'min': 1e-4, 'max': None,  'color': '#DC2626'},
]
_QMRA_FALLBACK_SCHEMA = {
    'header_row': 4, 'data_start_row': 5,
    'required_columns': [
        'Site', 'Date', 'Sample_Type', 'Exposure_Type', 'Pathogen',
        'Endpoint', 'Concentration', 'Unit', 'Events_Per_Year',
    ],
    'accepted_formats': ['.xlsx', '.xls'],
}
_RQ_FALLBACK_THRESHOLDS = [
    {'label': 'Low Risk',      'min': 0,  'max': 1,    'color': '#059669'},
    {'label': 'Moderate Risk', 'min': 1,  'max': 10,   'color': '#D97706'},
    {'label': 'High Risk',     'min': 10, 'max': None,  'color': '#DC2626'},
]
_RQ_FALLBACK_SCHEMA = {
    'unit_row': 1, 'header_row': 2, 'data_start_row': 3,
    'fixed_columns': ['Sample_ID', 'Site', 'Month', 'Date', 'Category', 'Sub_category'],
    'accepted_formats': ['.xlsx', '.xls'],
}


def _load_qmra_config():
    try:
        cfg = ModuleConfig.objects.get(module_code='QMRA', is_active=True)
        return (
            cfg.risk_thresholds.get('levels', _QMRA_FALLBACK_THRESHOLDS),
            cfg.input_schema or _QMRA_FALLBACK_SCHEMA,
        )
    except ModuleConfig.DoesNotExist:
        return _QMRA_FALLBACK_THRESHOLDS, _QMRA_FALLBACK_SCHEMA


def _load_rq_config():
    try:
        cfg = ModuleConfig.objects.get(module_code='RQ', is_active=True)
        return (
            cfg.risk_thresholds.get('levels', _RQ_FALLBACK_THRESHOLDS),
            cfg.input_schema or _RQ_FALLBACK_SCHEMA,
        )
    except ModuleConfig.DoesNotExist:
        return _RQ_FALLBACK_THRESHOLDS, _RQ_FALLBACK_SCHEMA


def _parse_weight(val, default: float) -> float:
    try:
        f = float(val)
        return max(0.0, min(1.0, f))
    except (TypeError, ValueError):
        return default


class RADARCalculateView(APIView):
    def post(self, request):
        qmra_file     = request.FILES.get('qmra_file')
        camri_arg_file = request.FILES.get('camri_arg_file')
        rq_file       = request.FILES.get('rq_file')

        files_provided = sum(bool(f) for f in [qmra_file, camri_arg_file, rq_file])

        if files_provided < 2:
            return Response(
                {
                    'status':  'error',
                    'code':    'INSUFFICIENT_MODULES',
                    'message': (
                        'At least 2 module files are required to compute a RADAR Score. '
                        'Upload any 2 or 3 of: qmra_file, camri_arg_file, rq_file.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        w_a = _parse_weight(request.data.get('w_a'), 0.50)
        w_b = _parse_weight(request.data.get('w_b'), 0.30)
        w_c = _parse_weight(request.data.get('w_c'), 0.20)

        all_warnings = []
        all_errors   = []

        # ── QMRA ─────────────────────────────────────────────────────────────
        qmra_by_key = None
        if qmra_file:
            try:
                qmra_thresholds, qmra_schema = _load_qmra_config()
                accepted = qmra_schema.get('accepted_formats', ['.xlsx', '.xls'])
                if not any(qmra_file.name.endswith(f) for f in accepted):
                    return Response(
                        {'status': 'error', 'code': 'INVALID_FILE_TYPE',
                         'message': f'QMRA file must be {", ".join(accepted)}.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                qmra_records, qmra_parse_warnings = qmra_parse_excel(qmra_file, qmra_schema)
                all_warnings.extend(qmra_parse_warnings)

                if qmra_records:
                    pathogen_names    = {r['pathogen'] for r in qmra_records}
                    pathogen_profiles = {
                        p.pathogen_name: p
                        for p in PathogenProfile.objects.filter(
                            pathogen_name__in=pathogen_names, is_active=True
                        )
                    }
                    qmra_results, qmra_errors = run_qmra_calculation(
                        qmra_records, pathogen_profiles, qmra_thresholds
                    )
                    all_errors.extend(qmra_errors)
                    qmra_by_key = aggregate_qmra(qmra_results)

            except ValueError as exc:
                return Response(
                    {'status': 'error', 'code': 'QMRA_PARSE_ERROR', 'message': str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception as exc:
                return Response(
                    {'status': 'error', 'code': 'QMRA_ERROR',
                     'message': f'Failed to process QMRA file: {exc}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── CAMRI ARG ─────────────────────────────────────────────────────────
        camri_by_key = None
        if camri_arg_file:
            try:
                if not any(camri_arg_file.name.endswith(f) for f in ['.xlsx', '.xls']):
                    return Response(
                        {'status': 'error', 'code': 'INVALID_FILE_TYPE',
                         'message': 'CAMRI ARG file must be .xlsx or .xls.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                arg_records, _, _, camri_warnings = parse_camri_excel(camri_arg_file, 'arg')
                all_warnings.extend(camri_warnings)

                if arg_records:
                    camri_output = run_camri(arg_records=arg_records)
                    camri_by_key = aggregate_camri(camri_output.get('results', []))

            except ValueError as exc:
                return Response(
                    {'status': 'error', 'code': 'CAMRI_PARSE_ERROR', 'message': str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception as exc:
                return Response(
                    {'status': 'error', 'code': 'CAMRI_ERROR',
                     'message': f'Failed to process CAMRI ARG file: {exc}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── RQ ────────────────────────────────────────────────────────────────
        rq_by_key = None
        if rq_file:
            try:
                rq_thresholds, rq_schema = _load_rq_config()
                accepted = rq_schema.get('accepted_formats', ['.xlsx', '.xls'])
                if not any(rq_file.name.endswith(f) for f in accepted):
                    return Response(
                        {'status': 'error', 'code': 'INVALID_FILE_TYPE',
                         'message': f'RQ file must be {", ".join(accepted)}.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                fixed_cols   = rq_schema.get('fixed_columns', [
                    'Sample_ID', 'Site', 'Month', 'Date', 'Category', 'Sub_category'
                ])
                data_start   = rq_schema.get('data_start_row', 3)
                rq_records, compound_map, rq_parse_warnings = rq_parse_excel(
                    rq_file, fixed_cols, data_start
                )
                all_warnings.extend(rq_parse_warnings)

                if rq_records:
                    compound_codes = [cm['code'] for cm in compound_map]
                    compounds_db   = {
                        c.compound_code: c
                        for c in CompoundReference.objects.filter(
                            compound_code__in=compound_codes, is_active=True
                        )
                    }
                    rq_results, rq_errors = run_rq_calculation(
                        rq_records, compound_map, compounds_db, rq_thresholds
                    )
                    all_errors.extend(rq_errors)
                    rq_by_key = aggregate_rq(rq_results)

            except ValueError as exc:
                return Response(
                    {'status': 'error', 'code': 'RQ_PARSE_ERROR', 'message': str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Exception as exc:
                return Response(
                    {'status': 'error', 'code': 'RQ_ERROR',
                     'message': f'Failed to process RQ file: {exc}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Re-check after processing — a file may have parsed to zero usable records
        active_modules = sum(bool(d) for d in [qmra_by_key, camri_by_key, rq_by_key])
        if active_modules < 2:
            return Response(
                {
                    'status':  'error',
                    'code':    'INSUFFICIENT_DATA',
                    'message': (
                        'After processing, fewer than 2 modules produced usable data. '
                        'Check that your files contain valid rows and recognised pathogens/compounds.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Compute RADAR ─────────────────────────────────────────────────────
        sample_results, site_results, radar_warnings = compute_radar(
            qmra_by_key, camri_by_key, rq_by_key,
            w_a=w_a, w_b=w_b, w_c=w_c,
        )
        all_warnings.extend(radar_warnings)

        modules_uploaded = (
            (['QMRA']  if qmra_file      else []) +
            (['CAMRI'] if camri_arg_file else []) +
            (['RQ']    if rq_file        else [])
        )

        return Response({
            'status':  'success',
            'module':  'RADAR',
            'version': '1.0',
            'meta': {
                'modules_uploaded': modules_uploaded,
                'total_samples':    len(sample_results),
                'total_sites':      len(site_results),
                'weights': {
                    'w_a': w_a, 'w_b': w_b, 'w_c': w_c,
                },
                'processed_at': datetime.now(timezone.utc).isoformat(),
            },
            'results':       sample_results,
            'site_summary':  site_results,
            'risk_tiers':    RADAR_TIERS,
            'errors':        all_errors,
            'warnings':      all_warnings,
        }, status=status.HTTP_200_OK)
