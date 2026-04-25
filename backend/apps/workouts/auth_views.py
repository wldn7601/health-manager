import hmac
import os
import subprocess
from pathlib import Path

from django.contrib.auth.models import User
from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


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

    def post(self, request):
        token = request.headers.get('X-Deploy-Token', '')
        secret = os.getenv('DEPLOY_SECRET', '')
        if not token or not secret or not hmac.compare_digest(token, secret):
            return Response({'error': 'unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

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
            return Response({'status': 'ok'})
        except subprocess.CalledProcessError as e:
            return Response({'error': e.stderr.decode()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
