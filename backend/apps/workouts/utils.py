from django.contrib.auth import get_user_model
from rapidfuzz import fuzz, process

from .models import Exercise, ExerciseAlias


FUZZY_SCORE_CUTOFF = 70


def search_exercise(query: str, category_id: int):
    """
    주어진 카테고리 내에서 입력값과 가장 유사한 운동을 찾는다.
    - score_cutoff 미만이면 is_new=True로 신규 운동으로 판정.
    - 동점자가 있으면 rapidfuzz의 정렬 기준에 따른다.
    """
    query = (query or '').strip()
    if not query:
        return {'matched': None, 'score': 0, 'is_new': True}

    aliases = list(
        ExerciseAlias.objects
        .select_related('exercise')
        .filter(exercise__category_id=category_id)
    )
    if not aliases:
        return {'matched': None, 'score': 0, 'is_new': True}

    candidates = {a.alias: a.exercise for a in aliases}

    result = process.extractOne(
        query,
        list(candidates.keys()),
        scorer=fuzz.token_sort_ratio,
        score_cutoff=FUZZY_SCORE_CUTOFF,
    )

    if result is None:
        return {'matched': None, 'score': 0, 'is_new': True}

    matched_alias, score, _ = result
    return {
        'matched': candidates[matched_alias],
        'score': score,
        'matched_alias': matched_alias,
        'is_new': False,
    }


def get_default_user():
    """
    Phase 5에서 JWT 인증 붙이면 request.user로 교체됨. 그때까지 개발 편의용.
    """
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username='default',
        defaults={'is_active': True},
    )
    return user
