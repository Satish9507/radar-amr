from django.core.management.base import BaseCommand
from apps.config.models import ModuleConfig

QMRA_CONFIG = {
    'module_code': 'QMRA',
    'module_name': 'QMRA',
    'module_description': (
        'Quantitative Microbial Risk Assessment — calculates dose, P(infection), P(illness) '
        'and DALYs/year for AMR-relevant waterborne pathogens using Exponential and Beta-Poisson '
        'dose-response models. Supports dual-track susceptible + ARB calculation with dDALY output.'
    ),
    'version': '2.0',
    'risk_thresholds': {
        'levels': [
            {'label': 'Below Threshold', 'min': 0,    'max': 1e-6, 'color': '#059669'},
            {'label': 'Above Threshold', 'min': 1e-6, 'max': None, 'color': '#DC2626'},
        ]
    },
    'infection_risk_thresholds': {
        'benchmark': 1e-4,
        'levels': [
            {'label': 'Below Threshold', 'min': 0,    'max': 1e-4, 'color': '#059669'},
            {'label': 'Above Threshold', 'min': 1e-4, 'max': None, 'color': '#DC2626'},
        ]
    },
    'calculation_config': {
        'formula_exponential':  'P = 1 - exp(-k × dose)',
        'formula_beta_poisson': 'P = 1 - (1 + dose/β)^(-α)',
        'daly_formula':         'DALYs/yr = (YLL + YLD); YLL = P_illness × CFR × L_YLL; YLD = P_illness × (1-CFR) × DW × (duration/365)',
        'daly_method':          'YLL+YLD (Cassini et al. 2019 framework)',
        'who_benchmark':        1e-6,
        'l_yll':                43.4,
        'reference':            'Goh et al. 2023 (J Hazard Mater); Haas et al. 1999; Harb & Hong 2017; Cassini et al. 2019 (Lancet Infect Dis)',
        'param_source_table':   'pathogen_profile',
    },
    'input_schema': {
        'header_row':      4,
        'data_start_row':  5,
        'fixed_columns': [
            'Site', 'Date', 'Sample_Type', 'Exposure_Type', 'Pathogen', 'Endpoint',
            'Concentration', 'Unit', 'ARB_Concentration', 'Log_Reduction',
            'Volume_L', 'Events_Per_Year',
        ],
        'required_columns': [
            'Site', 'Date', 'Sample_Type', 'Exposure_Type', 'Pathogen', 'Endpoint',
            'Concentration', 'Unit', 'Events_Per_Year',
        ],
        'optional_columns': ['Volume_L', 'ARB_Concentration', 'Log_Reduction'],
        'accepted_formats': ['.xlsx', '.xls'],
    },
    'created_by': 'system',
}


class Command(BaseCommand):
    help = 'Seed module_config table with QMRA v2.0 module settings'

    def handle(self, *args, **kwargs):
        obj, created = ModuleConfig.objects.update_or_create(
            module_code=QMRA_CONFIG['module_code'],
            defaults={k: v for k, v in QMRA_CONFIG.items() if k != 'module_code'},
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} module config: QMRA v{obj.version}'))
