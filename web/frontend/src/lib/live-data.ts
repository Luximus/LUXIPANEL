import { api, resolveTargetScope } from "./api-client";
import { browserReadCache } from "./read-cache";
import { browserVersionedData, dataResources, type Freshness } from "./versioned-data";
import { liveDataLabels } from "./live-data-labels";

/** Register a list loader, never a module initializer or an edit-form loader.
 * Controller scopes supply visibility/disposal, so parked drawers retain DOM
 * and drafts but stop subscriptions, timers and refresh requests. */
export function watchModuleData(resources: string[], reload: () => Promise<unknown>, root: HTMLElement, options: { showStatus?: boolean } = {}) {
  const marker = resources.join(",");
  if (root.dataset.liveDataBound === marker) return () => {};
  root.dataset.liveDataBound = marker;
  const id = crypto.randomUUID(), labels = liveDataLabels(document.documentElement.lang);
  const bar = document.createElement("div");
  bar.className = "flex items-center justify-end gap-3 px-3 py-1 text-xs text-muted-foreground";
  bar.dataset.liveDataStatus = resources.join(",");
  const status = document.createElement("span"); status.setAttribute("role", "status");
  const button = document.createElement("button"); button.type = "button"; button.textContent = labels.refresh;
  button.className = "underline underline-offset-2";
  bar.append(status, button);
  if (options.showStatus !== false) (root.closest<HTMLElement>("[data-internal-module]") ?? root.parentElement ?? root).prepend(bar);
  // Mail can have an independently selected server. Its HTTP adapter keeps
  // that selection; only primary-target events/collector jobs belong here.
  const targetScope = resolveTargetScope();
  let mailTarget = "";
  try {if (resources.includes("mail/accounts")) mailTarget = sessionStorage.getItem(`lxp:mail:server:v1:${targetScope}`)?.trim() ?? "";} catch { /* storage unavailable */ }
  const secondaryMail = !!mailTarget;
  let disposed = false, busy = false, dirty = false, enabled = false, revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const freshness = new Map<string, Freshness>();
  const states = new Map<string, Freshness["state"]>();
  const failedAfter = new Map<string, number>();
  const failed = (event: Event) => {
    const resource = (event as CustomEvent).detail?.resource;
    if (resources.includes(resource)) {failedAfter.set(resource, Date.now()/1000); states.set(resource, "stale"); paint();}
  };
  const visible = () => !disposed && root.isConnected && !document.hidden;
  const paint = (override?: Freshness["state"]) => {
    const values = [...states.values()];
    const state = override ?? (["offline", "stale", "updating", "fresh"] as const).find(value => values.includes(value)) ?? "updating";
    const timestamps = [...freshness.values()].map(value => value.collectedAt).filter(value => Number.isFinite(value) && value > 0);
    const collectedAt = timestamps.length ? Math.min(...timestamps) : undefined;
    status.textContent = labels[state] + (collectedAt
      ? ` · ${new Date(collectedAt * 1000).toLocaleTimeString(document.documentElement.lang)}` : "");
    button.disabled = busy;
  };
  paint("updating");
  const invalidate = () => {
    const match = (key: string) => Object.entries(dataResources).some(([path, resource]) => resources.includes(resource) && key.includes(path));
    browserVersionedData().invalidate(match); browserReadCache().invalidate(match);
  };
  const run = async () => {
    if (!visible()) return;
    if (busy) {dirty = true; return;}
    busy = true; dirty = false; paint("updating");
    try { invalidate(); await reload(); }
    catch { for (const resource of resources) states.set(resource, "offline"); paint(); }
    finally { busy = false; button.disabled = false; if (dirty && visible()) schedule(); }
  };
  const schedule = () => {
    if (!visible()) {dirty = true; return;}
    if (!timer) timer = setTimeout(() => {timer = undefined; void run();}, 250);
  };
  const announce = () => window.dispatchEvent(new CustomEvent("lxp:data:subscription", {detail: {id, resources: enabled && visible() ? resources : []}}));
  const resume = () => {
    revision++; announce();
    if (visible()) schedule();
    else {clearTimeout(timer); timer = undefined;}
  };
  const change = (event: Event) => {
    const frame = (event as CustomEvent).detail;
    if (Array.isArray(frame?.resources) && frame.resources.some((key: string) => resources.includes(key))) schedule();
  };
  const update = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!resources.includes(detail?.resource) || !visible()) return;
    if (detail.targetScope !== undefined && detail.targetScope !== targetScope) return;
    if (detail.resource === "mail/accounts" && detail.mailTarget !== undefined && detail.mailTarget !== mailTarget) return;
    const resource = detail.resource as string;
    if (detail.freshness) freshness.set(resource, detail.freshness);
    const value = freshness.get(resource), failedAt = failedAfter.get(resource);
    const stillFailed = failedAt !== undefined && (value?.collectedAt ?? 0) < failedAt;
    if (detail.ok && !stillFailed) failedAfter.delete(resource);
    states.set(resource, detail.ok ? stillFailed ? "stale" : value?.state ?? "fresh" : "offline");
    paint();
  };
  const refresh = async () => {
    if (busy || !visible()) return;
    const epoch = revision; busy = true; paint("updating");
    try {
      if (enabled) {
        for (const resource of resources) {
          const result = await api.post<{job?: {id: string}}>("/api/ui/data/refresh", {resource});
          if (!visible() || epoch !== revision) return;
          if (!result.ok || !result.data?.job?.id) throw new Error("refresh");
          let done = false;
          for (let attempt = 0; attempt < 100 && visible() && epoch === revision; attempt++) {
            const job = await api.get<{state: string}>(`/api/jobs/${result.data.job.id}`);
            if (!visible() || epoch !== revision) return;
            if (!job.ok || ["failed", "unknown"].includes(job.data?.state ?? "unknown")) throw new Error("refresh");
            if (job.data?.state === "done") {done = true; break;}
            // Use the native timer: disposal must still settle this promise.
            await new Promise(resolve => globalThis.setTimeout(resolve, 1000));
          }
          if (!done) throw new Error("refresh");
        }
      }
      if (visible() && epoch === revision) {invalidate(); await reload();}
    } catch {
      if (visible() && epoch === revision) {
        for (const resource of resources) {failedAfter.set(resource, Date.now()/1000); states.set(resource, "stale");}
        paint();
      }
    }
    finally { busy = false; button.disabled = false; if (dirty && visible()) schedule(); }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; delete root.dataset.liveDataBound; revision++; clearTimeout(timer); clearInterval(reconcile); announce(); bar.remove();
    document.removeEventListener("lxp:module:visibility", resume);
    document.removeEventListener("visibilitychange", resume);
    document.removeEventListener("lxp:module:dispose", dispose);
    document.removeEventListener("astro:before-swap", dispose);
    window.removeEventListener("lxp:data:refresh-failed", failed);
    window.removeEventListener("lxp:data:change", change);
    window.removeEventListener("lxp:data:freshness", update);
  };
  button.addEventListener("click", () => void refresh());
  document.addEventListener("lxp:module:visibility", resume);
  document.addEventListener("visibilitychange", resume);
  document.addEventListener("lxp:module:dispose", dispose);
  document.addEventListener("astro:before-swap", dispose);
  window.addEventListener("lxp:data:refresh-failed", failed);
  window.addEventListener("lxp:data:change", change);
  window.addEventListener("lxp:data:freshness", update);
  // Bounded reconciliation covers old targets, missed invalidations and a
  // disconnected channel. No polling of inactive drawers.
  const reconcile = setInterval(() => {if (visible()) {schedule(); void capabilities();}}, 30_000);
  const capabilities = () => api.get<{versionedReads?: boolean; resources?: string[]}>("/api/ui/data/capabilities").then(result => {
    if (disposed) return;
    enabled = !secondaryMail && !!result.ok && result.data?.versionedReads === true && resources.every(key => result.data?.resources?.includes(key));
    announce();
  });
  void capabilities();
  return dispose;
}
