#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 LUXISOFT
#
# Shared "build the two npm projects" flow.
#
# SOURCE it (never execute it). Two consumers, deliberately different tails:
#   · redeploy.sh              — build + `pm2 restart` (the deploy path)
#   · .claude/scripts/build.sh — build only, pm2 logs on failure (dev helper)
#
# What is shared: the pm2 app names and the `cd <project> && npm run build`
# step both used to inline. Presentation (messages, colours) stays with each
# caller, because they are different tools for different audiences.

# pm2 app names — must stay in sync with ecosystem.config.cjs.
PM2_BACKEND="luxipanel-backend"
PM2_FRONTEND="luxipanel-frontend"

# Map a project directory ("backend" | "frontend") to its pm2 app name.
pm2_app_for() {
  case "$1" in
    backend) printf '%s\n' "${PM2_BACKEND}" ;;
    frontend) printf '%s\n' "${PM2_FRONTEND}" ;;
    *) return 1 ;;
  esac
}

# Run `npm run build` inside <root>/<project>.
#
# Runs in a subshell so the caller's cwd is untouched, and returns npm's exit
# status instead of exiting, so a caller with `set -e` can still wrap it in
# `if ! build_project …` to print diagnostics.
build_project() {
  local root="$1"
  local project="$2"
  ( cd "${root}/${project}" && npm run build )
}
