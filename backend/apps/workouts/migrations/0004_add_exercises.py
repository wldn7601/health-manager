from django.db import migrations


EXERCISES = [
    {
        'category': '어깨',
        'canonical_name': '덤벨 숄더 프레스',
        'aliases': [
            '덤벨 숄더 프레스',
            '덤벨 어깨 프레스',
            '숄더 프레스',
            '덤벨 오버헤드 프레스',
            '오버헤드 프레스',
            '덤벨 프레스',
        ],
    },
    {
        'category': '팔',
        'canonical_name': '라잉 트라이셉스 익스텐션',
        'aliases': [
            '라잉 트라이셉스 익스텐션',
            '라잉 트라이셉 익스텐션',
            '스컬 크러셔',
            '라잉 익스텐션',
            '바벨 라잉 트라이셉스 익스텐션',
            '트라이셉스 익스텐션',
        ],
    },
]


def add_exercises(apps, schema_editor):
    Category = apps.get_model('workouts', 'Category')
    Exercise = apps.get_model('workouts', 'Exercise')
    ExerciseAlias = apps.get_model('workouts', 'ExerciseAlias')

    for item in EXERCISES:
        try:
            cat = Category.objects.get(name=item['category'])
        except Category.DoesNotExist:
            continue
        ex, _ = Exercise.objects.get_or_create(
            category=cat,
            canonical_name=item['canonical_name'],
        )
        for alias in item['aliases']:
            ExerciseAlias.objects.get_or_create(exercise=ex, alias=alias)


def remove_exercises(apps, schema_editor):
    Exercise = apps.get_model('workouts', 'Exercise')
    Exercise.objects.filter(
        canonical_name__in=[item['canonical_name'] for item in EXERCISES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0003_workoutset_group_id'),
    ]

    operations = [
        migrations.RunPython(add_exercises, remove_exercises),
    ]
