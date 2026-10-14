/**
 * Shared driver for the <ModuleDepsBanner> component.
 *
 * Checks a module's system dependencies against the generic backend endpoint
 * (`GET /api/system-deps/:module`), fills the banner with the missing
 * components and wires the "Install now" button to the shared install modal
 * (`runInstall`, which routes sudo prompts through `withSudo`). Reusable by
 * any module page (mail, cron, databases, …) — same pattern the firewall
 * page uses with its bespoke `#fw-not-installed` banner.
 *
 * Backend contract:
 *   GET  status  → { ok, data: { module, dependencies: DepInfo[],
 *                    allRequiredInstalled, anyInstalled } }
 *                  404 { ok:false, error:"UNKNOWN_MODULE" } → no deps: banner
 *                  stays hidden and the page proceeds normally.
 *   POST install → { ok, code?, data: { results, output, code? } }
 *                  (compatible with runInstall/withSudo).
 */
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { runInstall, bindInstallModalClose } from "/scripts/extracted/lib/install-modal.js?v=1";
import { escapeHtml } from "/scripts/extracted/lib/escape.js";

export interface DepInfo {
  key: string;
  label: string;
  description?: string;
  optional: boolean;
  installed: boolean;
  commands: string[];
  packages: string[];
  units?: string[];
}

export interface ModuleDepsStatus {
  module: string;
  dependencies: DepInfo[];
  allRequiredInstalled: boolean;
  anyInstalled: boolean;
}

export interface ModuleDepsOptions {
  module: string;
  /** Install endpoint (POST). Default: `/api/system-deps/${module}/install`. */
  installEndpoint?: string;
  /** Status endpoint (GET). Default: `/api/system-deps/${module}`. */
  statusEndpoint?: string;
  /** Render the optional-components section. Default: true. */
  showOptional?: boolean;
  /** Called when every required dependency is installed. */
  onReady?: (s: ModuleDepsStatus) => void;
  /** Called when at least one required dependency is missing. */
  onMissing?: (s: ModuleDepsStatus) => void;
}

interface ModuleState {
  opts: ModuleDepsOptions;
  status: ModuleDepsStatus | null;
  installing: boolean;
}

// Per-module runtime state so the (once-bound) click handlers always act on
// the latest fetched status + options. Keeps init re-entrant: calling
// initModuleDeps again just refreshes data without stacking listeners.
const states = new Map<string, ModuleState>();

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// Escape backend/server-provided strings before innerHTML interpolation.
const esc = escapeHtml;

function txt(module: string, key: string, fallback: string): string {
  return el(`deps-banner-${module}`)?.getAttribute(`data-txt-${key}`) || fallback;
}

function statusEndpointOf(opts: ModuleDepsOptions): string {
  return opts.statusEndpoint ?? `/api/system-deps/${opts.module}`;
}

function installEndpointOf(opts: ModuleDepsOptions): string {
  return opts.installEndpoint ?? `/api/system-deps/${opts.module}/install`;
}

function missingRequiredKeys(status: ModuleDepsStatus): string[] {
  return status.dependencies.filter((d) => !d.optional && !d.installed).map((d) => d.key);
}

function depRowHtml(
  module: string,
  dep: DepInfo,
  withInstallButton: boolean,
  withOptionalBadge = false,
): string {
  const badge = dep.installed
    ? `<span class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500"><i class="ti ti-check text-sm"></i>${esc(txt(module, "status-installed", "Installed"))}</span>`
    : `<span class="inline-flex items-center gap-1 rounded-md bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400"><i class="ti ti-x text-sm"></i>${esc(txt(module, "status-missing", "Not installed"))}</span>`;
  // "Optional" tag for rows in the optional-components card. One-of deps
  // rendered in the MAIN list never get it: there they are a requirement.
  const optionalBadge = withOptionalBadge
    ? `<span class="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">${esc(txt(module, "status-optional", "Optional"))}</span>`
    : "";
  const icon = dep.installed
    ? `<i class="ti ti-circle-check text-emerald-500"></i>`
    : `<i class="ti ti-circle-x text-yellow-600 dark:text-yellow-400"></i>`;
  const packages = dep.packages?.length
    ? `<span class="text-xs font-mono text-muted-foreground">${esc(dep.packages.join(" "))}</span>`
    : "";
  const description = dep.description
    ? `<span class="text-xs text-muted-foreground">${esc(dep.description)}</span>`
    : "";
  const installBtn = withInstallButton && !dep.installed
    ? `<button data-dep-key="${esc(dep.key)}" class="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"><i class="ti ti-download text-sm"></i>${esc(txt(module, "btn-install", "Install"))}</button>`
    : "";
  return `
    <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2" data-dep-row="${esc(dep.key)}">
      <div class="flex flex-wrap items-center gap-2">
        ${icon}
        <span class="text-sm font-medium">${esc(dep.label)}</span>
        ${packages}
        ${description}
      </div>
      <div class="flex items-center gap-2">${optionalBadge}${badge}${installBtn}</div>
    </div>`;
}

/**
 * Swap the banner heading/description between the generic "required missing"
 * texts (server-rendered) and the one-of variants. The original texts are
 * stashed in dataset the first time so modes can flip back and forth.
 */
function setBannerTexts(module: string, oneOf: boolean): void {
  const titleEl = el(`deps-banner-title-${module}`);
  const descEl = el(`deps-banner-desc-${module}`);
  for (const [node, key, fallback] of [
    [titleEl, "one-of-title", "At least one of these components is required"],
    [descEl, "one-of-description", "Install one of the following components to enable this module."],
  ] as const) {
    if (!node) continue;
    if (node.dataset.defaultText === undefined) node.dataset.defaultText = node.textContent ?? "";
    node.textContent = oneOf ? txt(module, key, fallback) : node.dataset.defaultText;
  }
}

function render(state: ModuleState): void {
  const { opts, status } = state;
  const module = opts.module;
  const banner = el(`deps-banner-${module}`);
  const list = el(`deps-list-${module}`);
  const optionalSection = el(`deps-optional-${module}`);
  const optionalList = el(`deps-optional-list-${module}`);
  const installBtn = el(`deps-install-${module}`) as HTMLButtonElement | null;
  if (!banner || !status) return;

  const required = status.dependencies.filter((d) => !d.optional);
  const optional = status.dependencies.filter((d) => d.optional);
  const missingRequired = required.filter((d) => !d.installed);
  // requiresOneOf semantics (e.g. databases): the backend marks every member
  // `optional` but flips `allRequiredInstalled` to false until AT LEAST ONE is
  // installed. No required dep is missing, yet the module is unusable — show
  // the candidates in the MAIN list with a per-dep install button each.
  const oneOfMode = !status.allRequiredInstalled && missingRequired.length === 0;
  const showOptional = (opts.showOptional ?? true) && optional.length > 0;

  if (status.allRequiredInstalled) {
    banner.classList.add("hidden");
  } else {
    banner.classList.remove("hidden");
    setBannerTexts(module, oneOfMode);
    if (oneOfMode) {
      // The main "Install now" button would install an empty required set —
      // hide it; each candidate row carries its own install button instead.
      installBtn?.classList.add("hidden");
      if (list) {
        list.innerHTML = optional
          .filter((d) => !d.installed)
          .map((d) => depRowHtml(module, d, true))
          .join("");
      }
    } else {
      installBtn?.classList.remove("hidden");
      if (list) list.innerHTML = required.map((d) => depRowHtml(module, d, false)).join("");
    }
  }

  if (optionalSection) {
    // Only surface optional components when at least one is still missing;
    // a fully-installed optional set needs no call to action. In one-of mode
    // the missing deps already live in the main list — don't duplicate them.
    const anyOptionalMissing = optional.some((d) => !d.installed);
    optionalSection.classList.toggle("hidden", !(showOptional && anyOptionalMissing && !oneOfMode));
    if (optionalList && showOptional && !oneOfMode) {
      optionalList.innerHTML = optional.map((d) => depRowHtml(module, d, true, true)).join("");
    }
  }
}

function showCheckError(module: string): void {
  const banner = el(`deps-banner-${module}`);
  const list = el(`deps-list-${module}`);
  const installBtn = el(`deps-install-${module}`);
  if (!banner) return;
  banner.classList.remove("hidden");
  installBtn?.classList.add("hidden"); // don't offer installs we can't verify
  if (list) {
    list.innerHTML = `<p class="text-sm font-medium">${esc(txt(module, "check-error", "Could not verify the module's components."))}</p>`;
  }
}

async function fetchStatus(
  opts: ModuleDepsOptions,
): Promise<{ status: ModuleDepsStatus | null; unknownModule: boolean }> {
  const res = await api.get<ModuleDepsStatus>(statusEndpointOf(opts));
  if (!res.ok) {
    // 404 UNKNOWN_MODULE → the module has no registered deps: nothing to show.
    const unknownModule = res.error === "UNKNOWN_MODULE";
    return { status: null, unknownModule };
  }
  const data = res.data as ModuleDepsStatus;
  if (!data || !Array.isArray(data.dependencies)) return { status: null, unknownModule: false };
  return { status: data, unknownModule: false };
}

async function installKeys(state: ModuleState, keys: string[]): Promise<void> {
  if (state.installing || keys.length === 0) return;
  state.installing = true;
  const module = state.opts.module;
  try {
    await runInstall({
      id: `deps-${module}`,
      endpoint: installEndpointOf(state.opts),
      body: { keys },
      runningText: txt(module, "installing", "Installing… this can take a few minutes."),
      successText: txt(module, "success", "Components installed successfully."),
    });
  } finally {
    state.installing = false;
  }
  // Re-check regardless of the outcome: a partial install may still have
  // added some components.
  await refreshModuleDeps(state.opts);
}

function bindOnce(state: ModuleState): void {
  const module = state.opts.module;
  const banner = el(`deps-banner-${module}`);
  if (!banner || banner.dataset.depsBound === "true") return;
  banner.dataset.depsBound = "true";

  bindInstallModalClose(`deps-${module}`);

  el(`deps-install-${module}`)?.addEventListener("click", () => {
    const status = states.get(module)?.status;
    if (!status) return;
    void installKeys(states.get(module)!, missingRequiredKeys(status));
  });

  // Per-dependency installs (optional card + one-of rows in the main list):
  // rows are re-rendered via innerHTML, so delegate from the (stable) list
  // containers instead of binding each button.
  const onDepClick = (e: Event) => {
    const btn = (e.target as HTMLElement | null)?.closest?.("[data-dep-key]") as HTMLElement | null;
    const key = btn?.getAttribute("data-dep-key");
    const st = states.get(module);
    if (!key || !st) return;
    void installKeys(st, [key]);
  };
  el(`deps-list-${module}`)?.addEventListener("click", onDepClick);
  el(`deps-optional-list-${module}`)?.addEventListener("click", onDepClick);
}

/**
 * Fetch the deps status, update the banner UI and fire onReady/onMissing.
 * Returns the status, or null when the check failed or the module has no
 * registered dependencies.
 */
export async function refreshModuleDeps(opts: ModuleDepsOptions): Promise<ModuleDepsStatus | null> {
  const module = opts.module;
  const state = states.get(module) ?? { opts, status: null, installing: false };
  state.opts = opts;
  states.set(module, state);

  const { status, unknownModule } = await fetchStatus(opts);
  // The page may have been swapped (SPA nav) while the request was in flight.
  const banner = el(`deps-banner-${module}`);
  if (!banner) return status;

  if (!status) {
    if (unknownModule) {
      // No deps registered for this module: keep everything hidden.
      banner.classList.add("hidden");
      el(`deps-optional-${module}`)?.classList.add("hidden");
    } else {
      showCheckError(module);
    }
    return null;
  }

  state.status = status;
  render(state);
  if (status.allRequiredInstalled) opts.onReady?.(status);
  else opts.onMissing?.(status);
  return status;
}

/**
 * Wire the banner (idempotent) and run the first status check.
 * Call it from the page script on load; call `refreshModuleDeps` afterwards
 * to re-check (e.g. after an external action that may have installed deps).
 */
export async function initModuleDeps(opts: ModuleDepsOptions): Promise<ModuleDepsStatus | null> {
  const module = opts.module;
  const state = states.get(module) ?? { opts, status: null, installing: false };
  state.opts = opts;
  states.set(module, state);
  bindOnce(state);
  return refreshModuleDeps(opts);
}
