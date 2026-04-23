from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    # path('api/', include('apps.api.urls')),  # Phase 1에서 추가
    re_path(
        r'^(?!api/|admin/|static/).*$',
        TemplateView.as_view(template_name='index.html'),
    ),
]
