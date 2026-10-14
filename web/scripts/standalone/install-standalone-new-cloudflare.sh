#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
#
# LUXIPANEL standalone installer — SCENARIO 1:
#   Fresh server (nothing installed) sitting BEHIND CLOUDFLARE.
#
# Does everything from `apt-get update` to a running panel: system deps,
# Node/pnpm/pm2, postgresql/redis/nginx, .env (https origins + host-only cookie),
# build, pm2, nginx vhost, and a Let's Encrypt cert via certbot (with the
# Cloudflare DNS-only guidance so the challenge reaches the origin).
#
# Usage:
#   sudo bash scripts/standalone/install-standalone-new-cloudflare.sh \
#        --domain panel.tudominio.com [--email tu@correo] [--backend-port N] [...]
#
# Any extra flag is forwarded to the root install.sh (see `install.sh --help`).
set -euo pipefail
IFS=$'\n\t'

# ROOT_DIR + root guard + `--domain` detection/prompt (domain_args).
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

echo "[INFO] LUXIPANEL standalone — SCENARIO 1: fresh server, behind Cloudflare (full install + TLS via certbot)."
echo "[INFO] You will be asked to set the Cloudflare record to 'DNS only' before certbot runs."
exec bash "${ROOT_DIR}/install.sh" \
  --standalone --cloudflare --run-certbot \
  "${domain_args[@]+"${domain_args[@]}"}" "$@"
