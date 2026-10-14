#!/usr/bin/env bash
# ============================================================
# LUXIPANEL — Public Hostname Smoke Test
# Verifies the production host split:
#   - panel.luxisoft.com for the UI
#   - api.luxisoft.com for the LS API/JWKS
#   - backend.luxisoft.com redirect during transition
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/colors.sh"

# NOTE: the default host below equals DEFAULT_APP_DOMAIN in
# scripts/install-common.sh. Left as a literal on purpose: this legacy smoke test
# only sources lib/colors.sh, and pulling in install-common.sh would flip IFS and
# couple a standalone probe to the installer. The sibling API/LEGACY hosts are not
# in the SSOT anyway, so sourcing one of three defaults would be inconsistent.
PANEL_URL="${PANEL_URL:-https://panel.luxisoft.com}"
API_URL="${API_URL:-https://api.luxisoft.com}"
LEGACY_URL="${LEGACY_URL:-https://backend.luxisoft.com}"
TIMEOUT="${TIMEOUT:-10}"

check_status() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local output
  # No `-k`: this is a TLS smoke test, so a bad/expired/self-signed/MITM cert
  # MUST fail the check rather than be silently accepted.
  output="$(curl -sS -o /dev/null -w "%{http_code} %{redirect_url}" --max-time "${TIMEOUT}" "${url}" || true)"
  local code="${output%% *}"
  local redirect="${output#* }"

  if [[ "${expected}" == "301" ]]; then
    if [[ "${code}" == "301" && "${redirect}" == "${PANEL_URL}"* ]]; then
      success "${name} (${code} -> ${redirect})"
      return 0
    fi
    error "${name} — expected 301 to ${PANEL_URL}, got ${output}"
    return 1
  fi

  if [[ "${code}" == "${expected}" ]]; then
    success "${name} (${code})"
    return 0
  fi

  error "${name} — expected ${expected}, got ${output}"
  return 1
}

main() {
  section "LUXIPANEL Public Hostname Smoke Test"

  local all_ok=true

  check_status "Panel homepage" "${PANEL_URL}/" "200" || all_ok=false
  check_status "LS JWKS" "${API_URL}/.well-known/jwks.json" "200" || all_ok=false
  check_status "Legacy redirect" "${LEGACY_URL}/cualquier-cosa" "301" || all_ok=false

  echo ""
  if [[ "${all_ok}" == "true" ]]; then
    success "Public hostname smoke passed"
    exit 0
  fi

  error "Public hostname smoke failed"
  exit 1
}

main "$@"
