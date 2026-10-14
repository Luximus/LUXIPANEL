// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * BitNinja service — wraps `bitninjacli` and the `bitninja` systemd unit.
 *
 * Everything runs through the shared Executor abstraction so the same code
 * works against any connected client server (never the panel host). Privileged
 * actions go through `sudoShell` (the LP one-passphrase model: the operator's
 * login passphrase doubles as their sudo password).
 *
 * BitNinja is commercial: the install needs the CLIENT's own license key,
 * entered in the panel UI. The official installer is `get.bitninja.io
 * /install.sh`. We download it to a temp file first and run `sudo bash <file>
 * --license_key=…`: piping `curl | sudo bash` would collide on stdin with the
 * `sudo -S` password stream (the pipe-into-sudo trap).
 */

import { env } from "../../../config/env.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { sudoShell, type SudoShellResult } from "../../../shared/system/index.js";
import type {
  BitNinjaActionResult,
  BitNinjaStatus,
  ServiceAction,
} from "../models/bitninja.model.js";

const log = createModuleLogger("bitninja");

/** Mapea el resultado de `sudoShell` al contrato público de acción. */
function formatActionResult(r: SudoShellResult): BitNinjaActionResult {
  return { ok: r.ok, exitCode: r.exitCode, output: r.output, code: r.code };
}

interface RawExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function safeExec(executor: Executor, cmd: string): Promise<RawExecResult> {
  try {
    const out = await executor.exec(cmd);
    return { stdout: out.stdout ?? "", stderr: out.stderr ?? "", exitCode: out.exitCode ?? 0 };
  } catch (err) {
    const error = errMessage(err);
    return { stdout: "", stderr: error, exitCode: 1 };
  }
}

async function runShell(executor: Executor, scriptBody: string): Promise<RawExecResult> {
  return safeExec(executor, quoteCmd("sh", ["-lc", scriptBody]));
}

/**
 * Parse the module list out of `bitninjacli --status-all` — documented as
 * "lists all modules (even if disabled) and their details in JSON format if
 * BitNinja is running". Defensive: accepts a JSON array OR an object keyed by
 * module name, and falls back to a line parser for older text output. Never
 * throws.
 */
function parseModules(raw: string): BitNinjaStatus["components"] {
  const jsonStart = raw.search(/[[{]/);
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const rows: Array<Record<string, unknown>> = Array.isArray(parsed)
        ? parsed
        : Object.entries(parsed as Record<string, unknown>).map(([name, v]) =>
            v && typeof v === "object" ? { name, ...(v as Record<string, unknown>) } : { name, state: v },
          );
      const out: BitNinjaStatus["components"] = [];
      const seen = new Set<string>();
      for (const r of rows) {
        const name = String(r.name ?? r.module ?? r.moduleName ?? "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const flag = r.status ?? r.state ?? r.active ?? r.enabled ?? r.running;
        const active = flag === true || /^(1|true|on|running|active|enabled)$/i.test(String(flag ?? "").trim());
        out.push({ name, active });
      }
      if (out.length) return out;
    } catch {
      /* not JSON — fall through to the text parser */
    }
  }
  // Text fallback: "WAFManager: running" / "MalwareDetection  active" / "DosDetection off".
  const out: BitNinjaStatus["components"] = [];
  const seen = new Set<string>();
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9 _-]{2,40}?)\s*[:\t]\s*(running|active|on|enabled|stopped|inactive|off|disabled)\b/i);
    if (!m) continue;
    const name = m[1]!.trim();
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, active: /^(running|active|on|enabled)$/i.test(m[2]!) });
  }
  return out;
}

/** Reject anything that could break out of the single-quoted shell argument. */
function isSafeToken(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

export const bitninjaService = {
  async getRecentLogs(executor: Executor, lines: number): Promise<string> {
    const result = await runShell(executor, `journalctl -u bitninja -n ${Math.min(200, Math.max(20, lines))} --no-pager -o short-iso 2>&1`);
    return (result.stdout || result.stderr)
      .slice(-48_000)
      .replace(/(--(?:license_key|reinstall-license-key)[= ]+)[A-Za-z0-9_-]+/gi, "$1[REDACTED]");
  },
  async getStatus(executor: Executor): Promise<BitNinjaStatus> {
    const installed = (await runShell(executor, "command -v bitninjacli >/dev/null 2>&1 && echo yes || echo no"))
      .stdout.trim().toLowerCase().startsWith("yes");

    if (!installed) {
      return { installed: false, running: false, licenseValid: false, version: null, components: [], raw: "" };
    }

    const [statusOut, versionOut, unitActive, licenseOut] = await Promise.all([
      runShell(executor, "bitninjacli --status-all 2>&1 || true"),
      runShell(executor, "bitninjacli --version 2>/dev/null | head -n1 || true"),
      runShell(executor, "systemctl is-active bitninja 2>/dev/null || true"),
      runShell(executor, "bitninjacli --licenseinfo 2>&1 || true"),
    ]);

    const raw = (statusOut.stdout || statusOut.stderr || "").trim();
    const components = parseModules(raw);
    // `--status-all` only emits when the agent is running; either an active
    // unit OR a parseable module list means it's up.
    const running = unitActive.stdout.trim() === "active" || components.length > 0;
    // `--licenseinfo` prints license details; flag invalid only on an explicit problem.
    const licenseText = `${licenseOut.stdout}\n${licenseOut.stderr}`;
    const licenseValid = !/\b(no\s+license|invalid|expired|unlicensed|not\s+licensed)\b/i.test(licenseText);

    return {
      installed: true,
      running,
      licenseValid,
      version: versionOut.stdout.trim() || null,
      components,
      raw,
    };
  },

  /**
   * Install BitNinja on the target with the client's license key.
   * Downloads the official installer to a temp file then runs it with sudo so
   * the password pipe (sudo -S) and the script source don't fight over stdin.
   */
  async install(
    executor: Executor,
    opts: { licenseKey?: string; sudoPassword?: string } = {},
  ): Promise<BitNinjaActionResult> {
    const licenseKey = (opts.licenseKey ?? "").trim();
    if (!licenseKey) {
      return { ok: false, exitCode: 1, output: "BitNinja requiere una clave de licencia (license key) para instalarse." };
    }
    if (!isSafeToken(licenseKey)) {
      return {
        ok: false,
        exitCode: 1,
        output: "Clave de licencia de BitNinja inválida (solo se permiten letras, números, '-' y '_').",
      };
    }

    // Optional integrity pin for the remote installer. Running install.sh as
    // root straight off a CDN means a CDN/MITM compromise is instant root on
    // every managed server. When BITNINJA_INSTALLER_SHA256 is set we verify the
    // downloaded script against it and ABORT the run before bash if it differs
    // (fail-closed). When unset we keep prior behavior but warn — operators
    // should pin the hash (or move to BitNinja's signed apt repo).
    const expectedSha = (env.BITNINJA_INSTALLER_SHA256 ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expectedSha) && expectedSha) {
      return { ok: false, exitCode: 1, output: "BITNINJA_INSTALLER_SHA256 no es un SHA-256 válido (64 hex)." };
    }
    if (!expectedSha) {
      log.warn(
        { target: executor.target.id },
        "BitNinja installer run without checksum pinning — set BITNINJA_INSTALLER_SHA256 to enforce integrity",
      );
    }
    const verifyChain = expectedSha
      ? `printf '%s  %s\\n' '${expectedSha}' "$tmp" | sha256sum -c - >/dev/null 2>&1 && `
      : "";

    const result = await sudoShell(
      executor,
      (sudo) =>
        `tmp=$(mktemp) && curl -fsSL https://get.bitninja.io/install.sh -o "$tmp" && ` +
        `${verifyChain}${sudo} bash "$tmp" --license_key='${licenseKey}'; rc=$?; rm -f "$tmp"; exit $rc`,
      { sudoPassword: opts.sudoPassword, timeoutMs: 600_000 },
    );
    if (result.ok) log.info({ target: executor.target.id }, "BitNinja installed");
    return formatActionResult(result);
  },

  /**
   * Re-activate an already-installed agent with a new license key.
   * Official flag (BitNinja ≥ 3.11.6): `bitninjacli --reinstall-license-key=<key>`
   * (older versions required a full reinstall via install.sh).
   */
  async setLicense(
    executor: Executor,
    opts: { licenseKey?: string; sudoPassword?: string } = {},
  ): Promise<BitNinjaActionResult> {
    const licenseKey = (opts.licenseKey ?? "").trim();
    if (!licenseKey || !isSafeToken(licenseKey)) {
      return { ok: false, exitCode: 1, output: "Clave de licencia inválida." };
    }
    const result = await sudoShell(
      executor,
      (sudo) => `${sudo} bitninjacli --reinstall-license-key='${licenseKey}'`,
      { sudoPassword: opts.sudoPassword, timeoutMs: 120_000 },
    );
    log.info({ target: executor.target.id, exitCode: result.exitCode, code: result.code }, "BitNinja license set");
    return formatActionResult(result);
  },

  async setService(
    executor: Executor,
    action: ServiceAction,
    opts: { sudoPassword?: string } = {},
  ): Promise<BitNinjaActionResult> {
    const result = await sudoShell(
      executor,
      (sudo) => `${sudo} systemctl ${action} bitninja`,
      { sudoPassword: opts.sudoPassword, timeoutMs: 60_000 },
    );
    log.info({ target: executor.target.id, action, exitCode: result.exitCode, code: result.code }, "BitNinja service action");
    return formatActionResult(result);
  },

  /**
   * Enable/disable a BitNinja component. Official syntax:
   * `bitninjacli --module=<Name> --enable|--disable` (persists the on/off
   * config; `--start|--stop` only control the running process for the session).
   */
  async setComponent(
    executor: Executor,
    component: string,
    enabled: boolean,
    opts: { sudoPassword?: string } = {},
  ): Promise<BitNinjaActionResult> {
    if (!isSafeToken(component)) {
      return { ok: false, exitCode: 1, output: "Nombre de componente inválido." };
    }
    const verb = enabled ? "--enable" : "--disable";
    const result = await sudoShell(
      executor,
      (sudo) => `${sudo} bitninjacli --module='${component}' ${verb}`,
      { sudoPassword: opts.sudoPassword, timeoutMs: 60_000 },
    );
    log.info(
      { target: executor.target.id, component, enabled, exitCode: result.exitCode, code: result.code },
      "BitNinja component toggled",
    );
    return formatActionResult(result);
  },
};
