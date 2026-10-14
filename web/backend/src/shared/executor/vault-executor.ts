// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Vault-owned direct-SSH executors for BACKGROUND workers (no user session).
 *
 * The request path caches one {@link DirectSshExecutor} per *bridge session*
 * (see `factory.ts`) — bound to a logged-in operator and torn down on logout.
 * Background schedulers (e.g. the backup scheduler) must reach a target with NO
 * user session in scope, so they cannot borrow those. This helper builds and
 * caches a SEPARATE executor per *targetId*, straight from the local SSH vault
 * (`targetsRepository.getMaterial`), independent of any operator.
 *
 * It deliberately does NOT reuse `factory.ts`'s map: mixing session-scoped and
 * worker-scoped executors under the same cache would let a logout tear down a
 * scheduler connection (or vice-versa). Same leak guards as the factory (idle
 * reaper + explicit dispose), kept private to this module.
 */

import type { Executor } from "./types.js";
import { DirectSshExecutor } from "./direct-ssh-executor.js";
import { wrapExecutorWithSudo } from "./sudo-exec-wrap.js";
import { createModuleLogger } from "../logger/index.js";
import { EXECUTOR_IDLE_TTL_MS } from "./constants.js";
// The vault is control-plane state of the panel host; reading target material
// for a background worker is exactly what `getMaterial` exists for.
import { targetsRepository } from "../../modules/servers/repositories/targets.repository.js";

const log = createModuleLogger("vault-executor");

/** One DirectSshExecutor per targetId (worker-scoped, not session-scoped). */
const executorByTargetId = new Map<string, DirectSshExecutor>();
const lastUsedAt = new Map<string, number>();

const REAP_INTERVAL_MS = 5 * 60_000;
let reaperTimer: NodeJS.Timeout | null = null;

function ensureReaper(): void {
  if (reaperTimer) return;
  reaperTimer = setInterval(() => void reapIdle(), REAP_INTERVAL_MS);
  if (typeof reaperTimer.unref === "function") reaperTimer.unref();
}

async function tearDown(targetId: string, exec: DirectSshExecutor): Promise<void> {
  executorByTargetId.delete(targetId);
  lastUsedAt.delete(targetId);
  await exec.dispose().catch(() => undefined);
}

async function reapIdle(): Promise<void> {
  const now = Date.now();
  for (const [targetId, exec] of [...executorByTargetId.entries()]) {
    if (now - (lastUsedAt.get(targetId) ?? 0) > EXECUTOR_IDLE_TTL_MS) {
      log.info({ targetId }, "Reaping idle vault executor");
      await tearDown(targetId, exec);
    }
  }
}

/**
 * Resolve (and cache) a sudo-wrapped executor for `targetId` from the vault.
 * Returns `null` when the target is unknown / its material can't be decrypted
 * caller-side (getMaterial throws on a vault-key mismatch — that propagates).
 */
export async function getVaultExecutor(targetId: string): Promise<Executor | null> {
  const cached = executorByTargetId.get(targetId);
  if (cached) {
    lastUsedAt.set(targetId, Date.now());
    return wrapExecutorWithSudo(cached);
  }

  const found = await targetsRepository.getMaterial(targetId);
  if (!found) return null;

  const exec = new DirectSshExecutor(String(found.target.id ?? targetId), found.target.name, found.material);
  executorByTargetId.set(targetId, exec);
  lastUsedAt.set(targetId, Date.now());
  ensureReaper();
  log.info({ targetId, host: found.material.host }, "Vault executor ready");
  return wrapExecutorWithSudo(exec);
}

/** Dispose every cached vault executor (scheduler stop / shutdown). */
export async function disposeAllVaultExecutors(): Promise<void> {
  const entries = [...executorByTargetId.entries()];
  await Promise.all(entries.map(([targetId, exec]) => tearDown(targetId, exec)));
  if (reaperTimer) { clearInterval(reaperTimer); reaperTimer = null; }
}
