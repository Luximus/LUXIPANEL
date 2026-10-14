import { AsyncLocalStorage } from "node:async_hooks";
import { getContextExecutor, getContextUser } from "../executor/context.js";
import type { Executor } from "../executor/types.js";
import type { DiagnosticComponent, Incident, LogEvent } from "./types.js";

/** Set only by SDK/dispatch/test-runner code after resolving a real module. */
export const moduleDiagnosticContext = new AsyncLocalStorage<DiagnosticComponent>();
const pending = new Map<Promise<unknown>, string>();
const pruned = new Map<string, number>();
const listeners = new Set<(event: LogEvent) => void>();
let repositoryImport: Promise<typeof import("../data-store/index.js")> | undefined;
async function store(executor: Executor, userId: number) {
  const { dataStore } = await (repositoryImport ||= import("../data-store/index.js"));
  return dataStore<LogEvent>(executor, "module-dev", `events-${userId}`, { idStrategy: "uuid" });
}
export function onDiagnostic(listener: (event: LogEvent) => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function emitDiagnostic(event: LogEvent): void {
  for (const listener of listeners) { try { listener(event); } catch { /* capture never throws */ } }
}
export function persistModuleEvent(event: LogEvent): boolean {
  const executor = getContextExecutor(); const user = getContextUser();
  if (!executor || !user || !event.component || event.component.kind !== "module") return false;
  event.component = { ...event.component, targetId: executor.target.id, userId: user.userId };
  event.scope = `modules:${executor.target.id}:${user.userId}`;
  if (pending.size >= 500) return false;
  const key = event.scope;
  const task = (async () => {
    const collection = await store(executor, user.userId);
    await collection.set(event.id, event);
    if ((pruned.get(key) || 0) + 60000 > Date.now()) { emitDiagnostic(event); return; }
    pruned.set(key, Date.now());
    const rows = (await collection.list()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const { diagnosticsStore } = await import("./store.js");
    const config = await diagnosticsStore.config("instance");
    const cutoff = Date.now() - config.retentionDays * 86400_000;
    for (const row of rows.slice(2000)) await collection.delete(String(row.id));
    for (const row of rows.slice(0, 2000)) if (Date.parse(row.timestamp) < cutoff) await collection.delete(String(row.id));
    emitDiagnostic(event);
  })().catch(async (error) => { const { diagnosticsStore } = await import("./store.js"); const { sanitizeText } = await import("./sanitize.js"); diagnosticsStore.health.dropped++; diagnosticsStore.health.error = sanitizeText(String(error)); }).finally(() => pending.delete(task));
  pending.set(task, key); return true;
}
export async function moduleEvents(executor: Executor, userId: number): Promise<LogEvent[]> {
  await Promise.all([...pending].filter(([, key]) => key === `modules:${executor.target.id}:${userId}`).map(([promise]) => promise));
  return (await (await store(executor, userId)).list()).filter((event) => event.component?.kind === "module"
    && event.component.userId === userId && event.component.targetId === executor.target.id);
}
export function groupIncidents(events: LogEvent[]): Incident[] {
  const groups = new Map<string, Incident>();
  for (const event of events) {
    const prior = groups.get(event.fingerprint);
    if (!prior) groups.set(event.fingerprint, { id: event.fingerprint, severity: event.severity, source: event.source,
      module: event.module, message: event.message, firstSeen: event.timestamp, lastSeen: event.timestamp, count: 1, sample: event });
    else { prior.count++; if (event.timestamp < prior.firstSeen) prior.firstSeen = event.timestamp;
      if (event.timestamp >= prior.lastSeen) { prior.lastSeen = event.timestamp; prior.sample = event; } }
  }
  return [...groups.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}
