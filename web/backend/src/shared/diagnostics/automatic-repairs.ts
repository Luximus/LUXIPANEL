import { onDiagnostic } from "./module-events.js";
import { diagnosticsStore } from "./store.js";
import { repairJobs } from "./repair-jobs.js";
import { sanitizeText } from "./sanitize.js";
import { snapshotModuleSource } from "./module-source.js";
import { getContextExecutor, getContextUser } from "../executor/context.js";
import type { SessionUser } from "../types/index.js";
import type { LogEvent } from "./types.js";

export function policyKey(event: LogEvent): string {
  const c = event.component;
  return c?.kind === "module" ? `module:${c.targetId}:${c.userId}:${c.id}` : "luxipanel";
}
let started = false;
export function startAutomaticRepairs(): void {
  if (started) return; started = true;
  let chain = Promise.resolve();
  onDiagnostic((event) => {
    const capturedUser = getContextUser(); const executor = getContextExecutor();
    chain = chain.then(async () => {
      if (event.historical || !event.component) return;
      const config = await diagnosticsStore.config("instance"); if (!config.enabled) return; const policy = config.repairPolicies?.[policyKey(event)];
      if (!policy?.enabled || event.timestamp < policy.since || !policy.severities.includes(event.severity)) return;
      if (event.source.startsWith("frontend") && event.administratorId !== policy.userId) return;
      // Error messages never confer authority; use the administrator who saved the policy.
      const owner: SessionUser = capturedUser?.userId === policy.userId && capturedUser.kind === "admin" && !capturedUser.direct && !capturedUser.tenantId && (!capturedUser.targetId || capturedUser.targetId === "local") ? capturedUser : {
        userId: policy.userId, username: policy.username, displayName: policy.username, role: "admin", kind: "admin", modules: ["module-dev"] };
      const scope = event.component.kind === "module" ? `modules:${event.component.targetId}:${event.component.userId}` : "instance";
      const prior = await repairJobs.list(scope);
      if (prior.some((job) => job.incidentId === event.fingerprint && job.automatic)) return;
      // Bound public-report and repeated-warning costs independently of model budgets.
      if (prior.filter((job) => job.automatic && job.createdAt.slice(0, 10) === event.timestamp.slice(0, 10)).length >= 3) return;
      const incident = { id: event.fingerprint, severity: event.severity, source: event.source, module: event.module,
        message: event.message, firstSeen: event.timestamp, lastSeen: event.timestamp, count: 1, sample: event };
      await repairJobs.create(scope, incident.id, owner, { incident, events: [event], automatic: true, moduleSource: event.component.kind === "module" && executor && capturedUser ? await snapshotModuleSource(executor, capturedUser, event.component.id) : undefined });
    }).catch((error) => { diagnosticsStore.health.error = sanitizeText(String((error as Error).message)).slice(0, 1000); });
  });
}
