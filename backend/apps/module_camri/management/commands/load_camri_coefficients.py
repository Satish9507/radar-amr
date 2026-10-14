from django.core.management.base import BaseCommand
from apps.module_camri.models import CAMRICoefficient


ARB_ROWS = [
    {'column_name': 'Ec_CAZ',   'label': 'E. coli × ceftazidime',         'coefficient': 37.2,  'priority_rank': 1, 'sort_order': 1, 'source_reference': 'Cassini et al. 2019'},
    {'column_name': 'Pseu_MEM', 'label': 'P. aeruginosa × meropenem',     'coefficient': 27.2,  'priority_rank': 2, 'sort_order': 2, 'source_reference': 'Cassini et al. 2019'},
    {'column_name': 'Kleb_CAZ', 'label': 'K. pneumoniae × ceftazidime',   'coefficient': 22.5,  'priority_rank': 3, 'sort_order': 3, 'source_reference': 'Cassini et al. 2019'},
    {'column_name': 'Kleb_MEM', 'label': 'K. pneumoniae × meropenem',     'coefficient': 11.5,  'priority_rank': 4, 'sort_order': 4, 'source_reference': 'Cassini et al. 2019'},
    {'column_name': 'Ent_VAN',  'label': 'Enterococcus × vancomycin',     'coefficient': 5.49,  'priority_rank': 5, 'sort_order': 5, 'source_reference': 'Cassini et al. 2019'},
    {'column_name': 'Ec_MEM',   'label': 'E. coli × meropenem',           'coefficient': 0.80,  'priority_rank': 6, 'sort_order': 6, 'source_reference': 'Cassini et al. 2019'},
]

ARG_ROWS = [
    {'column_name': 'blaKPC',   'label': 'β-lactamase KPC',    'coefficient': 5, 'priority_rank': 1, 'sort_order': 1, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'blaCTX_M', 'label': 'β-lactamase CTX-M',  'coefficient': 5, 'priority_rank': 1, 'sort_order': 2, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'vanA',     'label': 'Vancomycin resistance','coefficient': 4, 'priority_rank': 2, 'sort_order': 3, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'blaNDM',   'label': 'β-lactamase NDM',     'coefficient': 3, 'priority_rank': 3, 'sort_order': 4, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'blaSHV',   'label': 'β-lactamase SHV',     'coefficient': 3, 'priority_rank': 3, 'sort_order': 5, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'tetO',     'label': 'Tetracycline O',       'coefficient': 3, 'priority_rank': 3, 'sort_order': 6, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'tetM',     'label': 'Tetracycline M',       'coefficient': 2, 'priority_rank': 4, 'sort_order': 7, 'source_reference': 'Zhang et al. 2019'},
    {'column_name': 'qnrA',     'label': 'Quinolone A',          'coefficient': 1, 'priority_rank': 5, 'sort_order': 8, 'source_reference': 'Zhang et al. 2019'},
]


class Command(BaseCommand):
    help = 'Seed the CAMRICoefficient table with ARB and ARG burden weights'

    def handle(self, *args, **options):
        created = updated = 0
        for coeff_type, rows in [('arb', ARB_ROWS), ('arg', ARG_ROWS)]:
            for row in rows:
                obj, was_created = CAMRICoefficient.objects.update_or_create(
                    column_name=row['column_name'],
                    defaults={**row, 'type': coeff_type},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
        self.stdout.write(
            self.style.SUCCESS(f'CAMRI coefficients: {created} created, {updated} updated')
        )
