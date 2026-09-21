from django.urls import path
from .views import QMRACalculateView, QMRAPathogenListView
from .sensitivity_views import QMRASensitivityView, QMRASensitivityStatusView

urlpatterns = [
    path('calculate/', QMRACalculateView.as_view(), name='qmra-calculate'),
    path('pathogens/', QMRAPathogenListView.as_view(), name='qmra-pathogens'),
    path('sensitivity/', QMRASensitivityView.as_view(), name='qmra-sensitivity'),
    path('sensitivity/status/<str:task_id>/', QMRASensitivityStatusView.as_view(), name='qmra-sensitivity-status'),
]
