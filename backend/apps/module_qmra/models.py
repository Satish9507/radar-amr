from django.db import models


class PathogenProfile(models.Model):
    MODEL_EXPONENTIAL  = 'exponential'
    MODEL_BETA_POISSON = 'beta_poisson'
    MODEL_CHOICES = [
        (MODEL_EXPONENTIAL,  'Exponential'),
        (MODEL_BETA_POISSON, 'Beta-Poisson'),
    ]

    pathogen_name  = models.CharField(max_length=150, unique=True)
    display_strain = models.CharField(max_length=150, blank=True)
    model_type     = models.CharField(max_length=20, choices=MODEL_CHOICES)

    # Dose-response parameters — only one set is populated per model_type
    alpha = models.FloatField(null=True, blank=True, help_text='Beta-Poisson α parameter')
    beta  = models.FloatField(null=True, blank=True, help_text='Beta-Poisson β parameter')
    k     = models.FloatField(null=True, blank=True, help_text='Exponential k parameter')

    illness_ratio            = models.FloatField(help_text='Fraction of infected individuals who develop illness')
    resistant_illness_ratio  = models.FloatField(null=True, blank=True, help_text='Illness ratio for resistant strain (None = same as baseline)')
    daly_weight              = models.FloatField(help_text='Legacy single DALY weight — superseded by endpoint_daly_params', default=0.0)
    pathogenic_fraction      = models.FloatField(default=1.0, help_text='Fraction of total organism count that is pathogenic (e.g. 0.08 for total E. coli counts)')
    endpoint_daly_params     = models.JSONField(default=dict, blank=True, help_text='Per-endpoint DALY parameters: {endpoint: {cfr_baseline, cfr_resistant, duration_baseline_days, duration_resistant_days, disability_weight}}')
    life_expectancy_at_death = models.FloatField(default=43.4, help_text='L_YLL: standard life expectancy minus median age at infection (years)')

    param_source     = models.CharField(max_length=250, default='QMRAWiki')
    param_source_amr = models.CharField(max_length=250, blank=True, help_text='Citation for AMR-specific DALY parameters')
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    created_by   = models.CharField(max_length=100, blank=True)
    updated_at   = models.DateTimeField(auto_now=True)
    updated_by   = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'pathogen_profile'
        ordering = ['pathogen_name']

    def __str__(self):
        return f'{self.pathogen_name} ({self.get_model_type_display()})'
