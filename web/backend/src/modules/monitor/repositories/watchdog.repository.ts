/**
 * Watchdog config repository — per-server sidecar (`monitor/watchdog`).
 *
 * Single-document collection: the desired auto-reboot policy for the
 * CONNECTED server. The kv-store resolves the executor from the request
 * scope; we still accept an explicit executor for clarity/tests.
 */

import { kv } from "../../../shared/kv-store/index.js";
import type { Executor } from "../../../shared/executor/index.js";
import {
  DEFAULT_WATCHDOG_CONFIG,
  watchdogConfigSchema,
  type WatchdogConfig,
} from "../models/watchdog.model.js";

const DOC_ID = "config";

function collection(executor?: Executor | null) {
  return kv(executor).module("monitor").collection<WatchdogConfig>("watchdog");
}

export const watchdogRepository = {
  /** Stored config merged over defaults; corrupt/missing → defaults. */
  async load(executor?: Executor | null): Promise<WatchdogConfig> {
    const raw = await collection(executor).get(DOC_ID);
    if (!raw) return { ...DEFAULT_WATCHDOG_CONFIG };
    const { id: _id, ...doc } = raw as WatchdogConfig & { id?: string };
    const parsed = watchdogConfigSchema.safeParse({ ...DEFAULT_WATCHDOG_CONFIG, ...doc });
    return parsed.success ? parsed.data : { ...DEFAULT_WATCHDOG_CONFIG };
  },

  async save(executor: Executor | null | undefined, config: WatchdogConfig): Promise<void> {
    await collection(executor).set(DOC_ID, config);
  },
};
