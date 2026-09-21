from django.urls import path
from .views import CAMRIValidateView, CAMRICalculateView, CAMRITemplateView

urlpatterns = [
    path('validate/',           CAMRIValidateView.as_view(),  name='camri-validate'),
    path('calculate/',          CAMRICalculateView.as_view(), name='camri-calculate'),
    path('template/<str:file_type>/', CAMRITemplateView.as_view(), name='camri-template'),
]
