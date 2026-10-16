// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo apps sub-service — account/whoami, project discovery + info, project
 * scaffolding (create-expo-app + eas init) and the detached create-app job.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { quoteArg } from "../../../../shared/executor/index.js";
import { injectSudoIntoShellScript } from "../../../../shared/system/sudo-runtime.js";
import { ValidationError } from "../../../../shared/errors/index.js";
import type {
  CliResult,
  CreateAppInput,
  CreateAppStart,
  CreateAppStatus,
  CreateStatusInput,
  ExpoProject,
  ExpoProjectInfo,
  InitProjectInput,
  LinkProjectInput,
} from "../../models/index.js";
import { expoConfigService } from "../expo-config.service.js";
import { expoApiService } from "../expo-api.service.js";
import {
  CREATE_EXIT_RE,
  createUnit,
  devSlug,
  EAS,
  metroAlive,
  resolveUserHome,
  runEas,
  SCAN_TIMEOUT_MS,
  sh,
} from "./expo-shell.js";
import {
  detectExpoProject,
  flattenConfig,
  projectFromConfig,
  readAppConfig,
} from "./expo-config-parse.js";

/**
 * Allowlist of `create-expo-app --template` values. The template is fed to
 * `npx --yes create-expo-app@latest --template <t>`; an arbitrary value is an
 * arbitrary npm package that `npx` downloads and runs (RCE as the SSH user).
 * Only accept the official first-party template names. Empty/undefined = the
 * CLI default (no --template), which is fine.
 */
const ALLOWED_TEMPLATES = new Set([
  "blank",
  "blank-typescript",
  "tabs",
  "default",
  "navigation",
  "bare-minimum",
]);

function assertTemplate(template?: string): void {
  if (template === undefined || template === "") return;
  if (!ALLOWED_TEMPLATES.has(template)) {
    throw new ValidationError(
      `Plantilla no permitida: "${template}". Usa una de: ${[...ALLOWED_TEMPLATES].join(", ")}.`,
    );
  }
}

/** One EAS project can be present in several local checkouts. Keep the copy
 * that can actually run Expo, with a stable path fallback when both are ready.
 * Projects without an EAS id remain separate local apps.
 */
export function deduplicateExpoProjects(projects: ExpoProject[]): ExpoProject[] {
  const byProjectId = new Map<string, ExpoProject>();
  const unlinked: ExpoProject[] = [];
  const preferred = (a: ExpoProject, b: ExpoProject): ExpoProject => {
    const readiness = (p: ExpoProject) =>
      Number(p.runtime?.expoInstalled === true) * 2 + Number(p.runtime?.ngrokInstalled === true);
    const difference = readiness(a) - readiness(b);
    if (difference !== 0) return difference > 0 ? a : b;
    if (a.path.length !== b.path.length) return a.path.length < b.path.length ? a : b;
    return a.path.localeCompare(b.path) <= 0 ? a : b;
  };

  for (const project of projects) {
    const id = project.projectId?.trim().toLowerCase();
    if (!id) {
      unlinked.push(project);
      continue;
    }
    const existing = byProjectId.get(id);
    byProjectId.set(id, existing ? preferred(existing, project) : project);
  }
  return [...byProjectId.values(), ...unlinked];
}

/** An opt-out marker excludes archived trees without deleting review work. */
export function projectScanCommand(roots: string[], ignoredRoots: string[] = [], markersOnly = false): string {
  const rootsArg = roots.map(quoteArg).join(" ");
  // Escape find's pattern syntax as well as shell quoting (paths can contain []).
  const ignored = ignoredRoots.map(root => `-o -path ${quoteArg(root.replace(/([\\*?\[\]])/g, "\\$1"))} `).join("");
  const candidates = markersOnly
    ? "-name .luxipanel-expo-ignore"
    : "'(' -name app.json -o -name app.config.js -o -name app.config.ts -o -name eas.json ')'";
  return `find ${rootsArg} -maxdepth 5 ` +
    `-type d '(' -name node_modules -o -name .git -o -name .obsidian -o -name .expo -o -name .Trash ` +
    `${ignored}')' -prune -o ${candidates} -print ` +
    `2>/dev/null | head -n 400`;
}

export const expoAppsService = {
  /** Validate the stored token via `eas whoami` on the connected server. */
  async whoami(executor: Executor): Promise<{ loggedIn: boolean; username: string | null }> {
    const token = await expoConfigService.getTokenOrNull();
    if (!token) return { loggedIn: false, username: null };
    const result = await runEas(executor, "/tmp", `${EAS} whoami 2>&1 || true`, 30_000);
    const line = result.stdout.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
    const loggedIn =
      result.ok && line.length > 0 && !/not logged in|error/i.test(line) && !/logged out/i.test(line);
    return { loggedIn, username: loggedIn ? line : null };
  },

  /** Account + owned accounts via the GraphQL API (richer than whoami). */
  async account(): Promise<{ username: string; accounts: string[] }> {
    const token = await expoConfigService.getToken();
    return expoApiService.viewer(token);
  },

  /**
   * Scan the connected server for Expo / RN projects. Projects don't live only
   * under the SSH user's home (commonly `/var/www/<app>`), so we sweep the usual
   * code roots — the caller can still pass an explicit `root` to narrow it.
   * Heavy/irrelevant dirs are pruned; each candidate dir is confirmed to be a
   * real Expo project by `detectExpoProject` (cheap, no `npx`).
   */
  async listProjects(executor: Executor, root?: string): Promise<ExpoProject[]> {
    const roots = root
      ? [root]
      : Array.from(
          new Set(
            [
              executor.sshUsername ? `/home/${executor.sshUsername}` : "/home",
              "/home",
              "/root",
              "/var/www",
              "/srv",
              "/opt",
            ].filter((r): r is string => !!r),
          ),
        );
    // Two native find passes avoid spawning a `test` process for every directory.
    const markers = await sh(executor, projectScanCommand(roots, [], true), SCAN_TIMEOUT_MS).catch(() => null);
    const ignoredRoots = (markers?.stdout ?? "").split("\n").map(line => line.trim())
      .filter(line => line.endsWith("/.luxipanel-expo-ignore"))
      .map(line => line.slice(0, -"/.luxipanel-expo-ignore".length));
    const cmd = projectScanCommand(roots, ignoredRoots);
    const result = await sh(executor, cmd, SCAN_TIMEOUT_MS).catch(() => null);
    const files = (result?.stdout ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const dirs = Array.from(new Set(files.map((f) => f.replace(/\/[^/]+$/, ""))));
    const projects: ExpoProject[] = [];
    for (const dir of dirs.slice(0, 80)) {
      const project = await detectExpoProject(executor, dir).catch(() => null);
      if (project) projects.push(project);
    }
    // A copied checkout must not create another row for the same EAS app.
    // Linked projects first, then alphabetical — stable for the UI.
    return deduplicateExpoProjects(projects).sort(
      (a, b) => Number(!a.projectId) - Number(!b.projectId) || a.name.localeCompare(b.name) || a.path.localeCompare(b.path),
    );
  },

  async projectInfo(executor: Executor, projectPath: string): Promise<ExpoProjectInfo> {
    const cfg = await readAppConfig(executor, projectPath);
    const base = projectFromConfig(projectPath, cfg);
    const easProbe = await sh(
      executor,
      `test -f ${quoteArg(`${projectPath}/eas.json`)} && echo yes || echo no`,
      10_000,
    ).catch(() => null);
    return {
      ...base,
      config: cfg ? (flattenConfig(cfg) as Record<string, unknown>) : null,
      hasEasJson: (easProbe?.stdout.trim() ?? "no") === "yes",
    };
  },

  /** create-expo-app + eas init in a parent directory. Returns CLI output. */
  async initProject(executor: Executor, input: InitProjectInput): Promise<CliResult> {
    assertTemplate(input.template);
    const template = input.template ? ` --template ${quoteArg(input.template)}` : "";
    const createCmd =
      `npx --yes create-expo-app@latest ${quoteArg(input.name)}${template} 2>&1`;
    const created = await runEas(executor, input.root, createCmd, 300_000);
    if (!created.ok) return created;
    const projectPath = `${input.root.replace(/\/$/, "")}/${input.name}`;
    const initCmd = `${EAS} init --non-interactive 2>&1 || npx --yes eas-cli init --non-interactive 2>&1`;
    return runEas(executor, projectPath, initCmd, 180_000);
  },

  /** Link an existing project to EAS (creates or attaches a projectId). */
  async linkProject(executor: Executor, input: LinkProjectInput): Promise<CliResult> {
    const idArg = input.projectId ? ` --id ${quoteArg(input.projectId)}` : "";
    return runEas(executor, input.path, `${EAS} init${idArg} --non-interactive 2>&1`, 180_000);
  },

  /**
   * Scaffold a new Expo app (create-expo-app + best-effort `eas init`) as a
   * DETACHED transient systemd unit, mirroring `startDevClient`. Why detached:
   * a fresh React-Native `npm install` runs for minutes — past the panel's
   * proxy/Cloudflare gateway timeout — and the SSH executor reaps any plain
   * child when the exec returns. systemd supervises the unit independently; a
   * `script` PTY captures all output to a log we poll via `createAppStatus`.
   * Returns as soon as the unit is launched.
   */
  async startCreateApp(executor: Executor, input: CreateAppInput): Promise<CreateAppStart> {
    assertTemplate(input.template);
    const root = input.root.replace(/\/$/, "");
    const projectPath = `${root}/${input.name}`;
    const slug = devSlug(projectPath);
    const unit = createUnit(slug);
    const logFile = `/tmp/luxipanel-expo-create-${slug}.log`;
    const envFile = `/tmp/luxipanel-expo-create-${slug}.env`;

    // Don't clobber an in-flight creation or an existing folder.
    if (await metroAlive(executor, unit)) {
      return { projectPath, status: "running", message: "Ya hay una creación en curso para esta ruta." };
    }
    const exists = await sh(executor, `[ -e ${quoteArg(projectPath)} ] && echo yes || echo no`, 8_000).catch(() => null);
    if ((exists?.stdout ?? "").trim() === "yes") {
      return { projectPath, status: "error", message: `La ruta ${projectPath} ya existe.` };
    }

    const token = await expoConfigService.getToken();
    const { user, home } = await resolveUserHome(executor);
    // Pass EXPO_TOKEN via a 0600 EnvironmentFile (read by systemd as root at
    // unit start), NOT `--setenv=EXPO_TOKEN=<token>`: an argv token is visible
    // to any local user via `ps`, the journal and `systemctl show <unit>`.
    await executor.writeFile(envFile, `EXPO_TOKEN=${token}\n`, { encoding: "utf8", mode: 0o600 });
    const templateArg = input.template ? ` --template ${quoteArg(input.template)}` : "";
    // Single-line scaffold (managed executor rejects newlines): create the app;
    // if it succeeded, best-effort EAS link (needs a token — failure is non-fatal,
    // the app still runs locally). The trailing marker lets `createAppStatus`
    // detect completion + the create exit code.
    const createCmd =
      `npx --yes create-expo-app@latest ${quoteArg(input.name)}${templateArg} 2>&1; ` +
      `RC=$?; if [ "$RC" = "0" ]; then cd ${quoteArg(input.name)} && ` +
      `{ ${EAS} init --non-interactive 2>&1 || npx --yes eas-cli init --non-interactive 2>&1 || true; }; fi; ` +
      `echo "__LXP_CREATE_EXIT__:$RC"`;
    const innerSh = `exec script -qfc ${quoteArg(createCmd)} ${quoteArg(logFile)}`;
    const runArgs =
      `--unit=${quoteArg(unit)} --collect ` +
      `--uid=${quoteArg(user)} --gid=${quoteArg(user)} ` +
      `--setenv=HOME=${quoteArg(home)} --property=EnvironmentFile=-${quoteArg(envFile)} --setenv=CI=1 ` +
      `--working-directory=${quoteArg(root)}`;
    const body =
      `sudo systemctl stop ${quoteArg(unit)} 2>/dev/null; ` +
      `sudo systemctl reset-failed ${quoteArg(unit)} 2>/dev/null; ` +
      `sudo rm -f ${quoteArg(logFile)}; ` +
      `sudo systemd-run ${runArgs} /bin/sh -c ${quoteArg(innerSh)}`;
    const withSudo = await injectSudoIntoShellScript(executor, body);
    const launch = await executor.exec(`sh -lc ${quoteArg(withSudo)}`, { timeoutMs: 30_000 });
    if (launch.exitCode !== 0) {
      return { projectPath, status: "error", message: `No se pudo iniciar la creación. ${(launch.stderr || launch.stdout).trim()}` };
    }
    return { projectPath, status: "running", message: "Creando la app… esto puede tardar varios minutos." };
  },

  /** Poll a detached create job (keyed on the new project folder path). */
  async createAppStatus(executor: Executor, input: CreateStatusInput): Promise<CreateAppStatus> {
    const projectPath = input.path.replace(/\/$/, "");
    const slug = devSlug(projectPath);
    const unit = createUnit(slug);
    const logFile = `/tmp/luxipanel-expo-create-${slug}.log`;
    const envFile = `/tmp/luxipanel-expo-create-${slug}.env`;

    const r = await executor
      .exec(`sh -lc ${quoteArg(`tail -c 16000 ${quoteArg(logFile)} 2>/dev/null`)}`, { timeoutMs: 10_000 })
      .catch(() => null);
    // The PTY log carries CR + ANSI noise from progress bars; flatten it.
    const log = (r?.stdout ?? "")
      .replace(/\r/g, "\n")
      .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "")
      .trim();

    const exitMatch = log.match(CREATE_EXIT_RE);
    if (exitMatch) {
      const ok = exitMatch[1] === "0";
      // Job finished: clear the transient unit + the token EnvironmentFile so a
      // retry on the same path is clean and no token lingers on disk.
      const cleanup = await injectSudoIntoShellScript(
        executor,
        `sudo systemctl reset-failed ${quoteArg(unit)} 2>/dev/null; sudo rm -f ${quoteArg(envFile)}; echo done`,
      );
      await executor.exec(`sh -lc ${quoteArg(cleanup)}`, { timeoutMs: 10_000 }).catch(() => null);
      return {
        status: ok ? "done" : "error",
        done: true,
        ok,
        projectPath,
        log,
        message: ok ? "App creada y lista." : "La creación falló. Revisa el registro.",
      };
    }
    if (await metroAlive(executor, unit)) {
      return { status: "running", done: false, ok: false, projectPath, log, message: "Creando la app…" };
    }
    // No completion marker and the unit is gone → it died before finishing.
    return {
      status: "error",
      done: true,
      ok: false,
      projectPath,
      log,
      message: log
        ? "El proceso de creación terminó inesperadamente."
        : "No se encontró el trabajo de creación (puede haber expirado).",
    };
  },
};
