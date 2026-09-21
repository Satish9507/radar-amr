from rest_framework import serializers
from .models import CompoundReference


class CompoundReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompoundReference
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')
