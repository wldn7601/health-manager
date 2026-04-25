from django.conf import settings
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=20, unique=True)

    class Meta:
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Exercise(models.Model):
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name='exercises'
    )
    canonical_name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('category', 'canonical_name')]
        ordering = ['canonical_name']

    def __str__(self):
        return f'[{self.category.name}] {self.canonical_name}'


class ExerciseAlias(models.Model):
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, related_name='aliases'
    )
    alias = models.CharField(max_length=100)

    class Meta:
        unique_together = [('exercise', 'alias')]
        indexes = [models.Index(fields=['alias'])]

    def __str__(self):
        return self.alias


class WorkoutSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sessions',
    )
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [models.Index(fields=['user', '-date'])]
        unique_together = [('user', 'date')]

    def __str__(self):
        return f'{self.user} / {self.date}'


class WorkoutSet(models.Model):
    session = models.ForeignKey(
        WorkoutSession, on_delete=models.CASCADE, related_name='sets'
    )
    exercise = models.ForeignKey(
        Exercise, on_delete=models.PROTECT, related_name='sets'
    )
    set_number = models.PositiveSmallIntegerField()
    weight = models.DecimalField(max_digits=6, decimal_places=2)
    reps = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ['session', 'exercise', 'set_number']
        unique_together = [('session', 'exercise', 'set_number')]

    def __str__(self):
        return (
            f'{self.exercise.canonical_name} #{self.set_number} '
            f'{self.weight}kg x {self.reps}'
        )


class WorkoutTip(models.Model):
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, related_name='tips'
    )
    session = models.ForeignKey(
        WorkoutSession,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='tips',
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
