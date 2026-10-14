from django.contrib import admin
from .models import CAMRICoefficient


@admin.register(CAMRICoefficient)
class CAMRICoefficientAdmin(admin.ModelAdmin):
    list_display  = ('type', 'column_name', 'label', 'coefficient', 'priority_rank', 'source_reference', 'sort_order')
    list_filter   = ('type',)
    ordering      = ('type', 'sort_order', '-coefficient')
    search_fields = ('column_name', 'label')
