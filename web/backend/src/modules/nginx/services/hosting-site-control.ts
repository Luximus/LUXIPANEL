import { AsyncLocalStorage } from "node:async_hooks";
import type { Executor } from "../../../shared/executor/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { PrivilegeDropExecutor } from "../../../shared/executor/privilege-drop-executor.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { getTenantEnvelope, isHostingSession, isTenantDomainRoot } from "../../../shared/tenant/tenant-scope.js";
import type { SiteForm, NginxSiteSummary } from "../models/nginx.model.js";
import { hostingPhpSocket } from "../../hosting/services/hosting-php-policy.js";
const guided = new AsyncLocalStorage<boolean>();
export function hostingSiteExecutor(executor: Executor): Executor {
  const user = getContextUser();
  if (!isHostingSession(user)) return executor;
  if (!(executor instanceof PrivilegeDropExecutor)) return executor; // already inside a bounded service recipe
  const service = executor.trustedServiceExecutorFor(user!.owner ?? "");
  if (!service) throw new ForbiddenError("Hosting site service identity mismatch");
  return service;
}
export function ownedHostingSites<T extends { root?: string | null }>(sites: T[]): T[] {
  const user = getContextUser();
  if (!isHostingSession(user)) return sites;
  const envelope = getTenantEnvelope(user!);
  return sites.filter(site => isTenantDomainRoot(envelope, site.root));
}
export function withGuidedHostingSite<T>(fn: () => T): T { return guided.run(true, fn); }
export function requireGuidedHostingWrite(): void {
  if (isHostingSession(getContextUser()) && !guided.getStore()) throw new ForbiddenError("Hosting sites require the guided form");
}
export function validateHostingSiteForm(form: SiteForm): SiteForm {
  const user = getContextUser();
  if (!isHostingSession(user)) return form;
  const envelope = getTenantEnvelope(user!);
  if (form.kind === "proxy" || form.extraDirectives || form.redirectTo || !isTenantDomainRoot(envelope, form.root)) throw new ForbiddenError("Site configuration is outside the hosting account");
  if (form.kind === "php" && user!.hostingPolicy?.runtime) {
    if (!user!.hostingPolicy.capabilities?.php) throw new ForbiddenError("Isolated PHP runtime is unavailable for this hosting account");
    return { ...form, phpSocket: `unix:${hostingPhpSocket({ username: envelope.owner, homeRoot: envelope.homeRoot })}` };
  }
  return form;
}
export function assertHostingSiteOwned(sites: NginxSiteSummary[], name: string): void {
  if (isHostingSession(getContextUser()) && !ownedHostingSites(sites).some(site => site.name === name)) throw new ForbiddenError("Site is outside the hosting account");
}
