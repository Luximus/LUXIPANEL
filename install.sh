#!/usr/bin/env bash
set -euo pipefail
LXP_REPOSITORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${LXP_REPOSITORY_DIR}/web/install.sh" "$@"
