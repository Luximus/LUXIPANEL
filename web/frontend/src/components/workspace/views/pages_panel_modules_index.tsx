// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/modules/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Modules visibility — /panel/modules
 * Grid for showing or hiding preinstalled modules in the sidebar.
 */
import PanelLayout from "../module-frame";
import { getPageMessages } from "../view-context";
export default function pages_panel_modules_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["modules", "moduleCatalog"]);

  return (
    <Fragment>
      <PanelLayout title={t.modules.pageTitle} activeModule="modules">
        <div className="lxp-modules-page space-y-6 pt-5">
          <div className="flex gap-1 overflow-x-auto border-b border-border">
            <button
              id="tab-all"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:text-primary/80"
            >
              <span>{t.modules.tabs.all}</span>
              <span
                id="tab-all-count"
                className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              id="tab-modules"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{t.modules.tabs.modules}</span>
              <span
                id="tab-modules-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              id="tab-integrations"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{t.modules.tabs.integrations}</span>
              <span
                id="tab-integrations-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
            <button
              id="tab-installed"
              className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
            >
              <span>{t.modules.tabs.visible}</span>
              <span
                id="tab-installed-count"
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
              >
                —
              </span>
            </button>
          </div>

          <div className="sticky top-0 z-20 -mx-5 border-b border-border bg-background px-5 pb-4 pt-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="relative min-w-0 flex-1">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"></i>
                <input
                  id="mod-search"
                  type="search"
                  placeholder={t.modules.search.placeholder}
                  className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
                />
              </div>

              <div className="relative shrink-0 md:w-52">
                <i className="ti ti-category absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"></i>
                <select
                  id="category-filter-select"
                  aria-label={t.modules.categories.label}
                  className="w-full appearance-none rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-primary/60"
                >
                  <option value="all" data-label={t.modules.categories.all}>
                    {t.modules.categories.all}
                  </option>
                  <option
                    value="communication"
                    data-label={t.modules.categories.communication}
                  >
                    {t.modules.categories.communication}
                  </option>
                  <option
                    value="infrastructure"
                    data-label={t.modules.categories.infrastructure}
                  >
                    {t.modules.categories.infrastructure}
                  </option>
                  <option
                    value="security"
                    data-label={t.modules.categories.security}
                  >
                    {t.modules.categories.security}
                  </option>
                  <option
                    value="developer"
                    data-label={t.modules.categories.developer}
                  >
                    {t.modules.categories.developer}
                  </option>
                </select>
                <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"></i>
              </div>

              <div className="relative shrink-0 md:w-44">
                <i className="ti ti-eye absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"></i>
                <select
                  id="status-filter-select"
                  aria-label={t.modules.statusFilter.label}
                  className="w-full appearance-none rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-sm outline-none transition-colors focus:border-primary/60"
                >
                  <option value="all" data-label={t.modules.statusFilter.all}>
                    {t.modules.statusFilter.all}
                  </option>
                  <option
                    value="installed"
                    data-label={t.modules.statusFilter.visible}
                  >
                    {t.modules.statusFilter.visible}
                  </option>
                  <option
                    value="not-installed"
                    data-label={t.modules.statusFilter.hidden}
                  >
                    {t.modules.statusFilter.hidden}
                  </option>
                </select>
                <i className="ti ti-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none"></i>
              </div>
            </div>
          </div>

          <div
            id="mod-grid"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 6 }).map(() => (
              <Fragment>
                <div className="animate-pulse rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-muted"></div>
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 w-32 rounded bg-muted"></div>
                      <div className="h-3 w-48 rounded bg-muted"></div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <div className="h-3 w-full rounded bg-muted"></div>
                    <div className="h-3 w-4/5 rounded bg-muted"></div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="h-9 w-40 rounded-xl bg-muted"></div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>

          <div
            id="mod-empty"
            className="hidden flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <i className="ti ti-puzzle-off text-3xl text-muted-foreground"></i>
            </div>
            <p className="font-medium">{t.modules.empty.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.modules.empty.subtitle}
            </p>
          </div>
        </div>
      </PanelLayout>

      <script
        id="modules-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["modules"]) }}
      ></script>
      <script
        id="modules-catalog-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["moduleCatalog"]) }}
      ></script>

      <style>{`{"\\n  /* Modules page: <main> tiene p-5 (20px top) y eso crea un hueco visible\\n     entre el topbar y la fila sticky. Quitamos solo el padding-top en esta\\n     página (el pt-5 del wrapper compensa el espacio del h1). Scoped con\\n     :has() para no afectar a otras páginas del panel. */\\n  main:has(> .lxp-modules-page) {\\n    padding-top: 0;\\n  }\\n"}`}</style>
    </Fragment>
  );
}
