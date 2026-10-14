from django.db import models


class CAMRICoefficient(models.Model):
    TYPE_CHOICES = [('arb', 'ARB'), ('arg', 'ARG')]

    type             = models.CharField(max_length=3, choices=TYPE_CHOICES, db_index=True)
    column_name      = models.CharField(max_length=50, unique=True)
    label            = models.CharField(max_length=150)
    coefficient      = models.FloatField()
    priority_rank    = models.PositiveSmallIntegerField(default=1)
    source_reference = models.CharField(max_length=200, blank=True)
    sort_order       = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table  = 'amr_coefficients'
        ordering  = ['type', 'sort_order', '-coefficient']

    def __str__(self):
        return f'{self.type.upper()} | {self.column_name} = {self.coefficient}'
