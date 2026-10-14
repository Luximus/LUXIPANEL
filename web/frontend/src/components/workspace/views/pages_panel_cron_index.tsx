// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/cron/index.astro.
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
 * Cron Manager — /panel/cron
 * Scheduled cron jobs powered by AI agents.
 */
import PanelLayout from "../module-frame";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ModalNavbar from "./components_ui_ModalNavbar";
import { getSession, canSeeSidebar } from "../view-context";
import ModuleDepsBanner from "./components_ModuleDepsBanner";
import ScheduleBuilder from "./components_cron_ScheduleBuilder";
import { getPageMessages } from "../view-context";
export default function pages_panel_cron_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["cron", "deps"]);
  const c = t.cron;
  // AI quick-ask bar — same gate as the files module's help bar.
  const user = getSession(Astro.request);
  const canUseAssistant = user ? canSeeSidebar(user, "assistant") : false;
  const isAdmin = user?.kind === "admin";
  const cronView = Astro.url.searchParams.get("workspaceView");
  const isolatedCronView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["jobs", "agents"].includes(cronView ?? "");
  const showCronView = (view: string) => !isolatedCronView || cronView === view;

  return (
    <Fragment>
      <PanelLayout
        title={c.pageTitle}
        activeModule="cron"
        titleInActions
        fullBleed
      >
        {/* Module settings — reuses the panel navbar's "Configuración" action via the
        title-actions slot (canonical ViewSettingsModal pattern, like mail/files). */}
        <div slot="title-actions" className="flex min-w-0 items-center gap-2">
          <h1
            id="panel-topbar-title"
            data-panel-title
            className="shrink-0 text-base font-semibold text-foreground"
          >
            {c.pageTitle}
          </h1>
          <ViewSettingsModal
            id="cron-settings-modal"
            title={c.settings.title}
            description={c.settings.description}
            variant="drawer"
            hideFooter={true}
          >
            <span
              slot="header-actions"
              id="ps-autosave"
              className="mr-2 text-xs text-muted-foreground"
            ></span>
            <div className="flex h-full min-h-0 w-full @container">
              {/* Menú lateral izquierdo (estilo Agentes IA / DrawerSectionNav). */}
              <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52">
                <button
                  type="button"
                  data-ps-tab="cats"
                  data-cron-settings-nav="cats"
                  title={`${c.presets.categories} / ${c.presets.tags}`}
                  className="ps-tab flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors duration-200 ease-out @xl:justify-start"
                >
                  <i
                    className="ti ti-category shrink-0 text-lg"
                    aria-hidden
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {c.presets.categories} / {c.presets.tags}
                  </span>
                </button>
                <button
                  type="button"
                  data-ps-tab="rules"
                  data-cron-settings-nav="rules"
                  title={c.presets.rules}
                  className="ps-tab flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground @xl:justify-start"
                >
                  <i
                    className="ti ti-list-check shrink-0 text-lg"
                    aria-hidden
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {c.presets.rules}
                  </span>
                </button>
                <button
                  type="button"
                  data-ps-tab="service"
                  data-cron-settings-nav="service"
                  title={c.settings.service}
                  className="ps-tab flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-out hover:bg-accent hover:text-foreground @xl:justify-start"
                >
                  <i
                    className="ti ti-server-cog shrink-0 text-lg"
                    aria-hidden
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {c.settings.service}
                  </span>
                </button>
              </nav>

              {/* Columna de contenido */}
              <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
                <div id="ps-tab-cats" className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {c.presets.categories}
                    </label>
                    <div id="ps-cats" className="flex flex-wrap gap-1.5"></div>
                    <div className="flex gap-2">
                      <input
                        id="ps-cat-in"
                        type="text"
                        maxLength={60}
                        className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                      <button
                        id="ps-cat-add"
                        type="button"
                        className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-accent"
                      >
                        {c.presets.add}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {c.presets.tags}
                    </label>
                    <div id="ps-tags" className="flex flex-wrap gap-1.5"></div>
                    <div className="flex gap-2">
                      <select
                        id="ps-tag-cat"
                        className="h-9 w-44 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none"
                      >
                        <option value="">{c.bulk.category}</option>
                      </select>
                      <input
                        id="ps-tag-in"
                        type="text"
                        maxLength={40}
                        className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
                      />
                      <button
                        id="ps-tag-add"
                        type="button"
                        className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-accent"
                      >
                        {c.presets.add}
                      </button>
                    </div>
                  </div>
                </div>

                <div id="ps-tab-rules" className="hidden flex-col gap-2">
                  <div className="space-y-2">
                    <div id="ps-rules" className="space-y-3"></div>
                    <button
                      id="ps-rule-add"
                      type="button"
                      className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-accent"
                    >
                      <i className="ti ti-plus mr-1"></i>
                      {c.presets.addRule}
                    </button>
                  </div>
                </div>
                <div id="ps-tab-service" className="hidden flex-col gap-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      {c.settings.service}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {c.settings.serviceHint}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p id="cron-service-state" className="text-sm font-medium">
                      {c.settings.checking}
                    </p>
                    <p
                      id="cron-service-unit"
                      className="mt-1 text-xs text-muted-foreground"
                    ></p>
                  </div>
                  {isAdmin && (
                    <Fragment>
                      <div className="flex flex-wrap gap-2">
                        <button
                          id="cron-service-enable"
                          type="button"
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                        >
                          {c.service.btnEnable}
                        </button>
                        <button
                          id="cron-service-disable"
                          type="button"
                          className="rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive"
                        >
                          {c.settings.disable}
                        </button>
                      </div>
                    </Fragment>
                  )}
                  {!isAdmin && (
                    <Fragment>
                      <p className="text-xs text-muted-foreground">
                        {c.settings.adminOnly}
                      </p>
                    </Fragment>
                  )}
                </div>
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        <div
          id="cron-workspace"
          className="flex h-full min-h-0 flex-col bg-background"
        >
          <div id="cron-scroll" className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{c.header.heading}</h2>
              <p className="text-sm text-muted-foreground">
                {c.header.subheading}
              </p>
            </div>

            {/** Generic system-deps banner: covers the "cron not installed" state.
         The check hits GET /api/system-deps/cron; the install goes through the
         cron module's own POST /api/cron/install (extra runner setup). */}
            {isAdmin && (
              <Fragment>
                <ModuleDepsBanner module="cron" t={t.deps} />
              </Fragment>
            )}

            {/** Service banner (cron installed but daemon stopped) — texts set by the page script */}
            <div
              id="cron-install-banner"
              className="mb-4 hidden rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <i className="ti ti-alert-triangle text-xl text-amber-500"></i>
                  <div>
                    <p
                      className="text-sm font-medium"
                      id="cron-banner-title"
                    ></p>
                    <p
                      className="text-xs text-muted-foreground"
                      id="cron-banner-desc"
                    ></p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {isAdmin && (
                    <Fragment>
                      <button
                        id="btn-enable-service"
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        {c.service.btnEnable}
                      </button>
                    </Fragment>
                  )}
                </div>
              </div>
            </div>

            {isolatedCronView && (
              <Fragment>
                <h2 className="mb-4 text-base font-semibold text-foreground">
                  {cronView === "agents" ? c.tabs.agents : c.tabs.jobs}
                </h2>
              </Fragment>
            )}
            <div
              className={
                isolatedCronView
                  ? "sr-only"
                  : "mb-4 flex gap-1 rounded-xl border border-border bg-muted/20 p-1"
              }
              role="tablist"
              aria-label={c.pageTitle}
            >
              <button
                id="cron-tab-jobs"
                type="button"
                role="tab"
                aria-selected="true"
                className="rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm"
              >
                {c.tabs.jobs}
              </button>
              <button
                id="cron-tab-agents"
                type="button"
                role="tab"
                aria-selected="false"
                className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                {c.tabs.agents}
              </button>
            </div>
            {showCronView("jobs") && (
              <Fragment>
                <section
                  id="cron-jobs-pane"
                  className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
                >
                  <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold">
                        {c.jobsList.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {c.jobsList.description}
                      </p>
                    </div>
                    {isAdmin && (
                      <Fragment>
                        <label className="text-xs text-muted-foreground">
                          {c.settings.linuxUser}
                          <select
                            id="cron-user"
                            className="ml-2 h-9 rounded-lg border border-input bg-background px-2 text-sm"
                          >
                            <option value="root">root</option>
                          </select>
                        </label>
                      </Fragment>
                    )}
                    <button
                      id="btn-new-job"
                      type="button"
                      className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                    >
                      <i className="ti ti-plus mr-1"></i>
                      {c.header.btnNew}
                    </button>
                  </div>
                  <div
                    id="jobs-bulk"
                    className="mx-5 mt-4 hidden flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
                  >
                    <span className="text-xs">
                      <span id="jobs-bulk-count">0</span> {c.bulk.selected}
                    </span>
                    <button
                      id="jobs-bulk-enable"
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                    >
                      {c.bulk.enable}
                    </button>
                    <button
                      id="jobs-bulk-pause"
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                    >
                      {c.bulk.pause}
                    </button>
                    <button
                      id="jobs-bulk-delete"
                      className="rounded-lg border border-destructive/40 px-2 py-1 text-xs text-destructive"
                    >
                      {c.bulk.delete}
                    </button>
                    <button
                      id="jobs-bulk-clear"
                      className="ml-auto text-xs text-muted-foreground"
                    >
                      {c.filters.clear}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        id="jf-select-all"
                        type="checkbox"
                        className="h-4 w-4"
                      />
                      {c.bulk.selectAll}
                    </label>
                    <input
                      id="jobs-filter"
                      type="search"
                      placeholder={c.filters.searchPlaceholder}
                      className="h-9 min-w-48 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                    />
                  </div>
                  <div id="jobs-list" className="min-h-40"></div>
                </section>
              </Fragment>
            )}
            {showCronView("agents") && (
              <Fragment>
                <div id="cron-agents-pane" className="hidden space-y-6">
                  <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="flex flex-wrap items-start gap-3 border-b border-border px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold">
                          {c.agents.listTitle}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {c.agents.listDescription}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <i className="ti ti-server-cog text-xs"></i>
                          {c.agents.panelHostBadge}
                        </span>
                      </div>
                      <label
                        title={c.bulk.selectAll}
                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent"
                      >
                        <input
                          id="af-select-all"
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-input"
                        />
                        {c.bulk.selectAll}
                      </label>
                      <button
                        id="btn-new-agent"
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <i className="ti ti-plus text-sm"></i>
                        {c.agents.btnNew}
                      </button>
                    </div>

                    <div
                      id="agents-bulk"
                      className="mx-5 mt-4 hidden flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
                    >
                      <span className="text-xs font-medium">
                        <span id="bulk-count">0</span> {c.bulk.selected}
                      </span>
                      <select
                        id="bulk-category"
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                      >
                        <option value="">{c.bulk.category}</option>
                      </select>
                      <details id="bulk-tags-dd" className="relative">
                        <summary className="flex h-8 cursor-pointer select-none list-none items-center gap-1 rounded-lg border border-input bg-background px-2 text-xs">
                          <span id="bulk-tags-label">{c.bulk.tags}</span>
                          <i className="ti ti-chevron-down text-xs"></i>
                        </summary>
                        <div
                          id="bulk-tags"
                          className="absolute left-0 top-9 z-20 max-h-48 w-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl"
                        ></div>
                      </details>
                      <select
                        id="bulk-mode"
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                      >
                        <option value="">{c.bulk.mode}</option>
                        <option value="single">{c.filters.single}</option>
                        <option value="multi">{c.filters.multi}</option>
                      </select>
                      <details id="bulk-projects-dd" className="relative">
                        <summary className="flex h-8 cursor-pointer select-none list-none items-center gap-1 rounded-lg border border-input bg-background px-2 text-xs">
                          <span>{c.bulk.projects}</span>
                          <i className="ti ti-chevron-down text-xs"></i>
                        </summary>
                        <div
                          id="bulk-projects"
                          data-remove-label={c.bulk.removeProjects}
                          className="absolute left-0 top-9 z-20 max-h-48 w-72 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl"
                        ></div>
                      </details>
                      <select
                        id="bulk-provider"
                        className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                      >
                        <option value="">{c.bulk.provider}</option>
                      </select>
                      <select
                        id="bulk-model"
                        className="h-8 max-w-40 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                      >
                        <option value="">{c.bulk.model}</option>
                      </select>
                      <button
                        id="bulk-apply"
                        type="button"
                        className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {c.bulk.apply}
                      </button>
                      <span className="mx-1 h-5 w-px bg-border"></span>
                      <button
                        id="bulk-enable"
                        type="button"
                        className="h-8 rounded-lg border border-border px-2.5 text-xs hover:bg-accent"
                      >
                        {c.bulk.enable}
                      </button>
                      <button
                        id="bulk-pause"
                        type="button"
                        className="h-8 rounded-lg border border-border px-2.5 text-xs hover:bg-accent"
                      >
                        {c.bulk.pause}
                      </button>
                      <button
                        id="bulk-delete"
                        type="button"
                        className="h-8 rounded-lg border border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        {c.bulk.delete}
                      </button>
                      <button
                        id="bulk-clear"
                        type="button"
                        className="ml-auto h-8 rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent"
                        title={c.filters.clear}
                      >
                        <i className="ti ti-x"></i>
                      </button>
                    </div>

                    <div className="border-b border-border/70 px-5 py-4">
                      <div
                        id="agents-filters"
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <select
                          id="af-category"
                          className="h-9 max-w-36 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.category}: {c.filters.all}
                          </option>
                        </select>
                        <select
                          id="af-tag"
                          className="h-9 max-w-36 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.tag}: {c.filters.all}
                          </option>
                        </select>
                        <select
                          id="af-project"
                          className="h-9 max-w-36 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.project}: {c.filters.all}
                          </option>
                        </select>
                        <select
                          id="af-mode"
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.execution}: {c.filters.all}
                          </option>
                          <option value="single">{c.filters.single}</option>
                          <option value="multi">{c.filters.multi}</option>
                        </select>
                        <select
                          id="af-schedule"
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.schedule}: {c.filters.all}
                          </option>
                          <option value="scheduled">
                            {c.filters.scheduled}
                          </option>
                          <option value="unscheduled">
                            {c.filters.unscheduled}
                          </option>
                        </select>
                        <select
                          id="af-chain"
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.chain}: {c.filters.all}
                          </option>
                          <option value="chained">{c.filters.chained}</option>
                          <option value="not-chained">
                            {c.filters.notChained}
                          </option>
                        </select>
                        <select
                          id="af-status"
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="">
                            {c.filters.status}: {c.filters.all}
                          </option>
                          <option value="enabled">{c.filters.enabled}</option>
                          <option value="paused">{c.filters.paused}</option>
                          <option value="running">{c.filters.running}</option>
                          <option value="ok">{c.filters.ok}</option>
                          <option value="error">{c.filters.error}</option>
                          <option value="never">{c.filters.never}</option>
                        </select>
                        <select
                          id="af-sort"
                          className="h-9 rounded-lg border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
                        >
                          <option value="created">
                            {c.filters.sort}: {c.filters.sortCreated}
                          </option>
                          <option value="name">
                            {c.filters.sort}: {c.filters.sortName}
                          </option>
                          <option value="lastrun">
                            {c.filters.sort}: {c.filters.sortLastRun}
                          </option>
                        </select>
                        <label className="relative min-w-56 flex-1">
                          <span className="sr-only">{c.filters.search}</span>
                          <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"></i>
                          <input
                            id="cron-text-filter"
                            type="search"
                            autoComplete="off"
                            placeholder={c.filters.searchPlaceholder}
                            className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                          />
                        </label>
                        <button
                          id="af-clear"
                          type="button"
                          className="h-9 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          title={c.filters.clear}
                        >
                          <i className="ti ti-filter-off"></i>
                        </button>
                        <button
                          id="cron-text-clear"
                          type="button"
                          className="h-9 rounded-lg border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          title={c.filters.clear}
                        >
                          <i className="ti ti-x"></i>
                        </button>
                      </div>
                    </div>

                    <div id="agents-list" className="min-h-40">
                      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                        {c.agents.loading}
                      </div>
                    </div>
                    <p className="px-5 pb-5 pt-2 text-xs text-muted-foreground">
                      <i className="ti ti-info-circle mr-1"></i>
                      {c.agents.permissionsHint}
                      <a
                        href="/panel"
                        className="ml-1 text-primary hover:underline"
                      >
                        <i className="ti ti-shield-lock mr-0.5"></i>
                        {c.agents.permissionsLink}
                      </a>
                    </p>
                  </section>
                </div>
              </Fragment>
            )}
          </div>
          {/* Barra de consulta IA: comparte el patrón de Archivos y permanece visible
        debajo de la lista mientras el contenido de Cron se desplaza. */}
          {canUseAssistant && (
            <Fragment>
              <form
                id="cron-ai-form"
                data-module-ai-footer-form
                className="shrink-0 border-t border-border bg-muted/20 px-3 py-2"
              >
                <div
                  data-module-ai-footer-row
                  className="flex items-center gap-2"
                >
                  <i
                    className="ti ti-sparkles shrink-0 text-base text-primary"
                    aria-hidden="true"
                  ></i>
                  <input
                    id="cron-ai-input"
                    data-module-ai-footer-input
                    type="text"
                    autoComplete="off"
                    aria-label={c.ai.placeholder}
                    placeholder={c.ai.placeholder}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    aria-label={c.ai.send}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <i className="ti ti-send text-sm" aria-hidden="true"></i>
                    <span className="hidden sm:inline">{c.ai.send}</span>
                  </button>
                </div>
              </form>
            </Fragment>
          )}
        </div>
      </PanelLayout>

      {/** Job dialog (create/edit) */}
      <dialog
        id="dialog-job"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={c.jobDialog.title}
          titleId="job-dialog-title"
          closeId="job-close"
        />
        <form
          id="form-job"
          className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          <input type="hidden" id="job-id" />
          <div
            id="job-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>
          <p
            id="job-owner-hint"
            data-default-user={user?.username || ""}
            className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          ></p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="job-name">
              {c.jobDialog.labelName}
            </label>
            <input
              id="job-name"
              type="text"
              required
              placeholder={c.jobDialog.placeholderName}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {c.jobDialog.labelSchedule}
            </label>
            <ScheduleBuilder prefix="job" t={t} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="job-command">
              {c.jobDialog.labelCommand}
            </label>
            <div className="flex gap-2">
              <input
                id="job-command"
                type="text"
                required
                placeholder={c.jobDialog.placeholderCommand}
                className="h-10 flex-1 rounded-lg border border-input bg-background px-3 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                id="btn-browse"
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent whitespace-nowrap"
              >
                <i className="ti ti-folder-search text-sm mr-1"></i>
                {c.jobDialog.btnBrowse}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.jobDialog.commandHint}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="job-enabled"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-input text-primary"
            />
            <label htmlFor="job-enabled" className="text-sm">
              {c.jobDialog.labelEnabled}
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              id="job-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {c.jobDialog.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              id="job-submit"
            >
              {c.jobDialog.btnCreate}
            </button>
          </div>
        </form>
      </dialog>

      {/** AI agent dialog (create/edit) */}
      <dialog
        id="dialog-agent"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={c.agentDialog.title}
          titleId="agent-dialog-title"
          closeId="agent-close"
        />
        <form
          id="form-agent"
          className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto px-6 py-5"
        >
          <input type="hidden" id="agent-id" />
          <div
            id="agent-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-name">
              {c.agentDialog.labelName}
            </label>
            <input
              id="agent-name"
              type="text"
              required
              placeholder={c.agentDialog.placeholderName}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-saved">
              {c.agentDialog.labelSavedAgent}
            </label>
            <select
              id="agent-saved"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></select>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.savedAgentHint}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agent-provider">
                {c.agentDialog.labelProvider}
              </label>
              <select
                id="agent-provider"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              ></select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agent-model">
                {c.agentDialog.labelModel}
              </label>
              <select
                id="agent-model"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              ></select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-project">
              {c.agentDialog.labelProject}
            </label>
            <div
              id="agent-project"
              data-empty={c.agentDialog.projectNone}
              className="max-h-44 overflow-y-auto rounded-lg border border-input bg-background p-1"
            ></div>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.projectHint}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agent-category">
                {c.agentDialog.labelCategory}
              </label>
              <select
                id="agent-category"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">—</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {c.agentDialog.labelTags}
              </label>
              <div
                id="agent-tags"
                className="flex min-h-10 flex-wrap items-start gap-1.5 rounded-lg border border-input bg-background p-2"
              ></div>
              <p className="text-xs text-muted-foreground">
                {c.agentDialog.tagsHint}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-mode">
              {c.agentDialog.labelMode}
            </label>
            <select
              id="agent-mode"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="single">{c.agentDialog.modeSingle}</option>
              <option value="multi">{c.agentDialog.modeMulti}</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.modeHint}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-next">
              {c.agentDialog.labelNext}
            </label>
            <select
              id="agent-next"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{c.agentDialog.nextNone}</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.nextHint}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-prompt">
              {c.agentDialog.labelPrompt}
            </label>
            <textarea
              id="agent-prompt"
              rows={3}
              required
              placeholder={c.agentDialog.placeholderPrompt}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></textarea>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {c.agentDialog.rulesPreset}
            </label>
            <div
              id="agent-rules-presets"
              className="max-h-40 overflow-y-auto rounded-lg border border-input bg-background p-1"
            ></div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="agent-rules">
              {c.agentDialog.labelRules}
            </label>
            <textarea
              id="agent-rules"
              rows={2}
              placeholder={c.agentDialog.placeholderRules}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></textarea>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.rulesHint}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                id="agent-notify"
                type="checkbox"
                className="h-4 w-4 rounded border-input text-primary"
              />
              <label htmlFor="agent-notify" className="text-sm font-medium">
                {c.agentDialog.labelNotify}
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.notifyHint}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                id="agent-approval"
                type="checkbox"
                className="h-4 w-4 rounded border-input text-primary"
              />
              <label htmlFor="agent-approval" className="text-sm font-medium">
                {c.agentDialog.labelApproval}
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.agentDialog.approvalHint}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {c.agentDialog.labelSchedule}
            </label>
            <ScheduleBuilder prefix="agent" t={t} allowNone />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="agent-enabled"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-input text-primary"
            />
            <label htmlFor="agent-enabled" className="text-sm">
              {c.agentDialog.labelEnabled}
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              id="agent-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {c.agentDialog.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              id="agent-submit"
            >
              {c.agentDialog.btnCreate}
            </button>
          </div>
        </form>
      </dialog>

      {/** File browser */}
      <dialog
        id="dialog-files"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar title={c.fileBrowser.title} closeId="files-close" />
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <button
            id="files-up"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            title={c.fileBrowser.up}
          >
            <i className="ti ti-arrow-up text-sm"></i>
          </button>
          <code
            id="files-path"
            className="flex-1 truncate font-mono text-xs text-muted-foreground"
          ></code>
          <button
            id="files-use-folder"
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
          >
            {c.fileBrowser.useFolder}
          </button>
        </div>
        <div
          id="files-list"
          className="max-h-[55vh] overflow-y-auto divide-y divide-border"
        ></div>
      </dialog>

      {/** Log viewer */}
      <dialog
        id="dialog-logs"
        className="w-full max-w-3xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={c.logs.title}
          titleId="logs-title"
          closeId="logs-close"
        />
        <div className="grid grid-cols-3 max-h-[70vh]">
          <div
            id="logs-runs"
            className="col-span-1 overflow-y-auto divide-y divide-border border-r border-border"
          ></div>
          <div className="col-span-2 flex flex-col">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span
                id="logs-run-title"
                className="text-xs text-muted-foreground"
              >
                {c.logs.pickRun}
              </span>
              <button
                id="logs-refresh"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                title={c.logs.refresh}
              >
                <i className="ti ti-refresh text-sm"></i>
              </button>
            </div>
            <pre
              id="logs-content"
              className="flex-1 overflow-auto bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap"
            ></pre>
          </div>
        </div>
      </dialog>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="cron-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["cron"]) }}
      ></script>
    </Fragment>
  );
}
