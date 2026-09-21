from django.urls import path
from .views import ModuleConfigListView, ModuleConfigDetailView

urlpatterns = [
    path('', ModuleConfigListView.as_view(), name='module-config-list'),
    path('<str:module_code>/', ModuleConfigDetailView.as_view(), name='module-config-detail'),
]
