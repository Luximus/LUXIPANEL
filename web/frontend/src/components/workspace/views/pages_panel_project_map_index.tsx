// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/project-map/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

/** Read-only explorer of the LUXIPANEL source checkout. */
import PanelLayout from "../module-frame";
import { adminRedirect, getPageMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
export default function pages_panel_project_map_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const denied = adminRedirect(Astro);
  if (denied) return denied;
  const t = getPageMessages(Astro, ["projectMap"]).projectMap;
  const locale = localeFromRequest(Astro.request);

  return (
    <Fragment>
      <PanelLayout title={t.title} activeModule="module-dev">
        <div
          id="project-explorer-root"
          data-locale={locale}
          data-messages={JSON.stringify(t)}
          className="flex min-h-0 flex-col gap-4"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-primary">
                {t.sourceLabel}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">
                {t.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.description}
              </p>
            </div>
            <button
              id="pe-refresh"
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
            >
              <i className="ti ti-refresh text-base" aria-hidden="true"></i>{" "}
              {t.refreshTree}
            </button>
          </header>

          <nav
            className="flex flex-wrap items-center gap-1.5"
            aria-label={t.mainRoutes}
          >
            <button
              type="button"
              data-project-jump="backend/src/modules"
              className="rounded-full border border-border px-3 py-1.5 font-mono text-[11px] hover:border-primary/60 hover:text-primary"
            >
              {t.backendModules}
            </button>
            <button
              type="button"
              data-project-jump="frontend/src/pages/panel"
              className="rounded-full border border-border px-3 py-1.5 font-mono text-[11px] hover:border-primary/60 hover:text-primary"
            >
              {t.frontendScreens}
            </button>
            <button
              type="button"
              data-project-jump="backend/src/shared"
              className="rounded-full border border-border px-3 py-1.5 font-mono text-[11px] hover:border-primary/60 hover:text-primary"
            >
              {t.dataServices}
            </button>
            <button
              type="button"
              data-project-jump="backend/src/modules/module-dev/routes"
              className="rounded-full border border-border px-3 py-1.5 font-mono text-[11px] hover:border-primary/60 hover:text-primary"
            >
              {t.apiRoutes}
            </button>
            <button
              type="button"
              data-project-jump="scripts"
              className="rounded-full border border-border px-3 py-1.5 font-mono text-[11px] hover:border-primary/60 hover:text-primary"
            >
              {t.scripts}
            </button>
          </nav>

          <div className="grid min-h-[34rem] min-w-0 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]">
            <aside
              className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r"
              aria-label={t.treeLabel}
            >
              <div className="border-b border-border p-3">
                <label
                  htmlFor="pe-search"
                  className="mb-1.5 block text-xs font-semibold"
                >
                  {t.searchLabel}
                </label>
                <div className="relative">
                  <i
                    className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                    aria-hidden="true"
                  ></i>
                  <input
                    id="pe-search"
                    type="search"
                    autoComplete="off"
                    placeholder={t.searchPlaceholder}
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <p
                  id="pe-search-status"
                  className="mt-1.5 text-[11px] text-muted-foreground"
                  role="status"
                >
                  {t.searchHint}
                </p>
              </div>
              <div
                id="pe-tree"
                className="max-h-80 min-h-0 flex-1 overflow-auto px-2 py-2 lg:max-h-[46rem]"
                role="tree"
                aria-label={t.filesFolders}
              ></div>
              <div
                id="pe-results"
                className="hidden max-h-80 min-h-0 flex-1 overflow-auto px-2 py-2 lg:max-h-[46rem]"
                role="listbox"
                aria-label={t.searchResults}
              ></div>
            </aside>

            <section
              className="flex min-h-0 min-w-0 flex-col"
              aria-label={t.selectedContent}
            >
              <div className="border-b border-border px-4 py-3">
                <nav
                  id="pe-breadcrumb"
                  className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-muted-foreground"
                  aria-label={t.currentPath}
                ></nav>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="pe-title"
                    className="min-w-0 truncate text-base font-semibold"
                  >
                    LUXIPANEL
                  </h2>
                  <span
                    id="pe-meta"
                    className="font-mono text-[11px] text-muted-foreground"
                  ></span>
                </div>
              </div>
              <div
                id="pe-message"
                className="hidden px-4 py-8 text-sm text-muted-foreground"
                role="status"
              ></div>
              <div
                id="pe-folder"
                className="min-h-0 flex-1 overflow-auto p-3"
                aria-label={t.folderContent}
              ></div>
              <div
                id="pe-code-wrap"
                className="hidden min-h-0 flex-1 overflow-auto bg-background"
                aria-label={t.codePreview}
              >
                <div className="flex min-w-max font-mono text-xs leading-5">
                  <pre
                    id="pe-line-numbers"
                    className="sticky left-0 m-0 select-none border-r border-border bg-card px-3 py-3 text-right text-muted-foreground/65"
                    aria-hidden="true"
                  ></pre>
                  <pre className="m-0 min-w-0 px-4 py-3">
                    <code id="pe-code" className="whitespace-pre"></code>
                  </pre>
                </div>
              </div>
            </section>
          </div>
          <p className="text-xs text-muted-foreground">{t.readOnlyNote}</p>
        </div>
      </PanelLayout>
    </Fragment>
  );
}
