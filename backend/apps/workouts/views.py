from datetime import date, timedelta

from django.db.models import Avg, Count, F, Max, Q, Sum
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
                'set_type': s.set_type,
                'group_id': s.group_id,
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
            .prefetch_related('sets', 'sets__exercise', 'sets__exercise__category')
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


class GroupedSetCreateView(APIView):
    """
    POST /api/sessions/{id}/grouped_sets/
    드랍세트/슈퍼세트/컴파운드세트: 여러 세트를 하나의 group_id로 묶어 생성.
    body: { "group_type": "dropset", "sets": [{"exercise": 1, "weight": 100, "reps": 10}, ...] }
    """

    def post(self, request, session_id):
        session = get_object_or_404(WorkoutSession, pk=session_id, user=request.user)
        group_type = request.data.get('group_type')
        sets_data = request.data.get('sets', [])

        if not group_type or not sets_data:
            return Response({'error': '필수 필드 누락'}, status=status.HTTP_400_BAD_REQUEST)

        max_group = WorkoutSet.objects.filter(session=session).aggregate(
            m=Max('group_id')
        )['m'] or 0
        group_id = max_group + 1

        created = []
        for s in sets_data:
            exercise_id = s.get('exercise')
            existing_count = WorkoutSet.objects.filter(
                session=session, exercise_id=exercise_id
            ).count()
            ws = WorkoutSet.objects.create(
                session=session,
                exercise_id=exercise_id,
                set_number=existing_count + 1,
                weight=s['weight'],
                reps=s['reps'],
                set_type=group_type,
                group_id=group_id,
            )
            created.append(ws)

        from .serializers import WorkoutSetSerializer
        serializer = WorkoutSetSerializer(created, many=True)
        return Response({'group_id': group_id, 'sets': serializer.data}, status=status.HTTP_201_CREATED)


class ExpandToDropsetView(APIView):
    """
    POST /api/sets/{pk}/expand_dropset/
    기존 세트를 드랍세트 그룹으로 확장.
    body: { "drops": [{ "weight": 100, "reps": 10 }, { "weight": 80, "reps": 12 }] }
    기존 세트가 첫 번째 드랍이 되고, 나머지는 새로 생성됨.
    """

    def post(self, request, pk):
        from django.db.models import Max
        ws = get_object_or_404(WorkoutSet, pk=pk, session__user=request.user)
        drops = request.data.get('drops', [])
        if len(drops) < 2:
            return Response({'error': '드랍은 2개 이상이어야 합니다'}, status=status.HTTP_400_BAD_REQUEST)

        max_group = WorkoutSet.objects.filter(session=ws.session).aggregate(m=Max('group_id'))['m'] or 0
        group_id = max_group + 1

        first = drops[0]
        ws.weight = first['weight']
        ws.reps = first['reps']
        ws.set_type = 'dropset'
        ws.group_id = group_id
        ws.save()

        result = [ws]
        max_set_num = WorkoutSet.objects.filter(
            session=ws.session, exercise=ws.exercise
        ).aggregate(m=Max('set_number'))['m'] or 0
        for i, drop in enumerate(drops[1:], 1):
            new_ws = WorkoutSet.objects.create(
                session=ws.session,
                exercise=ws.exercise,
                set_number=max_set_num + i,
                weight=drop['weight'],
                reps=drop['reps'],
                set_type='dropset',
                group_id=group_id,
            )
            result.append(new_ws)

        serializer = WorkoutSetSerializer(result, many=True)
        return Response({'group_id': group_id, 'sets': serializer.data}, status=status.HTTP_201_CREATED)


class ExpandToPairedView(APIView):
    """
    POST /api/sets/{pk}/expand_paired/
    기존 세트를 슈퍼세트/컴파운드세트 그룹으로 확장.
    body: { "group_type": "superset", "weight1": 80, "reps1": 8,
            "exercise2": 5, "weight2": 50, "reps2": 10 }
    """

    def post(self, request, pk):
        from django.db.models import Max
        ws = get_object_or_404(WorkoutSet, pk=pk, session__user=request.user)
        group_type = request.data.get('group_type')
        if group_type not in ('superset', 'compound'):
            return Response({'error': '잘못된 group_type'}, status=status.HTTP_400_BAD_REQUEST)

        weight1 = request.data.get('weight1')
        reps1 = request.data.get('reps1')
        exercise2_id = request.data.get('exercise2')
        weight2 = request.data.get('weight2')
        reps2 = request.data.get('reps2')

        if None in (weight1, reps1, exercise2_id, weight2, reps2):
            return Response({'error': '필수 필드 누락'}, status=status.HTTP_400_BAD_REQUEST)

        max_group = WorkoutSet.objects.filter(session=ws.session).aggregate(m=Max('group_id'))['m'] or 0
        group_id = max_group + 1

        ws.weight = weight1
        ws.reps = reps1
        ws.set_type = group_type
        ws.group_id = group_id
        ws.save()

        exercise2 = get_object_or_404(Exercise, pk=exercise2_id)
        ex2_count = WorkoutSet.objects.filter(session=ws.session, exercise=exercise2).count()
        ws2 = WorkoutSet.objects.create(
            session=ws.session,
            exercise=exercise2,
            set_number=ex2_count + 1,
            weight=weight2,
            reps=reps2,
            set_type=group_type,
            group_id=group_id,
        )

        serializer = WorkoutSetSerializer([ws, ws2], many=True)
        return Response({'group_id': group_id, 'sets': serializer.data}, status=status.HTTP_201_CREATED)


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


class AddDropToGroupView(APIView):
    """
    POST /api/sets/{pk}/add_to_group/
    기존 그룹에 드랍을 추가. pk는 같은 그룹에 속한 임의의 세트 id.
    body: { "weight": 80, "reps": 12 }
    """

    def post(self, request, pk):
        ws = get_object_or_404(WorkoutSet, pk=pk, session__user=request.user)
        if ws.group_id is None:
            return Response(
                {'error': '그룹에 속하지 않은 세트입니다'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        weight = request.data.get('weight')
        reps = request.data.get('reps')
        if weight is None or reps is None:
            return Response({'error': '필수 필드 누락'}, status=status.HTTP_400_BAD_REQUEST)

        max_set_num = (
            WorkoutSet.objects
            .filter(session=ws.session, exercise=ws.exercise)
            .aggregate(m=Max('set_number'))['m'] or 0
        )
        new_ws = WorkoutSet.objects.create(
            session=ws.session,
            exercise=ws.exercise,
            set_number=max_set_num + 1,
            weight=weight,
            reps=reps,
            set_type=ws.set_type,
            group_id=ws.group_id,
        )
        return Response(WorkoutSetSerializer(new_ws).data, status=status.HTTP_201_CREATED)


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
                avg_weight=Avg('weight'),
                total_volume=Sum(F('weight') * F('reps')),
                ungrouped_count=Count('id', filter=Q(group_id__isnull=True)),
                grouped_count=Count('group_id', distinct=True, filter=Q(group_id__isnull=False)),
                max_reps=Max('reps'),
                avg_reps=Avg('reps'),
            )
            .order_by('session__date')
        )

        data = [
            {
                'date': r['session__date'].isoformat(),
                'max_weight': float(r['max_weight']),
                'avg_weight': round(float(r['avg_weight']), 1),
                'total_volume': float(r['total_volume']),
                'set_count': r['ungrouped_count'] + r['grouped_count'],
                'max_reps': r['max_reps'],
                'avg_reps': round(float(r['avg_reps']), 1),
            }
            for r in rows
        ]
        return Response({'exercise': ExerciseSerializer(exercise).data, 'data': data})
