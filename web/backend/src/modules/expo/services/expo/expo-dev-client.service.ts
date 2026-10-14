// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo dev-client sub-service — start/stop a Metro dev server with a public
 * ngrok tunnel on the connected server for live testing (transient systemd
 * unit + PTY log we poll for the `exp://…` URL). Handles the retry-on-transient
 * tunnel failure logic.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { quoteArg } from "../../../../shared/executor/index.js";
import { injectSudoIntoShellScript } from "../../../../shared/system/sudo-runtime.js";
import type { DevClientInput, DevClientMessageCode, DevClientSession } from "../../models/index.js";
import { expoConfigService } from "../expo-config.service.js";
import { requireExpoProject } from "./expo-config-parse.js";
import {
  classifyDevClientFailure,
  DEV_CLIENT_RETRY_BACKOFF_MS,
  DEV_CLIENT_SETTLE_MS,
  devSlug,
  MAX_DEV_CLIENT_LAUNCHES,
  metroAlive,
  metroUnit,
  readExpUrlFromLog,
  reapDevClientResiduals,
  resolveUserHome,
  tailLog,
} from "./expo-shell.js";

export const expoDevClientService = {
  /** Inspect an existing session without starting Metro or needing an EAS token. */
  async devClientStatus(executor: Executor, input: DevClientInput): Promise<{ status: "running" | "starting" | "stopped"; url: string | null }> {
    const slug = devSlug(input.path);
    if (!await metroAlive(executor, metroUnit(slug))) return { status: "stopped", url: null };
    const url = await readExpUrlFromLog(executor, `/tmp/luxipanel-expo-metro-${slug}.log`);
    return { status: url ? "running" : "starting", url };
  },
  /**
   * Start a Metro dev server with a public **tunnel** on the connected server
   * for LIVE testing: the developer scans the returned `exp://…exp.direct` URL
   * with their installed dev-client app and Metro streams the JS bundle with hot
   * reload. (Installing a build is a separate flow — the per-build QR in the
   * history points at the EAS install page.)
   *
   * Metro must keep running while testing, so we launch it DETACHED (nohup, FDs
   * off the SSH channel) and poll its log for the tunnel URL. A second click
   * reuses the running server; `stopDevClient` tears it down. The tunnel needs
   * `@expo/ngrok` in the project — if it's missing Metro exits early and we
   * surface the log tail.
   */
  async startDevClient(executor: Executor, input: DevClientInput): Promise<DevClientSession> {
    const mk = (
      url: string | null,
      raw: string,
      status: string | null,
      messageCode: DevClientMessageCode | null = null,
      detail = "",
    ): DevClientSession => ({
      url,
      artifactUrl: null,
      buildId: null,
      platform: null,
      profile: null,
      status,
      createdAt: null,
      qr: null,
      raw,
      messageCode,
      detail,
    });
    const project = await requireExpoProject(executor, input.path);
    if (!project.runtime?.expoInstalled) {
      return mk(null, "Faltan las dependencias del proyecto Expo. Instálalas antes de generar el QR.", "error", "expoMissing");
    }
    if (!project.runtime.ngrokInstalled) {
      return mk(null, "Falta @expo/ngrok para el túnel. Instálalo antes de generar el QR.", "error", "ngrokMissing");
    }
    const token = await expoConfigService.getToken();
    const slug = devSlug(input.path);
    const unit = metroUnit(slug);
    const logFile = `/tmp/luxipanel-expo-metro-${slug}.log`;
    const envFile = `/tmp/luxipanel-expo-metro-${slug}.env`;

    // Reuse a tunnel that's already up for this project.
    if (await metroAlive(executor, unit)) {
      const existing = await readExpUrlFromLog(executor, logFile);
      if (existing) return mk(existing, "El servidor de pruebas ya estaba en ejecución.", "running", "alreadyRunning");
    }

    const { user, home } = await resolveUserHome(executor);
    // Pass EXPO_TOKEN via a 0600 EnvironmentFile (read by systemd as root at
    // unit start), NOT `--setenv=EXPO_TOKEN=<token>`: an argv token is visible
    // to any local user via `ps`, the journal and `systemctl show <unit>`.
    await executor.writeFile(envFile, `EXPO_TOKEN=${token}\n`, { encoding: "utf8", mode: 0o600 });

    // CRITICAL: Metro must keep running for MINUTES after this request returns,
    // but the SSH executor reaps the whole process tree when the command
    // finishes — neither `nohup` nor `setsid` survives it (verified: the process
    // was dead within 3s, log empty). So run Metro as a transient **systemd**
    // unit: systemd supervises it independently of the SSH session, so it lives
    // on. `script` gives it a PTY (Metro only prints the URL/QR with a TTY; CI=1
    // / --non-interactive hide them); the `script` typescript file is the log we
    // poll. Port 8081 is freed first so expo never hits the "use another port?"
    // prompt. Stopping the unit kills its whole cgroup (Metro + ngrok).
    //
    // DO NOT add `pkill -f 'start --dev-client --tunnel'` (or any pattern that
    // also appears in THIS script's own text) here: the whole body runs as
    // `sh -lc '<body>'`, so the launching shell's argv literally contains that
    // substring — `pkill -f` matches and kills the shell mid-script, before
    // `systemd-run` ever runs. That was the root cause of "El servidor de
    // pruebas se detuvo antes de exponer la URL" (the journal showed
    // stop+reset-failed running but systemd-run never executing). Cleanup is
    // fully covered by `systemctl stop` (kills the unit's whole cgroup) plus
    // `fuser -k 8081/tcp` (frees the port from any stray non-unit orphan).
    const metroCmd = "npx --yes expo start --dev-client --tunnel";
    const innerSh = `exec script -qfc ${quoteArg(metroCmd)} ${quoteArg(logFile)}`;
    const runArgs =
      `--unit=${quoteArg(unit)} --collect ` +
      `--uid=${quoteArg(user)} --gid=${quoteArg(user)} ` +
      `--setenv=HOME=${quoteArg(home)} --property=EnvironmentFile=-${quoteArg(envFile)} ` +
      `--working-directory=${quoteArg(input.path)}`;
    const body =
      `sudo systemctl stop ${quoteArg(unit)} 2>/dev/null; ` +
      `sudo systemctl reset-failed ${quoteArg(unit)} 2>/dev/null; ` +
      `fuser -k 8081/tcp 2>/dev/null; sleep 1; ` +
      `sudo rm -f ${quoteArg(logFile)}; ` +
      `sudo systemd-run ${runArgs} /bin/sh -c ${quoteArg(innerSh)}`;

    // El túnel de ngrok falla de forma TRANSITORIA con bastante frecuencia (su
    // API devuelve respuestas sin cuerpo, y a veces hay cortes anunciados en su
    // status page). Antes, un hipo así abortaba la petición entera y — peor —
    // se reportaba como "falta @expo/ngrok", mandando al usuario a instalar un
    // paquete que ya tenía. Ahora se reintenta el lanzamiento, segando primero
    // los residuales (un ngrok zombi del intento anterior es justo lo que hace
    // fallar al siguiente). Los fallos NO transitorios (paquete ausente, error
    // de build) cortan en seco: reintentarlos solo haría perder el tiempo.
    let lastTail = "";
    for (let attempt = 1; attempt <= MAX_DEV_CLIENT_LAUNCHES; attempt++) {
      const killed = await reapDevClientResiduals(executor);
      if (killed > 0) await new Promise((r) => setTimeout(r, DEV_CLIENT_SETTLE_MS));

      const withSudo = await injectSudoIntoShellScript(executor, body);
      const launch = await executor.exec(`sh -lc ${quoteArg(withSudo)}`, { timeoutMs: 30_000 });
      if (launch.exitCode !== 0) {
        const detail = (launch.stderr || launch.stdout).trim();
        return mk(null, `No se pudo iniciar el servidor de pruebas. ${detail}`, "error", "startFailed", detail);
      }

      // Poll the log for the tunnel exp:// URL (ngrok + Metro cold start is slow).
      const deadline = Date.now() + 80_000;
      let died = false;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const url = await readExpUrlFromLog(executor, logFile);
        if (url)
          return mk(url, "Escanea el QR con tu app de desarrollo (dev-client) para probar en vivo con recarga en caliente.", "running", "started");
        // Bail early if the unit died (e.g. missing @expo/ngrok, build error).
        if (!(await metroAlive(executor, unit))) {
          died = true;
          break;
        }
      }
      if (!died) {
        return mk(null, "Tiempo de espera agotado iniciando el túnel. Intenta de nuevo.", "error", "timeout");
      }

      lastTail = await tailLog(executor, logFile);
      const failure = classifyDevClientFailure(lastTail);

      if (failure === "ngrokMissing") {
        return mk(
          null,
          `Falta @expo/ngrok en el proyecto para el túnel. El servidor de pruebas se detuvo antes de exponer la URL.\n${lastTail}`.trim(),
          "error",
          "exitedBeforeUrlNgrok",
          lastTail,
        );
      }
      if (failure === "exited") {
        return mk(
          null,
          `El servidor de pruebas se detuvo antes de exponer la URL.\n${lastTail}`.trim(),
          "error",
          "exitedBeforeUrl",
          lastTail,
        );
      }

      // Transitorio: reintentar mientras queden lanzamientos.
      if (attempt < MAX_DEV_CLIENT_LAUNCHES) {
        await new Promise((r) => setTimeout(r, DEV_CLIENT_RETRY_BACKOFF_MS));
      }
    }

    // Agotados los reintentos y SIEMPRE por un fallo transitorio del túnel: el
    // proyecto está bien, es ngrok el que no levanta. Que el mensaje lo diga.
    return mk(
      null,
      `El túnel de ngrok falló repetidamente (${MAX_DEV_CLIENT_LAUNCHES} intentos). No es un problema de tu proyecto; vuelve a intentarlo en un momento.\n${lastTail}`.trim(),
      "error",
      "exitedBeforeUrlTunnel",
      lastTail,
    );
  },

  /** Stop the Metro dev server / tunnel started for a project. */
  async stopDevClient(executor: Executor, input: DevClientInput): Promise<{ stopped: boolean }> {
    const slug = devSlug(input.path);
    const unit = metroUnit(slug);
    const logFile = `/tmp/luxipanel-expo-metro-${slug}.log`;
    const envFile = `/tmp/luxipanel-expo-metro-${slug}.env`;
    // Stopping the systemd unit kills its whole cgroup (Metro + ngrok); freeing
    // port 8081 mops up any non-unit orphan. NO `pkill -f` here either: this
    // body also runs as `sh -lc '<body>'`, so a pattern that appears in the
    // body would match and kill the stopping shell itself (see startDevClient).
    const body =
      `sudo systemctl stop ${quoteArg(unit)} 2>/dev/null; ` +
      `sudo systemctl reset-failed ${quoteArg(unit)} 2>/dev/null; ` +
      `fuser -k 8081/tcp 2>/dev/null; ` +
      `sudo rm -f ${quoteArg(logFile)} ${quoteArg(envFile)}; echo stopped`;
    const withSudo = await injectSudoIntoShellScript(executor, body);
    await executor.exec(`sh -lc ${quoteArg(withSudo)}`, { timeoutMs: 15_000 });
    return { stopped: true };
  },
};
