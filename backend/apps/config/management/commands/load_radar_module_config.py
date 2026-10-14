from django.core.management.base import BaseCommand
from apps.config.models import ModuleConfig

RADAR_CONFIG = {
    'module_code': 'RADAR',
    'module_name': 'RADAR Score',
    'module_description': (
        'Multi-criteria AMR risk integration combining QMRA (ARB), CAMRI (ARG), '
        'and RQ (PPCP) outputs into a single normalised composite score (0–1).'
    ),
    'version': '1.0',
    'risk_thresholds': {
        'levels': [
            {'label': 'Negligible', 'min': 0.00, 'max': 0.25, 'color': '#059669'},
            {'label': 'Low',        'min': 0.25, 'max': 0.50, 'color': '#0EA5E9'},
            {'label': 'Moderate',   'min': 0.50, 'max': 0.75, 'color': '#D97706'},
            {'label': 'High',       'min': 0.75, 'max': 1.00, 'color': '#DC2626'},
        ]
    },
    'calculation_config': {
        'formula': 'RADAR = W_A × S_ARB + W_B × S_ARG + W_C × S_PPCP',
        'default_weights': {'w_a': 0.50, 'w_b': 0.30, 'w_c': 0.20},
        'arb_normalisation': 'min(DALY / 1e-6, 1.0)  [WHO 10⁻⁶ benchmark]',
        'arg_normalisation': 'ℜ_ARG used directly (already 0–1)',
        'ppcp_normalisation': 'min(Hazard Index, 1.0)  [sum of max(RQ_AMR, RQ_Eco) per compound]',
        'missing_module_handling': 'weights redistributed proportionally',
        'minimum_modules_required': 2,
        'reference': 'Methodology: docs/methodology/radar_methodology.md',
    },
    'input_schema': {
        'uploads': [
            {'field': 'qmra_file',      'label': 'QMRA Results',      'required': False},
            {'field': 'camri_arg_file', 'label': 'CAMRI ARG Results', 'required': False},
            {'field': 'rq_file',        'label': 'RQ Results',         'required': False},
        ],
        'accepted_formats': ['.xlsx', '.xls'],
        'note': 'At least 2 of the 3 files must be provided.',
    },
    'is_active': True,
    'created_by': 'system',
}


class Command(BaseCommand):
    help = 'Seed module_config table with RADAR Score module settings'

    def handle(self, *args, **kwargs):
        obj, created = ModuleConfig.objects.update_or_create(
            module_code=RADAR_CONFIG['module_code'],
            defaults={k: v for k, v in RADAR_CONFIG.items() if k != 'module_code'},
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} module config: RADAR v{obj.version}'))
