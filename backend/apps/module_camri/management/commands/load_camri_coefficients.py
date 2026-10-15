from django.core.management.base import BaseCommand
from apps.module_camri.models import CAMRICoefficient


ARB_ROWS = [
    # Resistant pathogen × antibiotic combinations — Revised Table 2 (Cassini 2019 + GBD 2021)
    {'column_name': 'Ec_CAZ',   'label': 'E. coli × ceftazidime (3GCRE)',           'coefficient': 0.64,  'priority_rank': 1, 'sort_order': 1,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Pseu_MEM', 'label': 'P. aeruginosa × meropenem (CRPseu)',      'coefficient': 2.26,  'priority_rank': 2, 'sort_order': 2,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Kleb_CAZ', 'label': 'K. pneumoniae × ceftazidime (3GCRKP)',    'coefficient': 1.68,  'priority_rank': 3, 'sort_order': 3,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Kleb_MEM', 'label': 'K. pneumoniae × meropenem (CRKP)',        'coefficient': 3.70,  'priority_rank': 4, 'sort_order': 4,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Ent_VAN',  'label': 'Enterococcus × vancomycin (VRE)',         'coefficient': 1.75,  'priority_rank': 5, 'sort_order': 5,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Ec_MEM',   'label': 'E. coli × meropenem (CREco)',             'coefficient': 1.57,  'priority_rank': 6, 'sort_order': 6,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    # Susceptible baseline totals — GBD 2021 attribution ratios applied to Cassini 2019 anchors
    {'column_name': 'Ec',       'label': 'E. coli (susceptible baseline)',           'coefficient': 0.57,  'priority_rank': 7, 'sort_order': 7,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Ent',      'label': 'Enterococcus (susceptible baseline)',      'coefficient': 1.27,  'priority_rank': 8, 'sort_order': 8,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Kleb',     'label': 'K. pneumoniae (susceptible baseline)',     'coefficient': 1.54,  'priority_rank': 9, 'sort_order': 9,  'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
    {'column_name': 'Pseu',     'label': 'P. aeruginosa (susceptible baseline)',     'coefficient': 1.83,  'priority_rank': 10, 'sort_order': 10, 'source_reference': 'Revised Table 2 (Cassini 2019 + GBD 2021)'},
]

ARG_ROWS = [
    # Resistomap HT-qPCR primer sets — mean ARG_ranker weight (1–5 scale)
    {'column_name': 'AY254_tetA_2',       'label': 'AY254_tetA_2',       'coefficient': 5.000, 'priority_rank': 1,  'sort_order': 1,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY536_lnuB',         'label': 'AY536_lnuB',         'coefficient': 5.000, 'priority_rank': 1,  'sort_order': 2,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY533_ermB_2',       'label': 'AY533_ermB_2',       'coefficient': 5.000, 'priority_rank': 1,  'sort_order': 3,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY419_APH3-Ib',      'label': 'AY419_APH3-Ib',      'coefficient': 5.000, 'priority_rank': 1,  'sort_order': 4,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY152_blaNDM',       'label': 'AY152_blaNDM',       'coefficient': 4.303, 'priority_rank': 2,  'sort_order': 5,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY331_aadA2_3',      'label': 'AY331_aadA2_3',      'coefficient': 4.222, 'priority_rank': 2,  'sort_order': 6,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY10_aadA_1',        'label': 'AY10_aadA_1',        'coefficient': 4.000, 'priority_rank': 2,  'sort_order': 7,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY461_qnrS2',        'label': 'AY461_qnrS2',        'coefficient': 4.000, 'priority_rank': 2,  'sort_order': 8,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY125_blaGES',       'label': 'AY125_blaGES',       'coefficient': 3.667, 'priority_rank': 3,  'sort_order': 9,  'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY528_ereA',         'label': 'AY528_ereA',         'coefficient': 3.500, 'priority_rank': 3,  'sort_order': 10, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY145_blaOXA58',     'label': 'AY145_blaOXA58',     'coefficient': 3.375, 'priority_rank': 3,  'sort_order': 11, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY110_blaOXA10_1',   'label': 'AY110_blaOXA10_1',   'coefficient': 3.242, 'priority_rank': 3,  'sort_order': 12, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY263_tetW',         'label': 'AY263_tetW',         'coefficient': 3.200, 'priority_rank': 3,  'sort_order': 13, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY367_tetL_2',       'label': 'AY367_tetL_2',       'coefficient': 3.000, 'priority_rank': 3,  'sort_order': 14, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY29_catB3',         'label': 'AY29_catB3',         'coefficient': 3.000, 'priority_rank': 3,  'sort_order': 15, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY114_cfxA',         'label': 'AY114_cfxA',         'coefficient': 3.000, 'priority_rank': 3,  'sort_order': 16, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY538_mel',          'label': 'AY538_mel',          'coefficient': 3.000, 'priority_rank': 3,  'sort_order': 17, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY412_aadA7',        'label': 'AY412_aadA7',        'coefficient': 2.857, 'priority_rank': 4,  'sort_order': 18, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY446_blaCARB',      'label': 'AY446_blaCARB',      'coefficient': 2.786, 'priority_rank': 4,  'sort_order': 19, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY339_blaCMY_2',     'label': 'AY339_blaCMY_2',     'coefficient': 2.707, 'priority_rank': 4,  'sort_order': 20, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY32_floR_1',        'label': 'AY32_floR_1',        'coefficient': 2.667, 'priority_rank': 4,  'sort_order': 21, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY8_AAC6-Ib_1',      'label': 'AY8_AAC6-Ib_1',      'coefficient': 2.652, 'priority_rank': 4,  'sort_order': 22, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY460_qnrS_1',       'label': 'AY460_qnrS_1',       'coefficient': 2.636, 'priority_rank': 4,  'sort_order': 23, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY120_blaOXA1',      'label': 'AY120_blaOXA1',      'coefficient': 2.385, 'priority_rank': 4,  'sort_order': 24, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY105_blaVEB',       'label': 'AY105_blaVEB',       'coefficient': 2.359, 'priority_rank': 4,  'sort_order': 25, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY98_ampC_1',        'label': 'AY98_ampC_1',        'coefficient': 2.286, 'priority_rank': 4,  'sort_order': 26, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY96_qnrB',          'label': 'AY96_qnrB',          'coefficient': 2.118, 'priority_rank': 4,  'sort_order': 27, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY466_MCR-1',        'label': 'AY466_MCR-1',        'coefficient': 2.053, 'priority_rank': 4,  'sort_order': 28, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY439_blaTEM',       'label': 'AY439_blaTEM',       'coefficient': 2.005, 'priority_rank': 4,  'sort_order': 29, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY565_optrA',        'label': 'AY565_optrA',        'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 30, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY413_ANT2-Ia',      'label': 'AY413_ANT2-Ia',      'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 31, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY267_tetX',         'label': 'AY267_tetX',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 32, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY427_armA_1',       'label': 'AY427_armA_1',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 33, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY133_mecA',         'label': 'AY133_mecA',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 34, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY159_vanB_1',       'label': 'AY159_vanB_1',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 35, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY117_blaDHA',       'label': 'AY117_blaDHA',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 36, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY111_cphA_1',       'label': 'AY111_cphA_1',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 37, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY126_blaSFO',       'label': 'AY126_blaSFO',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 38, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY262_tetB_2',       'label': 'AY262_tetB_2',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 39, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY24_APH6-Id',       'label': 'AY24_APH6-Id',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 40, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY218_qacEdelta1_1', 'label': 'AY218_qacEdelta1_1', 'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 41, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY595_vanA',         'label': 'AY595_vanA',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 42, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY603_rmtB',         'label': 'AY603_rmtB',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 43, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY489_qacH_1',       'label': 'AY489_qacH_1',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 44, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY574_tetM',         'label': 'AY574_tetM',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 45, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY94_erm31',         'label': 'AY94_erm31',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 46, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY558_catIII',       'label': 'AY558_catIII',       'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 47, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY456_qepA',         'label': 'AY456_qepA',         'coefficient': 2.000, 'priority_rank': 4,  'sort_order': 48, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY480_Staphylococci','label': 'AY480_Staphylococci','coefficient': 2.000, 'priority_rank': 4,  'sort_order': 49, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY130_blaIMP_1',     'label': 'AY130_blaIMP_1',     'coefficient': 1.972, 'priority_rank': 5,  'sort_order': 50, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY129_blaVIM',       'label': 'AY129_blaVIM',       'coefficient': 1.767, 'priority_rank': 5,  'sort_order': 51, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY134_blaCTX-M_5',   'label': 'AY134_blaCTX-M_5',   'coefficient': 1.748, 'priority_rank': 5,  'sort_order': 52, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY601_blaOXA48',     'label': 'AY601_blaOXA48',     'coefficient': 1.698, 'priority_rank': 5,  'sort_order': 53, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY104_blaSHV_1',     'label': 'AY104_blaSHV_1',     'coefficient': 1.622, 'priority_rank': 5,  'sort_order': 54, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY448_blaHERA',      'label': 'AY448_blaHERA',      'coefficient': 1.571, 'priority_rank': 5,  'sort_order': 55, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY153_blaKPC_2',     'label': 'AY153_blaKPC_2',     'coefficient': 1.561, 'priority_rank': 5,  'sort_order': 56, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
    {'column_name': 'AY435_blaOXA51',     'label': 'AY435_blaOXA51',     'coefficient': 1.052, 'priority_rank': 5,  'sort_order': 57, 'source_reference': 'primer_ARG_weightage (ARG_ranker)'},
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
