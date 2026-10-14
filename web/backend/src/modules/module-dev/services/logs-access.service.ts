import type { Executor } from "../../../shared/executor/types.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { dataStore } from "../../../shared/data-store/index.js";
import { marketplaceLinkRepository } from "../../../shared/marketplace-link/index.js";
import { moduleEvents, groupIncidents } from "../../../shared/diagnostics/module-events.js";
import { diagnosticsStore } from "../../../shared/diagnostics/store.js";
import type { Incident, LogEvent } from "../../../shared/diagnostics/types.js";

export type LogsView = "luxipanel" | "modules";
export function logsScope(view: LogsView, executor: Executor, user: SessionUser): string {
  return view === "luxipanel" ? "instance" : `modules:${executor.target.id}:${user.userId}`;
}
export async function ownedModuleIds(executor: Executor, user: SessionUser): Promise<string[]> {
  const projects = dataStore<{ ownerId?: number }>(executor, "assistant", "projects", { idStrategy: "uuid" });
  const links = await marketplaceLinkRepository.list(executor);
  const own = [];
  for (const link of links) {
    const owner = link.ownerUserId ?? (await projects.get(link.projectId))?.ownerId;
    if (owner === user.userId) own.push(link.moduleId);
  }
  return [...new Set(own)];
}
export async function accessibleModuleEvents(executor: Executor, user: SessionUser): Promise<LogEvent[]> {
  // Reports from elsewhere are imported only for verified owned modules.
  return moduleEvents(executor, user.userId);
}
export async function accessibleIncidents(view: LogsView, executor: Executor, user: SessionUser): Promise<Incident[]> {
  return view === "luxipanel" ? diagnosticsStore.incidents("instance") : groupIncidents(await accessibleModuleEvents(executor, user));
}
export async function accessibleDetail(view: LogsView, executor: Executor, user: SessionUser, id: string, offset = 0) {
  if (view === "luxipanel") return diagnosticsStore.detail("instance", id, offset);
  const events = (await accessibleModuleEvents(executor, user)).filter((event) => event.fingerprint === id);
  return { incident: groupIncidents(events)[0], events: events.slice(offset, offset + 100), total: events.length };
}
