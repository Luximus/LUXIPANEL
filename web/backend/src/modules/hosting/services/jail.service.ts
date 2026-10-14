// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Hosting jail service (Fase 5) — chroot/jailshell real (jailkit) para las
 * shells/terminal de las sesiones `kind:"hosting"`.
 *
 * NO duplica la receta de aprovisionamiento del jail: los `MutationStep[]` los
 * construye `systemAccountsService.buildJailSetupSteps` (propiedad del módulo
 * `users`, ya existente: `jk_init` + `jk_cp` de un perfil mínimo + `mount proc`
 * hidepid=2 + `jk_jailuser -m`). Aquí se aporta lo que faltaba en la Fase 5:
 *
 *   - Detección de jailkit en el VPS (`isJailkitAvailable`) con degradación
 *     accionable (NO rompe el aprovisionamiento si jailkit no está instalado).
 *   - Aprovisionamiento/reaprovisionamiento idempotente del jail vía la cola
 *     write-behind (`provisionJail`), mismo patrón que `hosting.service`.
 *   - Desmontaje del jail (`teardownJail`): revierte el login shell a /bin/bash
 *     y desmonta el `/proc` del jail.
 *   - Estado del jail (`jailStatus`) para el endpoint GET.
 *
 * IMPORTANTE (anti-ciclo): este servicio NO importa `hosting.service.ts` (que a
 * su vez podría importar este). En su lugar, reproduce localmente el helper
 * `applyTenantSteps` (idéntico al de `hosting.service`) — son pocas líneas y la
 * receta de steps vive en `system-accounts.service`, no aquí.
 *
 * El owner es el ÚNICO usuario enjaulado en el MVP (`jk_jailuser -m` fija su
 * login shell a `jk_chrootsh`). Los sub-usuarios NO se enjaulan (deuda Fase 8).
 */

import { systemAccountsService, DEFAULT_LOGIN_SHELL } from "../../users/services/system-accounts.service.js";
import type { MutationStep } from "../../../shared/remote-cache/submit-mutation.js";
import { applyStepsOrThrow } from "../../../shared/remote-cache/apply-steps.js";
import { isCommandInPath } from "../../../shared/system/command-probe.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { env } from "../../../config/env.js";
import type { HostingAccount } from "../models/hosting-account.model.js";

const log = createModuleLogger("hosting:jail");

export interface JailProvisionResult {
  jailed: boolean;
  degraded: boolean;
  reason?: string;
  jailedAt?: string;
}

export interface JailStatusResult {
  jailEnabled: boolean;
  jailedAt: string | null;
  jailkitAvailable: boolean;
}

/**
 * Encola una receta write-behind y exige que se aplique antes de devolver.
 * El contrato vive en `shared/remote-cache/apply-steps.ts` — estar en `shared/`
 * es lo que elimina el ciclo de imports que obligaba a duplicarlo aquí.
 */
async function applyTenantSteps(
  executor: Executor,
  op: "create" | "update" | "delete",
  steps: MutationStep[],
): Promise<void> {
  await applyStepsOrThrow(executor, {
    module: "hosting",
    collection: "accounts",
    op,
    steps,
    // El owner es un usuario Linux — refresca la tabla de usuarios.
    refresh: [["users", "system"]],
    notConfirmedMessage: "La operación de jail de hosting no se confirmó a tiempo en el servidor",
    notConfirmedCode: "HOSTING_JAIL_NOT_CONFIRMED",
  });
}

export const hostingJailService = {
  /**
   * ¿Está jailkit instalado en el VPS conectado? Probamos `command -v jk_init`
   * (POSIX) y, como respaldo, la presencia ejecutable del binario junto al
   * `jk_chrootsh` configurado (`JAIL_TOOL_PATH`). True si cualquiera resuelve.
   */
  async isJailkitAvailable(executor: Executor): Promise<boolean> {
    // `command -v` bajo login shell — sonda compartida (shared/system).
    // `requireOutput`: the legacy probe here ended in `|| true`, so only a
    // printed path (not the exit code) tells jailkit apart from a miss.
    if (await isCommandInPath(executor, "jk_init", { requireOutput: true })) return true;
    // Respaldo: jk_init vive junto al jk_chrootsh configurado.
    const jailDir = env.JAIL_TOOL_PATH.replace(/\/[^/]*$/, "") || "/usr/sbin";
    const jkInit = `${jailDir}/jk_init`;
    try {
      const res = await executor.exec(`[ -x ${quoteArg(jkInit)} ] && echo yes || true`);
      return res.stdout.trim() === "yes";
    } catch {
      return false;
    }
  },

  /**
   * Aprovisiona (o reaprovisiona, idempotente) el jail del owner de la cuenta.
   *
   * Degradación accionable (fail-soft, NO lanza):
   *   - `JAIL_SHELL_ENABLED=false` → no enjaular.
   *   - jailkit ausente en el VPS → no enjaular + WARN + notificación accionable.
   *
   * Si jailkit está disponible, encola la receta de `buildJailSetupSteps` por la
   * cola write-behind (mismo transporte/atomicidad que el resto del módulo).
   */
  async provisionJail(account: HostingAccount, executor: Executor): Promise<JailProvisionResult> {
    if (!env.JAIL_SHELL_ENABLED) {
      return { jailed: false, degraded: true, reason: "JAIL_SHELL_ENABLED=false" };
    }

    const available = await this.isJailkitAvailable(executor);
    if (!available) {
      const reason = "jailkit no instalado en el VPS (apt-get install jailkit)";
      log.warn({ id: account.id, username: account.username, target: executor.target.id }, reason);
      // Notificación accionable al admin del VPS (fail-soft: no aborta nada).
      // Vía event bus — los módulos NO se importan entre sí (CLAUDE.md).
      eventBus.emit(Events.HOSTING_JAIL_DEGRADED, {
        accountId: account.id,
        username: account.username,
        reason,
      });
      return { jailed: false, degraded: true, reason };
    }

    await applyTenantSteps(
      executor,
      "update",
      systemAccountsService.buildJailSetupSteps(
        account.homeRoot,
        account.username,
        account.tenantGroup,
        account.allowedModules,
      ),
    );
    const jailedAt = new Date().toISOString();
    log.info({ id: account.id, username: account.username, target: executor.target.id }, "Hosting jail provisioned");
    return { jailed: true, degraded: false, jailedAt };
  },

  /**
   * Desmonta el jail: revierte el login shell del owner a /bin/bash y desmonta
   * el `/proc` del jail si está montado. Cada step es idempotente (corre sin
   * daño en cuentas no enjauladas). NO borra los binarios copiados (jk_cp) —
   * eso es trabajo de `terminate`, que elimina el home entero.
   */
  async teardownJail(account: HostingAccount, executor: Executor): Promise<void> {
    const jailProc = `${account.homeRoot}/proc`;
    await applyTenantSteps(executor, "update", [
      { type: "sh", argv: ["usermod", "-s", DEFAULT_LOGIN_SHELL, account.username], sudo: true },
      {
        type: "sh",
        argv: ["sh", "-c", `mountpoint -q ${quoteArg(jailProc)} && umount ${quoteArg(jailProc)} || true`],
        sudo: true,
      },
    ]);
    log.info({ id: account.id, username: account.username, target: executor.target.id }, "Hosting jail torn down");
  },

  /** Estado del jail: la intención (envelope) + disponibilidad real de jailkit. */
  async jailStatus(account: HostingAccount, executor: Executor): Promise<JailStatusResult> {
    const jailkitAvailable = await this.isJailkitAvailable(executor);
    return {
      jailEnabled: account.jailEnabled === true,
      jailedAt: account.jailedAt ?? null,
      jailkitAvailable,
    };
  },
};
