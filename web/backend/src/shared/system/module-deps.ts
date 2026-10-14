// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Generic per-module system-dependency registry — generalizes the pattern the
 * firewall module uses (ufw/fail2ban detection + unattended install) so every
 * module can declare which binaries/packages/units it needs on the target
 * server, and the system-deps module can check/install them uniformly.
 *
 * Low-level work (package-manager detection, sudo strategy, unit enabling) is
 * delegated to `packageInstaller` in `./installer.js` — never duplicated here.
 */

import type { Executor } from "../executor/index.js";
import {
  packageInstaller,
  SUDO_PASSWORD_INVALID,
  SUDO_PASSWORD_REQUIRED,
  type PackageManager,
  type PackageSpec,
} from "./installer.js";

type SudoCode = typeof SUDO_PASSWORD_REQUIRED | typeof SUDO_PASSWORD_INVALID;

export interface ModuleDependency {
  /** Stable identifier, e.g. "dovecot". */
  key: string;
  /** Technical name shown in the UI (not translated), e.g. "Dovecot (IMAP/LMTP)". */
  label: string;
  /** Short, technical description. */
  description?: string;
  /** Binaries to probe; installed = ALL of them exist (isCommandAvailable). */
  commands: string[];
  /** Packages per manager (apt/dnf/yum/apk/pacman). */
  packages: PackageSpec;
  /** systemd units to `enable --now` after installing. */
  units?: string[];
  /**
   * When true, `units` are ALTERNATIVES (distro-dependent name, e.g.
   * cron/crond): enabling stops at the first unit that succeeds, mirroring
   * cron-daemon.service.ts. When false/absent, ALL units are enabled.
   */
  unitsAreAlternatives?: boolean;
  /** true = nice-to-have; does not block the module. */
  optional?: boolean;
}

export interface ModuleDepsMeta {
  /**
   * Module is "ready" when AT LEAST ONE dependency (even optional) is
   * installed — e.g. databases needs mariadb OR postgresql, not both.
   */
  requiresOneOf?: boolean;
}

const MODULE_DEPS_META: Record<string, ModuleDepsMeta> = {
  databases: { requiresOneOf: true },
};

const MODULE_DEPENDENCIES: Record<string, ModuleDependency[]> = {
  firewall: [
    {
      key: "ufw",
      label: "UFW",
      description: "Uncomplicated Firewall — gestión de reglas de firewall.",
      commands: ["ufw"],
      packages: { apt: ["ufw"], dnf: ["ufw"], yum: ["ufw"], apk: ["ufw"], pacman: ["ufw"] },
    },
    {
      key: "fail2ban",
      label: "Fail2ban",
      description: "Baneo automático de IPs por intentos de intrusión.",
      commands: ["fail2ban-client"],
      packages: { apt: ["fail2ban"], dnf: ["fail2ban"], yum: ["fail2ban"], apk: ["fail2ban"], pacman: ["fail2ban"] },
      units: ["fail2ban"],
    },
  ],
  mail: [
    {
      key: "postfix",
      label: "Postfix (SMTP)",
      description: "MTA para envío/recepción de correo.",
      commands: ["postfix"],
      packages: { apt: ["postfix"], dnf: ["postfix"], yum: ["postfix"], apk: ["postfix"], pacman: ["postfix"] },
      units: ["postfix"],
    },
    {
      key: "dovecot",
      label: "Dovecot (IMAP/LMTP)",
      description: "Servidor IMAP y entrega local LMTP.",
      commands: ["dovecot", "doveadm"],
      packages: {
        apt: ["dovecot-core", "dovecot-imapd", "dovecot-lmtpd"],
        dnf: ["dovecot"],
        yum: ["dovecot"],
        apk: ["dovecot"],
        pacman: ["dovecot"],
      },
      units: ["dovecot"],
    },
    {
      key: "opendkim",
      label: "OpenDKIM",
      description: "Firma DKIM para el correo saliente.",
      commands: ["opendkim"],
      packages: {
        apt: ["opendkim", "opendkim-tools"],
        dnf: ["opendkim"],
        yum: ["opendkim"],
        pacman: ["opendkim"],
      },
      units: ["opendkim"],
      optional: true,
    },
  ],
  nginx: [
    {
      key: "nginx",
      label: "Nginx",
      description: "Servidor web / reverse proxy.",
      commands: ["nginx"],
      packages: { apt: ["nginx"], dnf: ["nginx"], yum: ["nginx"], apk: ["nginx"], pacman: ["nginx"] },
      units: ["nginx"],
    },
    {
      key: "certbot",
      label: "Certbot (Let's Encrypt)",
      description: "Emisión y renovación de certificados TLS.",
      commands: ["certbot"],
      packages: {
        apt: ["certbot", "python3-certbot-nginx"],
        dnf: ["certbot", "python3-certbot-nginx"],
        yum: ["certbot", "python3-certbot-nginx"],
        apk: ["certbot", "certbot-nginx"],
        pacman: ["certbot", "certbot-nginx"],
      },
      optional: true,
    },
  ],
  databases: [
    {
      key: "mariadb",
      label: "MariaDB Server",
      description: "Servidor de bases de datos MySQL/MariaDB.",
      commands: ["mysql"],
      packages: {
        apt: ["mariadb-server"],
        dnf: ["mariadb-server"],
        yum: ["mariadb-server"],
        apk: ["mariadb", "mariadb-client"],
        pacman: ["mariadb"],
      },
      units: ["mariadb"],
      optional: true,
    },
    {
      key: "postgresql",
      label: "PostgreSQL Server",
      description: "Servidor de bases de datos PostgreSQL.",
      commands: ["psql"],
      packages: {
        apt: ["postgresql"],
        dnf: ["postgresql-server"],
        yum: ["postgresql-server"],
        apk: ["postgresql"],
        pacman: ["postgresql"],
      },
      units: ["postgresql"],
      optional: true,
    },
  ],
  backup: [
    {
      key: "archive",
      label: "tar + gzip",
      description: "Empaquetado y compresión de backups.",
      commands: ["tar", "gzip"],
      packages: {
        apt: ["tar", "gzip"],
        dnf: ["tar", "gzip"],
        yum: ["tar", "gzip"],
        apk: ["tar", "gzip"],
        pacman: ["tar", "gzip"],
      },
    },
    {
      key: "mysql-client",
      label: "mysqldump (cliente MariaDB)",
      description: "Dump lógico de bases MySQL/MariaDB.",
      commands: ["mysqldump"],
      packages: {
        apt: ["mariadb-client"],
        dnf: ["mariadb"],
        yum: ["mariadb"],
        apk: ["mariadb-client"],
        pacman: ["mariadb-clients"],
      },
      optional: true,
    },
    {
      key: "postgres-client",
      label: "pg_dump (cliente PostgreSQL)",
      description: "Dump lógico de bases PostgreSQL.",
      commands: ["pg_dump"],
      packages: {
        apt: ["postgresql-client"],
        dnf: ["postgresql"],
        yum: ["postgresql"],
        apk: ["postgresql-client"],
        pacman: ["postgresql"],
      },
      optional: true,
    },
  ],
  cron: [
    {
      key: "cron",
      label: "Cron (crontab)",
      description: "Demonio de tareas programadas.",
      commands: ["crontab"],
      packages: {
        apt: ["cron"],
        dnf: ["cronie"],
        yum: ["cronie"],
        apk: ["cronie"],
        pacman: ["cronie"],
      },
      // Debian/Ubuntu → `cron`; RHEL/Fedora/Alpine/Arch (cronie) → `crond`.
      // Same fallback strategy as cron-daemon.service.ts install().
      units: ["cron", "crond"],
      unitsAreAlternatives: true,
    },
  ],
  files: [
    {
      key: "archive",
      label: "zip + unzip + tar",
      description: "Comprimir/extraer archivos desde el gestor de archivos.",
      commands: ["zip", "unzip", "tar"],
      packages: {
        apt: ["zip", "unzip", "tar"],
        dnf: ["zip", "unzip", "tar"],
        yum: ["zip", "unzip", "tar"],
        apk: ["zip", "unzip", "tar"],
        pacman: ["zip", "unzip", "tar"],
      },
    },
    {
      key: "git",
      label: "Git",
      description: "Operaciones de repositorios desde el gestor de archivos.",
      commands: ["git"],
      packages: { apt: ["git"], dnf: ["git"], yum: ["git"], apk: ["git"], pacman: ["git"] },
      optional: true,
    },
    {
      key: "rsync",
      label: "rsync",
      description: "Sincronización/copia eficiente de directorios.",
      commands: ["rsync"],
      packages: { apt: ["rsync"], dnf: ["rsync"], yum: ["rsync"], apk: ["rsync"], pacman: ["rsync"] },
      optional: true,
    },
  ],
};

/** True when `moduleId` has dependencies declared in the registry. */
export function isKnownDepsModule(moduleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODULE_DEPENDENCIES, moduleId);
}

/** Display package names (apt names, falling back to the first defined manager). */
function displayPackages(spec: PackageSpec): string[] {
  return spec.apt ?? spec.dnf ?? spec.yum ?? spec.apk ?? spec.pacman ?? [];
}

export interface ModuleDependencyStatus {
  key: string;
  label: string;
  description?: string;
  optional: boolean;
  installed: boolean;
  commands: string[];
  /** Package names for display (apt naming). */
  packages: string[];
  units?: string[];
}

export interface ModuleDependenciesCheck {
  module: string;
  dependencies: ModuleDependencyStatus[];
  /** All non-optional deps installed (with requiresOneOf: at least one dep installed). */
  allRequiredInstalled: boolean;
  /** At least one dependency (optional or not) installed. */
  anyInstalled: boolean;
}

/**
 * Check the install state of every dependency of `moduleId` on the target.
 * Returns `null` when the module is not in the registry (controller → 404).
 */
export async function checkModuleDependencies(
  executor: Executor,
  moduleId: string,
): Promise<ModuleDependenciesCheck | null> {
  const deps = MODULE_DEPENDENCIES[moduleId];
  if (!deps) return null;

  const meta = MODULE_DEPS_META[moduleId] ?? {};

  const dependencies = await Promise.all(
    deps.map(async (dep): Promise<ModuleDependencyStatus> => {
      const checks = await Promise.all(
        dep.commands.map((cmd) => packageInstaller.isCommandAvailable(executor, cmd)),
      );
      const status: ModuleDependencyStatus = {
        key: dep.key,
        label: dep.label,
        optional: dep.optional === true,
        installed: checks.every(Boolean),
        commands: dep.commands,
        packages: displayPackages(dep.packages),
      };
      if (dep.description !== undefined) status.description = dep.description;
      if (dep.units !== undefined) status.units = dep.units;
      return status;
    }),
  );

  const anyInstalled = dependencies.some((d) => d.installed);
  const allRequiredInstalled = meta.requiresOneOf
    ? anyInstalled
    : dependencies.filter((d) => !d.optional).every((d) => d.installed);

  return { module: moduleId, dependencies, allRequiredInstalled, anyInstalled };
}

export interface ModuleDependencyInstallItem {
  key: string;
  ok: boolean;
  manager: PackageManager | null;
  packages: string[];
  exitCode: number;
  code?: SudoCode;
  /** Present when the dependency declares units: true if enabling succeeded. */
  unitsEnabled?: boolean;
}

export interface ModuleDependenciesInstallResult {
  ok: boolean;
  code?: SudoCode;
  results: ModuleDependencyInstallItem[];
  /** Combined log: `=== <label> ===` blocks per dependency. */
  output: string;
}

/**
 * Install dependencies of `moduleId` on the target. `keys` undefined ⇒ all
 * required-and-missing deps (with requiresOneOf ⇒ first registry entry when
 * none is installed). Installs SEQUENTIALLY (apt lock) reusing
 * `packageInstaller.install` + `enableUnit`; a SUDO_PASSWORD_* code aborts
 * the run and is propagated. Returns `null` for unknown modules.
 */
export async function installModuleDependencies(
  executor: Executor,
  moduleId: string,
  keys: string[] | undefined,
  opts: { sudoPassword?: string } = {},
): Promise<ModuleDependenciesInstallResult | null> {
  const deps = MODULE_DEPENDENCIES[moduleId];
  if (!deps) return null;

  const meta = MODULE_DEPS_META[moduleId] ?? {};

  let targets: ModuleDependency[];
  if (keys && keys.length > 0) {
    const wanted = new Set(keys);
    targets = deps.filter((d) => wanted.has(d.key));
    if (targets.length === 0) {
      return { ok: false, results: [], output: "Ninguna clave de dependencia coincide con el módulo." };
    }
  } else {
    // Default selection: required deps that are missing.
    const check = await checkModuleDependencies(executor, moduleId);
    const installedByKey = new Map((check?.dependencies ?? []).map((d) => [d.key, d.installed]));
    if (meta.requiresOneOf) {
      // "At least one" semantics: nothing to do if any is installed;
      // otherwise install the first registry entry.
      targets = check?.anyInstalled ? [] : deps.slice(0, 1);
    } else {
      targets = deps.filter((d) => !d.optional && installedByKey.get(d.key) !== true);
    }
  }

  if (targets.length === 0) {
    return { ok: true, results: [], output: "Nada que instalar: las dependencias requeridas ya están presentes." };
  }

  const results: ModuleDependencyInstallItem[] = [];
  const outputs: string[] = [];
  let topCode: SudoCode | undefined;

  for (const dep of targets) {
    const sections: string[] = [];
    const install = await packageInstaller.install(executor, dep.packages, {
      sudoPassword: opts.sudoPassword,
    });
    if (install.output) sections.push(install.output);

    const item: ModuleDependencyInstallItem = {
      key: dep.key,
      ok: install.ok,
      manager: install.manager,
      packages: install.packages,
      exitCode: install.exitCode,
    };
    if (install.code !== undefined) item.code = install.code;

    if (install.code === SUDO_PASSWORD_REQUIRED || install.code === SUDO_PASSWORD_INVALID) {
      topCode = install.code;
      results.push(item);
      outputs.push(`=== ${dep.label} ===\n${sections.join("\n")}`.trim());
      break; // Don't fire more package-manager runs that will fail the same way.
    }

    // Enable systemd units after a successful install.
    if (install.ok && dep.units && dep.units.length > 0) {
      let unitsEnabled = !dep.unitsAreAlternatives; // alternatives start pessimistic
      for (const unit of dep.units) {
        const en = await packageInstaller.enableUnit(executor, unit, {
          sudoPassword: opts.sudoPassword,
        });
        if (en.output) sections.push(`[systemctl enable --now ${unit}]\n${en.output}`);
        if (en.code === SUDO_PASSWORD_REQUIRED || en.code === SUDO_PASSWORD_INVALID) {
          topCode = en.code;
          item.code = en.code;
          unitsEnabled = false;
          break;
        }
        if (dep.unitsAreAlternatives) {
          // Distro-dependent unit name (cron vs crond): first success wins.
          if (en.ok) {
            unitsEnabled = true;
            break;
          }
        } else if (!en.ok) {
          unitsEnabled = false;
        }
      }
      item.unitsEnabled = unitsEnabled;
    }

    results.push(item);
    outputs.push(`=== ${dep.label} ===\n${sections.join("\n")}`.trim());

    if (topCode) break; // Sudo prompt needed — surface it before continuing.
  }

  const ok = !topCode && results.every((r) => r.ok);
  const result: ModuleDependenciesInstallResult = {
    ok,
    results,
    output: outputs.join("\n\n"),
  };
  if (topCode !== undefined) result.code = topCode;
  return result;
}
