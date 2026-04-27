import hmac
import logging
import os
import secrets
import subprocess
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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
                [str(venv_python), '-m', 'pip', 'install', '-r', str(repo_root / 'backend' / 'requirements.txt')],
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


class MeView(APIView):
    """GET /api/auth/me/  — 내 정보 조회"""

    def get(self, request):
        from .models import WorkoutSession, WorkoutSet
        u = request.user
        sets = WorkoutSet.objects.filter(session__user=u)
        ungrouped = sets.filter(group_id__isnull=True).count()
        grouped = sets.filter(group_id__isnull=False).values('group_id').distinct().count()
        first = (
            WorkoutSession.objects.filter(user=u)
            .order_by('date').values_list('date', flat=True).first()
        )
        return Response({
            'username': u.username,
            'email': u.email,
            'date_joined': u.date_joined.date().isoformat(),
            'session_count': WorkoutSession.objects.filter(user=u).count(),
            'set_count': ungrouped + grouped,
            'first_session': first.isoformat() if first else None,
        })


class SendEmailCodeView(APIView):
    """POST /api/auth/email/send-code/"""

    def post(self, request):
        from .models import EmailVerificationCode
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': '이메일을 입력해주세요.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'error': '올바른 이메일 형식이 아닙니다.'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email=email).exclude(pk=request.user.pk).exists():
            return Response({'error': '이미 사용 중인 이메일입니다.'}, status=status.HTTP_400_BAD_REQUEST)

        # 이전 코드 삭제 + 10분 이상 된 오래된 코드도 정리
        EmailVerificationCode.objects.filter(user=request.user).delete()
        EmailVerificationCode.objects.filter(
            created_at__lt=timezone.now() - timedelta(minutes=10)
        ).delete()

        code = str(secrets.randbelow(900000) + 100000)
        EmailVerificationCode.objects.create(user=request.user, email=email, code=code)

        html_message = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:36px 40px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:3px;color:#94a3b8;text-transform:uppercase;">Health Manager</p>
              <p style="margin:8px 0 0;font-size:22px;font-weight:700;color:#f8fafc;">이메일 인증</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7;">
                아래 인증 코드를 입력하여 이메일 주소를 확인하세요.
              </p>

              <!-- Code box -->
              <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">인증 코드</p>
                <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#1e293b;">{code}</p>
              </div>

              <!-- Expiry notice -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fef9ec;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;color:#92400e;">
                      ⏱ 이 코드는 <strong>3분</strong> 동안만 유효합니다.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:24px 40px;background:#fafafa;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                본인이 요청하지 않은 경우 이 메일을 무시하세요.<br>
                계정 보안에 이상이 있다면 즉시 비밀번호를 변경하세요.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        try:
            send_mail(
                subject='[헬스 매니저] 이메일 인증 코드',
                message=f'인증 코드: {code}\n\n이 코드는 3분간 유효합니다.\n본인이 요청하지 않은 경우 무시하세요.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
                html_message=html_message,
            )
        except Exception as e:
            logger.error('Email send failed | user=%s | error=%s', request.user.username, e)
            return Response({'error': '이메일 발송에 실패했습니다.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info('Email code sent | user=%s | email=%s', request.user.username, email)
        return Response({'status': 'sent'})


class VerifyEmailCodeView(APIView):
    """POST /api/auth/email/verify/"""

    def post(self, request):
        from .models import EmailVerificationCode
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()

        if not email or not code:
            return Response({'error': '이메일과 인증 코드를 입력해주세요.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            verification = EmailVerificationCode.objects.filter(
                user=request.user,
                email=email,
                code=code,
                used=False,
            ).latest('created_at')
        except EmailVerificationCode.DoesNotExist:
            return Response({'error': '인증 코드가 올바르지 않습니다.'}, status=status.HTTP_400_BAD_REQUEST)

        age = (timezone.now() - verification.created_at).total_seconds()
        if age > 180:
            return Response({'error': '인증 코드가 만료됐습니다. 다시 발송해주세요.'}, status=status.HTTP_400_BAD_REQUEST)

        verification.used = True
        verification.save(update_fields=['used'])

        request.user.email = email
        request.user.save(update_fields=['email'])

        logger.info('Email verified | user=%s | email=%s', request.user.username, email)
        return Response({'email': email})


class ChangePasswordView(APIView):
    """POST /api/auth/me/password/"""

    def post(self, request):
        current = request.data.get('current_password', '')
        new_pw = request.data.get('new_password', '')
        if not request.user.check_password(current):
            return Response(
                {'error': '현재 비밀번호가 올바르지 않습니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_pw) < 4:
            return Response(
                {'error': '비밀번호는 4자 이상이어야 합니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(new_pw)
        request.user.save()
        return Response({'status': 'ok'})


class DeleteAccountView(APIView):
    """POST /api/auth/me/delete/"""

    def post(self, request):
        password = request.data.get('password', '')
        if not request.user.check_password(password):
            return Response(
                {'error': '비밀번호가 올바르지 않습니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.delete()
        return Response({'status': 'ok'})


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_staff'] = user.is_staff
        return token


class CustomTokenObtainPairView(_BaseTokenView):
    serializer_class = CustomTokenObtainPairSerializer
