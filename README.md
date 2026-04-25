# 헬스 매니저

헬스장에서 폰으로 쓰는 운동 기록 앱입니다.  
세트마다 중량과 횟수를 기록하고, 나중에 그래프로 성장 추이를 확인할 수 있습니다.

**라이브**: [wldn7601.store](https://wldn7601.store)

---

## 이런 앱입니다

- 오늘 벤치프레스 3세트를 했다면, 각 세트의 중량과 횟수를 입력합니다
- 운동 이름을 직접 타이핑하면 퍼지 매칭으로 기존 운동과 연결해줍니다  
  ("인클라인 프레스"를 쳐도 "인클라인 벤치 프레스"로 연결)
- 한 달 뒤에 그래프로 최대 중량이 얼마나 늘었는지 볼 수 있습니다
- iPhone 홈 화면에 추가해서 네이티브 앱처럼 쓸 수 있습니다 (PWA)

---

## 기술 스택

- **백엔드**: Django 5.2 + Django REST Framework + Simple JWT
- **프론트엔드**: React 19 + Vite + TailwindCSS + Recharts
- **인증**: JWT (access token 60분, refresh token 7일)
- **배포**: PythonAnywhere (Django가 React 빌드 결과물을 직접 서빙)
- **DB**: SQLite

---

## 로컬에서 실행하기

### 사전 준비

- Python 3.12
- Node.js 24+

### 1. 백엔드 실행

```bash
cd backend

# 가상환경 생성 및 패키지 설치
python3.12 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# DB 초기화 및 기본 데이터 로드
python manage.py migrate
python manage.py loaddata apps/workouts/fixtures/seed.json

# 계정 생성
python manage.py createsuperuser

# 서버 실행
python manage.py runserver
```

### 2. 프론트엔드 실행 (별도 터미널)

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:5173` 에서 확인할 수 있습니다.

### 3. 환경변수

프로젝트 루트에 `.env` 파일을 만들어주세요.

```env
SECRET_KEY=개발용-임의-문자열
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

---

## 프로덕션 빌드

React를 빌드하고 Django에 통합하는 작업을 한 번에 처리하는 스크립트가 있습니다.

```bash
# 프로젝트 루트에서 실행
bash scripts/build_and_copy.sh
```

이 스크립트가 하는 일:
1. `frontend/` 빌드
2. 빌드 결과물을 `backend/staticfiles_src/` 에 복사
3. `index.html` 의 정적 파일 경로를 Django용으로 수정
4. `collectstatic` 실행

---

## 프로젝트 구조

```
├── backend/
│   ├── apps/workouts/       # 운동 기록 앱 (모델, API, 퍼지 매칭)
│   ├── config/              # Django 설정, URL 라우팅
│   ├── staticfiles_src/     # 직접 관리하는 정적 파일 (manifest.json 등)
│   └── templates/index.html # React 빌드 결과물 (build_and_copy.sh가 생성)
├── frontend/
│   └── src/
│       ├── pages/           # 기록, 히스토리, 성장추이, 로그인 페이지
│       └── api/             # API 호출 함수 모음
└── scripts/
    └── build_and_copy.sh    # 프로덕션 빌드 자동화
```

---

## API

인증이 필요한 엔드포인트는 `Authorization: Bearer <access_token>` 헤더를 사용합니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/register/` | 회원가입 |
| POST | `/api/auth/token/` | 로그인 |
| POST | `/api/auth/token/refresh/` | 토큰 갱신 |
| GET | `/api/sessions/` | 세션 목록 (날짜 필터 가능) |
| POST | `/api/sessions/` | 세션 생성 (날짜 기준 get_or_create) |
| POST | `/api/sessions/{id}/sets/` | 세트 추가 |
| PATCH | `/api/sets/{id}/` | 세트 수정 |
| DELETE | `/api/sets/{id}/` | 세트 삭제 |
| POST | `/api/exercises/search/` | 운동 이름 퍼지 매칭 검색 |
| GET | `/api/exercises/{id}/progress/` | 성장 추이 (`?period=1m\|3m\|6m\|all`) |
