from rest_framework import serializers

from .models import (
    Category,
    Exercise,
    ExerciseAlias,
    WorkoutSession,
    WorkoutSet,
    WorkoutTip,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name')


class ExerciseSerializer(serializers.ModelSerializer):
    aliases = serializers.SerializerMethodField()

    class Meta:
        model = Exercise
        fields = ('id', 'category', 'canonical_name', 'aliases', 'created_at')

    def get_aliases(self, obj):
        return [a.alias for a in obj.aliases.all()]


class ExerciseCreateSerializer(serializers.ModelSerializer):
    """
    신규 운동 등록 시 canonical_name을 alias에도 자동 추가.
    """

    class Meta:
        model = Exercise
        fields = ('id', 'category', 'canonical_name')

    def create(self, validated_data):
        exercise = Exercise.objects.create(**validated_data)
        ExerciseAlias.objects.get_or_create(
            exercise=exercise, alias=exercise.canonical_name,
        )
        return exercise


class ExerciseSearchSerializer(serializers.Serializer):
    category = serializers.IntegerField()
    query = serializers.CharField(max_length=100)


class WorkoutSetSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(
        source='exercise.canonical_name', read_only=True,
    )

    class Meta:
        model = WorkoutSet
        fields = (
            'id', 'session', 'exercise', 'exercise_name',
            'set_number', 'weight', 'reps',
        )
        read_only_fields = ('session',)


class WorkoutSessionSerializer(serializers.ModelSerializer):
    sets = WorkoutSetSerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutSession
        fields = (
            'id', 'date',
            'sets', 'created_at',
        )
        read_only_fields = ('created_at',)


class WorkoutTipSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutTip
        fields = ('id', 'exercise', 'session', 'content', 'created_at')
        read_only_fields = ('created_at',)
