#!/usr/bin/env bash
# ============================================================
# setup-jails.sh — ensure jailkit is installed on the CLIENT
# server so per-account chroot shells (Track 2) can be built.
#
# Idempotent & non-interactive. Run by LP over the pooled SSH
# connection (engaged from ImplLP), like install-engines.sh.
# This script ONLY installs the tooling + sanity-checks it; the
# actual per-account jail is built by the panel's write-behind
# recipe (systemAccountsService.buildJailSetupSteps → jk_init /
# jk_cp / jk_jailuser) when an account opts in.
#
# Output: a single JSON line on stdout, e.g.
#   {"ok":true,"jailkit":"installed","jk_chrootsh":"/usr/sbin/jk_chrootsh"}
# ============================================================
set -u

have() { command -v "$1" >/dev/null 2>&1; }
emit_fail() { echo "{\"ok\":false,\"error\":\"$1\"}"; exit 0; }

# jailkit ships jk_chrootsh + jk_init/jk_cp/jk_jailuser under sbin.
JK_CHROOTSH=""
find_chrootsh() {
  for p in /usr/sbin/jk_chrootsh /usr/local/sbin/jk_chrootsh /sbin/jk_chrootsh; do
    if [ -x "$p" ]; then JK_CHROOTSH="$p"; return 0; fi
  done
  if have jk_chrootsh; then JK_CHROOTSH="$(command -v jk_chrootsh)"; return 0; fi
  return 1
}

# ---- install jailkit if missing
if ! find_chrootsh; then
  if have apt-get; then
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || true
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq jailkit >/dev/null 2>&1 || true
  elif have dnf; then dnf install -y -q jailkit >/dev/null 2>&1 || true
  elif have yum; then yum install -y -q jailkit >/dev/null 2>&1 || true
  elif have zypper; then zypper -q install -y jailkit >/dev/null 2>&1 || true
  elif have apk; then apk add --no-cache jailkit >/dev/null 2>&1 || true
  fi
fi

find_chrootsh || emit_fail "jailkit not installable (jk_chrootsh missing)"

# ---- sanity: the helper tools the panel recipe invokes must exist too.
JK_DIR="$(dirname "${JK_CHROOTSH}")"
for tool in jk_init jk_cp jk_jailuser; do
  if [ ! -x "${JK_DIR}/${tool}" ] && ! have "${tool}"; then
    emit_fail "jailkit incomplete: ${tool} missing"
  fi
done

# ---- register jk_chrootsh as a valid login shell (/etc/shells) so password
#      tools and PAM don't reject the jailed account. Idempotent.
if [ "$(id -u)" = 0 ] && [ -w /etc/shells ] || { [ "$(id -u)" = 0 ] && [ ! -e /etc/shells ]; }; then
  if ! grep -qxF "${JK_CHROOTSH}" /etc/shells 2>/dev/null; then
    echo "${JK_CHROOTSH}" >> /etc/shells 2>/dev/null || true
  fi
fi

# ---- sudoers drop-in: NOPASSWD allowlist for the EXACT privileged commands the
#      panel's per-account jail recipe runs (systemAccountsService.buildJailSetupSteps
#      + hosting.service teardown). The recipe runs as the panel's SSH service
#      user (non-root); without this it would hit "a password is required" on
#      each jk_*/mount step. Sibling of install-engines.sh's write_sudoers — same
#      pattern (strict Cmnd_Alias, validated with `visudo -cf` before install).
#
#      Strict allowlist — NOT a blanket NOPASSWD ALL. Each binary is pinned by
#      absolute path. The jk_* tools resolve from the jailkit dir; mount/umount
#      cover the per-jail /proc (hidepid=2) the recipe mounts/unmounts (their
#      args are the dynamic per-account jail paths, so only the binary is pinned).
#
#      NOTE on `sudo -u <owner> -i` (the interactive jailed login shell): it is
#      DELIBERATELY NOT granted NOPASSWD here. Owners are arbitrary per-account
#      Linux users, so any NOPASSWD runas spec covering them would be effectively
#      generic — forbidden. Instead it rides the existing one-passphrase model:
#      the panel (PrivilegeDropExecutor.spawn) feeds the user's passphrase at
#      sudo's PTY prompt, exactly as `sudo -u <owner> -H …` already does for
#      Track-1 ops. No new sudoers rule is needed for it.
write_sudoers() {
  local f="/etc/sudoers.d/luxipanel-jail"
  local tmp="${f}.tmp.$$"
  local TARGET_USER="${SUDO_USER:-root}"
  # mount/umount live in different dirs across distros; pin every common path.
  cat > "${tmp}" <<EOF
# LUXIPANEL jail (Fase 5 / Track 2) — managed by setup-jails.sh. Do not edit.
# Lets the panel SSH service user (${TARGET_USER}) build/tear down per-account
# chroot jails without a password prompt. Strict, per-binary allowlist.
Cmnd_Alias LUXIPANEL_JAIL = \\
  ${JK_DIR}/jk_init, \\
  ${JK_DIR}/jk_cp, \\
  ${JK_DIR}/jk_jailuser, \\
  /usr/bin/mount, /bin/mount, \\
  /usr/bin/umount, /bin/umount
Defaults!LUXIPANEL_JAIL !requiretty
${TARGET_USER} ALL=(root) NOPASSWD: LUXIPANEL_JAIL
EOF
  chmod 440 "${tmp}" 2>/dev/null || true
  if visudo -cf "${tmp}" >/dev/null 2>&1; then
    mv -f "${tmp}" "${f}" 2>/dev/null || rm -f "${tmp}"
  else
    rm -f "${tmp}"
  fi
}
if [ "$(id -u)" = 0 ] && have visudo && [ "${SUDO_USER:-root}" != "root" ]; then
  write_sudoers || true
fi

echo "{\"ok\":true,\"jailkit\":\"present\",\"jk_chrootsh\":\"${JK_CHROOTSH}\"}"
exit 0
