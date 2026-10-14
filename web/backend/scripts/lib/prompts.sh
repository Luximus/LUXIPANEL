#!/usr/bin/env bash
# ============================================================
# LUXIPANEL — Interactive prompt helpers
# ============================================================

# Prompt for a non-empty string value
# Usage: prompt_required VAR_NAME "Prompt text" [default]
prompt_required() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-}"
  local value=""

  while [[ -z "${value}" ]]; do
    if [[ -n "${default_val}" ]]; then
      echo -ne "${CYAN}${prompt_text}${RESET} [${DIM}${default_val}${RESET}]: "
    else
      echo -ne "${CYAN}${prompt_text}${RESET}: "
    fi
    read -r value
    value="${value:-${default_val}}"
    if [[ -z "${value}" ]]; then
      warn "This field is required."
    fi
  done

  printf -v "${var_name}" '%s' "${value}"
}

# Prompt for an optional value with a default
# Usage: prompt_optional VAR_NAME "Prompt text" [default]
prompt_optional() {
  local var_name="$1"
  local prompt_text="$2"
  local default_val="${3:-}"

  if [[ -n "${default_val}" ]]; then
    echo -ne "${CYAN}${prompt_text}${RESET} [${DIM}${default_val}${RESET}]: "
  else
    echo -ne "${CYAN}${prompt_text}${RESET}: "
  fi
  read -r value
  value="${value:-${default_val}}"

  printf -v "${var_name}" '%s' "${value}"
}

# Prompt for a password (hidden input), confirm match
# Usage: prompt_password VAR_NAME "Password label"
prompt_password() {
  local var_name="$1"
  local label="${2:-Password}"
  local pass1="" pass2=""

  while true; do
    echo -ne "${CYAN}${label}${RESET}: "
    read -rs pass1; echo
    echo -ne "${CYAN}Confirm ${label}${RESET}: "
    read -rs pass2; echo
    if [[ "${pass1}" == "${pass2}" ]]; then
      break
    fi
    warn "Passwords do not match. Try again."
  done

  printf -v "${var_name}" '%s' "${pass1}"
}

# Yes/No confirmation prompt, returns 0 for yes, 1 for no
# Usage: confirm "Are you sure?" && do_something
confirm() {
  local prompt_text="${1:-Continue?}"
  local default="${2:-y}"  # y or n
  local reply

  if [[ "${default}" == "y" ]]; then
    echo -ne "${YELLOW}${prompt_text}${RESET} [${BOLD}Y${RESET}/n]: "
  else
    echo -ne "${YELLOW}${prompt_text}${RESET} [y/${BOLD}N${RESET}]: "
  fi
  read -r reply

  reply="${reply:-${default}}"
  [[ "${reply}" =~ ^[Yy] ]]
}

# Select from a list of options
# Usage: select_option VAR_NAME "Prompt" opt1 opt2 opt3
select_option() {
  local var_name="$1"
  local prompt_text="$2"
  shift 2
  local options=("$@")

  echo -e "${CYAN}${prompt_text}${RESET}"
  for i in "${!options[@]}"; do
    echo -e "  ${BOLD}$((i+1))${RESET}. ${options[$i]}"
  done

  local choice
  while true; do
    echo -ne "Enter choice [1-${#options[@]}]: "
    read -r choice
    if [[ "${choice}" =~ ^[0-9]+$ ]] && \
       [[ "${choice}" -ge 1 ]] && \
       [[ "${choice}" -le "${#options[@]}" ]]; then
      printf -v "${var_name}" '%s' "${options[$((choice-1))]}"
      break
    fi
    warn "Invalid choice. Please enter a number between 1 and ${#options[@]}."
  done
}

# Generate a cryptographically random secret of ${length} BYTES, printed as
# 2*${length} lowercase hex characters.
#
# Both paths now agree — same alphabet AND same length. The old urandom
# fallback (`tr -dc 'A-Za-z0-9' | head -c ${length}`) emitted a DIFFERENT
# alphabet and HALF the characters `openssl rand -hex ${length}` does, so a box
# without openssl silently got a weaker secret than the caller asked for. Hex
# keeps the `sed`-safety the alphanumeric restriction was there for (no `&`,
# no `\`), which matters because rotate-secrets.sh splices the value into a
# `sed` replacement. Same fallback used by scripts/install-common.sh's
# `random_hex` and by the remote provisioning scripts.
generate_secret() {
  local length="${1:-64}"
  openssl rand -hex "${length}" 2>/dev/null || \
    { head -c "${length}" /dev/urandom | od -An -tx1 | tr -d ' \n'; printf '\n'; }
}

# Print a summary table: key=value pairs
print_summary() {
  local title="${1:-Configuration Summary}"
  shift
  echo -e "\n${BOLD}${title}${RESET}"
  echo "──────────────────────────────────────────────"
  while [[ $# -ge 2 ]]; do
    printf "  ${CYAN}%-24s${RESET} %s\n" "$1" "$2"
    shift 2
  done
  echo "──────────────────────────────────────────────"
}
