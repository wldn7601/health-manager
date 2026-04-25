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
