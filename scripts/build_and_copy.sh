#!/usr/bin/env bash
# React를 빌드하고 결과물을 Django에 복사한 뒤 collectstatic을 실행합니다.
# 프로젝트 루트에서 실행하세요: bash scripts/build_and_copy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
ASSET_DEST="$BACKEND_DIR/staticfiles_src/assets"
TEMPLATE_DEST="$BACKEND_DIR/templates/index.html"

echo "==> 1/4 React build"
cd "$FRONTEND_DIR"
npm run build

echo "==> 2/4 Assets 복사"
rm -rf "$ASSET_DEST"
mkdir -p "$ASSET_DEST"
cp -r "$FRONTEND_DIR/dist/assets/." "$ASSET_DEST/"

# dist/ 루트의 정적 파일(아이콘, manifest 등)도 함께 복사
find "$FRONTEND_DIR/dist" -maxdepth 1 -type f ! -name 'index.html' -exec \
  cp {} "$BACKEND_DIR/staticfiles_src/" \;

echo "==> 3/4 index.html 복사 (static 경로로 치환)"
# Vite가 내보낸 /assets/... 경로를 Django STATIC_URL(/static/assets/...)에 맞게 치환
sed 's|="/assets/|="/static/assets/|g; s|="/vite.svg"|="/static/vite.svg"|g' \
  "$FRONTEND_DIR/dist/index.html" > "$TEMPLATE_DEST"

echo "==> 4/4 collectstatic"
cd "$BACKEND_DIR"
if [ ! -d venv ]; then
  echo "backend/venv 없음. 먼저 'python3.12 -m venv venv && pip install -r requirements.txt' 하세요." >&2
  exit 1
fi
# shellcheck disable=SC1091
source venv/bin/activate
python manage.py collectstatic --noinput

echo "완료."
