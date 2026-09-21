from django.core.management.base import BaseCommand
from apps.module_compounds.models import CompoundReference

COMPOUNDS = [
    # Antibiotics
    {'compound_code': 'LIN',        'compound_name': 'Lincomycin',                               'compound_class': 'Antibiotic - Lincosamide'},
    {'compound_code': 'CLI',        'compound_name': 'Clindamycin',                              'compound_class': 'Antibiotic - Lincosamide'},
    {'compound_code': 'CIPX',       'compound_name': 'Ciprofloxacin',                            'compound_class': 'Antibiotic - Fluoroquinolone'},
    {'compound_code': 'ENFLX',      'compound_name': 'Enrofloxacin',                             'compound_class': 'Antibiotic - Fluoroquinolone'},
    {'compound_code': 'ERY-H2O',    'compound_name': 'Erythromycin-H2O',                         'compound_class': 'Antibiotic - Macrolide'},
    {'compound_code': 'AZT',        'compound_name': 'Azithromycin',                             'compound_class': 'Antibiotic - Macrolide'},
    {'compound_code': 'CLAR',       'compound_name': 'Clarithromycin',                           'compound_class': 'Antibiotic - Macrolide'},
    # Personal care / antimicrobials
    {'compound_code': 'TCC',        'compound_name': 'Triclocarban',                             'compound_class': 'Antimicrobial - Personal Care'},
    {'compound_code': 'TCS',        'compound_name': 'Triclosan',                                'compound_class': 'Antimicrobial - Personal Care'},
    {'compound_code': 'BP-3',       'compound_name': 'Benzophenone-3',                           'compound_class': 'UV Filter - Personal Care'},
    {'compound_code': 'BPA',        'compound_name': 'Bisphenol A',                              'compound_class': 'Industrial Chemical'},
    # Pharmaceuticals
    {'compound_code': 'ATN',        'compound_name': 'Atenolol',                                 'compound_class': 'Pharmaceutical - Beta Blocker'},
    {'compound_code': 'SUL',        'compound_name': 'Sulpiride',                                'compound_class': 'Pharmaceutical - Antipsychotic'},
    {'compound_code': 'CBZ',        'compound_name': 'Carbamazepine',                            'compound_class': 'Pharmaceutical - Anticonvulsant'},
    {'compound_code': 'SA',         'compound_name': 'Salicylic Acid',                           'compound_class': 'Pharmaceutical - Analgesic'},
    {'compound_code': 'LOP',        'compound_name': 'Lopinavir',                                'compound_class': 'Pharmaceutical - Antiretroviral'},
    {'compound_code': 'GFZ',        'compound_name': 'Gemfibrozil',                              'compound_class': 'Pharmaceutical - Lipid Regulator'},
    # Food additives / stimulants
    {'compound_code': 'CF',         'compound_name': 'Caffeine',                                 'compound_class': 'Food Additive - Stimulant'},
    {'compound_code': 'CYC',        'compound_name': 'Cyclamate',                                'compound_class': 'Food Additive - Sweetener'},
    {'compound_code': 'SAC',        'compound_name': 'Saccharin',                                'compound_class': 'Food Additive - Sweetener'},
    # Pesticides / insect repellents
    {'compound_code': 'DEET',       'compound_name': 'DEET',                                     'compound_class': 'Insect Repellent'},
    {'compound_code': 'FIP',        'compound_name': 'Fipronil',                                 'compound_class': 'Pesticide - Phenylpyrazole'},
    {'compound_code': 'FIP-DESULF', 'compound_name': 'Fipronil Desulfinyl',                      'compound_class': 'Pesticide Metabolite'},
    {'compound_code': 'FIP-SULF',   'compound_name': 'Fipronil Sulfide',                         'compound_class': 'Pesticide Metabolite'},
    {'compound_code': 'FIP-SULF2',  'compound_name': 'Fipronil Sulfone',                         'compound_class': 'Pesticide Metabolite'},
    # Quaternary ammonium compounds
    {'compound_code': 'BDDACI',     'compound_name': 'Benzyl Dimethyl Dodecyl Ammonium Chloride', 'compound_class': 'Quaternary Ammonium Compound'},
    {'compound_code': 'BENZ-CL',    'compound_name': 'Benzethonium Chloride',                    'compound_class': 'Quaternary Ammonium Compound'},
    {'compound_code': 'DDACI',      'compound_name': 'Didecyldimethylammonium Chloride',          'compound_class': 'Quaternary Ammonium Compound'},
    # Heavy metals
    {'compound_code': 'AS',         'compound_name': 'Arsenic',                                  'compound_class': 'Heavy Metal'},
    {'compound_code': 'CR',         'compound_name': 'Chromium',                                 'compound_class': 'Heavy Metal'},
    {'compound_code': 'CD',         'compound_name': 'Cadmium',                                  'compound_class': 'Heavy Metal'},
    {'compound_code': 'CU',         'compound_name': 'Copper',                                   'compound_class': 'Heavy Metal'},
    {'compound_code': 'PB',         'compound_name': 'Lead',                                     'compound_class': 'Heavy Metal'},
    {'compound_code': 'ZN',         'compound_name': 'Zinc',                                     'compound_class': 'Heavy Metal'},
]


class Command(BaseCommand):
    help = 'Seed compound_reference table with all template compounds'

    def handle(self, *args, **kwargs):
        created = 0
        updated = 0
        for data in COMPOUNDS:
            obj, is_new = CompoundReference.objects.update_or_create(
                compound_code=data['compound_code'],
                defaults={
                    'compound_name': data['compound_name'],
                    'compound_class': data['compound_class'],
                    'pnec_unit': 'ng/L',
                    'preferred_calc_unit': 'ng/L',
                    'pnec_source': 'AMR Industry Alliance',
                    'created_by': 'system',
                }
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done. Created: {created}, Updated: {updated}. '
            f'Set PNEC values via Django admin or a CSV import.'
        ))
