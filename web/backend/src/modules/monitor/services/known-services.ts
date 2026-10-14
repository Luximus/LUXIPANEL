// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Catalogue of the services the LUXIPANEL modules depend on.
 *
 * Each entry maps a systemd unit (Debian-canonical name, since that is what
 * the panel's reference deployment runs) to the module that needs it and,
 * when the service is installable, to its per-distro package spec.
 *
 * The monitor page surfaces every entry here, distinguishing three states:
 *   - active    → unit is loaded and running.
 *   - inactive  → unit is loaded (installed) but stopped → offer "Activar".
 *   - missing   → unit file not found (not installed). When `pkg` is set we
 *                 offer "Instalar"; base-system units (no `pkg`) just show a
 *                 "No instalado" badge.
 *
 * `PackageSpec` is consumed by the shared `packageInstaller`, which falls back
 * to the `apt` names when no entry exists for the detected package manager.
 */

import type { PackageSpec } from "../../../shared/system/installer.js";

export interface KnownService {
  /** systemd unit name (without the `.service` suffix). */
  unit: string;
  /** Human-facing label shown in the UI. */
  label: string;
  /** Which panel module relies on this service (for grouping / context). */
  module: string;
  /**
   * Per-distro package names. Omitted for base-system units that ship with
   * the OS and cannot be installed as a standalone package (e.g.
   * systemd-resolved) — those render without an "Instalar" button.
   */
  pkg?: PackageSpec;
}

export const KNOWN_SERVICES: KnownService[] = [
  // ---- Web / reverse proxy ----
  { unit: "nginx", label: "nginx", module: "nginx", pkg: { apt: ["nginx"], dnf: ["nginx"], yum: ["nginx"], apk: ["nginx"], pacman: ["nginx"] } },
  { unit: "apache2", label: "apache2", module: "nginx", pkg: { apt: ["apache2"], dnf: ["httpd"], yum: ["httpd"], apk: ["apache2"], pacman: ["apache"] } },

  // ---- Mail stack ----
  { unit: "postfix", label: "postfix", module: "mail", pkg: { apt: ["postfix"], dnf: ["postfix"], yum: ["postfix"], apk: ["postfix"], pacman: ["postfix"] } },
  { unit: "dovecot", label: "dovecot", module: "mail", pkg: { apt: ["dovecot-core", "dovecot-imapd"], dnf: ["dovecot"], yum: ["dovecot"], apk: ["dovecot"], pacman: ["dovecot"] } },
  { unit: "opendkim", label: "opendkim", module: "mail", pkg: { apt: ["opendkim"], dnf: ["opendkim"], yum: ["opendkim"], apk: ["opendkim"], pacman: ["opendkim"] } },

  // ---- Databases / cache ----
  { unit: "postgresql", label: "postgresql", module: "hosting", pkg: { apt: ["postgresql"], dnf: ["postgresql-server"], yum: ["postgresql-server"], apk: ["postgresql"], pacman: ["postgresql"] } },
  { unit: "mysql", label: "mysql", module: "hosting", pkg: { apt: ["mysql-server"], dnf: ["mysql-server"], yum: ["mysql-server"], apk: ["mysql"], pacman: ["mysql"] } },
  { unit: "mariadb", label: "mariadb", module: "hosting", pkg: { apt: ["mariadb-server"], dnf: ["mariadb-server"], yum: ["mariadb-server"], apk: ["mariadb"], pacman: ["mariadb"] } },
  { unit: "redis-server", label: "redis-server", module: "hosting", pkg: { apt: ["redis-server"], dnf: ["redis"], yum: ["redis"], apk: ["redis"], pacman: ["redis"] } },
  { unit: "memcached", label: "memcached", module: "hosting", pkg: { apt: ["memcached"], dnf: ["memcached"], yum: ["memcached"], apk: ["memcached"], pacman: ["memcached"] } },

  // ---- Security / firewall ----
  { unit: "fail2ban", label: "fail2ban", module: "firewall", pkg: { apt: ["fail2ban"], dnf: ["fail2ban"], yum: ["fail2ban"], apk: ["fail2ban"], pacman: ["fail2ban"] } },
  { unit: "ufw", label: "ufw", module: "firewall", pkg: { apt: ["ufw"], dnf: ["ufw"], yum: ["ufw"], apk: ["ufw"], pacman: ["ufw"] } },

  // ---- Base system (module-relevant but OS-managed) ----
  { unit: "ssh", label: "ssh", module: "terminal", pkg: { apt: ["openssh-server"], dnf: ["openssh-server"], yum: ["openssh-server"], apk: ["openssh"], pacman: ["openssh"] } },
  { unit: "cron", label: "cron", module: "cron", pkg: { apt: ["cron"], dnf: ["cronie"], yum: ["cronie"], apk: ["cronie"], pacman: ["cronie"] } },
  { unit: "systemd-resolved", label: "systemd-resolved", module: "monitor" },

  // ---- Containers ----
  { unit: "docker", label: "docker", module: "openclaw", pkg: { apt: ["docker.io"], dnf: ["docker"], yum: ["docker"], apk: ["docker"], pacman: ["docker"] } },
  { unit: "containerd", label: "containerd", module: "openclaw", pkg: { apt: ["containerd"], dnf: ["containerd"], yum: ["containerd"], apk: ["containerd"], pacman: ["containerd"] } },
];

/** O(1) lookup by unit name. */
export const KNOWN_SERVICE_BY_UNIT: Map<string, KnownService> = new Map(
  KNOWN_SERVICES.map((s) => [s.unit, s]),
);
