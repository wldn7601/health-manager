import os
import django
import sys
from datetime import timedelta
from django.utils import timezone

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.workouts.models import Category, Exercise, WorkoutSession, WorkoutSet, WorkoutTip

User = get_user_model()

def seed_data():
    # 1. Get or create a default user
    user = User.objects.first()
    if not user:
        user = User.objects.create_user(username='testuser', password='password123')
        print("Created test user 'testuser'.")
    
    # 2. Ensure categories and exercises exist
    if not Category.objects.exists():
        print("No categories found. Please run loaddata first.")
        return

    chest_cat = Category.objects.filter(name='가슴').first()
    back_cat = Category.objects.filter(name='등').first()
    leg_cat = Category.objects.filter(name='하체').first()

    if not chest_cat:
        print("Category '가슴' not found.")
        return

    bench_press, _ = Exercise.objects.get_or_create(category=chest_cat, canonical_name='벤치 프레스')
    lat_pulldown, _ = Exercise.objects.get_or_create(category=back_cat, canonical_name='랫 풀다운')
    squat, _ = Exercise.objects.get_or_create(category=leg_cat, canonical_name='스쿼트')

    today = timezone.now().date()

    # Data to create
    mock_data = [
        {
            "days_ago": 1,
            "exercises": [
                {"ex": bench_press, "sets": [(60, 10), (60, 10), (65, 8)]},
                {"ex": squat, "sets": [(80, 12), (90, 10), (100, 8)]}
            ]
        },
        {
            "days_ago": 3,
            "exercises": [
                {"ex": lat_pulldown, "sets": [(40, 12), (45, 12), (50, 10), (55, 8)]}
            ],
            "tip": "랫 풀다운 할 때 광배근 자극이 잘 왔음. 하지만 승모근에 힘이 너무 들어가지 않게 주의할 것."
        },
        {
            "days_ago": 5,
            "exercises": [
                {"ex": bench_press, "sets": [(50, 12), (55, 10), (60, 8)]},
            ],
            "tip": "컨디션이 안 좋아서 평소보다 중량을 낮춤."
        }
    ]

    for data in mock_data:
        past_date = today - timedelta(days=data['days_ago'])
        
        # Create session
        session, created = WorkoutSession.objects.get_or_create(user=user, date=past_date)
        if not created:
            # Clear existing sets/tips for this generated session to avoid duplicates if run multiple times
            session.sets.all().delete()
            session.tips.all().delete()
            print(f"Refreshed session for {past_date}")
        else:
            print(f"Created session for {past_date}")

        # Create sets
        for ex_data in data['exercises']:
            exercise = ex_data['ex']
            for i, (weight, reps) in enumerate(ex_data['sets'], start=1):
                WorkoutSet.objects.create(
                    session=session,
                    exercise=exercise,
                    set_number=i,
                    weight=weight,
                    reps=reps
                )

        # Create tip if exists
        if 'tip' in data:
            WorkoutTip.objects.create(
                exercise=data['exercises'][0]['ex'], # Attach to the first exercise for simplicity
                session=session,
                content=data['tip']
            )

    print("Successfully added mock data for past dates.")

if __name__ == '__main__':
    seed_data()
