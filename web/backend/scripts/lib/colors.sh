#!/usr/bin/env bash
# ============================================================
# LUXIPANEL — Color & formatting helpers
# Source this file: source "$(dirname "$0")/lib/colors.sh"
# ============================================================

# Colors (only when stdout is a terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  MAGENTA='\033[0;35m'
  BOLD='\033[1m'
  DIM='\033[2m'
  RESET='\033[0m'
else
  RED='' GREEN='' YELLOW='' BLUE='' CYAN='' MAGENTA=''
  BOLD='' DIM='' RESET=''
fi

# ---- Print helpers ----

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
fatal()   { echo -e "${RED}[FATAL]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}==>${RESET}${BOLD} $*${RESET}"; }
section() { echo -e "\n${BOLD}${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n${BOLD}${MAGENTA}  $*${RESET}\n${BOLD}${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }

banner() {
  echo -e "${BOLD}${CYAN}"
  echo '  ██╗     ██╗   ██╗██╗  ██╗██╗██████╗  █████╗ ███╗   ██╗███████╗██╗'
  echo '  ██║     ██║   ██║╚██╗██╔╝██║██╔══██╗██╔══██╗████╗  ██║██╔════╝██║'
  echo '  ██║     ██║   ██║ ╚███╔╝ ██║██████╔╝███████║██╔██╗ ██║█████╗  ██║'
  echo '  ██║     ██║   ██║ ██╔██╗ ██║██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║'
  echo '  ███████╗╚██████╔╝██╔╝ ██╗██║██║     ██║  ██║██║ ╚████║███████╗███████╗'
  echo '  ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝'
  echo -e "${RESET}"
  echo -e "  ${DIM}Server Management Panel v2.0${RESET}\n"
}
