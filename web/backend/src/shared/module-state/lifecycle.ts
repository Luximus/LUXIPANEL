// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { eventBus, Events } from "../events/index.js";
import { getContextExecutor } from "../executor/context.js";
let sequence = 0;
const revisions = new Map<string, number>();
export function moduleStateRevision(targetId: string): number { return revisions.get(targetId) ?? 0; }
export function notifyModulesChanged(moduleId?: string, targetId: string | null = getContextExecutor()?.target.id ?? null): void {
  const revision = ++sequence;
  if (targetId) revisions.set(targetId, revision);
  eventBus.emit(Events.MODULES_CHANGED, { moduleId, targetId, revision });
}
