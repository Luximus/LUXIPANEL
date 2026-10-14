#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
# LUXIPANEL — build + pm2 restart helper.
#
# Usage:
#   bash redeploy.sh                # build + restart both backend and frontend
#   bash redeploy.sh backend        # only backend
#   bash redeploy.sh frontend       # only frontend
#
# Why: each `astro build` rewrites server chunks with new content-hashed
# filenames. The running pm2 process keeps the old import graph in memory
# and 500s on every route until it is restarted. This script makes sure
# the restart always follows the build.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-all}"

# pm2 app names (PM2_BACKEND/PM2_FRONTEND) + `build_project` — shared with
# .claude/scripts/build.sh. SSOT for the names is ecosystem.config.cjs.
source "${ROOT}/scripts/lib/build-flow.sh"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no está en PATH. Instala con: npm install -g pm2" >&2
  exit 1
fi

build_backend() {
  echo "==> backend: npm run build"
  build_project "$ROOT" backend
  echo "==> backend: pm2 restart ${PM2_BACKEND}"
  pm2 restart "${PM2_BACKEND}" --update-env
}

build_frontend() {
  echo "==> frontend: npm run build"
  build_project "$ROOT" frontend
  echo "==> frontend: pm2 restart ${PM2_FRONTEND}"
  pm2 restart "${PM2_FRONTEND}" --update-env
}

case "$TARGET" in
  backend)  build_backend ;;
  frontend) build_frontend ;;
  all|both|"") build_backend; build_frontend ;;
  *)
    echo "Destino desconocido: $TARGET" >&2
    echo "Uso: $0 [backend|frontend|all]" >&2
    exit 2
    ;;
esac

echo "==> pm2 status"
pm2 list
