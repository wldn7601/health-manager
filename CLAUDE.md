# Project Overview

개인 프로젝트. Django 백엔드 + React 프론트엔드 통합 서빙 구조.
PythonAnywhere 배포, PWA 지원, 반응형 웹.

---

## Tech Stack

| 항목       | 버전/내용                        |
| ---------- | -------------------------------- |
| Python     | 3.12                             |
| Django     | latest stable                    |
| Node.js    | 24.15.0                          |
| npm        | 11.12.1                          |
| Frontend   | React (Vite 기반 빌드)           |
| Styling    | TailwindCSS                      |
| Deployment | PythonAnywhere                   |
| Domain     | wldn7601.store                   |
| OS (dev)   | Rocky Linux 10 (WSL2 on Windows) |

---

## Architecture

- Django가 React 빌드 결과물을 직접 서빙
- API는 `/api/` prefix 사용
- `/api/` 외 모든 경로는 `index.html` (React SPA) 반환
- PWA: manifest.json + service-worker.js 포함
  project-root/
  ├── backend/ # Django 프로젝트
  │ ├── config/ # settings, urls, wsgi
  │ ├── apps/ # Django 앱들
  │ ├── static/ # collectstatic 결과물 (git ignore)
  │ ├── staticfiles_src/ # 직접 관리하는 static (manifest.json 등)
  │ ├── templates/
  │ │ └── index.html # React 빌드 결과물
  │ ├── requirements.txt
  │ └── manage.py
  ├── frontend/ # React 프로젝트 (Vite)
  │ ├── src/
  │ ├── public/
  │ │ ├── manifest.json
  │ │ └── service-worker.js
  │ ├── package.json
  │ └── vite.config.js
  └── scripts/
  └── build_and_copy.sh # React 빌드 후 Django에 복사하는 스크립트

---

## Dev Environment Setup

### Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Build & Copy (배포 전)

```bash
bash scripts/build_and_copy.sh
```

build_and_copy.sh 내용:

1. `cd frontend && npm run build`
2. `cp -r frontend/dist/assets/* backend/staticfiles_src/`
3. `cp frontend/dist/index.html backend/templates/index.html`
4. `cd backend && python manage.py collectstatic --noinput`

---

## Django Configuration

- `STATIC_URL = '/static/'`
- `STATIC_ROOT = BASE_DIR / 'static'`
- `STATICFILES_DIRS = [BASE_DIR / 'staticfiles_src']`
- `TEMPLATES DIRS = [BASE_DIR / 'templates']`
- CORS 설정 필요 (개발 시 localhost:5173 허용)
- `ALLOWED_HOSTS`에 `wldn7601.store`, `www.wldn7601.store` 포함

### URL 라우팅 규칙

- `/api/*` → Django API
- `/admin/` → Django admin
- 나머지 전부 → `index.html` (React SPA catch-all)

---

## Deployment (PythonAnywhere)

- Python 3.12 가상환경 사용
- WSGI 파일 경로: `/var/www/username_pythonanywhere_com_wsgi.py`
- Static files 등록:
  - URL: `/static/` → Directory: `/home/username/project/backend/static`
- 커스텀 도메인: `wldn7601.store` (PythonAnywhere에서 발급하는 IP를 DNS A 레코드에 등록)
- HTTPS: PythonAnywhere 제공 Let's Encrypt 사용

---

## PWA Requirements

- `manifest.json` → `/static/manifest.json` 으로 서빙
- `service-worker.js` → Django view에서 `/service-worker.js` 경로로 직접 서빙 (scope 문제)
- HTML `<head>`에 manifest link 태그 포함
- 아이콘: 192x192, 512x512 PNG 필요

---

## Code Conventions

- Python: PEP8, Black 포맷터
- JavaScript: ESLint + Prettier
- API 응답 형식: JSON, `{ "data": ..., "error": ... }` 구조 통일
- Django app 단위로 기능 분리
- React 컴포넌트: 함수형, hooks 사용
- TailwindCSS: utility-first, 커스텀 클래스 최소화

---

## Constraints

- React 빌드 결과물만 Django에 포함 (소스 파일 포함 금지)
- 민감 정보는 `.env` 파일 관리, `python-dotenv` 사용
- `SECRET_KEY`, `DEBUG`, `DATABASE_URL` 환경변수로 관리
- PythonAnywhere 무료 플랜 제약: WebSocket 불가, 외부 HTTP 요청 도메인 제한 있음

---

## Project: 헬스 매니저 (Fitness Manager)

### 서비스 개요

헬스 운동 기록 및 성장 추이 분석 서비스.
머신/프리웨이트 운동의 중량, 횟수를 기록하고 운동별 팁을 메모할 수 있다.

---

### 핵심 기능

#### 1. 운동 카테고리 선택

- 하체 / 팔 / 등 / 가슴 / 어깨 5개 고정 카테고리
- 카테고리는 사용자가 추가 불가, 고정값

#### 2. 운동 종목 입력 (퍼지 매칭)

- 사용자가 운동 이름을 직접 입력
- 동일 운동을 다르게 입력해도 같은 운동으로 인식해야 함
  - 예: "인클라인 벤치 프레스" = "인클라인 바벨 프레스" = "인클라인 프레스"
- 구현 방식: 입력값을 정규화된 운동명(canonical name)으로 매핑
  - DB에 운동 별칭(alias) 테이블 운영
  - 유사도 기반 매칭: rapidfuzz 라이브러리 사용 (Python)
  - 매칭 신뢰도가 낮으면 사용자에게 "이 운동을 말씀하시는 건가요?" 확인 UI 표시
  - 완전히 새로운 운동이면 신규 등록

#### 3. 운동 기록

- 기록 단위: 세트별 중량(kg) + 횟수(reps)
- 하나의 운동 세션에 여러 세트 추가 가능
- 운동 날짜 기록 (기본값: 오늘)

#### 4. 운동 팁 메모

- 운동이 잘 됐을 때 팁, 자극 포인트 등 자유 텍스트 입력
- 운동 종목별로 누적 저장 (히스토리 형태)
- 특정 날짜의 기록에 팁을 연결

#### 5. 성장 추이 확인

- 운동 종목별 최대 중량 변화 그래프
- 볼륨(중량 x 횟수 x 세트 수) 변화 추이
- 기간 필터: 1개월 / 3개월 / 6개월 / 전체

---

### DB 모델 설계 (Django ORM 기준)

```python
# 운동 카테고리 (고정값 - fixture로 초기 데이터 삽입)
Category: id, name  # 하체/팔/등/가슴/어깨

# 정규화된 운동명
Exercise: id, category(FK), canonical_name, created_at

# 운동 별칭 (퍼지 매칭용)
ExerciseAlias: id, exercise(FK), alias

# 운동 세션 (하루 운동 단위)
WorkoutSession: id, user(FK), date, category(FK), created_at

# 세트 기록
WorkoutSet: id, session(FK), exercise(FK), set_number, weight, reps

# 팁 메모
WorkoutTip: id, exercise(FK), session(FK), content, created_at
```

---

### API 설계 (Django REST Framework)

GET /api/categories/ # 카테고리 목록
GET /api/exercises/?category=1 # 운동 목록
POST /api/exercises/search/ # 퍼지 매칭 운동 검색
POST /api/exercises/ # 신규 운동 등록
POST /api/sessions/ # 운동 세션 생성
GET /api/sessions/?date=2025-01-01 # 날짜별 세션 조회
POST /api/sessions/{id}/sets/ # 세트 기록 추가
POST /api/sessions/{id}/tips/ # 팁 메모 추가
GET /api/exercises/{id}/progress/ # 성장 추이 데이터
?period=1m|3m|6m|all

---

### 퍼지 매칭 구현 방식

```python
# requirements.txt에 추가
rapidfuzz

# 로직
from rapidfuzz import process, fuzz

def search_exercise(query: str, category_id: int):
    exercises = Exercise.objects.filter(category_id=category_id)
    aliases = ExerciseAlias.objects.select_related('exercise').filter(
        exercise__category_id=category_id
    )

    candidates = {alias.alias: alias.exercise for alias in aliases}

    result = process.extractOne(
        query,
        candidates.keys(),
        scorer=fuzz.token_sort_ratio,
        score_cutoff=70  # 70점 미만이면 신규 운동으로 처리
    )

    if result:
        matched_alias, score, _ = result
        return {"matched": candidates[matched_alias], "score": score, "is_new": False}

    return {"matched": None, "score": 0, "is_new": True}
```

---

### Frontend 화면 구성 (React)

/ → 오늘 운동 기록 홈
/record → 운동 기록 입력
/history → 과거 기록 달력/리스트
/progress → 성장 추이 그래프
/exercise/{id} → 운동 종목 상세 (기록 + 팁 히스토리)

---

### 제약 및 주의사항

- 퍼지 매칭 score_cutoff는 70으로 시작, 실사용 후 조정
- 성장 추이 그래프 라이브러리: Recharts (React) 사용
- 인증: Django 기본 Auth 또는 Simple JWT 사용
- 1인 사용자 기준으로 설계 (멀티유저 확장 고려는 하되 우선 단일 유저)
- PythonAnywhere 무료 플랜 기준 SQLite 사용 (PostgreSQL 전환 고려 시 별도 명시)
