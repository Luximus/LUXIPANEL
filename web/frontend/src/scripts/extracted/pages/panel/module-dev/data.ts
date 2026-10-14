import { createTablePages } from "/scripts/extracted/lib/table-pages.js";
// Module-dev page — data loading (modules / links / previews) + stale banner.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { state } from "./state";
import type { DevModulesPayload, MarketplaceLink, PreviewMeta } from "./state";
import { t, showToast, $, fmtDate } from "./dom";
import { renderModules } from "./table-bridge";
import { renderLinks, renderPreviews } from "./render";
const modulePages = createTablePages({ tableId: "module-dev-table", events: window, scope: resolveTargetScope, reload: () => loadModules(), field: "auto", aliases:{modulo:"coalesce:name,code",codigo:"code",estado:"reviewStatus",actualizadoTs:"updatedAt"},values:()=>({estado:Object.fromEntries(["enviado","revision","correccion","publico","inactivo","rechazado","borrador","suspendido"].map(status=>[t(`states.${status}`,status),status]))}) });

// ── Carga de datos ───────────────────────────────────────────────────────────
export async function loadAll() {
  await Promise.all([loadModules(), loadLinks(), loadPreviews()]);
  // Re-render cruzado: los botones de la tabla dependen de los links y la
  // sección de links depende de qué módulos existen ya en LP.
  renderModules();
  renderLinks();
}

export async function loadModules() {
  const res = await modulePages.read<DevModulesPayload>(params => api.get<DevModulesPayload>("/api/module-dev/modules", {params}));
  if (res.code === "TARGET_SCOPE_CHANGED") return;
  if (!res.ok) {
    showToast(res.error ?? t("table.loadError", "No se pudieron cargar tus módulos."), false);
    state.modules = [];
    state.stale = true;
    renderModules();
    updateStaleBanner(true, null);
    return;
  }
  state.modules = res.data?.modules ?? [];
  state.stale = Boolean(res.data?.stale);
  state.marketplaceAvailable = res.data?.marketplaceAvailable !== false;
  state.fetchedAt = res.data?.fetchedAt ?? null;
  updateStaleBanner(state.stale, state.fetchedAt);
  $("md-local")?.classList.toggle("hidden", state.marketplaceAvailable);
  renderModules();
}

export async function loadLinks() {
  const res = await api.get<{ links: MarketplaceLink[] }>("/api/module-dev/links");
  state.links = res.ok ? (res.data?.links ?? []) : [];
  renderLinks();
}

export async function loadPreviews() {
  const res = await api.get<{ previews: PreviewMeta[] }>("/api/module-dev/preview");
  state.previews = res.ok ? (res.data?.previews ?? []) : [];
  renderPreviews();
}

export function updateStaleBanner(stale: boolean, fetchedAt: string | null) {
  const banner = $("md-stale");
  if (!banner) return;
  banner.classList.toggle("hidden", !stale);
  banner.classList.toggle("flex", stale);
  const at = $("md-stale-at");
  if (at) at.textContent = fmtDate(fetchedAt);
}
