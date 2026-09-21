import uuid
from django.db import models


class ModuleConfig(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module_code = models.CharField(max_length=50, unique=True)
    module_name = models.CharField(max_length=100)
    module_description = models.TextField(blank=True)
    version = models.CharField(max_length=20, default='1.0')
    is_active = models.BooleanField(default=True)
    risk_thresholds = models.JSONField(
        help_text='JSON: {"levels": [{"label": "Low Risk", "min": 0, "max": 1, "color": "#059669"}, ...]}'
    )
    infection_risk_thresholds = models.JSONField(
        default=dict,
        blank=True,
        help_text='JSON: {"benchmark": 1e-4, "levels": [...]}'
    )
    calculation_config = models.JSONField(
        default=dict,
        help_text='Module-specific calculation parameters (formula, PNEC source table, etc.)'
    )
    input_schema = models.JSONField(
        default=dict,
        help_text='Expected Excel template structure: required columns, unit row, data start row'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=100, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'module_config'
        ordering = ['module_code']

    def __str__(self):
        return f'{self.module_code} v{self.version}'
