#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
#
# LUXIPANEL standalone installer — SCENARIO 2:
#   Fresh server (nothing installed), NO Cloudflare — direct TLS.
#
# Does everything from `apt-get update` to a running panel and then issues a
# Let's Encrypt certificate directly on this origin via `certbot --nginx`
# (the domain's DNS A/AAAA record must already point to this server).
#
# Usage:
#   sudo bash scripts/standalone/install-standalone-new-direct.sh \
#        --domain panel.tudominio.com [--email tu@correo] [--backend-port N] [...]
#
# Tip: add `--http` if you genuinely want a plain-http install (no TLS).
set -euo pipefail
IFS=$'\n\t'

# ROOT_DIR + root guard + `--domain` detection/prompt (domain_args).
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"

echo "[INFO] LUXIPANEL standalone — SCENARIO 2: fresh server, direct TLS (full install + certbot)."
echo "[INFO] Make sure ${_domain:-the domain}'s DNS already points to THIS server before TLS issuance."
exec bash "${ROOT_DIR}/install.sh" \
  --standalone --https --run-certbot \
  "${domain_args[@]+"${domain_args[@]}"}" "$@"
