from datetime import date, timedelta

from django.contrib.auth.models import User
from django.db.models import Count, F, Max, Q, Sum
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Exercise, ExerciseAlias, WorkoutSession, WorkoutSet, WorkoutTip


class AdminStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = date.today()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        active_7d = (
            WorkoutSession.objects
            .filter(date__gte=week_ago, user__is_staff=False)
            .values('user')
            .distinct()
            .count()
        )

        total_volume = WorkoutSet.objects.aggregate(
            v=Sum(F('weight') * F('reps'))
        )['v'] or 0

        top_exercises = list(
            Exercise.objects
            .annotate(usage=Count('sets'))
            .order_by('-usage')
            .values('canonical_name', 'usage')[:8]
        )

        recent_sessions = list(
            WorkoutSession.objects
            .select_related('user')
            .order_by('-date', '-created_at')
            .values('user__username', 'date')[:10]
        )

        return Response({
            'users': {
                'total': User.objects.filter(is_staff=False).count(),
                'active_7d': active_7d,
            },
            'sessions': {
                'total': WorkoutSession.objects.count(),
                'last_7d': WorkoutSession.objects.filter(date__gte=week_ago).count(),
                'last_30d': WorkoutSession.objects.filter(date__gte=month_ago).count(),
            },
            'sets': {
                'total': WorkoutSet.objects.count(),
                'total_volume': float(total_volume),
            },
            'exercises': {
                'total': Exercise.objects.count(),
                'aliases': ExerciseAlias.objects.count(),
            },
            'tips': {
                'total': WorkoutTip.objects.count(),
            },
            'top_exercises': top_exercises,
            'recent_sessions': recent_sessions,
        })


class AdminUserListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        users = (
            User.objects
            .filter(is_staff=False)
            .annotate(
                session_count=Count('sessions', distinct=True),
                set_count=Count('sessions__sets', distinct=True),
                last_session=Max('sessions__date'),
            )
            .order_by('-date_joined')
        )

        return Response([
            {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'date_joined': u.date_joined.date().isoformat(),
                'last_login': u.last_login.date().isoformat() if u.last_login else None,
                'session_count': u.session_count,
                'set_count': u.set_count,
                'last_session': u.last_session.isoformat() if u.last_session else None,
            }
            for u in users
        ])


class AdminExerciseListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        exercises = (
            Exercise.objects
            .select_related('category')
            .prefetch_related('aliases')
            .annotate(
                ungrouped=Count('sets', filter=Q(sets__group_id__isnull=True)),
                grouped=Count('sets__group_id', distinct=True, filter=Q(sets__group_id__isnull=False)),
            )
            .order_by('canonical_name')
        )

        data = sorted(
            [
                {
                    'id': ex.id,
                    'canonical_name': ex.canonical_name,
                    'category': ex.category.name,
                    'aliases': [a.alias for a in ex.aliases.all()],
                    'usage_count': ex.ungrouped + ex.grouped,
                    'created_at': ex.created_at.date().isoformat(),
                }
                for ex in exercises
            ],
            key=lambda x: (-x['usage_count'], x['canonical_name']),
        )
        return Response(data)
