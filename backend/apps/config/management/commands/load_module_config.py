from django.core.management.base import BaseCommand
from apps.config.models import ModuleConfig

RQ_CONFIG = {
    'module_code': 'RQ',
    'module_name': 'Risk Quotient',
    'module_description': 'Calculates RQ_Eco and RQ_AMR for environmental contaminants using MEC/PNEC ratio.',
    'version': '1.0',
    'risk_thresholds': {
        'levels': [
            {'label': 'Low Risk',       'min': 0,   'max': 0.1,  'color': '#059669'},
            {'label': 'Moderate Risk',  'min': 0.1, 'max': 1,    'color': '#D97706'},
            {'label': 'High Risk',      'min': 1,   'max': 10,   'color': '#EA580C'},
            {'label': 'Very High Risk', 'min': 10,  'max': None, 'color': '#DC2626'},
        ]
    },
    'calculation_config': {
        'formula': 'RQ = MEC / PNEC',
        'pnec_source_table': 'compound_reference',
        'rq_types': ['rq_eco', 'rq_amr'],
        'reference': 'Tran et al. 2019, Sci Total Environ 692, 157-174',
    },
    'input_schema': {
        'unit_row': 1,
        'header_row': 2,
        'data_start_row': 3,
        'fixed_columns': ['Sample_ID', 'Site', 'Month', 'Date', 'Category', 'Sub_category'],
        'accepted_formats': ['.xlsx', '.xls'],
    },
    'created_by': 'system',
}


class Command(BaseCommand):
    help = 'Seed module_config table with RQ module settings'

    def handle(self, *args, **kwargs):
        obj, created = ModuleConfig.objects.update_or_create(
            module_code=RQ_CONFIG['module_code'],
            defaults={k: v for k, v in RQ_CONFIG.items() if k != 'module_code'},
        )
        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} module config: RQ v{obj.version}'))
