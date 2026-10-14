// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal tmux preflight controller.
 *
 * El terminal usa tmux para PERSISTIR la sesión (re-adjuntar tras un corte del
 * WS — p. ej. el SO suspende el WebView móvil al cambiar de app). tmux debe
 * existir EN EL SERVIDOR OBJETIVO; si falta, cada reconexión abre una shell
 * nueva. Estos endpoints dejan al frontend hacer un preflight antes de abrir el
 * terminal y, si falta y se puede, instalarlo con un botón.
 *
 *   GET  /api/terminal/tmux-status  → { installed, canInstall, packageManager, reason? }
 *   POST /api/terminal/tmux-install → { installed, output?, error? }
 *
 * Reglas (espejan el gate de reattach en terminal.controller.ts):
 *   - tmux APLICA (persiste la sesión) en executors cuyo `spawn` acaba en tmux:
 *     DirectSshExecutor y PrivilegeDropExecutor NO enjaulado. Otros → no aplica
 *     (installed:true para no bloquear; el WS abrirá shell normal).
 *   - canInstall NO requiere PTY: instalar tmux es UN comando de paquete
 *     (`sudo apt-get install -y tmux`). Puede DirectSsh (clave del usuario +
 *     sudo). En privilege-drop el owner no tiene root → lo instala el proveedor.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutorAsync } from "../../../shared/executor/index.js";
import { DirectSshExecutor } from "../../../shared/executor/direct-ssh-executor.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { tmuxMessage } from "./tmux-i18n.js";

const log = createModuleLogger("terminal:tmux");

/** Gestores de paquetes soportados, en orden de preferencia. */
const PKG_DETECT = "for m in apt-get dnf yum apk pacman zypper; do command -v \"$m\" >/dev/null 2>&1 && { printf '%s' \"$m\"; break; }; done";

function buildInstallCommand(pm: string): string | null {
  switch (pm) {
    case "apt-get":
      return "sudo sh -c 'export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y tmux'";
    case "dnf":
      return "sudo sh -c 'dnf install -y tmux'";
    case "yum":
      return "sudo sh -c 'yum install -y tmux'";
    case "apk":
      return "sudo sh -c 'apk add --no-cache tmux'";
    case "pacman":
      return "sudo sh -c 'pacman -Sy --noconfirm tmux'";
    case "zypper":
      return "sudo sh -c 'zypper --non-interactive install tmux'";
    default:
      return null;
  }
}

/** El executor termina envolviendo la shell en tmux (= donde el reattach aplica). */
function isTmuxCapable(executor: unknown): boolean {
  if (executor instanceof DirectSshExecutor) return true;
  if (executor instanceof PrivilegeDropExecutor) return !executor.willJailInteractiveShell;
  return false;
}

/**
 * El executor puede instalar tmux como root corriendo UN comando de paquete
 * (`sudo apt-get install -y tmux`) — NO necesita PTY. DirectSsh (clave del
 * usuario + sudo) y LicenseProxy (LP guarda el passphrase del owner y la
 * inyección de sudo opera igual sobre el proxy) sí pueden. PrivilegeDrop = owner
 * sin root → lo instala el proveedor.
 */
function canRootInstall(executor: unknown): boolean {
  return executor instanceof DirectSshExecutor;
}

async function probeTmux(executor: { exec: (c: string) => Promise<{ exitCode: number; stdout: string }> }): Promise<boolean> {
  const probe = await executor.exec("command -v tmux >/dev/null 2>&1 && printf ok");
  return probe.exitCode === 0 && probe.stdout.trim() === "ok";
}

export const tmuxController = {
  /** GET /api/terminal/tmux-status — preflight de tmux en el servidor objetivo. */
  status: asyncHandler(async (req: Request, res: Response) => {
    let executor;
    try {
      executor = await getExecutorAsync(req);
    } catch (err) {
      // Sin executor por-servidor (modo no gestionado / sesión expirada): no
      // bloqueamos el terminal — el WS resolverá el shell como pueda.
      log.debug({ err: String(err) }, "tmux-status: no executor — skip gate");
      res.json({ ok: true, data: { installed: true, canInstall: false, packageManager: null, reason: "no-executor" } });
      return;
    }

    const capable = isTmuxCapable(executor);
    let installed = false;
    try {
      installed = await probeTmux(executor);
    } catch (err) {
      log.warn({ err: String(err) }, "tmux-status: probe failed");
      // No pudimos comprobar → no bloquear.
      res.json({ ok: true, data: { installed: true, canInstall: false, packageManager: null, reason: "probe-failed" } });
      return;
    }

    // canInstall solo en DirectSsh (root vía sudo). Detectamos el gestor de
    // paquetes únicamente en ese caso (en privilege-drop el owner no instala).
    let packageManager: string | null = null;
    let canInstall = false;
    let reason: string | undefined;
    if (!installed) {
      if (!capable) {
        reason = "unsupported-executor";
      } else if (canRootInstall(executor)) {
        try {
          packageManager = (await executor.exec(PKG_DETECT)).stdout.trim() || null;
        } catch { packageManager = null; }
        canInstall = !!packageManager;
        if (!packageManager) reason = "no-package-manager";
      } else {
        // PrivilegeDrop NO enjaulado: tmux ayudaría, pero lo instala el proveedor.
        reason = "provider-managed";
      }
    }

    res.json({ ok: true, data: { installed, canInstall, packageManager, reason } });
  }),

  /** POST /api/terminal/tmux-install — instala tmux en el servidor objetivo. */
  install: asyncHandler(async (req: Request, res: Response) => {
    let executor;
    try {
      executor = await getExecutorAsync(req);
    } catch (err) {
      res.json({ ok: true, data: { installed: false, error: tmuxMessage(res.locals.locale, "noSession") } });
      log.warn({ err: String(err) }, "tmux-install: no executor");
      return;
    }

    // Instalación = paquete de sistema (root) vía UN `exec`. DirectSsh (sudo del
    // usuario) o LicenseProxy (sudo inyectado sobre el proxy con el passphrase
    // que guarda LP). En privilege-drop el owner no tiene root → lo hace el
    // proveedor.
    if (!canRootInstall(executor)) {
      res.json({ ok: true, data: { installed: false, error: tmuxMessage(res.locals.locale, "installDenied") } });
      return;
    }

    // ¿Ya está? (idempotente)
    try {
      if (await probeTmux(executor)) {
        res.json({ ok: true, data: { installed: true } });
        return;
      }
    } catch { /* sigue al install */ }

    let pm: string;
    try {
      pm = (await executor.exec(PKG_DETECT)).stdout.trim();
    } catch (err) {
      res.json({ ok: true, data: { installed: false, error: tmuxMessage(res.locals.locale, "detectFailed", { detail: String(err) }) } });
      return;
    }
    const cmd = buildInstallCommand(pm);
    if (!cmd) {
      res.json({ ok: true, data: { installed: false, error: tmuxMessage(res.locals.locale, "unsupportedManager", { manager: pm || tmuxMessage(res.locals.locale, "unknownManager") }) } });
      return;
    }

    log.info({ pm, target: (executor as { target?: { id?: string } }).target?.id }, "tmux-install: installing tmux");
    let output = "";
    try {
      const out = await executor.exec(cmd, { timeoutMs: 180_000 });
      output = (out.stderr?.trim() || out.stdout?.trim() || "").slice(-2000);
    } catch (err) {
      res.json({ ok: true, data: { installed: false, error: tmuxMessage(res.locals.locale, "installFailed", { detail: String(err) }) } });
      return;
    }

    let installed = false;
    try { installed = await probeTmux(executor); } catch { installed = false; }
    if (!installed) {
      log.warn({ pm, output }, "tmux-install: still not present after install");
      res.json({ ok: true, data: { installed: false, error: tmuxMessage(res.locals.locale, "stillMissing"), output } });
      return;
    }

    log.info({ pm }, "tmux-install: tmux installed OK");
    res.json({ ok: true, data: { installed: true } });
  }),
};
