// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { getContextExecutor, localExecutor, LOCAL_TARGET_ID, runOnPanelHost, type Executor } from "../../../shared/executor/index.js";
import { getVaultExecutor } from "../../../shared/executor/vault-executor.js";

/** Resolve internal/background events on their originating server. A missing
 * remote executor must never redirect a notification to the panel host. */
export async function resolveNotificationExecutor(targetId?: string): Promise<Executor> {
  const context = getContextExecutor();
  const id = targetId || context?.target.id || LOCAL_TARGET_ID;
  if (context?.target.id === id) return context;
  if (id === LOCAL_TARGET_ID) return localExecutor;
  const executor = await runOnPanelHost(() => getVaultExecutor(id));
  if (!executor) throw new Error(`Notification server unavailable: ${id}`);
  return executor;
}

export function notificationEventTargetId(data: Record<string, unknown>): string | undefined {
  if (typeof data.targetId === "string" && data.targetId) return data.targetId;
  if (typeof data.scope === "string" && data.scope) return data.scope;
  const executor = data.executor as Executor | undefined;
  return typeof executor?.target?.id === "string" ? executor.target.id : undefined;
}
