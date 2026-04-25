from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workouts', '0002_workoutset_set_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='workoutset',
            name='group_id',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
