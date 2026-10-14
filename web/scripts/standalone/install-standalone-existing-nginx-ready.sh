#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
#
# LUXIPANEL standalone installer — SCENARIO 4:
#   Server with the system libraries installed AND nginx ALREADY configured for
#   this domain (vhost + TLS already in place). The installer must NOT touch
#   nginx — it only deploys the app into your existing setup.
#
# Skips apt + service-enable AND the nginx vhost. Ensures Node/pnpm/pm2, writes
# the .env files (https origins + host-only cookie), builds and starts pm2.
# Uses --strict-ports so the app binds the EXACT ports your nginx proxies to
# (fails instead of silently picking another).
#
# IMPORTANT: pass the ports your existing nginx points at, e.g.:
#   sudo bash scripts/standalone/install-standalone-existing-nginx-ready.sh \
#        --domain panel.tudominio.com --backend-port 8080 --frontend-port 4321
#
# Your nginx vhost must proxy:
#   /  → 127.0.0.1:<frontend-port>      (Astro SSR)
#   /api → 127.0.0.1:<backend-port>     (+ WS upgrade for /api/terminal and
#                                         /api/preferences/ws)
#
# If your origin serves plain http (not https), add `--http`.
set -euo pipefail
IFS=$'\n\t'

# ROOT_DIR + root guard + `--domain` detection/prompt (domain_args).
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

echo "[INFO] LUXIPANEL standalone — SCENARIO 4: existing deps + nginx already configured (app-only deploy)."
echo "[INFO] Not touching nginx; binding the exact --backend-port/--frontend-port your vhost expects."
exec bash "${ROOT_DIR}/install.sh" \
  --standalone --skip-system-deps --skip-nginx --strict-ports --https \
  "${domain_args[@]+"${domain_args[@]}"}" "$@"
