#!/usr/bin/env bash
# 本地发布：构建 -> 写入 version.json(origin=local) -> 同步到服务器
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== install =="
npm install

echo "== build =="
npm run build

echo "== write version.json =="
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
printf '{"origin":"local","commit":"%s","ref":"%s","built":"%s"}\n' \
  "$COMMIT" "$BRANCH" "$(date -u +%FT%TZ)" > dist/version.json
cat dist/version.json

echo "== deploy =="
rsync -rltz --delete --chmod=D775,F664 \
  --exclude=status.html --exclude=status.json \
  dist/ ubuntu@raicco.cn:/var/www/yishennav/

echo "== done =="
curl -fsS -o /dev/null -w 'site=%{http_code}\n' https://yishennav.raicco.cn/
