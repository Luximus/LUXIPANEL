// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useMemo, useState } from "react";
import { api, scopeHeaders } from "@/lib/api-client";
import { MODULES_INSTALLED_PATH } from "@/lib/api-routes";
import { MODULES_CHANGED_EVENT } from "@/lib/module-events";
import { useAssistantI18n } from "./i18n";

type InstalledModule = {
  id?: string;
  name?: string;
  enabled?: boolean;
};

type ModuleShortcut = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

/**
 * The panel sidebar already is the authoritative, permission-filtered route
 * catalogue. Reading its rendered links means this fallback cannot expose a
 * module hidden by role, display flags or a workspace-specific navigation.
 */
function sidebarShortcuts(): Map<string, ModuleShortcut> {
  const shortcuts = new Map<string, ModuleShortcut>();
  if (typeof document === "undefined") return shortcuts;
  for (const link of document.querySelectorAll<HTMLAnchorElement>("#sidebar a[data-module], #sidebar-mobile a[data-module]")) {
    const id = link.dataset.module?.trim();
    const href = link.getAttribute("href")?.trim();
    if (!id || !href || id === "assistant" || shortcuts.has(id)) continue;
    const icon = link.querySelector("i")?.className?.toString().match(/ti-[\w-]+/)?.[0] ?? "ti-puzzle";
    const label = link.getAttribute("title")?.trim() || link.textContent?.trim() || id;
    shortcuts.set(id, { id, href, label, icon });
  }
  return shortcuts;
}

export function PanelModulesDashboard({
  onOpenProviders,
  onRetryAvailability,
  checkingAvailability,
}: {
  onOpenProviders(): void;
  onRetryAvailability(): void;
  checkingAvailability: boolean;
}) {
  const t = useAssistantI18n().chatTab as unknown as Record<string, string | undefined>;
  const [modules, setModules] = useState<InstalledModule[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [linksVersion, setLinksVersion] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let live = true;
    const refresh = async () => {
      const scope = JSON.stringify(scopeHeaders());
      try {
        const response = await api.get<InstalledModule[]>(MODULES_INSTALLED_PATH);
        if (!live || scope !== JSON.stringify(scopeHeaders())) return;
        setModules(response.ok && Array.isArray(response.data) ? response.data : []);
        setLoadError(!response.ok);
      } catch {
        if (live && scope === JSON.stringify(scopeHeaders())) {
          setModules([]);
          setLoadError(true);
        }
      }
    };
    void refresh();
    const changed = () => setReloadVersion((value) => value + 1);
    for (const event of [MODULES_CHANGED_EVENT, "luxipanel:target-changed", "luxipanel:permissions-changed"]) {
      window.addEventListener(event, changed);
    }
    return () => {
      live = false;
      for (const event of [MODULES_CHANGED_EVENT, "luxipanel:target-changed", "luxipanel:permissions-changed"]) {
        window.removeEventListener(event, changed);
      }
    };
  }, [reloadVersion]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const observe = () => setLinksVersion((value) => value + 1);
    const observer = new MutationObserver(observe);
    const roots = [document.getElementById("sidebar"), document.getElementById("sidebar-mobile")].filter((node): node is HTMLElement => Boolean(node));
    roots.forEach((root) => observer.observe(root, { childList: true, subtree: true }));
    observe();
    return () => observer.disconnect();
  }, []);

  const shortcuts = useMemo(() => {
    const sidebar = sidebarShortcuts();
    return (modules ?? [])
      .filter((module) => module.enabled !== false)
      .map((module) => module.id ? sidebar.get(module.id) : undefined)
      .filter((shortcut): shortcut is ModuleShortcut => Boolean(shortcut));
  }, [modules, linksVersion]);

  const retry = () => {
    setReloadVersion((value) => value + 1);
    onRetryAvailability();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <i className="ti ti-plug-off text-xl" aria-hidden></i>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t.noProvidersTitle ?? "Proveedor IA no disponible"}</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">{t.panelModulesTitle ?? "Continúa desde tus módulos"}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.panelModulesDescription ?? "El chat se habilita cuando un proveedor API o CLI esté listo. Mientras tanto puedes abrir cualquier módulo disponible."}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={retry} disabled={checkingAvailability} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-60">
              <i className={`ti ti-refresh ${checkingAvailability ? "animate-spin" : ""}`} aria-hidden></i>
              {t.retry ?? "Reintentar"}
            </button>
            <button type="button" onClick={onOpenProviders} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              <i className="ti ti-plug-connected" aria-hidden></i>
              {t.goToProviders ?? "Configurar proveedor"}
            </button>
          </div>
        </div>

        <div className="pt-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-px w-5 bg-primary/50" aria-hidden></span>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{t.panelModulesSection ?? "Módulos disponibles"}</h3>
          </div>
          {modules === null ? (
            <div role="status" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-xl border border-border/60 bg-muted/40" />)}
            </div>
          ) : shortcuts.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {shortcuts.map((shortcut) => (
                <a key={shortcut.id} href={shortcut.href} className="group flex min-h-20 items-center gap-3 rounded-xl border border-border/80 bg-card/75 px-3.5 py-3 shadow-sm transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <i className={`ti ${shortcut.icon} text-lg`} aria-hidden></i>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{shortcut.label}</span>
                  <i className="ti ti-arrow-up-right shrink-0 text-base text-muted-foreground transition-colors group-hover:text-primary" aria-hidden></i>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-4 py-9 text-center text-sm text-muted-foreground">
              <i className="ti ti-layout-grid mb-2 block text-2xl text-muted-foreground/55" aria-hidden></i>
              <p>{loadError ? (t.panelModulesLoadError ?? "No se pudieron cargar los módulos disponibles.") : (t.panelModulesEmpty ?? "No hay módulos disponibles para este usuario.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
