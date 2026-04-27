from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenRefreshView

from apps.workouts.auth_views import (
    ChangePasswordView,
    CustomTokenObtainPairView,
    DeleteAccountView,
    DeployView,
    MeView,
    RegisterView,
    SendEmailCodeView,
    StaticFileView,
    VerifyEmailCodeView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token-obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/me/', MeView.as_view(), name='me'),
    path('api/auth/me/password/', ChangePasswordView.as_view(), name='change-password'),
    path('api/auth/me/delete/', DeleteAccountView.as_view(), name='delete-account'),
    path('api/auth/email/send-code/', SendEmailCodeView.as_view(), name='email-send-code'),
    path('api/auth/email/verify/', VerifyEmailCodeView.as_view(), name='email-verify'),
    path('api/deploy/', DeployView.as_view(), name='deploy'),
    path('api/', include('apps.workouts.urls')),
    path('manifest.json', StaticFileView.as_view(), {'filename': 'manifest.json'}),
    path('service-worker.js', StaticFileView.as_view(), {'filename': 'service-worker.js'}),
    re_path(
        r'^(?!api/|admin/|static/).*$',
        TemplateView.as_view(template_name='index.html'),
    ),
]
