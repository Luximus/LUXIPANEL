#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
#
# Shared prologue for the scripts/standalone/*.sh scenario wrappers.
#
# SOURCE it (never execute it) right after each wrapper's `set -euo pipefail`:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
#
# A sourced file keeps the caller's `$@` and `$0`, so the guard message and the
# `--domain` detection behave exactly as they did when every wrapper carried its
# own byte-identical copy of these ~12 lines.
#
# Provides:
#   ROOT_DIR     — the repo root (two levels up from this file)
#   domain_args  — ("--domain" "<host>") when the caller did NOT pass --domain
#                  and answered the prompt; empty array otherwise
#   _domain      — the prompted hostname (wrappers echo it in their banner)
#
# Exits 1 when not root, or when the prompt is answered with an empty domain.

# Resolved from THIS file, so it is the same for every wrapper that sources it.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ "${EUID}" -eq 0 ]] || { echo "[ERROR] Run as root: sudo bash $0 ..." >&2; exit 1; }

# Prompt for the domain only when the caller didn't pass --domain.
needs_domain=1
for a in "$@"; do [[ "$a" == "--domain" ]] && needs_domain=0; done
domain_args=()
if [[ "${needs_domain}" -eq 1 ]]; then
  read -r -p "Public domain (e.g. panel.tudominio.com): " _domain
  [[ -n "${_domain}" ]] || { echo "[ERROR] A domain is required." >&2; exit 1; }
  domain_args=(--domain "${_domain}")
fi
