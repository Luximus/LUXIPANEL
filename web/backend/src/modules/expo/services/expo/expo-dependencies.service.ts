// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Install a project's missing local Expo/Metro packages on the connected server. */

import type { Executor } from "../../../../shared/executor/index.js";
import { quoteArg } from "../../../../shared/executor/index.js";
import { injectSudoIntoShellScript } from "../../../../shared/system/sudo-runtime.js";
import type { ExpoInstallStatus } from "../../models/index.js";
import { readExpoRuntime, requireExpoProject } from "./expo-config-parse.js";
import { devSlug, metroAlive, resolveUserHome } from "./expo-shell.js";

const unitFor = (path: string) => `luxipanel-expo-install-${devSlug(path)}`;
const logFor = (path: string) => `/tmp/luxipanel-expo-install-${devSlug(path)}.log`;
const EXIT_RE = /__LXP_INSTALL_EXIT__:(\d+)/;

export const expoDependenciesService = {
  async install(executor: Executor, path: string): Promise<ExpoInstallStatus> {
    const project = await requireExpoProject(executor, path);
    const unit = unitFor(path);
    if (await metroAlive(executor, unit)) {
      return { status: "running", done: false, ok: false, log: "", message: "La instalación ya está en curso." };
    }
    const runtime = project.runtime!;
    if (runtime.expoInstalled && runtime.ngrokInstalled) {
      return { status: "done", done: true, ok: true, log: "", message: "Las dependencias ya están instaladas." };
    }

    const { user, home } = await resolveUserHome(executor);
    // The package manager is selected only from lockfiles in the validated
    // project. No user-supplied command is interpolated into the shell body.
    const selectManager =
      `if [ -f pnpm-lock.yaml ]; then PM=pnpm; ` +
      `elif [ -f yarn.lock ]; then PM=yarn; ` +
      `elif [ -f bun.lockb ] || [ -f bun.lock ]; then PM=bun; ` +
      `else PM=npm; fi; ` +
      `command -v "$PM" >/dev/null 2>&1 || { echo "No está instalado el gestor de paquetes $PM"; exit 127; }; `;
    const installManifest =
      `case "$PM" in ` +
      `pnpm) pnpm install --no-frozen-lockfile ;; ` +
      `yarn) yarn install ;; ` +
      `bun) bun install ;; ` +
      `*) npm install --no-audit --no-fund ;; esac`;
    const addNgrok =
      `case "$PM" in ` +
      `pnpm) pnpm add -D @expo/ngrok ;; ` +
      `yarn) yarn add -D @expo/ngrok ;; ` +
      `bun) bun add -d @expo/ngrok ;; ` +
      `*) npm install --save-dev --no-audit --no-fund @expo/ngrok ;; esac`;
    const addExpo =
      `case "$PM" in ` +
      `pnpm) pnpm add expo ;; ` +
      `yarn) yarn add expo ;; ` +
      `bun) bun add expo ;; ` +
      `*) npm install --save --no-audit --no-fund expo ;; esac`;
    const steps = [selectManager];
    if (!runtime.expoInstalled) {
      steps.push(`${installManifest} || exit $?; `);
      // An expo-router-only manifest may omit expo itself. Add the package
      // only if normal manifest installation still cannot resolve it.
      steps.push(`node -e ${quoteArg("require.resolve('expo/package.json',{paths:[process.cwd()]})")} 2>/dev/null || { ${addExpo} || exit $?; }; `);
    }
    if (!runtime.ngrokInstalled) steps.push(`${addNgrok} || exit $?; `);
    const job = `( ${steps.join("")} ); RC=$?; echo "__LXP_INSTALL_EXIT__:$RC"`;
    const inner = `exec script -qfc ${quoteArg(job)} ${quoteArg(logFor(path))}`;
    const body =
      `sudo systemctl stop ${quoteArg(unit)} 2>/dev/null; ` +
      `sudo systemctl reset-failed ${quoteArg(unit)} 2>/dev/null; ` +
      `sudo rm -f ${quoteArg(logFor(path))}; ` +
      `sudo systemd-run --unit=${quoteArg(unit)} --collect --uid=${quoteArg(user)} --gid=${quoteArg(user)} ` +
      `--setenv=HOME=${quoteArg(home)} --property=RuntimeMaxSec=1800 ` +
      `--working-directory=${quoteArg(path)} /bin/sh -c ${quoteArg(inner)}`;
    const withSudo = await injectSudoIntoShellScript(executor, body);
    const launch = await executor.exec(`sh -lc ${quoteArg(withSudo)}`, { timeoutMs: 30_000 });
    if (launch.exitCode !== 0) {
      return { status: "error", done: true, ok: false, log: (launch.stderr || launch.stdout).trim(), message: "No se pudo iniciar la instalación." };
    }
    return { status: "running", done: false, ok: false, log: "", message: "Instalando dependencias…" };
  },

  async status(executor: Executor, path: string): Promise<ExpoInstallStatus> {
    await requireExpoProject(executor, path);
    const result = await executor.exec(`sh -lc ${quoteArg(`tail -c 6000 ${quoteArg(logFor(path))} 2>/dev/null`)}`, { timeoutMs: 10_000 }).catch(() => null);
    const log = (result?.stdout ?? "").replace(/\r/g, "\n").replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").trim();
    const exit = log.match(EXIT_RE);
    if (exit) {
      const runtime = await readExpoRuntime(executor, path);
      const ok = exit[1] === "0" && runtime.expoInstalled && runtime.ngrokInstalled;
      return { status: ok ? "done" : "error", done: true, ok, log, message: ok ? "Dependencias instaladas." : "La instalación falló. Revisa el registro." };
    }
    if (await metroAlive(executor, unitFor(path))) {
      return { status: "running", done: false, ok: false, log, message: "Instalando dependencias…" };
    }
    return { status: "error", done: true, ok: false, log, message: "El proceso de instalación terminó inesperadamente." };
  },
};
