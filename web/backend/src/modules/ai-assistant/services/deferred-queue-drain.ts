// SPDX-License-Identifier: AGPL-3.0-only
import { runWithExecutor, type Executor } from "../../../shared/executor/index.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const log = createModuleLogger("assistant-deferred-drain");
/** Timers are only accelerators: the due time and retry identity live on disk. */
export function deferQueueDrain(executor: Executor, conversationId: string, delay: number, user: SessionUser | null | undefined,
  drain: (executor: Executor, conversationId: string) => Promise<void>): void {
  const key = JSON.stringify([executor.target.id, user?.userId, conversationId]);
  if (timers.has(key)) return;
  const timer = setTimeout(() => {
    timers.delete(key);
    void runWithExecutor(executor, () => drain(executor, conversationId), user?.userId, user ?? undefined)
      .catch(err => log.warn({ conversationId, error: String(err) }, "delayed team turn failed"));
  }, Math.max(1, delay));
  timer.unref?.();
  timers.set(key, timer);
}
