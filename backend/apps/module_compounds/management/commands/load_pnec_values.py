from django.core.management.base import BaseCommand
from apps.module_compounds.models import CompoundReference

# Extracted from the PNEC reference table provided by user.
# unit: ng/L for all values.
# None = blank in source table.
PNEC_DATA = [
    {'compound_code': 'AMX',     'compound_name': 'Amoxicillin',            'compound_class': 'Antibiotic - Penicillin',          'pnec_amr_value': 100,   'pnec_eco_value': 3.7    },
    {'compound_code': 'AMP',     'compound_name': 'Ampicillin',             'compound_class': 'Antibiotic - Penicillin',          'pnec_amr_value': 75,    'pnec_eco_value': 0.31   },
    {'compound_code': 'AZT',     'compound_name': 'Azithromycin',           'compound_class': 'Antibiotic - Macrolide',           'pnec_amr_value': 150,   'pnec_eco_value': 500    },
    {'compound_code': 'CAP',     'compound_name': 'Chloramphenicol',        'compound_class': 'Antibiotic - Amphenicol',          'pnec_amr_value': 1600,  'pnec_eco_value': 64.3   },
    {'compound_code': 'CEFX',    'compound_name': 'Cefixime',               'compound_class': 'Antibiotic - Cephalosporin',       'pnec_amr_value': 40,    'pnec_eco_value': None   },
    {'compound_code': 'CFZ',     'compound_name': 'Ceftazidime',            'compound_class': 'Antibiotic - Cephalosporin',       'pnec_amr_value': 100,   'pnec_eco_value': 130    },
    {'compound_code': 'CIPX',    'compound_name': 'Ciprofloxacin',          'compound_class': 'Antibiotic - Fluoroquinolone',     'pnec_amr_value': 20,    'pnec_eco_value': 5      },
    {'compound_code': 'CLAR',    'compound_name': 'Clarithromycin',         'compound_class': 'Antibiotic - Macrolide',           'pnec_amr_value': 40,    'pnec_eco_value': 2      },
    {'compound_code': 'CLI',     'compound_name': 'Clindamycin',            'compound_class': 'Antibiotic - Lincosamide',         'pnec_amr_value': 500,   'pnec_eco_value': 14     },
    {'compound_code': 'CTC',     'compound_name': 'Chlortetracycline',      'compound_class': 'Antibiotic - Tetracycline',        'pnec_amr_value': None,  'pnec_eco_value': 5      },
    {'compound_code': 'ENFLX',   'compound_name': 'Enrofloxacin',           'compound_class': 'Antibiotic - Fluoroquinolone',     'pnec_amr_value': 64,    'pnec_eco_value': 49     },
    {'compound_code': 'ERY',     'compound_name': 'Erythromycin',           'compound_class': 'Antibiotic - Macrolide',           'pnec_amr_value': 40,    'pnec_eco_value': 3.1    },
    {'compound_code': 'ERY-H2O', 'compound_name': 'Anhydroerythromycin',    'compound_class': 'Antibiotic - Macrolide',           'pnec_amr_value': None,  'pnec_eco_value': None   },
    {'compound_code': 'LIN',     'compound_name': 'Lincomycin',             'compound_class': 'Antibiotic - Lincosamide',         'pnec_amr_value': 2000,  'pnec_eco_value': 70     },
    {'compound_code': 'MER',     'compound_name': 'Meropenem',              'compound_class': 'Antibiotic - Carbapenem',          'pnec_amr_value': 64,    'pnec_eco_value': 36     },
    {'compound_code': 'MIN',     'compound_name': 'Minocycline',            'compound_class': 'Antibiotic - Tetracycline',        'pnec_amr_value': 300,   'pnec_eco_value': 420.8  },
    {'compound_code': 'OFLX',    'compound_name': 'Ofloxacin',              'compound_class': 'Antibiotic - Fluoroquinolone',     'pnec_amr_value': 40,    'pnec_eco_value': 4.74   },
    {'compound_code': 'OXY',     'compound_name': 'Oxytetracycline',        'compound_class': 'Antibiotic - Tetracycline',        'pnec_amr_value': 500,   'pnec_eco_value': 31     },
    {'compound_code': 'SMX',     'compound_name': 'Sulfamethoxazole',       'compound_class': 'Antibiotic - Sulfonamide',         'pnec_amr_value': 16000, 'pnec_eco_value': 59     },
    {'compound_code': 'SMZ',     'compound_name': 'Sulfamethazine',         'compound_class': 'Antibiotic - Sulfonamide',         'pnec_amr_value': None,  'pnec_eco_value': 10     },
    {'compound_code': 'TET',     'compound_name': 'Tetracycline',           'compound_class': 'Antibiotic - Tetracycline',        'pnec_amr_value': 300,   'pnec_eco_value': 5      },
    {'compound_code': 'TMP',     'compound_name': 'Trimethoprim',           'compound_class': 'Antibiotic - Diaminopyrimidine',   'pnec_amr_value': 500,   'pnec_eco_value': 32     },
    {'compound_code': 'TYL',     'compound_name': 'Tylosin',                'compound_class': 'Antibiotic - Macrolide',           'pnec_amr_value': 4000,  'pnec_eco_value': 8.9    },
    {'compound_code': 'VCM',     'compound_name': 'Vancomycin',             'compound_class': 'Antibiotic - Glycopeptide',        'pnec_amr_value': 600,   'pnec_eco_value': 370800 },
]


class Command(BaseCommand):
    help = 'Load PNEC values into compound_reference. Updates existing records, creates new ones.'

    def handle(self, *args, **kwargs):
        updated = 0
        created = 0

        for row in PNEC_DATA:
            code = row['compound_code']
            existing = CompoundReference.objects.filter(compound_code=code).first()

            if existing:
                existing.pnec_eco_value = row['pnec_eco_value']
                existing.pnec_amr_value = row['pnec_amr_value']
                existing.pnec_unit = 'ng/L'
                existing.preferred_calc_unit = 'ng/L'
                existing.pnec_source = 'AMR Industry Alliance'
                existing.save()
                self.stdout.write(f'  Updated : {code}')
                updated += 1
            else:
                CompoundReference.objects.create(
                    compound_code=code,
                    compound_name=row['compound_name'],
                    compound_class=row['compound_class'],
                    pnec_eco_value=row['pnec_eco_value'],
                    pnec_amr_value=row['pnec_amr_value'],
                    pnec_unit='ng/L',
                    preferred_calc_unit='ng/L',
                    pnec_source='AMR Industry Alliance',
                    created_by='system',
                )
                self.stdout.write(f'  Created : {code} ({row["compound_name"]})')
                created += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Updated: {updated}, Created: {created}.'
        ))
