#!/usr/bin/env bash
# Remote cutover deploy for echovocis. Runs on the VPS via deploy-prod.sh.
# Builds the bot image, starts postgres, then the bot (which auto-runs
# alembic upgrade head on first start).
#
# This stack has NO Caddy integration — the bot uses Telegram directly.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env file missing. Copy infra/.env.production.example to ../.env and populate." >&2
  exit 1
fi

echo "==> Pull base images"
docker compose pull db

echo "==> Build bot image"
docker compose build bot

echo "==> Start db"
docker compose up -d db

echo "==> Wait for db healthy"
for i in $(seq 1 30); do
  status=$(docker compose ps --format json db 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  if [ "$status" = "healthy" ]; then
    echo "    db healthy"
    break
  fi
  sleep 2
done

echo "==> Start bot (runs alembic upgrade head && python -m src.main)"
docker compose up -d bot

echo "==> Status"
docker compose ps

echo "==> Done. Tail logs with: docker compose logs -f --tail=200 bot"
