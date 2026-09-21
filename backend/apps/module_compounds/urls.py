from django.urls import path
from .views import CompoundListView, CompoundDetailView

urlpatterns = [
    path('', CompoundListView.as_view(), name='compound-list'),
    path('<str:compound_code>/', CompoundDetailView.as_view(), name='compound-detail'),
]
