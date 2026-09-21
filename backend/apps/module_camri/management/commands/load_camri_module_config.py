from django.core.management.base import BaseCommand
from apps.config.models import ModuleConfig

CAMRI_CONFIG = {
    'module_code': 'CAMRI',
    'module_name': 'CAMRI',
    'module_description': (
        'Combined AMR Risk Index — relative AMR burden pipeline using a 6-step algorithm '
        '(Goh et al. 2022, J. Hazardous Materials). Combines ARB (bacteria, CFU/mL) and '
        'ARG (resistance genes, copies/mL) tracks with min-max scaling and burden-weighted '
        'coefficients. Supports ARB-only, ARG-only, or combined dual-track calculation.'
    ),
    'version': '1.0',
    'risk_thresholds': {
        'levels': [
            {'label': 'Low',    'min': 0,    'max': 0.40, 'color': '#059669'},
            {'label': 'Medium', 'min': 0.40, 'max': 0.65, 'color': '#D97706'},
            {'label': 'High',   'min': 0.65, 'max': None, 'color': '#DC2626'},
        ]
    },
    'calculation_config': {
        'formula':        'r_AMR = α × r_ARB + (1−α) × r_ARG',
        'default_alpha':  0.6,
        'alpha_range':    [0.51, 1.0],
        'scaling':        'min-max per analyte column',
        'arb_source':     'Cassini et al. 2019 (DALY database)',
        'arg_source':     'Zhang et al. 2019 (ARG Ranker)',
        'reference':      'Goh et al. 2022 (J. Hazardous Materials)',
        'modes':          ['arb_only', 'arg_only', 'combined'],
        'arb_coefficients': {
            'Ec_CAZ': 37.2, 'Pseu_MEM': 27.2, 'Kleb_CAZ': 22.5,
            'Kleb_MEM': 11.5, 'Ent_VAN': 5.49, 'Ec_MEM': 0.80,
        },
        'arg_coefficients': {
            'blaKPC': 5, 'blaCTX_M': 5, 'vanA': 4,
            'blaNDM': 3, 'blaSHV': 3, 'tetO': 3, 'tetM': 2, 'qnrA': 1,
        },
    },
    'input_schema': {
        'unit_row':       1,
        'header_row':     2,
        'data_start_row': 3,
        'fixed_columns':  ['Sample_ID', 'Site', 'Month', 'Date', 'Category', 'Sub_category'],
        'arb_data_columns': ['Ec_CAZ', 'Pseu_MEM', 'Kleb_CAZ', 'Kleb_MEM', 'Ent_VAN', 'Ec_MEM'],
        'arg_data_columns': ['blaKPC', 'blaCTX_M', 'vanA', 'blaNDM', 'blaSHV', 'tetO', 'tetM', 'qnrA'],
        'arb_unit':       'CFU/mL',
        'arg_unit':       'copies/mL',
        'accepted_formats': ['.xlsx', '.xls'],
    },
    'created_by': 'system',
}


class Command(BaseCommand):
    help = 'Seed module_config table with CAMRI v1.0 module settings'

    def handle(self, *args, **kwargs):
        obj, created = ModuleConfig.objects.update_or_create(
            module_code=CAMRI_CONFIG['module_code'],
            defaults={k: v for k, v in CAMRI_CONFIG.items() if k != 'module_code'},
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} module config: CAMRI v{obj.version}'))
