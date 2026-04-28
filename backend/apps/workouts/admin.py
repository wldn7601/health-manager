from django.contrib import admin

from .models import (
    Category,
    Exercise,
    ExerciseAlias,
    ExerciseRequest,
    WorkoutSession,
    WorkoutSet,
    WorkoutTip,
)


class ExerciseAliasInline(admin.TabularInline):
    model = ExerciseAlias
    extra = 1


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('id', 'category', 'canonical_name', 'is_bodyweight', 'created_at')
    list_filter = ('category', 'is_bodyweight')
    search_fields = ('canonical_name', 'aliases__alias')
    inlines = [ExerciseAliasInline]


@admin.register(ExerciseAlias)
class ExerciseAliasAdmin(admin.ModelAdmin):
    list_display = ('id', 'alias', 'exercise')
    search_fields = ('alias',)


class WorkoutSetInline(admin.TabularInline):
    model = WorkoutSet
    extra = 1


class WorkoutTipInline(admin.TabularInline):
    model = WorkoutTip
    extra = 0


@admin.register(WorkoutSession)
class WorkoutSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'date', 'created_at')
    list_filter = ('date',)
    inlines = [WorkoutSetInline, WorkoutTipInline]


@admin.register(WorkoutSet)
class WorkoutSetAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'exercise', 'set_number', 'weight', 'reps')
    list_filter = ('exercise__category',)


@admin.register(WorkoutTip)
class WorkoutTipAdmin(admin.ModelAdmin):
    list_display = ('id', 'exercise', 'session', 'created_at')
    search_fields = ('content',)


@admin.register(ExerciseRequest)
class ExerciseRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'category', 'canonical_name', 'is_bodyweight', 'status', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('canonical_name',)
