// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { ScanFinding } from "../models/audit-report.model.js";
import { packageInstaller, sudoShell, type InstallResult } from "../../../shared/system/index.js";
import type { Executor } from "../../../shared/executor/index.js";

const log = createModuleLogger("security-audit:scanners");

/** Hard cap on findings emitted per scanner. Scanner output is a line-per-match
 *  stream from an untrusted target; without a cap a noisy/hostile box could push
 *  unbounded findings into the report sidecar (memory + SSH write amplification). */
const MAX_FINDINGS_PER_SCANNER = 200;
/** Timeout (ms) for a BitNinja status scan over the executor. */
const BITNINJA_SCAN_TIMEOUT_MS = 60_000;

export type Scanner = "bitninja" | "lynis" | "rkhunter" | "chkrootkit";

/** One regex→finding rule for {@link runRegexScanner}. */
interface ScannerMapping {
  /** Global regex matched against the command output. */
  regex: RegExp;
  severity: ScanFinding["severity"];
  title: string;
  /** Key used for this mapping's match count in the success log object. */
  countLabel: string;
}

/**
 * Generic runner for scanners whose output is a flat list of lines matched by
 * regex. `mappings` are applied in order — findings are pushed mapping by
 * mapping, line by line — so callers control the ordering. On any failure the
 * single `unavailable` finding is returned instead.
 */
async function runRegexScanner(
  executor: Executor,
  opts: {
    scanner: Exclude<Scanner, "bitninja">;
    command: string;
    timeoutMs: number;
    mappings: ScannerMapping[];
    successMessage: string;
    failMessage: string;
    unavailable: ScanFinding;
  },
): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  try {
    const exec = await executor.exec(opts.command, { timeoutMs: opts.timeoutMs });
    const result = exec.stdout ?? "";

    const counts: Record<string, number> = {};
    for (const mapping of opts.mappings) {
      const matches = result.match(mapping.regex) || [];
      counts[mapping.countLabel] = matches.length;
      for (const description of matches) {
        if (findings.length >= MAX_FINDINGS_PER_SCANNER) break;
        findings.push({
          severity: mapping.severity,
          scanner: opts.scanner,
          title: mapping.title,
          description,
        });
      }
      if (findings.length >= MAX_FINDINGS_PER_SCANNER) {
        log.warn(
          { scanner: opts.scanner, cap: MAX_FINDINGS_PER_SCANNER },
          "Scanner findings capped",
        );
        break;
      }
    }

    log.info(counts, opts.successMessage);
  } catch (err) {
    log.error({ err }, opts.failMessage);
    findings.push(opts.unavailable);
  }
  return findings;
}

export const scannersService = {
  async runBitNinja(executor: Executor): Promise<ScanFinding[]> {
    const findings: ScanFinding[] = [];
    try {
      const exec = await executor.exec("bitninjacli --status-all 2>&1 || true", {
        timeoutMs: BITNINJA_SCAN_TIMEOUT_MS,
      });
      const result = exec.stdout ?? "";

      // BitNinja is a protection agent, not a one-shot scanner: surface its
      // runtime state. `--status-all` only emits the modules JSON when the
      // agent is running, so JSON-shaped output (a `{`/`[`) means protection
      // is live; anything else (empty / "not running") is a finding.
      const running = /[[{]/.test(result) && !/not running|no daemon|inactive|stopped/i.test(result);
      if (running) {
        findings.push({
          severity: "info",
          scanner: "bitninja",
          title: "BitNinja activo",
          description: result.trim() || "El agente de BitNinja está protegiendo el servidor.",
        });
      } else {
        findings.push({
          severity: "high",
          scanner: "bitninja",
          title: "BitNinja no está activo",
          description: result.trim() || "El agente de BitNinja no está corriendo.",
        });
      }
      log.info("BitNinja status checked");
    } catch (err) {
      log.error({ err }, "BitNinja status check failed");
      findings.push({
        severity: "info",
        scanner: "bitninja",
        title: "BitNinja no disponible",
        description: "BitNinja no está instalado o no se pudo ejecutar",
      });
    }
    return findings;
  },

  async runLynis(executor: Executor): Promise<ScanFinding[]> {
    return runRegexScanner(executor, {
      scanner: "lynis",
      command: "lynis audit system --quiet 2>&1 || true",
      timeoutMs: 120000, // 2 min
      mappings: [
        { regex: /\[WA\].*/g, severity: "high", title: "Advertencia de seguridad", countLabel: "warnings" },
        { regex: /\[SG\].*/g, severity: "medium", title: "Sugerencia de mejora", countLabel: "suggestions" },
      ],
      successMessage: "Lynis scan completed",
      failMessage: "Lynis scan failed",
      unavailable: {
        severity: "info",
        scanner: "lynis",
        title: "Lynis no disponible",
        description: "Lynis no está instalado o no se pudo ejecutar",
      },
    });
  },

  async runRkhunter(executor: Executor): Promise<ScanFinding[]> {
    return runRegexScanner(executor, {
      scanner: "rkhunter",
      command: "rkhunter --check --skip-keypress --report-warnings-only 2>&1 || true",
      timeoutMs: 120000,
      mappings: [
        { regex: /\[ALERT\].*/g, severity: "critical", title: "Alerta de rootkit", countLabel: "alerts" },
        { regex: /\[WARNING\].*/g, severity: "high", title: "Advertencia de rkhunter", countLabel: "warnings" },
      ],
      successMessage: "Rkhunter scan completed",
      failMessage: "Rkhunter scan failed",
      unavailable: {
        severity: "info",
        scanner: "rkhunter",
        title: "Rkhunter no disponible",
        description: "Rkhunter no está instalado o no se pudo ejecutar",
      },
    });
  },

  async runChkrootkit(executor: Executor): Promise<ScanFinding[]> {
    return runRegexScanner(executor, {
      scanner: "chkrootkit",
      command: "chkrootkit 2>&1 || true",
      timeoutMs: 120000,
      mappings: [
        { regex: /INFECTED.*/g, severity: "critical", title: "Posible infección detectada", countLabel: "suspicions" },
      ],
      successMessage: "Chkrootkit scan completed",
      failMessage: "Chkrootkit scan failed",
      unavailable: {
        severity: "info",
        scanner: "chkrootkit",
        title: "Chkrootkit no disponible",
        description: "Chkrootkit no está instalado o no se pudo ejecutar",
      },
    });
  },

  async getInstalledMap(executor: Executor): Promise<Record<Scanner, boolean>> {
    const [bitninja, lynis, rkhunter, chkrootkit] = await Promise.all([
      packageInstaller.isCommandAvailable(executor, "bitninjacli"),
      packageInstaller.isCommandAvailable(executor, "lynis"),
      packageInstaller.isCommandAvailable(executor, "rkhunter"),
      packageInstaller.isCommandAvailable(executor, "chkrootkit"),
    ]);
    return { bitninja, lynis, rkhunter, chkrootkit };
  },

  /**
   * BitNinja is a commercial security suite — NOT a distro package. It ships
   * its own installer (`get.bitninja.io/install.sh`) and requires a license
   * key. We download the script to a temp file first and then run
   * `sudo bash <file> --license_key=…`: piping `curl | sudo bash` would
   * collide on stdin with the `sudo -S` password stream (the pipe-into-sudo
   * trap), so the script MUST come from a file, leaving stdin for the password.
   */
  async installBitNinja(
    executor: Executor,
    opts: { sudoPassword?: string; licenseKey?: string } = {},
  ): Promise<InstallResult> {
    const licenseKey = (opts.licenseKey ?? "").trim();
    if (!licenseKey) {
      return {
        ok: false,
        manager: null,
        packages: ["bitninja"],
        exitCode: 1,
        output: "BitNinja requiere una clave de licencia (license key) para instalarse.",
      };
    }
    // License keys are alphanumeric tokens; reject anything that could break
    // out of the single-quoted shell argument.
    if (!/^[A-Za-z0-9_-]+$/.test(licenseKey)) {
      return {
        ok: false,
        manager: null,
        packages: ["bitninja"],
        exitCode: 1,
        output: "Clave de licencia de BitNinja inválida (solo se permiten letras, números, '-' y '_').",
      };
    }

    const result = await sudoShell(
      executor,
      (sudo) =>
        `tmp=$(mktemp) && curl -fsSL https://get.bitninja.io/install.sh -o "$tmp" && ` +
        `${sudo} bash "$tmp" --license_key='${licenseKey}'; rc=$?; rm -f "$tmp"; exit $rc`,
      { sudoPassword: opts.sudoPassword, timeoutMs: 600_000 },
    );

    if (result.ok) log.info({ target: executor.target.id }, "BitNinja installed");
    return {
      ok: result.ok,
      manager: null,
      packages: ["bitninja"],
      exitCode: result.exitCode,
      output: result.output,
      code: result.code,
    };
  },

  async installScanner(
    executor: Executor,
    scanner: Scanner,
    opts: { sudoPassword?: string; licenseKey?: string } = {},
  ): Promise<InstallResult> {
    if (scanner === "bitninja") {
      return this.installBitNinja(executor, opts);
    }
    const specs: Record<Exclude<Scanner, "bitninja">, Parameters<typeof packageInstaller.install>[1]> = {
      lynis: {
        apt: ["lynis"],
        dnf: ["lynis"],
        yum: ["lynis"],
        apk: ["lynis"],
        pacman: ["lynis"],
      },
      rkhunter: {
        apt: ["rkhunter"],
        dnf: ["rkhunter"],
        yum: ["rkhunter"],
        apk: ["rkhunter"],
        pacman: ["rkhunter"],
      },
      chkrootkit: {
        apt: ["chkrootkit"],
        dnf: ["chkrootkit"],
        yum: ["chkrootkit"],
        apk: ["chkrootkit"],
        pacman: ["chkrootkit"],
      },
    };
    const result = await packageInstaller.install(executor, specs[scanner], { sudoPassword: opts.sudoPassword });
    if (result.ok) log.info({ scanner, target: executor.target.id }, "Scanner installed");
    return result;
  },

  async runAllScanners(executor: Executor): Promise<ScanFinding[]> {
    const allFindings: ScanFinding[] = [];

    log.info({ target: executor.target.id }, "Starting all security scanners");

    const [bitninja, lynis, rkhunter, chkrootkit] = await Promise.all([
      this.runBitNinja(executor),
      this.runLynis(executor),
      this.runRkhunter(executor),
      this.runChkrootkit(executor),
    ]);

    allFindings.push(...bitninja, ...lynis, ...rkhunter, ...chkrootkit);
    log.info({ total: allFindings.length }, "All scanners completed");

    return allFindings;
  },
};
