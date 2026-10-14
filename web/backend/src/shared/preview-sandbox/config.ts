// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — configuración tipada del runtime de preview sandbox (Fase F1).
 *
 * Lee `env` (Zod, ya validado en boot) y expone un objeto inmutable con
 * defaults seguros. NO ejecuta nada ni toca el host: sólo materializa la
 * política. El ABI se fija al del proceso actual cuando la env viene vacía,
 * de modo que el self-test futuro pueda rechazar cualquier worker cuyo
 * `process.versions.modules` no coincida (anti fail-open por drift de ABI).
 *
 * Ver `RUNTIME-DESIGN.md` §9 (config) y §8 (matriz fail-closed).
 */
import { env } from "@config/env.js";

export interface PreviewSandboxConfig {
  /** Kill-switch global. `false` ⇒ runtime inerte, todo dispatch fail-closed. */
  readonly enabled: boolean;
  /** Tier mínimo aceptable (1 = piso confinante; nunca sin scrub de FS). */
  readonly minTier: 1 | 2;
  readonly poolSize: number;
  readonly reuse: "once" | "pooled";
  /** Deadline único por dispatch (ms). */
  readonly dispatchMs: number;
  readonly memMaxMb: number;
  readonly cpuQuotaPct: number;
  readonly maxFrameBytes: number;
  readonly maxOutputBytes: number;
  readonly rootMb: number;
  readonly scratchMb: number;
  /** Máximo de capCalls por dispatch (anti-DoS de canal). */
  readonly maxCapsPerDispatch: number;
  /** Profundidad máxima de la cola FIFO de admisión (over-queue ⇒ saturado). */
  readonly queueMax: number;
  /** Token bucket por owner, formato "<n>/<segundos>s" (p.ej. "6/30s"). */
  readonly perOwnerRate: string;
  /** Máximo de dispatches reutilizables por worker en modo `pooled`. */
  readonly workerMaxDispatches: number;
  /** ABI de Node fijada EXACTA (process.versions.modules). */
  readonly abi: string;
  /** Versión exacta de Node fijada (process.version) para el pin del worker. */
  readonly nodeVersion: string;
}

let cached: PreviewSandboxConfig | null = null;

export function getPreviewSandboxConfig(): PreviewSandboxConfig {
  if (cached) return cached;
  cached = Object.freeze({
    enabled: env.PREVIEW_SANDBOX_ENABLED,
    minTier: (env.PREVIEW_SANDBOX_MIN_TIER === 2 ? 2 : 1) as 1 | 2,
    poolSize: env.PREVIEW_SANDBOX_POOL_SIZE,
    reuse: env.PREVIEW_SANDBOX_REUSE,
    dispatchMs: env.PREVIEW_SANDBOX_DISPATCH_MS,
    memMaxMb: env.PREVIEW_SANDBOX_MEM_MAX_MB,
    cpuQuotaPct: env.PREVIEW_SANDBOX_CPU_QUOTA_PCT,
    maxFrameBytes: env.PREVIEW_SANDBOX_MAX_FRAME,
    maxOutputBytes: env.PREVIEW_SANDBOX_MAX_OUTPUT,
    rootMb: env.PREVIEW_SANDBOX_ROOT_MB,
    scratchMb: env.PREVIEW_SANDBOX_SCRATCH_MB,
    maxCapsPerDispatch: env.PREVIEW_SANDBOX_MAX_CAPS_PER_DISPATCH,
    queueMax: env.PREVIEW_SANDBOX_QUEUE_MAX,
    perOwnerRate: env.PREVIEW_SANDBOX_PER_OWNER_RATE,
    workerMaxDispatches: env.PREVIEW_SANDBOX_WORKER_MAX_DISPATCHES,
    // ABI/versión fijadas: si la env viene vacía, se ancla al runtime actual
    // para que cualquier worker con ABI distinto se considere NO disponible.
    abi: env.PREVIEW_SANDBOX_ABI || process.versions.modules,
    nodeVersion: process.version,
  });
  return cached;
}
