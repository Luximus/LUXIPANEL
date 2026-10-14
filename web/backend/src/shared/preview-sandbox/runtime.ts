// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * previewSandboxRuntime — punto de integración ÚNICO para ejecutar el código de
 * un preview de módulo (module-dev Modo B) en un proceso AISLADO out-of-process.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE ARCHIVO Y POR QUÉ `isAvailable()` ARRANCA EN `false`
 * ──────────────────────────────────────────────────────────────────────────
 * El autor de un módulo de marketplace es, en el modelo de amenaza, ADVERSARIO.
 * El proceso del panel comparte heap con la clave de cliente mTLS, `LUXIPANEL_KEY`
 * y los `Executor` SSH vivos de OTROS tenants. Ejecutar su código en proceso
 * convierte cualquier 0-day de V8/del addon en RCE a nivel de proceso = robo de
 * secretos CROSS-TENANT. La ÚNICA frontera aceptable es OUT-OF-PROCESS: proceso
 * separado, non-root, capabilities dropeadas, sin red, FS scrubbeado y sin
 * heredar secretos (RUNTIME-DESIGN.md §1–§4).
 *
 * F2/F3/F4 materializan ese runtime: `init()` corre el self-test POSITIVO de 7
 * pasos a través del builder de producción exacto y calienta un pool de workers
 * (`PoolSupervisor`); `dispatch()` captura el `Executor` por-request y delega al
 * pool, que media cada `capCall` por el `broker` (deny-by-default, MÁS ESTRICTO
 * que `buildCtx`). Todo sigue INERTE tras `PREVIEW_SANDBOX_ENABLED=false`
 * (default) — F5 (encender) requiere sign-off + CI gate (§12).
 *
 * FAIL-CLOSED POR CONSTRUCCIÓN: cualquier condición no probada segura ⇒
 * `available=false` ⇒ `dispatch` lanza `ForbiddenError`. `init()` NUNCA lanza.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * COPIA POR VALOR
 * ──────────────────────────────────────────────────────────────────────────
 * `dispatch()` lee y CONGELA los bytes del manifest + el source del entry al
 * entrar (snapshot atómico, hash del manifest), y los pasa POR VALOR en la trama
 * de dispatch: el child NUNCA re-lee el disco. El broker autoriza contra la copia
 * congelada, nunca re-lee por `capCall`. El resultado vuelve copiado por valor
 * (JSON.parse de bytes no confiables → re-serialización host-side), nunca un
 * `JSON.stringify` ejecutado por código del módulo.
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createModuleLogger } from "../logger/index.js";
import { ForbiddenError } from "../errors/index.js";
import { getContextExecutor, getContextUser } from "../executor/context.js";
import { getPreviewSandboxConfig } from "./config.js";
import { eventBus, Events } from "../events/index.js";
import {
  handleCapCall,
  buildEffectivePolicy,
  setSessionEpochSource,
  type BrokerSession,
  type CapCall,
  type CapResult,
  type FrozenManifest,
} from "./broker.js";
import { loadPreviewPolicy } from "./preview-policy.repository.js";
import { PoolSupervisor, type BrokerHandleCapCall } from "./pool-supervisor.js";

/**
 * Adapter binding the typed broker `handleCapCall` to the supervisor's opaque
 * `BrokerHandleCapCall` (session is `unknown` at the IPC boundary; we narrow it
 * back to a `BrokerSession`, which it always is — runtime is the only producer).
 */
const brokerHandleCapCall: BrokerHandleCapCall = (session: unknown, capCall: CapCall): Promise<CapResult> =>
  handleCapCall(session as BrokerSession, capCall);

const log = createModuleLogger("preview-sandbox");

export interface PreviewDispatchRequest {
  moduleId: string;
  /** Dir vendorizado del preview en el host del panel (installed/<id>/). */
  installedDir: string;
  tool: string;
  input: unknown;
}

export interface PreviewSandboxRuntime {
  /**
   * Inicializa el runtime en boot (idempotente). NUNCA lanza: cualquier fallo
   * deja el runtime no disponible (fail-closed) y registra un warning
   * accionable. El boot del panel no depende de que el sandbox exista.
   */
  init(): void;
  /**
   * `true` SOLO si el runtime out-of-process está presente Y su self-test de 7
   * pasos (incl. canario de secreto, corte de red, scrub de realm, deny-by-
   * default) pasó Y el pool calentó ≥1 worker sano. Por defecto `false`.
   */
  isAvailable(): boolean;
  /** Descripción legible del estado (para logs/errores accionables). */
  describe(): string;
  /**
   * Ejecuta una tool del preview en el runtime aislado. DEBE rechazar si
   * `isAvailable()` es `false` (fail-closed).
   */
  dispatch(req: PreviewDispatchRequest): Promise<{ ok: boolean; output: unknown }>;
  /**
   * Apaga el runtime (SIGTERM/exit del panel): mata el cgroup de workers, las
   * unidades Tier-2 y limpia scratch. Idempotente. Se cablea en `server.ts`.
   */
  dispose(): Promise<void>;
}

/** Estado interno: arranca NO disponible; sólo lo habilita el self-test POSITIVO. */
let available = false;
let reason = "out-of-process preview sandbox not initialized";
let initialized = false;
let pool: PoolSupervisor | null = null;

/**
 * Monotonic session epoch. Re-checked by the broker on EVERY capCall together
 * with the executor identity; bumping it (on logout/dispose) invalidates every
 * in-flight/queued dispatch session (RUNTIME-DESIGN §6.5, matrix row 17).
 */
let sessionEpoch = 0;
export function bumpPreviewSessionEpoch(): void {
  sessionEpoch++;
}
/** Current monotonic session epoch — injected into the broker so it can DENY a
 *  capCall whose captured `session.sessionEpoch` no longer matches (revocation
 *  on logout/dispose). */
function currentPreviewSessionEpoch(): number {
  return sessionEpoch;
}
// Inject the epoch reader into the broker at module load (before any dispatch):
// the broker fail-closes (DENY) until this is wired.
setSessionEpochSource(currentPreviewSessionEpoch);

/** Emit a preview-sandbox health event, swallowing any listener error so the
 *  fail-closed `init()` body can never be perturbed by a notification side. */
function emitPreviewEvent(event: string, payload: Record<string, unknown>): void {
  try {
    eventBus.emit(event, payload);
  } catch (err) {
    log.warn({ err: (err as Error)?.message, event }, "preview sandbox event emit failed (ignored)");
  }
}

/**
 * Snapshot atómico del manifest + source del entry (RUNTIME-DESIGN §6.3).
 *
 * Intención de diseño: `openat` desde un O_PATH dirfd de `installedDir` para
 * leer manifest+entry de forma atómica frente a un reinstall concurrente. Node
 * no expone O_PATH/openat sin un addon nativo (prohibido), así que la atomicidad
 * estructural la dan: (a) el bind RO de `/vendor` en el child (no puede reescribir
 * su propio manifest en disco), (b) la concurrencia per-owner install↔dispatch
 * en el supervisor, y (c) el hash del manifest congelado que el broker usa SIEMPRE
 * en vez de re-leer. Aquí leemos los bytes una sola vez y los congelamos.
 */
async function freezeSource(
  installedDir: string,
): Promise<{ manifest: Record<string, unknown>; manifestHash: string; entryBytes: string }> {
  const manifestPath = path.join(installedDir, "module.manifest.json");
  const manifestRaw = await fs.readFile(manifestPath); // bytes, congelados
  const manifestHash = createHash("sha256").update(manifestRaw).digest("hex");
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestRaw.toString("utf-8")) as Record<string, unknown>;
  } catch {
    throw new ForbiddenError("preview manifest is not valid JSON");
  }
  // Resolve the entry source path relative to installedDir; reject any escape.
  const entry = (manifest.entry as { backend?: unknown } | undefined)?.backend;
  if (typeof entry !== "string" || !entry) {
    throw new ForbiddenError("preview manifest has no entry.backend");
  }
  const entryAbs = path.resolve(installedDir, entry);
  if (entryAbs !== installedDir && !entryAbs.startsWith(installedDir + path.sep)) {
    throw new ForbiddenError("preview entry path escapes installedDir");
  }
  const entryBytes = (await fs.readFile(entryAbs)).toString("utf-8");
  return { manifest, manifestHash, entryBytes };
}

export const previewSandboxRuntime: PreviewSandboxRuntime = {
  init(): void {
    if (initialized) return;
    initialized = true;
    // Whole body fail-closed: ANY error ⇒ available=false (matrix row 21).
    try {
      const config = getPreviewSandboxConfig();
      if (!config.enabled) {
        available = false;
        reason = "PREVIEW_SANDBOX_ENABLED=false (kill-switch)";
        log.info({ available, reason }, "preview sandbox runtime disabled by kill-switch (inert)");
        return;
      }
      pool = new PoolSupervisor();
      // bootstrap() is async but `init()` is sync (interface-frozen). Kick it
      // off and latch availability from its outcome; until it resolves the
      // runtime stays unavailable (fail-closed). Errors never escape.
      void pool
        .bootstrap({ brokerHandleCapCall })
        .then(() => {
          available = pool!.healthy();
          reason = pool!.describe();
          if (available) {
            log.info({ reason }, "preview sandbox runtime AVAILABLE");
            // Healthy but warmed FEWER workers than the (already-clamped) pool
            // target ⇒ DEGRADED (mirrors WRITE_QUEUE_DEGRADED — wired in
            // wireInternalNotifications). Compare against the pool's clamped
            // target, not the raw config poolSize (a low-CPU host legitimately
            // clamps below config and that is NOT a degradation).
            const target = pool!.targetPoolSize();
            const warmed = pool!.workerCount();
            if (warmed < target) {
              emitPreviewEvent(Events.PREVIEW_SANDBOX_DEGRADED, { reason, warmed, target });
            }
          } else {
            log.warn({ reason }, "preview sandbox runtime unavailable after self-test (inert)");
            // Operator asked for previews (enabled) but the self-test/pool did
            // not come up ⇒ surface UNAVAILABLE so the operator gets the health
            // signal (RUNTIME-DESIGN §9 — mirrors WRITE_QUEUE_DEGRADED).
            emitPreviewEvent(Events.PREVIEW_SANDBOX_UNAVAILABLE, { reason });
          }
        })
        .catch((err) => {
          available = false;
          reason = `bootstrap failed: ${(err as Error).message}`;
          log.warn({ reason }, "preview sandbox runtime bootstrap failed (inert, fail-closed)");
          emitPreviewEvent(Events.PREVIEW_SANDBOX_UNAVAILABLE, { reason });
        });
    } catch (err) {
      available = false;
      reason = `init error: ${(err as Error).message}`;
      log.warn({ available, reason }, "preview sandbox runtime init failed (inert, fail-closed)");
    }
  },

  isAvailable(): boolean {
    return available;
  },

  describe(): string {
    return available ? `out-of-process preview sandbox: ${reason}` : `preview sandbox unavailable: ${reason}`;
  },

  async dispatch(req: PreviewDispatchRequest): Promise<{ ok: boolean; output: unknown }> {
    if (!available || !pool) {
      // Fail-closed incondicional: NUNCA ejecutar código de preview en proceso.
      throw new ForbiddenError(
        `preview sandbox runtime unavailable (${reason}); refusing to execute preview code in the panel process`,
      );
    }

    // Capturamos el executor por-request AL ENTRAR. Estamos dentro del scope
    // del request (requireAuth → runWithExecutor), NO en runOnPanelHost. Si no
    // hay executor de contexto ⇒ fail-closed (matrix row 16): NUNCA localExecutor.
    const ownerExecutor = getContextExecutor();
    if (!ownerExecutor) {
      throw new ForbiddenError(
        "preview dispatch rejected: no per-server executor in scope (fail-closed; never the panel host)",
      );
    }
    const user = getContextUser();

    // Snapshot atómico del manifest + source (congelado, hash).
    const { manifest, manifestHash, entryBytes } = await freezeSource(req.installedDir);

    // Política EFECTIVA = operador ∩ manifest (el autor sólo puede ESTRECHAR).
    const ownerUserId = user ? String(user.userId) : "";
    const operatorPolicy = await loadPreviewPolicy(ownerUserId, req.moduleId);
    const effectivePolicy = buildEffectivePolicy(operatorPolicy, {
      capabilities: Array.isArray(manifest.capabilities)
        ? (manifest.capabilities as FrozenManifest["capabilities"])
        : undefined,
      http_allowlist: Array.isArray(manifest.http_allowlist)
        ? (manifest.http_allowlist as string[])
        : undefined,
    });

    const session: BrokerSession = {
      executor: ownerExecutor,
      user,
      sessionEpoch,
      owner: ownerUserId,
      ownerUserId,
      moduleId: req.moduleId,
      effectivePolicy,
      manifestHash,
    };

    const config = getPreviewSandboxConfig();
    const result = await pool.dispatch({
      moduleId: req.moduleId,
      tool: req.tool,
      input: req.input,
      owner: ownerUserId,
      ownerUserId,
      deadlineMs: config.dispatchMs,
      source: { entryBytes, manifestHash },
      policy: {
        capabilities: [...effectivePolicy.capabilities],
        http_allowlist: effectivePolicy.http_allowlist,
      },
      session,
      brokerHandleCapCall,
    });
    return { ok: result.ok, output: result.output };
  },

  async dispose(): Promise<void> {
    bumpPreviewSessionEpoch(); // invalidate every in-flight session
    available = false;
    try {
      await pool?.dispose();
    } catch (err) {
      log.warn({ err: (err as Error).message }, "preview sandbox dispose error (ignored)");
    }
  },
};
