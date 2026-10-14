#!/usr/bin/env bash
# ============================================================
# LUXIPANEL — Pre-flight checks and system verification
# ============================================================

# Require root (or sudo) for system operations
require_root() {
  if [[ $EUID -ne 0 ]]; then
    fatal "This script must be run as root. Try: sudo $0"
  fi
}

# Detect distro family and set package manager globals
detect_distro() {
  if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    source /etc/os-release
    DISTRO_ID="${ID:-unknown}"
    DISTRO_VERSION="${VERSION_ID:-0}"
    DISTRO_NAME="${NAME:-Unknown}"
  else
    fatal "Cannot detect Linux distribution. /etc/os-release not found."
  fi

  case "${DISTRO_ID}" in
    debian|ubuntu)
      PKG_MANAGER="apt-get"
      PKG_UPDATE="apt-get update -q"
      PKG_INSTALL="apt-get install -y -q"
      PKG_FAMILY="debian"
      ;;
    rocky|rhel|centos|almalinux)
      PKG_MANAGER="dnf"
      PKG_UPDATE="dnf makecache -q"
      PKG_INSTALL="dnf install -y"
      PKG_FAMILY="rhel"
      ;;
    *)
      fatal "Unsupported distribution: ${DISTRO_ID}. Supported: Debian 12+, Ubuntu 22.04+, Rocky Linux 9"
      ;;
  esac

  info "Detected: ${DISTRO_NAME} ${DISTRO_VERSION} (${PKG_FAMILY})"

  # Refresh package cache so require_cmd installs succeed on a fresh system
  export DEBIAN_FRONTEND=noninteractive
  info "Updating package cache..."
  ${PKG_UPDATE} || fatal "Failed to update package cache"
  success "Package cache updated"

  export PKG_MANAGER PKG_UPDATE PKG_INSTALL PKG_FAMILY DISTRO_ID DISTRO_VERSION DISTRO_NAME
}

# Verify minimum supported version
check_distro_version() {
  case "${DISTRO_ID}" in
    debian)
      [[ "${DISTRO_VERSION}" -ge 12 ]] || fatal "Debian 12 (Bookworm) or later required. Found: ${DISTRO_VERSION}"
      ;;
    ubuntu)
      local major; major="${DISTRO_VERSION%%.*}"
      [[ "${major}" -ge 22 ]] || fatal "Ubuntu 22.04 or later required. Found: ${DISTRO_VERSION}"
      ;;
    rocky|almalinux)
      local major; major="${DISTRO_VERSION%%.*}"
      [[ "${major}" -ge 9 ]] || fatal "Rocky Linux 9 or later required. Found: ${DISTRO_VERSION}"
      ;;
  esac
}

# Check that a command exists
require_cmd() {
  local cmd="$1"
  local pkg="${2:-$1}"
  if ! command -v "${cmd}" &>/dev/null; then
    warn "'${cmd}' not found. Installing ${pkg}..."
    if ! ${PKG_INSTALL} "${pkg}"; then
      fatal "Failed to install ${pkg}"
    fi
    if ! command -v "${cmd}" &>/dev/null; then
      fatal "'${cmd}' still not found after installing ${pkg}"
    fi
    success "Installed ${pkg}"
  fi
}

# Check that a port is not already in use
check_port_free() {
  local port="$1"
  if ss -tlnH "( sport = :${port} )" 2>/dev/null | grep -q "${port}"; then
    fatal "Port ${port} is already in use. Free it before running this script."
  fi
}

# Check available disk space (in MB)
check_disk_space() {
  local required_mb="$1"
  local path="${2:-/}"
  local available_mb
  available_mb=$(df -m "${path}" | awk 'NR==2 {print $4}')
  if [[ "${available_mb}" -lt "${required_mb}" ]]; then
    fatal "Insufficient disk space on ${path}. Required: ${required_mb}MB, Available: ${available_mb}MB"
  fi
  info "Disk space OK: ${available_mb}MB available on ${path}"
}

# Check available RAM (in MB)
check_ram() {
  local required_mb="$1"
  local available_mb
  available_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if [[ "${available_mb}" -lt "${required_mb}" ]]; then
    warn "Low available memory: ${available_mb}MB (recommended: ${required_mb}MB)"
  else
    info "Memory OK: ${available_mb}MB available"
  fi
}

# Verify internet connectivity
check_internet() {
  if curl -sf --max-time 5 https://deb.debian.org/ &>/dev/null || \
     curl -sf --max-time 5 https://www.google.com &>/dev/null || \
     curl -sf --max-time 5 https://1.1.1.1 &>/dev/null; then
    info "Internet connectivity OK"
  else
    fatal "No internet connectivity. Check your network connection."
  fi
}

# Verify systemd is running
check_systemd() {
  if ! systemctl is-system-running &>/dev/null && ! systemctl status &>/dev/null; then
    warn "systemd may not be the init system. Some features may not work."
  fi
}

# Wait for a service to become healthy
wait_for_service() {
  local service="$1"
  local max_wait="${2:-30}"
  local waited=0
  info "Waiting for ${service} to start..."
  while ! systemctl is-active --quiet "${service}"; do
    sleep 2
    waited=$((waited + 2))
    if [[ ${waited} -ge ${max_wait} ]]; then
      fatal "${service} did not start within ${max_wait}s"
    fi
  done
  success "${service} is running"
}

# Wait for a TCP port to accept connections
wait_for_port() {
  local host="$1"
  local port="$2"
  local max_wait="${3:-30}"
  local waited=0
  info "Waiting for ${host}:${port}..."
  while ! nc -z "${host}" "${port}" 2>/dev/null; do
    sleep 2
    waited=$((waited + 2))
    if [[ ${waited} -ge ${max_wait} ]]; then
      fatal "${host}:${port} not reachable after ${max_wait}s"
    fi
  done
  success "${host}:${port} is reachable"
}

# Verify a systemd service exists and enable it
enable_and_start_service() {
  local service="$1"
  systemctl daemon-reload
  systemctl enable --now "${service}" || fatal "Failed to enable/start ${service}"
  success "Service ${service} enabled and started"
}

# ============================================================
# Package requirement validation system
# ============================================================

# Get version number from a command
# Returns the major.minor version, or "0.0" if not found
get_package_version() {
  local cmd="$1"
  local version_arg="${2:---version}"

  if ! command -v "${cmd}" &>/dev/null; then
    echo "0.0"
    return
  fi

  # Try to extract version (handles various formats)
  local version
  version=$("${cmd}" "${version_arg}" 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
  echo "${version:-0.0}"
}

# Compare two versions (e.g., "22.0" >= "20.0")
# Returns 0 if version1 >= version2, 1 otherwise
version_ge() {
  local v1="$1" v2="$2"
  [[ "$(printf '%s\n' "$v2" "$v1" | sort -V | head -n1)" == "$v2" ]]
}

# Validate a package requirement
# Usage: validate_package_requirement "node" "22.0" "Node.js"
# Returns: 0 if OK, 1 if needs update, 2 if not installed
validate_package_requirement() {
  local cmd="$1"
  local min_version="$2"
  local display_name="${3:-$cmd}"
  local version_arg="${4:---version}"

  # Check if command exists
  if ! command -v "${cmd}" &>/dev/null; then
    return 2  # Not installed
  fi

  # Get current version
  local current_version
  current_version=$(get_package_version "${cmd}" "${version_arg}")

  # Check if version meets requirement
  if version_ge "${current_version}" "${min_version}"; then
    info "✓ ${display_name}: ${current_version} (meets requirement ≥ ${min_version})"
    return 0  # Already OK
  else
    warn "✗ ${display_name}: ${current_version} (upgrade needed to ≥ ${min_version})"
    return 1  # Needs update
  fi
}

# Prompt user to install a new package
# Usage: prompt_install_package "Node.js" "Required for backend compilation"
# Returns: 0 if user accepts, 1 if user declines
prompt_install_package() {
  local display_name="$1"
  local description="${2:-}"

  if [[ "${NON_INTERACTIVE}" == "true" ]]; then
    info "Non-interactive mode: proceeding with ${display_name} installation"
    return 0
  fi

  echo ""
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "  Install ${display_name}?"
  if [[ -n "${description}" ]]; then
    warn "  ${description}"
  fi
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ -t 0 ]]; then
    read -r -p "  Proceed with installation? (y/n) " -n 1 response
    echo ""
    [[ "${response}" == "y" || "${response}" == "Y" ]]
    return
  else
    warn "Non-TTY mode: cannot prompt for installation"
    return 1
  fi
}

# Prompt user to upgrade a package
# Usage: prompt_upgrade_package "node" "Node.js"
# Returns: 0 if user accepts, 1 if user declines
prompt_upgrade_package() {
  local cmd="$1"
  local display_name="${2:-$cmd}"

  if [[ "${NON_INTERACTIVE}" == "true" ]]; then
    info "Non-interactive mode: proceeding with ${display_name} upgrade"
    return 0
  fi

  echo ""
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "  ${display_name} requires upgrade"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ -t 0 ]]; then
    read -r -p "  Proceed with upgrade? (y/n) " -n 1 response
    echo ""
    [[ "${response}" == "y" || "${response}" == "Y" ]]
    return
  else
    warn "Non-TTY mode: cannot prompt for upgrade"
    return 1
  fi
}

# Full validation and installation workflow
# Usage: ensure_package "node" "22.0" "Node.js" "nodejs" "--version" "Required for backend compilation"
# Returns: 0 if success, 1 if aborted by user, 2 if fatal error
ensure_package() {
  local cmd="$1"
  local min_version="$2"
  local display_name="${3:-$cmd}"
  local pkg_name="${4:-$cmd}"
  local version_arg="${5:---version}"
  local description="${6:-}"

  validate_package_requirement "${cmd}" "${min_version}" "${display_name}" "${version_arg}"
  local validation_result=$?

  case "${validation_result}" in
    0)
      # Already installed and meets requirements
      success "✓ ${display_name} already meets requirements"
      return 0
      ;;
    1)
      # Installed but needs upgrade
      if prompt_upgrade_package "${cmd}" "${display_name}"; then
        info "Upgrading ${display_name}..."
        ${PKG_INSTALL} "${pkg_name}" || fatal "Failed to upgrade ${display_name}"
        success "✓ ${display_name} upgraded successfully"
        return 0
      else
        warn "Upgrade aborted: ${display_name} does not meet requirements"
        return 1
      fi
      ;;
    2)
      # Not installed, need to install
      if prompt_install_package "${display_name}" "${description}"; then
        info "Installing ${display_name}..."
        ${PKG_INSTALL} "${pkg_name}" || fatal "Failed to install ${display_name}"
        success "✓ ${display_name} installed successfully"
        return 0
      else
        warn "Installation aborted: ${display_name} is required"
        return 1
      fi
      ;;
  esac

  return 2
}

# Check PM2 specifically (npm global package)
check_pm2() {
  if ! command -v pm2 &>/dev/null; then
    return 2  # Not installed
  fi

  local pm2_version
  pm2_version=$(pm2 --version 2>/dev/null || echo "0.0")
  info "✓ PM2: ${pm2_version} is installed"
  return 0
}

# Ensure PM2 is installed globally
ensure_pm2() {
  if check_pm2 >/dev/null 2>&1; then
    success "PM2 is already installed globally"
    return 0
  fi

  info "Installing PM2 globally via npm..."
  npm install -g pm2 || fatal "Failed to install PM2"
  success "✓ PM2 installed successfully"
}
