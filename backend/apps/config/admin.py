from django.contrib import admin
from .models import ModuleConfig


@admin.register(ModuleConfig)
class ModuleConfigAdmin(admin.ModelAdmin):
    list_display = ('module_code', 'module_name', 'version', 'is_active')
    search_fields = ('module_code', 'module_name')
