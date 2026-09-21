from django.contrib import admin
from .models import CompoundReference


@admin.register(CompoundReference)
class CompoundReferenceAdmin(admin.ModelAdmin):
    list_display = ('compound_code', 'compound_name', 'compound_class', 'pnec_eco_value', 'pnec_amr_value', 'pnec_unit', 'preferred_calc_unit', 'is_active')
    list_filter = ('compound_class', 'is_active', 'pnec_unit', 'preferred_calc_unit')
    search_fields = ('compound_code', 'compound_name', 'cas_number')
    ordering = ('compound_name',)
