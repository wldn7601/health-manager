from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.workouts.auth_views import RegisterView, StaticFileView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token-obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/', include('apps.workouts.urls')),
    path('manifest.json', StaticFileView.as_view(), {'filename': 'manifest.json'}),
    path('service-worker.js', StaticFileView.as_view(), {'filename': 'service-worker.js'}),
    re_path(
        r'^(?!api/|admin/|static/).*$',
        TemplateView.as_view(template_name='index.html'),
    ),
]
