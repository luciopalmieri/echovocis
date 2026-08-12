#!/usr/bin/env bash
# One-shot production deploy for echovocis from a local checkout.
# Usage: bash infra/deploy-prod.sh
#
# Mirrors the kimera-apps pattern: rsync the current tree to the VPS, then
# run the remote cutover script. Override the SSH host or remote path with
# env vars if needed.

set -euo pipefail

SSH_HOST="${ECHOVOCIS_SSH_HOST:-kimera}"
REMOTE_PATH="${ECHOVOCIS_REMOTE_PATH:-/opt/echovocis}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Local: $REPO_ROOT"
echo "==> Remote: $SSH_HOST:$REMOTE_PATH"
echo

git_status="$(git -C "$REPO_ROOT" status --porcelain || true)"
if [ -n "$git_status" ]; then
  echo "WARN: working tree has uncommitted changes — they will be deployed:" >&2
  echo "$git_status" | sed 's/^/      /' >&2
  echo
fi

echo "==> rsync to VPS"
rsync -av --delete \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  --exclude='.ruff_cache' \
  --exclude='.git' \
  --exclude='.claude' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.*.local' \
  --exclude='infra/.env' \
  "$REPO_ROOT/" \
  "$SSH_HOST:$REMOTE_PATH/"

echo
echo "==> Run deploy.sh on VPS"
ssh "$SSH_HOST" "cd $REMOTE_PATH/infra && bash deploy.sh"
