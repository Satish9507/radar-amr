from django.urls import path
from .views import RQCalculateView, RQCalculateSingleView

urlpatterns = [
    path('calculate/', RQCalculateView.as_view(), name='rq-calculate'),
    path('calculate/single/', RQCalculateSingleView.as_view(), name='rq-calculate-single'),
]
