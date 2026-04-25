from datetime import date, timedelta

from django.db.models import F, Max, Sum
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Category,
    Exercise,
    WorkoutSession,
    WorkoutSet,
)
from .serializers import (
    CategorySerializer,
    ExerciseCreateSerializer,
    ExerciseSearchSerializer,
    ExerciseSerializer,
    WorkoutSessionSerializer,
    WorkoutSetSerializer,
    WorkoutTipSerializer,
)
from .utils import search_exercise


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all().order_by('id')
    serializer_class = CategorySerializer
    pagination_class = None


class ExerciseListCreateView(generics.ListCreateAPIView):
    pagination_class = None

    def get_queryset(self):
        qs = Exercise.objects.prefetch_related('aliases').all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ExerciseCreateSerializer
        return ExerciseSerializer


class ExerciseDetailView(generics.RetrieveAPIView):
    queryset = Exercise.objects.prefetch_related('aliases').all()
    serializer_class = ExerciseSerializer


class ExerciseSearchView(APIView):
    def post(self, request):
        serializer = ExerciseSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = search_exercise(
            query=serializer.validated_data['query'],
            category_id=serializer.validated_data['category'],
        )

        payload = {
            'score': result['score'],
            'is_new': result['is_new'],
            'matched_alias': result.get('matched_alias'),
            'matched': (
                ExerciseSerializer(result['matched']).data
                if result['matched']
                else None
            ),
        }
        return Response(payload)


class ExerciseHistoryView(APIView):
    """
    GET /api/exercises/{id}/history/
    이 운동의 모든 기록을 세션 단위로 그룹화해서 최신순 반환.
    response: [ { session_id, date, sets: [...] }, ... ]
    """

    def get(self, request, pk):
        exercise = get_object_or_404(Exercise, pk=pk)

        sets = (
            WorkoutSet.objects
            .filter(exercise=exercise, session__user=request.user)
            .select_related('session')
            .order_by('-session__date', '-session__created_at', 'set_number')
        )

        grouped = {}
        for s in sets:
            sid = s.session_id
            if sid not in grouped:
                grouped[sid] = {
                    'session_id': sid,
                    'date': s.session.date.isoformat(),
                    'sets': [],
                }
            grouped[sid]['sets'].append({
                'id': s.id,
                'set_number': s.set_number,
                'weight': str(s.weight),
                'reps': s.reps,
            })

        return Response(list(grouped.values()))


class ExerciseTipsView(APIView):
    """
    GET /api/exercises/{id}/tips/
    해당 운동에 대한 팁 전체 (최신순).
    """

    def get(self, request, pk):
        exercise = get_object_or_404(Exercise, pk=pk)
        tips = exercise.tips.all().order_by('-created_at')
        return Response(WorkoutTipSerializer(tips, many=True).data)


class WorkoutSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkoutSessionSerializer
    pagination_class = None

    def get_queryset(self):
        qs = (
            WorkoutSession.objects
            .filter(user=self.request.user)
            .prefetch_related('sets', 'sets__exercise')
            .order_by('-date', '-created_at')
        )
        params = self.request.query_params
        date = params.get('date')
        start = params.get('start')
        end = params.get('end')
        if date:
            qs = qs.filter(date=date)
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        return qs

    def create(self, request, *args, **kwargs):
        """날짜 기준으로 세션을 get_or_create. 이미 있으면 기존 세션 반환."""
        date = request.data.get('date')
        if not date:
            return Response(
                {'error': 'date 필드가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session, created = WorkoutSession.objects.get_or_create(
            user=request.user,
            date=date,
        )
        session = (
            WorkoutSession.objects
            .prefetch_related('sets', 'sets__exercise')
            .get(pk=session.pk)
        )
        serializer = self.get_serializer(session)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)


class WorkoutSetCreateView(generics.CreateAPIView):
    serializer_class = WorkoutSetSerializer

    def create(self, request, *args, **kwargs):
        session = get_object_or_404(
            WorkoutSession,
            pk=kwargs['session_id'],
            user=request.user,
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(session=session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WorkoutTipCreateView(generics.CreateAPIView):
    """
    POST /api/sessions/{session_id}/tips/
    body: { "exercise": 30, "content": "인클라인에서 어깨 안 쓰고 가슴에 집중" }
    """

    serializer_class = WorkoutTipSerializer

    def create(self, request, *args, **kwargs):
        session = get_object_or_404(
            WorkoutSession,
            pk=kwargs['session_id'],
            user=request.user,
        )
        data = {**request.data, 'session': session.id}
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WorkoutSetDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    """
    PATCH /api/sets/{id}/  — 중량/횟수 수정
    DELETE /api/sets/{id}/ — 세트 삭제
    """
    serializer_class = WorkoutSetSerializer
    http_method_names = ['patch', 'delete']

    def get_queryset(self):
        return WorkoutSet.objects.filter(session__user=self.request.user)


class ExerciseProgressView(APIView):
    """
    GET /api/exercises/{id}/progress/?period=1m|3m|6m|all
    날짜별 최대 중량(max_weight)과 총 볼륨(total_volume = Σ weight×reps) 반환.
    response: { exercise: {...}, data: [ { date, max_weight, total_volume }, ... ] }
    """

    PERIOD_DAYS = {'1m': 30, '3m': 90, '6m': 180}

    def get(self, request, pk):
        exercise = get_object_or_404(Exercise, pk=pk)

        period = request.query_params.get('period', '3m')
        qs = WorkoutSet.objects.filter(exercise=exercise, session__user=request.user)
        if period in self.PERIOD_DAYS:
            cutoff = date.today() - timedelta(days=self.PERIOD_DAYS[period])
            qs = qs.filter(session__date__gte=cutoff)

        rows = (
            qs
            .values('session__date')
            .annotate(
                max_weight=Max('weight'),
                total_volume=Sum(F('weight') * F('reps')),
            )
            .order_by('session__date')
        )

        data = [
            {
                'date': r['session__date'].isoformat(),
                'max_weight': float(r['max_weight']),
                'total_volume': float(r['total_volume']),
            }
            for r in rows
        ]
        return Response({'exercise': ExerciseSerializer(exercise).data, 'data': data})
