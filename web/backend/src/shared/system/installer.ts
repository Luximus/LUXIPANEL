// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared package installer — detects the target server's package manager
 * (apt, dnf/yum, apk, pacman) and runs an unattended install.
 *
 * Modules that depend on a server-side binary (ufw, fail2ban,
 * certbot, lynis, …) should call `packageInstaller.install(executor, …)`
 * from a dedicated route guarded by admin + CSRF, and `isCommandAvailable`
 * to detect "not installed" state.
 *
 * Sudo strategy:
 *   - Try `sudo -n` first (NOPASSWD rule from /etc/sudoers.d/luxipanel-modules).
 *   - When that fails with "a password is required" and the caller did NOT
 *     supply `sudoPassword`, return `{ code: "SUDO_PASSWORD_REQUIRED" }` so
 *     the frontend can prompt the user.
 *   - When `sudoPassword` is provided, pipe it via `sudo -S` (base64-encoded
 *     to avoid shell quoting issues). The password never leaves the request
 *     scope and is never logged.
 */

import { quoteCmd, type Executor } from "../executor/index.js";
import { createModuleLogger } from "../logger/index.js";
import {
  clearSudoPassword,
  getStoredSudoPassword,
  storeSudoPassword,
} from "./sudo-credentials.js";
import { invalidateSudoPasswordCache, redactSudoSecrets } from "./sudo-runtime.js";
import { errMessage } from "../utils/err-message.js";

const log = createModuleLogger("package-installer");

export type PackageManager = "apt" | "dnf" | "yum" | "apk" | "pacman";

export const SUDO_PASSWORD_REQUIRED = "SUDO_PASSWORD_REQUIRED" as const;
export const SUDO_PASSWORD_INVALID = "SUDO_PASSWORD_INVALID" as const;

export interface InstallResult {
  ok: boolean;
  manager: PackageManager | null;
  packages: string[];
  exitCode: number;
  output: string;
  /** Set when sudo refused: caller should prompt for password or rebind sudoers. */
  code?: typeof SUDO_PASSWORD_REQUIRED | typeof SUDO_PASSWORD_INVALID;
}

/** Mapping from a logical install spec to the per-distro package names. */
export interface PackageSpec {
  apt?: string[];
  dnf?: string[];
  yum?: string[];
  apk?: string[];
  pacman?: string[];
}

export interface SudoOptions {
  /** Optional plaintext sudo password (only used for THIS call, never logged). */
  sudoPassword?: string;
}

interface RawExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Per-manager command construction lives in data, not in a switch: adding a
 * package manager is a new table entry (probe + install), never an edit to
 * detection/install control flow.
 *
 *   - `probeTool`: the binary `command -v` looks for during detection; the
 *     ordered list of `probeTool`s also defines the detection precedence.
 *   - `install({ sudo, packages, refresh })`: the full shell line to install
 *     `packages`, optionally refreshing the index first.
 */
interface PackageManagerDriver {
  probeTool: string;
  install: (ctx: { sudo: string; packages: string[]; refresh: boolean }) => string;
}

/**
 * Ordered driver table. Detection order = table order (apt → dnf → yum → apk →
 * pacman). Keyed by `PackageManager`, so the union stays the single source of
 * truth for which managers exist.
 */
const PACKAGE_MANAGER_DRIVERS: Record<PackageManager, PackageManagerDriver> = {
  apt: {
    probeTool: "apt-get",
    install: ({ sudo, packages, refresh }) => {
      const refreshCmd = refresh ? `${sudo} DEBIAN_FRONTEND=noninteractive apt-get update -y && ` : "";
      return `${refreshCmd}${sudo} DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ${packages.join(" ")}`;
    },
  },
  dnf: {
    probeTool: "dnf",
    install: ({ sudo, packages }) => `${sudo} dnf install -y ${packages.join(" ")}`,
  },
  yum: {
    probeTool: "yum",
    install: ({ sudo, packages }) => `${sudo} yum install -y ${packages.join(" ")}`,
  },
  apk: {
    probeTool: "apk",
    install: ({ sudo, packages, refresh }) =>
      `${refresh ? `${sudo} apk update && ` : ""}${sudo} apk add --no-cache ${packages.join(" ")}`,
  },
  pacman: {
    probeTool: "pacman",
    install: ({ sudo, packages, refresh }) =>
      `${refresh ? `${sudo} pacman -Sy --noconfirm && ` : ""}${sudo} pacman -S --noconfirm --needed ${packages.join(" ")}`,
  },
};

/** Detection precedence + probe loop both derive from the table order. */
const PACKAGE_MANAGER_ORDER = Object.keys(PACKAGE_MANAGER_DRIVERS) as PackageManager[];

/** True when sudo output indicates "password required" (NOPASSWD missing). */
/** stdout + stderr of an exec, trimmed — the shape every caller here logs. */
function combinedOutput(out: RawExecResult): string {
  return `${out.stdout}${out.stderr ? `\n${out.stderr}` : ""}`.trim();
}

function isSudoPasswordRequired(output: string): boolean {
  return /a password is required|sudo: no tty present|sudo: a terminal is required/i.test(output);
}

/** True when sudo output indicates a wrong password. */
function isSudoPasswordInvalid(output: string): boolean {
  return /incorrect password attempt|sudo: \d+ incorrect password/i.test(output);
}

async function safeExec(executor: Executor, cmd: string, timeoutMs?: number): Promise<RawExecResult> {
  // Redact the base64 sudo-password segment from EVERY output string before it
  // leaves this function. With localExecutor (execFile) a thrown error carries
  // the full command line — including `printf '<base64>' | base64 -d | sudo -S`
  // — which sudoShell would otherwise fold into `output` and return to the API
  // client / logs. The plaintext `.replace(password, "***")` in sudoShell can't
  // catch it because the secret rides as base64. This is the single exec choke
  // point, so redacting here covers stdout, stderr and thrown messages alike.
  try {
    const out = await executor.exec(cmd, timeoutMs ? { timeoutMs } : undefined);
    return {
      stdout: redactSudoSecrets(out.stdout ?? ""),
      stderr: redactSudoSecrets(out.stderr ?? ""),
      exitCode: out.exitCode ?? 0,
    };
  } catch (err) {
    const error = errMessage(err);
    return { stdout: "", stderr: redactSudoSecrets(error), exitCode: 1 };
  }
}

async function runShell(executor: Executor, scriptBody: string, timeoutMs?: number): Promise<RawExecResult> {
  return safeExec(executor, quoteCmd("sh", ["-lc", scriptBody]), timeoutMs);
}

/**
 * Build the prefix used to invoke privileged commands.
 *
 * Without password:  `sudo -n`               (relies on NOPASSWD rule)
 * With password:     `printf '%s' "$BASE64" | base64 -d | sudo -S -p ''`
 *                    (password is base64-encoded so shell metachars in it
 *                    don't break the command line; -S reads from stdin;
 *                    -p '' suppresses the prompt that would interfere
 *                    with the base64 stream).
 */
export function buildSudoPrefix(sudoPassword?: string): string {
  if (!sudoPassword) return "sudo -n";
  const b64 = Buffer.from(sudoPassword, "utf-8").toString("base64");
  // Single-quoted strings in /bin/sh don't expand anything except `'`
  // itself, and base64 output never contains a single quote.
  return `printf '%s' '${b64}' | base64 -d | sudo -S -p ''`;
}

export interface SudoShellResult {
  ok: boolean;
  exitCode: number;
  output: string;
  code?: typeof SUDO_PASSWORD_REQUIRED | typeof SUDO_PASSWORD_INVALID;
}

/**
 * Run a shell command that needs sudo. The caller passes a `buildCommand`
 * function that takes the sudo prefix and returns the full shell line.
 *
 * Resolution order:
 *   1. `sudo -n` (NOPASSWD).
 *   2. Password from request body (`opts.sudoPassword`). On success, store.
 *   3. Stored credential from `${LUXIPANEL_CONFIG_DIR}/sudo-credentials.json`.
 *      On invalid, clear the entry and return `SUDO_PASSWORD_REQUIRED`.
 *   4. Otherwise: `SUDO_PASSWORD_REQUIRED` so the UI can prompt.
 */
export async function sudoShell(
  executor: Executor,
  buildCommand: (sudoPrefix: string) => string,
  opts: { sudoPassword?: string; timeoutMs?: number } = {},
): Promise<SudoShellResult> {
  // Run the command with the given password piped to `sudo -S`, returning the
  // raw result plus the masked, trimmed output text (the secret never leaks).
  const tryWithPassword = async (password: string): Promise<{ out: RawExecResult; text: string }> => {
    const out = await runShell(executor, buildCommand(buildSudoPrefix(password)), opts.timeoutMs);
    const text = combinedOutput(out).replace(password, "***");
    return { out, text };
  };

  // ---- 1. NOPASSWD ----
  let out = await runShell(executor, buildCommand("sudo -n"), opts.timeoutMs);
  let text = combinedOutput(out);
  // Defensive: if the caller's command body uses `|| true` to silence
  // failures, sudo can refuse but the shell still exits 0. Detect the
  // password-required string in the output regardless of exit code.
  const passwordRequiredHere = isSudoPasswordRequired(text);
  if (out.exitCode === 0 && !passwordRequiredHere) {
    return { ok: true, exitCode: 0, output: text };
  }
  if (!passwordRequiredHere) {
    return { ok: false, exitCode: out.exitCode, output: text };
  }

  // ---- 2. Password from this request ----
  if (opts.sudoPassword) {
    ({ out, text } = await tryWithPassword(opts.sudoPassword));
    if (out.exitCode === 0) {
      // Persist for future actions on this target.
      try {
        await storeSudoPassword(executor, opts.sudoPassword);
        invalidateSudoPasswordCache(executor.target.id);
      } catch (err) {
        log.warn({ err }, "Failed to persist sudo credential");
      }
      return { ok: true, exitCode: 0, output: text };
    }
    if (isSudoPasswordInvalid(text)) {
      return {
        ok: false,
        exitCode: out.exitCode,
        output: "Contraseña sudo inválida.",
        code: SUDO_PASSWORD_INVALID,
      };
    }
    return { ok: false, exitCode: out.exitCode, output: text };
  }

  // ---- 3. Stored credential ----
  const stored = await getStoredSudoPassword(executor);
  if (stored) {
    ({ out, text } = await tryWithPassword(stored));
    if (out.exitCode === 0) {
      // Touch lastUsedAt by re-storing.
      try {
        await storeSudoPassword(executor, stored);
      } catch {
        /* non-fatal */
      }
      return { ok: true, exitCode: 0, output: text };
    }
    if (isSudoPasswordInvalid(text)) {
      // Stored password no longer works — drop it and re-prompt the UI.
      await clearSudoPassword(executor).catch(() => undefined);
      invalidateSudoPasswordCache(executor.target.id);
      return {
        ok: false,
        exitCode: out.exitCode,
        output: "La contraseña sudo guardada ya no es válida. Vuelve a introducirla.",
        code: SUDO_PASSWORD_REQUIRED,
      };
    }
    return { ok: false, exitCode: out.exitCode, output: text };
  }

  // ---- 3b. Live SSH passphrase (LP one-passphrase model) ----
  // The secret the operator typed at login also serves as their sudo
  // password. Read it live from this session's executor (never persisted
  // here, never cached under the shared server id) so privileged actions
  // "just work" without a separate prompt or a pre-seeded sidecar.
  const hint = await executor.getSudoPasswordHint?.();
  if (hint) {
    ({ out, text } = await tryWithPassword(hint));
    if (out.exitCode === 0 && !isSudoPasswordRequired(text)) {
      return { ok: true, exitCode: 0, output: text };
    }
    if (isSudoPasswordInvalid(text)) {
      // Login passphrase isn't this account's sudo password — ask the UI.
      return {
        ok: false,
        exitCode: out.exitCode,
        output: "La contraseña de tu sesión no es válida para sudo. Introdúcela manualmente.",
        code: SUDO_PASSWORD_REQUIRED,
      };
    }
  }

  // ---- 4. No password available — ask the UI ----
  return {
    ok: false,
    exitCode: out.exitCode,
    output: text,
    code: SUDO_PASSWORD_REQUIRED,
  };
}

export const packageInstaller = {
  /** Detect which package manager is available on the target. */
  async detectManager(executor: Executor): Promise<PackageManager | null> {
    // Probe loop + result mapping both derive from the ordered driver table,
    // so detection precedence stays in data (apt-get dnf yum apk pacman).
    const probeTools = PACKAGE_MANAGER_ORDER.map((m) => PACKAGE_MANAGER_DRIVERS[m].probeTool);
    const probe = await runShell(
      executor,
      `for c in ${probeTools.join(" ")}; do if command -v $c >/dev/null 2>&1; then echo $c; break; fi; done`,
    );
    const tool = probe.stdout.trim();
    return PACKAGE_MANAGER_ORDER.find((m) => PACKAGE_MANAGER_DRIVERS[m].probeTool === tool) ?? null;
  },

  /**
   * True when `<command>` exists on the target. We prepend the standard
   * sbin/bin dirs to PATH for the lookup: many admin tools (ufw, iptables,
   * fail2ban-server, …) live in /usr/sbin, which Debian/Ubuntu leave OUT of a
   * NON-root user's PATH. A bare `command -v ufw` would then report "missing"
   * even right after installing it (privileged ops still work because sudo's
   * secure_path includes sbin) — which left the install banner stuck on.
   */
  async isCommandAvailable(executor: Executor, command: string): Promise<boolean> {
    const safe = command.replace(/[^a-zA-Z0-9_./:+-]/g, "");
    if (!safe) return false;
    const out = await runShell(
      executor,
      `PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH" command -v ${safe} >/dev/null 2>&1 && echo yes || echo no`,
    );
    return out.stdout.trim().toLowerCase().startsWith("yes");
  },

  /**
   * Install a list of packages on the target using the detected manager.
   * Picks the right names from `spec` for the active package manager. If
   * `spec` is a `string[]`, the same names are used everywhere (best-effort).
   *
   * Always runs unattended (`-y` / `--noconfirm`). Requires a passwordless
   * sudo rule for the package manager when the panel does not run as root,
   * OR an explicit `sudoPassword` from the caller.
   */
  async install(
    executor: Executor,
    spec: PackageSpec | string[],
    opts: { timeoutMs?: number; refresh?: boolean } & SudoOptions = {},
  ): Promise<InstallResult> {
    const timeoutMs = opts.timeoutMs ?? 600_000; // 10 min default
    const refresh = opts.refresh !== false;

    const manager = await this.detectManager(executor);
    if (!manager) {
      return {
        ok: false,
        manager: null,
        packages: Array.isArray(spec) ? spec : [],
        exitCode: 1,
        output: "No se pudo detectar el gestor de paquetes (apt/dnf/yum/apk/pacman) en el servidor objetivo.",
      };
    }

    const packages = Array.isArray(spec) ? spec : (spec[manager] ?? spec.apt ?? []);
    if (packages.length === 0) {
      return {
        ok: false,
        manager,
        packages: [],
        exitCode: 1,
        output: `No hay paquetes definidos para el gestor "${manager}".`,
      };
    }

    // Defense-in-depth: only allow conservative package name characters.
    for (const name of packages) {
      if (!/^[a-zA-Z0-9._+-]+$/.test(name)) {
        return {
          ok: false,
          manager,
          packages,
          exitCode: 1,
          output: `Nombre de paquete inválido: ${name}`,
        };
      }
    }

    log.info(
      { manager, packages, target: executor.target.id, withPassword: Boolean(opts.sudoPassword) },
      "Installing packages",
    );

    const result = await sudoShell(
      executor,
      (sudo) => PACKAGE_MANAGER_DRIVERS[manager].install({ sudo, packages, refresh }),
      { sudoPassword: opts.sudoPassword, timeoutMs },
    );

    if (!result.ok) {
      log.warn(
        { manager, packages, exitCode: result.exitCode, target: executor.target.id, code: result.code },
        "Package install failed",
      );
    }

    return {
      ok: result.ok,
      manager,
      packages,
      exitCode: result.exitCode,
      output: result.output,
      code: result.code,
    };
  },

  /**
   * Convenience: enable + start a systemd unit (idempotent).
   * Returns `{ ok, code? }` so callers can branch on SUDO_PASSWORD_REQUIRED.
   */
  async enableUnit(
    executor: Executor,
    unit: string,
    opts: SudoOptions = {},
  ): Promise<{ ok: boolean; code?: typeof SUDO_PASSWORD_REQUIRED | typeof SUDO_PASSWORD_INVALID; output?: string }> {
    const safe = unit.replace(/[^a-zA-Z0-9_.@-]/g, "");
    if (!safe) return { ok: false };
    const result = await sudoShell(
      executor,
      (sudo) => `${sudo} systemctl enable --now ${safe}`,
      { sudoPassword: opts.sudoPassword },
    );
    return { ok: result.ok, code: result.code, output: result.output };
  },
};
