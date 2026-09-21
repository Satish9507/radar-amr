from django.contrib import admin
from .models import PathogenProfile


@admin.register(PathogenProfile)
class PathogenProfileAdmin(admin.ModelAdmin):
    list_display  = ('pathogen_name', 'model_type', 'illness_ratio', 'daly_weight', 'param_source', 'is_active')
    list_filter   = ('model_type', 'is_active')
    search_fields = ('pathogen_name', 'display_strain')
    ordering      = ('pathogen_name',)
