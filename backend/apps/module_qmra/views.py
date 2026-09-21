from datetime import datetime, timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.config.models import ModuleConfig
from apps.module_qmra.models import PathogenProfile
from apps.module_qmra.calculator import parse_excel, run_qmra_calculation, get_risk_label

_FALLBACK_THRESHOLDS = [
    {'label': 'Negligible', 'min': 0,    'max': 1e-6, 'color': '#059669'},
    {'label': 'Low',        'min': 1e-6, 'max': 1e-5, 'color': '#0EA5E9'},
    {'label': 'Moderate',   'min': 1e-5, 'max': 1e-4, 'color': '#D97706'},
    {'label': 'Very High',  'min': 1e-4, 'max': None, 'color': '#DC2626'},
]

_FALLBACK_INPUT_SCHEMA = {
    'header_row':     4,
    'data_start_row': 5,
    'fixed_columns': [
        'Site', 'Date', 'Sample_Type', 'Pathogen', 'Endpoint',
        'Concentration', 'Unit', 'Log_Reduction', 'Volume_L', 'Events_Per_Year',
    ],
    'required_columns': [
        'Site', 'Date', 'Sample_Type', 'Pathogen', 'Endpoint', 'Concentration', 'Unit',
    ],
    'accepted_formats': ['.xlsx', '.xls'],
    'default_exposure': {
        'Drinking Water':              {'volume_l': 1.0,   'events_per_year': 365},
        'Recreational Water':          {'volume_l': 0.1,   'events_per_year': 20},
        'Irrigation Water':            {'volume_l': 0.001, 'events_per_year': 100},
        'Wastewater (worker exposure)': {'volume_l': 0.1,  'events_per_year': 250},
    },
}


def _load_module_config():
    try:
        cfg = ModuleConfig.objects.get(module_code='QMRA', is_active=True)
        return (
            cfg.risk_thresholds.get('levels', _FALLBACK_THRESHOLDS),
            cfg.input_schema if cfg.input_schema else _FALLBACK_INPUT_SCHEMA,
            cfg.version,
        )
    except ModuleConfig.DoesNotExist:
        return _FALLBACK_THRESHOLDS, _FALLBACK_INPUT_SCHEMA, '1.0'


class QMRACalculateView(APIView):
    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'status': 'error', 'code': 'NO_FILE',
                 'message': 'No file provided. Send Excel as multipart/form-data with key "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thresholds, input_schema, module_version = _load_module_config()

        accepted = input_schema.get('accepted_formats', ['.xlsx', '.xls'])
        if not any(file.name.endswith(fmt) for fmt in accepted):
            return Response(
                {'status': 'error', 'code': 'INVALID_FILE_TYPE',
                 'message': f'Only {", ".join(accepted)} files are accepted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            records, parse_warnings = parse_excel(file, input_schema)
        except ValueError as exc:
            return Response(
                {'status': 'error', 'code': 'PARSE_ERROR', 'message': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {'status': 'error', 'code': 'PARSE_ERROR',
                 'message': f'Failed to read Excel file: {exc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not records:
            return Response(
                {'status': 'error', 'code': 'EMPTY_FILE',
                 'message': 'No valid data rows found in the uploaded file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pathogen_names   = {r['pathogen'] for r in records}
        pathogen_profiles = {
            p.pathogen_name: p
            for p in PathogenProfile.objects.filter(
                pathogen_name__in=pathogen_names, is_active=True
            )
        }

        results, calc_errors = run_qmra_calculation(records, pathogen_profiles, thresholds)

        return Response({
            'status':  'success',
            'module':  'QMRA',
            'version': module_version,
            'meta': {
                'total_results':   len(results),
                'total_samples':   len(records),
                'processed_at':    datetime.now(timezone.utc).isoformat(),
            },
            'results':  results,
            'errors':   calc_errors,
            'warnings': parse_warnings,
        }, status=status.HTTP_200_OK)


class QMRAPathogenListView(APIView):
    def get(self, request):
        profiles = PathogenProfile.objects.filter(is_active=True).values(
            'pathogen_name', 'display_strain', 'model_type',
            'alpha', 'beta', 'k', 'illness_ratio', 'daly_weight', 'param_source',
        )
        return Response({'status': 'success', 'pathogens': list(profiles)})
