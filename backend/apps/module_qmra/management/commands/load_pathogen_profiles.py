from django.core.management.base import BaseCommand
from apps.module_qmra.models import PathogenProfile

# Pathogens to deactivate — retained in DB for historical records but not shown in tool
DEACTIVATE = [
    'Cryptosporidium parvum',
    'Cryptosporidium hominis',
    'Rotavirus',
    'Norovirus',
    'Campylobacter jejuni',
    'Salmonella typhi',
    'Giardia lamblia',
    'Adenovirus',
]

# ── Endpoint DALY parameters ────────────────────────────────────────────────────
# Source: Cassini et al. 2019 (Lancet Infect Dis) via Goh et al. 2023 (J Hazard Mater 458:132058)
# CFR = case fatality rate; DW = disability weight; duration in days
# Resistant column = 3rd-generation cephalosporin resistant (most environmentally prevalent)

_ECOLI_ENDPOINT_DALY = {
    'UTI': {
        'cfr_baseline': 0.000, 'cfr_resistant': 0.000,
        'duration_baseline_days': 7.5, 'duration_resistant_days': 8.5,
        'disability_weight': 0.095,
    },
    'BSI': {
        'cfr_baseline': 0.137, 'cfr_resistant': 0.178,
        'duration_baseline_days': 8.69, 'duration_resistant_days': 12.25,
        'disability_weight': 0.128,
    },
    'Watery Diarrhea': {
        'cfr_baseline': 0.001, 'cfr_resistant': 0.001,
        'duration_baseline_days': 7.0, 'duration_resistant_days': 7.0,
        'disability_weight': 0.067,
    },
    'Gastroenteritis': {
        'cfr_baseline': 0.001, 'cfr_resistant': 0.001,
        'duration_baseline_days': 7.0, 'duration_resistant_days': 7.0,
        'disability_weight': 0.067,
    },
    'RESP': {
        'cfr_baseline': 0.036, 'cfr_resistant': 0.036,
        'duration_baseline_days': 10.5, 'duration_resistant_days': 15.85,
        'disability_weight': 0.128,
    },
    'Infection': {
        'cfr_baseline': 0.010, 'cfr_resistant': 0.010,
        'duration_baseline_days': 7.5, 'duration_resistant_days': 7.5,
        'disability_weight': 0.067,
    },
}

_KPNEU_ENDPOINT_DALY = {
    'UTI': {
        'cfr_baseline': 0.000, 'cfr_resistant': 0.000,
        'duration_baseline_days': 8.5, 'duration_resistant_days': 8.5,
        'disability_weight': 0.095,
    },
    'BSI': {
        'cfr_baseline': 0.167, 'cfr_resistant': 0.178,
        'duration_baseline_days': 9.28, 'duration_resistant_days': 12.25,
        'disability_weight': 0.128,
    },
    'Watery Diarrhea': {
        'cfr_baseline': 0.001, 'cfr_resistant': 0.001,
        'duration_baseline_days': 7.0, 'duration_resistant_days': 7.0,
        'disability_weight': 0.067,
    },
    'Gastroenteritis': {
        'cfr_baseline': 0.001, 'cfr_resistant': 0.001,
        'duration_baseline_days': 7.0, 'duration_resistant_days': 7.0,
        'disability_weight': 0.067,
    },
    'Infection': {
        'cfr_baseline': 0.010, 'cfr_resistant': 0.010,
        'duration_baseline_days': 7.5, 'duration_resistant_days': 7.5,
        'disability_weight': 0.067,
    },
}

# E. faecium: no direct human dose-response exists.
# Surrogate: E. faecalis exponential model (k = 2.19e-11).
# Source: Denissen et al. 2023 (Sci Total Environ 901:166217).
# DALY: VRE vs VSE BSI shows similar 30-day mortality (~37% both).
# Excess burden from VRE is driven by longer treatment duration, not higher CFR.
# Source: Bergmark et al. 2024 (Emerg Microbes Infect), Danish cohort n=6,071.
_EFAECIUM_ENDPOINT_DALY = {
    'UTI': {
        'cfr_baseline': 0.000, 'cfr_resistant': 0.000,
        'duration_baseline_days': 10.0, 'duration_resistant_days': 14.0,
        'disability_weight': 0.095,
    },
    'BSI': {
        'cfr_baseline': 0.340, 'cfr_resistant': 0.380,
        'duration_baseline_days': 14.0, 'duration_resistant_days': 21.0,
        'disability_weight': 0.128,
    },
    'Watery Diarrhea': {
        'cfr_baseline': 0.001, 'cfr_resistant': 0.001,
        'duration_baseline_days': 7.0, 'duration_resistant_days': 7.0,
        'disability_weight': 0.067,
    },
    'Gastroenteritis': {
        'cfr_baseline': 0.001, 'cfr_resistant': 0.001,
        'duration_baseline_days': 7.0, 'duration_resistant_days': 7.0,
        'disability_weight': 0.067,
    },
    'Infection': {
        'cfr_baseline': 0.010, 'cfr_resistant': 0.010,
        'duration_baseline_days': 7.5, 'duration_resistant_days': 7.5,
        'disability_weight': 0.067,
    },
}

PATHOGENS = [
    # ── E. coli — updated to Goh et al. 2023 / Haas et al. 1999 parameters ──────
    # Beta-Poisson N50 = 2.11e6, α = 0.155  →  β = N50 / (2^(1/α) − 1) ≈ 2.42e4
    # Pathogenic fraction: 8% of total E. coli counts assumed pathogenic (Goh et al. 2023)
    {
        'pathogen_name':          'Escherichia coli',
        'display_strain':         'Pathogenic strains',
        'model_type':             'beta_poisson',
        'alpha':                  0.155,
        'beta':                   2.42e4,
        'k':                      None,
        'illness_ratio':          0.50,
        'resistant_illness_ratio': None,
        'daly_weight':            0.0,
        'pathogenic_fraction':    0.08,
        'endpoint_daly_params':   _ECOLI_ENDPOINT_DALY,
        'life_expectancy_at_death': 43.4,
        'param_source':           'Goh et al. 2023 (J Hazard Mater 458:132058); Haas et al. 1999',
        'param_source_amr':       'Cassini et al. 2019 (Lancet Infect Dis) via Goh et al. 2023',
        'is_active':              True,
    },
    # ── K. pneumoniae — Goh et al. 2023 / Harb & Hong 2017 ──────────────────────
    {
        'pathogen_name':          'Klebsiella pneumoniae',
        'display_strain':         'Environmental isolate',
        'model_type':             'exponential',
        'alpha':                  None,
        'beta':                   None,
        'k':                      1.62e-6,
        'illness_ratio':          0.50,
        'resistant_illness_ratio': None,
        'daly_weight':            0.0,
        'pathogenic_fraction':    1.0,
        'endpoint_daly_params':   _KPNEU_ENDPOINT_DALY,
        'life_expectancy_at_death': 43.4,
        'param_source':           'Goh et al. 2023 (J Hazard Mater 458:132058); Harb & Hong 2017',
        'param_source_amr':       'Cassini et al. 2019 (Lancet Infect Dis) via Goh et al. 2023',
        'is_active':              True,
    },
    # ── E. faecium — E. faecalis surrogate (no direct human dose-response exists) ─
    {
        'pathogen_name':          'Enterococcus faecium',
        'display_strain':         'E. faecalis surrogate (VRE)',
        'model_type':             'exponential',
        'alpha':                  None,
        'beta':                   None,
        'k':                      2.19e-11,
        'illness_ratio':          0.50,
        'resistant_illness_ratio': None,
        'daly_weight':            0.0,
        'pathogenic_fraction':    1.0,
        'endpoint_daly_params':   _EFAECIUM_ENDPOINT_DALY,
        'life_expectancy_at_death': 43.4,
        'param_source':           'Denissen et al. 2023 (Sci Total Environ 901:166217) — E. faecalis surrogate',
        'param_source_amr':       'Cassini et al. 2019; Bergmark et al. 2024 (Emerg Microbes Infect)',
        'is_active':              True,
    },
]


class Command(BaseCommand):
    help = 'Seed pathogen_profile table with AMR-focused QMRA parameters (v2.0)'

    def handle(self, *args, **kwargs):
        # Deactivate non-AMR pathogens
        deactivated = PathogenProfile.objects.filter(
            pathogen_name__in=DEACTIVATE
        ).update(is_active=False, updated_by='system')
        self.stdout.write(f'Deactivated {deactivated} legacy pathogen profile(s).')

        created = updated = 0
        for data in PATHOGENS:
            _, is_new = PathogenProfile.objects.update_or_create(
                pathogen_name=data['pathogen_name'],
                defaults={
                    **{k: v for k, v in data.items() if k != 'pathogen_name'},
                    'created_by': 'system',
                    'updated_by': 'system',
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done. Created: {created}, Updated: {updated} pathogen profiles.'
        ))
