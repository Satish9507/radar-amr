from django.urls import path
from .views import RADARCalculateView

urlpatterns = [
    path('calculate/', RADARCalculateView.as_view(), name='radar-calculate'),
]
