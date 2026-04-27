import hmac
import logging
import os
import subprocess
from pathlib import Path

from django.contrib.auth.models import User
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as _BaseTokenView

logger = logging.getLogger(__name__)


class DeployRateThrottle(SimpleRateThrottle):
    scope = 'deploy'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username or not password:
            return Response(
                {'error': '아이디와 비밀번호를 입력해주세요.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=username).exists():
            return Response(
                {'error': '이미 사용 중인 아이디입니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(username=username, password=password)
        refresh = RefreshToken.for_user(user)
        return Response(
            {'access': str(refresh.access_token), 'refresh': str(refresh)},
            status=status.HTTP_201_CREATED,
        )


class DeployView(APIView):
    """
    POST /api/deploy/
    GitHub Actions에서 호출 — git pull + collectstatic + WSGI reload.
    """
    permission_classes = [AllowAny]
    throttle_classes = [DeployRateThrottle]

    def post(self, request):
        ip = request.META.get('REMOTE_ADDR', 'unknown')
        token = request.headers.get('X-Deploy-Token', '')
        secret = os.getenv('DEPLOY_SECRET', '')
        if not token or not secret or not hmac.compare_digest(token, secret):
            logger.warning('Deploy auth failed | ip=%s', ip)
            return Response({'error': 'unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

        logger.info('Deploy started | ip=%s', ip)
        repo_root = Path(settings.BASE_DIR).parent
        venv_python = repo_root / 'backend' / 'venv' / 'bin' / 'python'
        wsgi_file = Path('/var/www/wldn7601_pythonanywhere_com_wsgi.py')

        try:
            subprocess.run(['git', 'fetch', 'origin'], cwd=repo_root, check=True, capture_output=True)
            subprocess.run(['git', 'reset', '--hard', 'origin/main'], cwd=repo_root, check=True, capture_output=True)
            subprocess.run(
                ['find', str(repo_root / 'backend'), '-name', '*.pyc', '-delete'],
                check=True, capture_output=True,
            )
            subprocess.run(
                [str(venv_python), 'manage.py', 'migrate', '--noinput'],
                cwd=repo_root / 'backend',
                check=True,
                capture_output=True,
            )
            subprocess.run(
                [str(venv_python), 'manage.py', 'collectstatic', '--noinput'],
                cwd=repo_root / 'backend',
                check=True,
                capture_output=True,
            )
            wsgi_file.touch()
            logger.info('Deploy succeeded | ip=%s', ip)
            return Response({'status': 'ok'})
        except subprocess.CalledProcessError as e:
            logger.error('Deploy failed | ip=%s | stderr=%s', ip, e.stderr.decode())
            return Response({'error': 'deploy failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StaticFileView(APIView):
    """
    /manifest.json, /service-worker.js 를 staticfiles_src 에서 직접 서빙.
    인증 불필요, 올바른 Content-Type 반환.
    """
    permission_classes = [AllowAny]
    CONTENT_TYPES = {
        '.json': 'application/json',
        '.js': 'application/javascript',
    }

    def get(self, request, filename):
        path = Path(settings.BASE_DIR) / 'staticfiles_src' / filename
        if not path.exists() or not path.is_file():
            raise Http404
        content_type = self.CONTENT_TYPES.get(path.suffix, 'application/octet-stream')
        return FileResponse(open(path, 'rb'), content_type=content_type)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_staff'] = user.is_staff
        return token


class CustomTokenObtainPairView(_BaseTokenView):
    serializer_class = CustomTokenObtainPairSerializer
