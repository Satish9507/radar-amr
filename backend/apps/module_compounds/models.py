import uuid
from django.db import models

UNIT_CHOICES = [('ng/L', 'ng/L'), ('μg/L', 'μg/L'), ('mg/L', 'mg/L')]


class CompoundReference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    compound_code = models.CharField(max_length=30, unique=True)
    compound_name = models.CharField(max_length=150)
    compound_class = models.CharField(max_length=100, blank=True)
    cas_number = models.CharField(max_length=30, blank=True)
    pnec_eco_value = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    pnec_amr_value = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    pnec_unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='ng/L',
                                  help_text='Unit that PNEC values are stored in')
    preferred_calc_unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='ng/L',
                                            help_text='Unit to use during RQ calculation. Input MEC will be converted to this unit.')
    pnec_source = models.CharField(max_length=200, blank=True)
    pnec_source_year = models.IntegerField(null=True, blank=True)
    reference_citation = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'compound_reference'
        ordering = ['compound_name']

    def __str__(self):
        return f'{self.compound_code} — {self.compound_name}'
