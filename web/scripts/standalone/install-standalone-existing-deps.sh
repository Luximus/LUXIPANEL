#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
#
# LUXIPANEL standalone installer — SCENARIO 3:
#   Server that ALREADY has the system libraries installed and running
#   (redis, postgresql, certbot, nginx, build tools, …) but nginx is NOT yet
#   configured for this domain.
#
# Skips `apt-get` and service-enable (assumes they are present/running), then:
# ensures Node/pnpm/pm2, writes the .env files, builds, starts pm2, WRITES the
# nginx vhost for your domain, and issues a TLS cert via certbot.
#
# Usage:
#   sudo bash scripts/standalone/install-standalone-existing-deps.sh \
#        --domain panel.tudominio.com [--email tu@correo] [--backend-port N] [...]
#
# TLS choice:
#   · default = direct TLS (certbot on this origin).
#   · behind Cloudflare? add `--cloudflare` (certbot runs with the DNS-only flow).
#   · plain http? add `--http` (certbot is then best-effort / can be skipped).
set -euo pipefail
IFS=$'\n\t'

# ROOT_DIR + root guard + `--domain` detection/prompt (domain_args).
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

echo "[INFO] LUXIPANEL standalone — SCENARIO 3: existing deps, configure nginx for the domain + TLS."
echo "[INFO] Skipping apt + service-enable; writing the panel nginx vhost and issuing TLS."
exec bash "${ROOT_DIR}/install.sh" \
  --standalone --skip-system-deps --https --run-certbot \
  "${domain_args[@]+"${domain_args[@]}"}" "$@"
