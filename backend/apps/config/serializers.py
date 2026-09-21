from rest_framework import serializers
from .models import ModuleConfig


class ModuleConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModuleConfig
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
