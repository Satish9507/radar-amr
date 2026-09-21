from rest_framework import generics
from .models import ModuleConfig
from .serializers import ModuleConfigSerializer


class ModuleConfigListView(generics.ListAPIView):
    queryset = ModuleConfig.objects.filter(is_active=True)
    serializer_class = ModuleConfigSerializer


class ModuleConfigDetailView(generics.RetrieveAPIView):
    queryset = ModuleConfig.objects.filter(is_active=True)
    serializer_class = ModuleConfigSerializer
    lookup_field = 'module_code'
