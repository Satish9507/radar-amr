from rest_framework import generics, filters
from .models import CompoundReference
from .serializers import CompoundReferenceSerializer


class CompoundListView(generics.ListAPIView):
    queryset = CompoundReference.objects.filter(is_active=True)
    serializer_class = CompoundReferenceSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['compound_code', 'compound_name', 'compound_class']


class CompoundDetailView(generics.RetrieveAPIView):
    queryset = CompoundReference.objects.filter(is_active=True)
    serializer_class = CompoundReferenceSerializer
    lookup_field = 'compound_code'
