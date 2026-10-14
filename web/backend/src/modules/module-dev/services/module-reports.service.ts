import { createHash } from "node:crypto";
import { publicGithubPages, CANONICAL_GITHUB, githubSince } from "../../../shared/github/public-api.js";
import { ownedModuleIds, accessibleDetail } from "./logs-access.service.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import type { Executor } from "../../../shared/executor/types.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { moduleDiagnosticContext, moduleEvents, persistModuleEvent } from "../../../shared/diagnostics/module-events.js";
import { sanitizePublicText, fingerprint } from "../../../shared/diagnostics/sanitize.js";
import { diagnosticsStore } from "../../../shared/diagnostics/store.js";
import { repairBridge } from "../../../shared/diagnostics/repair-bridge.js";
import { dataStore } from "../../../shared/data-store/index.js";
import { localExecutor } from "../../../shared/executor/index.js";
interface GithubIssue { id: number; number: number; title: string; body?: string; created_at: string; updated_at: string; html_url: string; pull_request?: unknown; labels: { name: string }[]; user: { login: string } }
export async function reportModuleIds(executor: Executor, user: SessionUser): Promise<string[]> {
  // A shared installation/account key cannot prove which Linux user authored a module.
  return ownedModuleIds(executor, user);
}

export async function syncModuleReports(executor: Executor, user: SessionUser): Promise<void> {
  const owned = new Set(await reportModuleIds(executor, user)); if (!owned.size) return;
  const after = githubSince();
  const issues = await publicGithubPages<GithubIssue>(`${CANONICAL_GITHUB}/issues?state=all&labels=module-report&sort=updated&since=${encodeURIComponent(after)}`);
  const policies = (await diagnosticsStore.config("instance")).repairPolicies;
  const existing = await moduleEvents(executor, user.userId);
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const id = issue.labels.map((label) => label.name.match(/^module:([a-z][a-z0-9-]{2,38})$/)?.[1]).find((value) => value && owned.has(value));
    if (!id || existing.some((event) => event.id === `github-issue-${issue.id}` && event.timestamp === issue.updated_at)) continue;
    const metadata = issue.body?.match(/<!-- luxipanel-report (\{[^\n]*\}) -->/);
    let version = "unknown"; try { const parsed = JSON.parse(metadata?.[1] || "{}"); if (/^\d+\.\d+\.\d+$/.test(parsed.version)) version = parsed.version; } catch { /* public user input */ }
    const severity = issue.labels.some((label) => label.name === "warning") ? "warn" : "error";
    const message = sanitizePublicText(issue.title).slice(0, 2000);
    const component = { kind: "module" as const, id, version, origin: "report" as const, issueNumber: issue.number, reporter: issue.user.login };
    runWithExecutor(executor, () => moduleDiagnosticContext.run(component, () => persistModuleEvent({ id: `github-issue-${issue.id}`, scope: `modules:${executor.target.id}:${user.userId}`, timestamp: issue.updated_at, severity, source: "github-report", module: id, message, component,
      fingerprint: fingerprint(severity, "github-report", `${id}:${version}`, message), details: { issueNumber: issue.number, issueUrl: issue.html_url, body: sanitizePublicText(issue.body || "").slice(0, 16000) }, historical: !policies?.[`module:${executor.target.id}:${user.userId}:${id}`]?.enabled || !issue.created_at || issue.created_at < policies[`module:${executor.target.id}:${user.userId}:${id}`]!.since })), user.userId, user);
  }
}
export async function publishIncidentReport(executor: Executor, user: SessionUser, administrator: SessionUser, view: "luxipanel" | "modules", id: string) {
  const detail = await accessibleDetail(view, executor, user, id); if (!detail.incident) throw new Error("Incidencia no encontrada");
  const links = dataStore<{ id?: string; fingerprint: string; issueNumber: number; issueUrl: string; moduleId: string }>(localExecutor, "module-dev", `reports-${administrator.userId}`, { idStrategy: "uuid" });
  const key = createHash("sha256").update(`${executor.target.id}:${user.userId}:${id}`).digest("hex");
  const prior = await links.get(key); if (prior) return { issueUrl: prior.issueUrl, issueNumber: prior.issueNumber };
  const event = detail.incident.sample; const config = await diagnosticsStore.config("instance");
  return repairBridge.github().withAuth(config.credentialId, async (auth) => {
    const actor = await auth.api("GET", "/user") as { login?: string }; if (!actor.login) throw new Error("Cuenta GitHub no verificada");
    const component = event.component?.kind === "module" ? event.component.id : "luxipanel";
    const metadata = { moduleId: component, version: event.component?.version || "unknown", fingerprint: id, severity: event.severity };
    const body = `<!-- luxipanel-report ${JSON.stringify(metadata)} -->\n\nComponente: ${component}\nVersión: ${metadata.version}\nGravedad: ${event.severity}\n\n${sanitizePublicText(event.message)}\n\nReporte de @${actor.login}. Las evidencias completas permanecen privadas en la instalación.`;
    const issue = await auth.api("POST", `${CANONICAL_GITHUB}/issues`, { title: `[${component}] ${sanitizePublicText(event.message).slice(0, 160)}`, body }) as { number: number; html_url: string };
    if (!/^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/issues\/\d+$/.test(issue.html_url)) throw new Error("GitHub no devolvió un reporte válido");
    await links.create({ id: key, fingerprint: id, issueNumber: issue.number, issueUrl: issue.html_url, moduleId: component });
    return { issueUrl: issue.html_url, issueNumber: issue.number };
  });
}
