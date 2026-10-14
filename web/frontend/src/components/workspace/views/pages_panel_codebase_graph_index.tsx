// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/codebase-graph/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import CodebaseGraphView from "../CodebaseGraphView";
import PanelLayout from "../module-frame";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import SettingsSectionLayout from "./components_ui_SettingsSectionLayout";
import { getPageMessages, moduleAccessRedirect } from "../view-context";
import { localeFromRequest } from "../view-context";
export default function pages_panel_codebase_graph_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  // E-11: guarda de acceso por módulo compartida (antes copiada por página).
  const denied = moduleAccessRedirect(Astro, "codebase-graph");
  if (denied) return denied;
  const t = getPageMessages(Astro, ["codebaseGraph"]);
  const g = t.codebaseGraph;
  const locale = localeFromRequest(Astro.request);
  const user = Astro.locals.user;
  const canOpenOriginal =
    user?.kind === "admin" && (!user.targetId || user.targetId === "local");
  const graphView = Astro.url.searchParams.get("workspaceView");
  const graphSettingsOnly = Astro.url.searchParams.has("settingsOverlay");
  const isolatedGraphView =
    Astro.url.searchParams.get("embed") === "1" &&
    ["graph", "symbols"].includes(graphView ?? "") &&
    (graphView !== "graph" || canOpenOriginal);
  const showGraphView = (view: string) =>
    !graphSettingsOnly && (!isolatedGraphView || graphView === view);
  const graphSettingsSections = [
    { id: "explorer", label: g.explorer, icon: "ti-sitemap" },
    { id: "related", label: g.related, icon: "ti-apps" },
    ...(user?.kind === "admin"
      ? [{ id: "remote", label: g.remoteViewer, icon: "ti-network" }]
      : []),
  ];

  return (
    <Fragment>
      <PanelLayout title={g.pageTitle} activeModule="codebase-graph" fullBleed>
        <div slot="title-actions">
          <ViewSettingsModal
            id="graph-settings-modal"
            title={g.settingsTitle}
            buttonLabel={g.settingsButton}
            description={g.settingsDescription}
            variant="drawer"
            hideFooter={true}
          >
            <SettingsSectionLayout
              id="graph-settings"
              label={g.sectionsLabel}
              sections={graphSettingsSections}
            >
              <section
                id="graph-settings-panel-explorer"
                data-lxp-settings-panel="explorer"
                role="tabpanel"
                aria-labelledby="graph-settings-tab-explorer"
                className="space-y-4 text-sm"
              >
                <h2 className="font-semibold">{g.explorer}</h2>
                <label className="flex items-center gap-3">
                  {g.resultLimit}
                  <select
                    id="cg-result-limit"
                    className="rounded-lg border border-border bg-background px-2 py-1"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">{g.queriesNote}</p>
              </section>
              <section
                id="graph-settings-panel-related"
                data-lxp-settings-panel="related"
                role="tabpanel"
                aria-labelledby="graph-settings-tab-related"
                className="hidden space-y-4 text-sm"
              >
                <h2 className="font-semibold">{g.relatedModules}</h2>
                <div className="flex flex-col gap-2">
                  <a
                    href="/panel/assistant"
                    className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                  >
                    <i className="ti ti-sparkles mr-2"></i>
                    {g.assistantProjects}
                  </a>
                  <a
                    href="/panel/files"
                    className="rounded-lg border border-border px-3 py-2 hover:bg-accent"
                  >
                    <i className="ti ti-folder mr-2"></i>
                    {g.projectFiles}
                  </a>
                </div>
              </section>
              {user?.kind === "admin" && (
                <Fragment>
                  <section
                    id="graph-settings-panel-remote"
                    data-lxp-settings-panel="remote"
                    role="tabpanel"
                    aria-labelledby="graph-settings-tab-remote"
                    className="hidden space-y-4 text-sm"
                  >
                    <h2 className="font-semibold">{g.remoteViewer}</h2>
                    <p className="text-xs text-muted-foreground">
                      {g.remoteHelp.replace("{url}", "http://127.0.0.1:19749/")}
                    </p>
                    <code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                      ssh -L 19749:127.0.0.1:9749 user@server
                    </code>
                  </section>
                </Fragment>
              )}
            </SettingsSectionLayout>
          </ViewSettingsModal>
        </div>
        <div
          id="codebase-graph-root"
          data-locale={locale}
          data-messages={JSON.stringify(g)}
          data-workspace-isolated-view={
            isolatedGraphView ? graphView : undefined
          }
          className="flex h-full min-h-0 flex-col gap-3 p-4"
        >
          {canOpenOriginal && !isolatedGraphView && !graphSettingsOnly && (
            <Fragment>
              <div
                className="flex shrink-0 gap-2"
                role="tablist"
                aria-label={g.graphViews}
              >
                <button
                  id="cg-show-original"
                  type="button"
                  role="tab"
                  aria-selected="true"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  {g.visualGraph}
                </button>
                <button
                  id="cg-show-explorer"
                  type="button"
                  role="tab"
                  aria-selected="false"
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  {g.symbolExplorer}
                </button>
              </div>
            </Fragment>
          )}
          {canOpenOriginal && showGraphView("graph") && (
            <Fragment>
              <section
                id="cg-original"
                role="tabpanel"
                className="relative min-h-[500px] flex-1 overflow-hidden rounded-xl border border-border bg-card"
              >
                <CodebaseGraphView />
              </section>
            </Fragment>
          )}
          {showGraphView("symbols") && (
            <Fragment>
              <div
                id="cg-explorer"
                role="tabpanel"
                className={classList([
                  "space-y-5",
                  canOpenOriginal && !isolatedGraphView && "hidden",
                ])}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl font-semibold">{g.explorerTitle}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {g.explorerDescription}
                    </p>
                  </div>
                </div>
                <div
                  id="cg-error"
                  role="alert"
                  className="hidden rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                ></div>
                <section className="rounded-xl border border-border bg-card p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium">
                      {g.project}
                      <select
                        id="cg-project"
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="">{g.loadingProjects}</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium">
                      {g.query}
                      <select
                        id="cg-tool"
                        className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        <option value="get_architecture">
                          {g.architecture}
                        </option>
                        <option value="search_graph">{g.searchSymbol}</option>
                        <option value="trace_path">{g.traceCalls}</option>
                        <option value="get_code_snippet">{g.readSymbol}</option>
                        <option value="index_status">{g.indexStatus}</option>
                        <option value="detect_changes">
                          {g.changesSinceIndex}
                        </option>
                      </select>
                    </label>
                  </div>
                  <label
                    id="cg-query-wrap"
                    className="mt-4 hidden text-sm font-medium"
                  >
                    {g.searchTerm}
                    <input
                      id="cg-query"
                      type="search"
                      autoComplete="off"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder={g.searchPlaceholder}
                    />
                  </label>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      id="cg-run"
                      type="button"
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {g.runQuery}
                    </button>
                    <span
                      id="cg-index-state"
                      className="text-xs text-muted-foreground"
                    ></span>
                  </div>
                </section>
                <section className="min-h-64 overflow-hidden rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-4 py-3 text-sm font-semibold">
                    {g.result}
                  </div>
                  <div
                    id="cg-result"
                    className="max-h-[65vh] overflow-auto p-4 text-sm text-muted-foreground"
                  >
                    {g.chooseProjectHint}
                  </div>
                </section>
              </div>
            </Fragment>
          )}
        </div>
      </PanelLayout>
    </Fragment>
  );
}
