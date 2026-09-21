from django.contrib import admin
from django.urls import path, include
from .admin_views import api_docs_view

urlpatterns = [
    path('admin/api-docs/', admin.site.admin_view(api_docs_view), name='admin-api-docs'),
    path('admin/', admin.site.urls),
    path('api/v1/compounds/', include('apps.module_compounds.urls')),
    path('api/v1/config/', include('apps.config.urls')),
    path('api/v1/rq/', include('apps.module_rq.urls')),
    path('api/v1/qmra/',  include('apps.module_qmra.urls')),
    path('api/v1/camri/', include('apps.module_camri.urls')),
]
