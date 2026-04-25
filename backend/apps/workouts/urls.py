from django.urls import path

from .views import (
    CategoryListView,
    ExerciseDetailView,
    ExerciseHistoryView,
    ExerciseListCreateView,
    ExerciseProgressView,
    ExerciseSearchView,
    ExerciseTipsView,
    WorkoutSessionListCreateView,
    WorkoutSetCreateView,
    WorkoutSetDetailView,
    WorkoutTipCreateView,
)

urlpatterns = [
    path('categories/', CategoryListView.as_view(), name='category-list'),
    path('exercises/', ExerciseListCreateView.as_view(), name='exercise-list'),
    path('exercises/search/', ExerciseSearchView.as_view(), name='exercise-search'),
    path('exercises/<int:pk>/', ExerciseDetailView.as_view(), name='exercise-detail'),
    path('exercises/<int:pk>/history/', ExerciseHistoryView.as_view(), name='exercise-history'),
    path('exercises/<int:pk>/tips/', ExerciseTipsView.as_view(), name='exercise-tips'),
    path('exercises/<int:pk>/progress/', ExerciseProgressView.as_view(), name='exercise-progress'),
    path('sessions/', WorkoutSessionListCreateView.as_view(), name='session-list'),
    path(
        'sessions/<int:session_id>/sets/',
        WorkoutSetCreateView.as_view(),
        name='session-set-create',
    ),
    path('sets/<int:pk>/', WorkoutSetDetailView.as_view(), name='set-detail'),
    path(
        'sessions/<int:session_id>/tips/',
        WorkoutTipCreateView.as_view(),
        name='session-tip-create',
    ),
]
