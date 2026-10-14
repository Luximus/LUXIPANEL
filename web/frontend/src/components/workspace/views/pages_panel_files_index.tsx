// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/files/index.astro.
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
 * File Manager — /panel/files
 * Browser de archivos + editor lateral. La consola, snippets, historial y
 * configuración de terminal viven en el componente global FloatingTerminal
 * (botón flotante disponible en todas las vistas del panel).
 */
import PanelLayout from "../module-frame";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import ModalNavbar from "./components_ui_ModalNavbar";
import ModuleDepsBanner from "./components_ModuleDepsBanner";
import { FilesWorkspace } from "@/components/panel-files/FilesWorkspace";
import { ProjectMapDrawer } from "@/components/panel-files/ProjectMapDrawer";
import { getSession, canSeeSidebar } from "../view-context";
import { getPageLocale, getPageMessages } from "../view-context";
import "@/styles/files-branched-tree.css";
export default function pages_panel_files_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const locale = getPageLocale(Astro);
  const t = getPageMessages(Astro, ["files", "deps"]);
  // The AI help bar in the file browser is only shown when the user can use the
  // AI assistant module (same gate as the floating assistant button).
  const user = getSession(Astro.request);
  const canUseAssistant = user ? canSeeSidebar(user, "assistant") : false;
  // Expo module gate — enables the "Create Expo app here" folder action.
  const canExpo = user ? canSeeSidebar(user, "expo") : false;
  const canAdminFiles = user?.kind === "admin";

  return (
    <Fragment>
      <PanelLayout title={t.files.pageTitle} activeModule="files" flush>
        <div slot="title-actions">
          <ViewSettingsModal
            id="files-settings-modal"
            title={t.files.settings.modalTitle}
            description={t.files.settings.modalDescription}
            variant="drawer"
            hideFooter={true}
          >
            <section className="flex h-full min-h-0 w-full @container">
              <nav
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
                role="tablist"
                aria-label={t.files.settings.modalTitle}
              >
                <button
                  type="button"
                  data-files-settings-tab="general"
                  data-files-settings-nav="general"
                  title={t.files.settings.tabs.general}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start bg-primary/10 text-primary"
                >
                  <i className="ti ti-adjustments shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {t.files.settings.tabs.general}
                  </span>
                </button>
                <button
                  type="button"
                  data-files-settings-tab="roots"
                  data-files-settings-nav="roots"
                  title={t.files.settings.tabs.roots}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <i className="ti ti-folders shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {t.files.settings.tabs.roots}
                  </span>
                </button>
                <button
                  type="button"
                  data-files-settings-tab="shortcuts"
                  title={t.files.settings.tabs.shortcuts}
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <i className="ti ti-keyboard shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {t.files.settings.tabs.shortcuts}
                  </span>
                </button>
                {canAdminFiles && (
                  <Fragment>
                    <button
                      type="button"
                      data-files-settings-tab="operation"
                      title={t.files.settings.tabs.operation}
                      className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 ease-out @xl:justify-start text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <i className="ti ti-server-cog shrink-0 text-lg"></i>
                      <span className="hidden truncate @xl:inline">
                        {t.files.settings.tabs.operation}
                      </span>
                    </button>
                  </Fragment>
                )}
              </nav>

              <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-1 py-4 @xl:px-6">
                <div data-files-settings-panel="general" className="space-y-4">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold">
                          {t.files.settings.browserMode.heading}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t.files.settings.browserMode.description}
                        </p>
                      </div>
                      <select
                        id="files-mode-select"
                        className="h-10 shrink-0 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="developer">
                          {t.files.settings.browserMode.optionDeveloper}
                        </option>
                        <option value="client">
                          {t.files.settings.browserMode.optionClient}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold">
                          {t.files.settings.hiddenFiles.heading}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t.files.settings.hiddenFiles.description}
                        </p>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          id="files-show-hidden-toggle"
                          className="peer sr-only"
                        />
                        <div className="h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div
                  data-files-settings-panel="shortcuts"
                  className="space-y-4 hidden"
                >
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">
                          {t.files.settings.shortcuts.heading}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t.files.settings.shortcuts.description}
                        </p>
                      </div>
                    </div>

                    {/** Categorías de atajos (Archivos / Navegación / Vista y herramientas) */}
                    <div
                      className="mt-4 inline-flex rounded-lg border border-border bg-muted/30 p-1"
                      role="tablist"
                    >
                      <button
                        type="button"
                        data-files-shortcut-cat="files"
                        className="files-shortcut-cat rounded-md px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground shadow-sm"
                      >
                        {t.files.settings.shortcuts.catFiles}
                      </button>
                      <button
                        type="button"
                        data-files-shortcut-cat="nav"
                        className="files-shortcut-cat rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {t.files.settings.shortcuts.catNav}
                      </button>
                      <button
                        type="button"
                        data-files-shortcut-cat="tools"
                        className="files-shortcut-cat rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {t.files.settings.shortcuts.catTools}
                      </button>
                    </div>

                    {/** Archivos */}
                    <div
                      data-files-shortcut-catpanel="files"
                      className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelNewFile}
                        </span>
                        <input
                          id="s-files-shortcut-new-file"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelNewFolder}
                        </span>
                        <input
                          id="s-files-shortcut-new-folder"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelUpload}
                        </span>
                        <input
                          id="s-files-shortcut-upload"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelPaste}
                        </span>
                        <input
                          id="s-files-shortcut-paste"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelSave}
                        </span>
                        <input
                          id="s-files-shortcut-save"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelDelete}
                        </span>
                        <input
                          id="s-files-shortcut-delete"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                    </div>

                    {/** Navegación */}
                    <div
                      data-files-shortcut-catpanel="nav"
                      className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 hidden"
                    >
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelBack}
                        </span>
                        <input
                          id="s-files-shortcut-back"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelRefresh}
                        </span>
                        <input
                          id="s-files-shortcut-refresh"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelSearch}
                        </span>
                        <input
                          id="s-files-shortcut-search"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelNewTab}
                        </span>
                        <input
                          id="s-files-shortcut-new-tab"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelClearSelection}
                        </span>
                        <input
                          id="s-files-shortcut-clear-selection"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelOpenFiles}
                        </span>
                        <input
                          id="s-files-shortcut-open-files"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelToggleEditor}
                        </span>
                        <input
                          id="s-files-shortcut-toggle-editor"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                    </div>

                    {/** Vista y herramientas */}
                    <div
                      data-files-shortcut-catpanel="tools"
                      className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 hidden"
                    >
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelViewList}
                        </span>
                        <input
                          id="s-files-shortcut-view-list"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelViewGrid}
                        </span>
                        <input
                          id="s-files-shortcut-view-grid"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelProjects}
                        </span>
                        <input
                          id="s-files-shortcut-projects"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelRescanProjects}
                        </span>
                        <input
                          id="s-files-shortcut-rescan-projects"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelProjectMap}
                        </span>
                        <input
                          id="s-files-shortcut-project-map"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelCompare}
                        </span>
                        <input
                          id="s-files-shortcut-compare"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelGit}
                        </span>
                        <input
                          id="s-files-shortcut-git"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelCopyPath}
                        </span>
                        <input
                          id="s-files-shortcut-copy-path"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.files.settings.shortcuts.labelDownload}
                        </span>
                        <input
                          id="s-files-shortcut-download"
                          type="text"
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                    </div>

                    <p className="mt-4 text-xs text-muted-foreground">
                      {t.files.settings.shortcuts.hint}
                    </p>
                  </div>
                </div>

                <div
                  data-files-settings-panel="roots"
                  className="space-y-4 hidden"
                >
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div>
                      <h4 className="text-sm font-semibold">
                        {t.files.settings.roots.heading}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {t.files.settings.roots.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <select
                        id="files-fav-root-select"
                        className="h-10 flex-1 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      ></select>
                      <button
                        id="files-fav-root-add"
                        type="button"
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
                        title={t.files.settings.roots.add}
                      >
                        <i className="ti ti-folder-plus text-sm"></i>
                        <span className="hidden sm:inline">
                          {t.files.settings.roots.add}
                        </span>
                      </button>
                      <button
                        id="files-fav-root-remove"
                        type="button"
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-destructive"
                        title={t.files.settings.roots.remove}
                      >
                        <i className="ti ti-trash text-sm"></i>
                        <span className="hidden sm:inline">
                          {t.files.settings.roots.remove}
                        </span>
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t.files.settings.roots.hint}
                    </p>
                  </div>
                </div>
                {canAdminFiles && (
                  <Fragment>
                    <div
                      data-files-settings-panel="operation"
                      className="space-y-4 hidden"
                    >
                      <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                          {t.files.settings.operation.serverPolicy}
                        </p>
                        <p
                          id="files-config-status"
                          className="mt-1 text-sm text-foreground"
                        >
                          {t.files.settings.operation.loading}
                        </p>
                      </div>
                      <form id="files-operation-form" className="space-y-4">
                        <div className="rounded-xl border border-border bg-background p-4">
                          <h4 className="text-sm font-semibold">
                            {t.files.settings.operation.transfers}
                          </h4>
                          <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
                            <span>
                              {t.files.settings.operation.uploadLimit}
                            </span>
                            <input
                              id="files-config-upload-mib"
                              type="number"
                              min="1"
                              step="1"
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                            />
                          </label>
                          <p
                            id="files-config-upload-ceiling"
                            className="mt-2 text-xs text-muted-foreground"
                          ></p>
                        </div>
                        <div className="rounded-xl border border-border bg-background p-4">
                          <h4 className="text-sm font-semibold">
                            {t.files.settings.operation.snapshots}
                          </h4>
                          <label className="mt-3 flex items-center gap-2 text-sm">
                            <input
                              id="files-config-snapshots-enabled"
                              type="checkbox"
                              className="accent-primary"
                            />
                            {t.files.settings.operation.snapshotsEnabled}
                          </label>
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <label className="space-y-1 text-xs text-muted-foreground">
                              <span>
                                {t.files.settings.operation.snapshotMaxMib}
                              </span>
                              <input
                                id="files-config-snapshot-mib"
                                type="number"
                                min="1"
                                step="1"
                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                              />
                            </label>
                            <label className="space-y-1 text-xs text-muted-foreground">
                              <span>
                                {t.files.settings.operation.snapshotPerPath}
                              </span>
                              <input
                                id="files-config-snapshot-path"
                                type="number"
                                min="1"
                                step="1"
                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                              />
                            </label>
                            <label className="space-y-1 text-xs text-muted-foreground">
                              <span>
                                {t.files.settings.operation.snapshotTotal}
                              </span>
                              <input
                                id="files-config-snapshot-total"
                                type="number"
                                min="1"
                                step="1"
                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                              />
                            </label>
                          </div>
                          <button
                            id="files-config-prune"
                            type="button"
                            className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                          >
                            {t.files.settings.operation.prune}
                          </button>
                        </div>
                        <div className="rounded-xl border border-border bg-background p-4">
                          <h4 className="text-sm font-semibold">
                            {t.files.settings.operation.shares}
                          </h4>
                          <label className="mt-3 flex items-center gap-2 text-sm">
                            <input
                              id="files-config-sharing-enabled"
                              type="checkbox"
                              className="accent-primary"
                            />
                            {t.files.settings.operation.sharingEnabled}
                          </label>
                          <label className="mt-3 block space-y-1 text-xs text-muted-foreground">
                            <span>
                              {t.files.settings.operation.shareMaxHours}
                            </span>
                            <input
                              id="files-config-share-hours"
                              type="number"
                              min="1"
                              max="720"
                              step="1"
                              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                            />
                          </label>
                          <label className="mt-3 flex items-center gap-2 text-sm">
                            <input
                              id="files-config-share-password"
                              type="checkbox"
                              className="accent-primary"
                            />
                            {t.files.settings.operation.sharePassword}
                          </label>
                        </div>
                        <button
                          id="files-config-save"
                          type="submit"
                          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          {t.files.settings.operation.save}
                        </button>
                      </form>
                    </div>
                  </Fragment>
                )}
              </div>
            </section>
          </ViewSettingsModal>
        </div>

        {/** Deps del sistema (zip/unzip/tar requeridos; git/rsync opcionales).
         Solo informa e instala: el navegador de archivos sigue usable aunque
         falten (afectan comprimir/extraer, panel git y copias con rsync). */}
        <ModuleDepsBanner module="files" t={t.deps} />

        <div id="files-pane" className="flex h-full min-h-0 gap-3">
          {/** Navegador de carpetas (panel izquierdo): lista las carpetas desde la raíz
         del servidor (o la base permitida del usuario) y permite descender. Al
         pulsar una carpeta carga su contenido en el listado de la derecha usando
         el mismo navigate(): el árbol SOLO enlaza a esa vista. */}
          <aside
            id="files-tree-pane"
            className="hidden lg:flex min-h-0 w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <i className="ti ti-folders text-base text-primary"></i>
                <span className="truncate text-sm font-semibold">
                  {t.files.tree.title}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  id="files-tree-set-root"
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title={t.files.tree.setRoot}
                  aria-label={t.files.tree.setRoot}
                >
                  <i className="ti ti-folder-cog text-sm"></i>
                </button>
                <button
                  id="files-tree-refresh"
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title={t.files.tree.refresh}
                  aria-label={t.files.tree.refresh}
                >
                  <i className="ti ti-refresh text-sm"></i>
                </button>
              </div>
            </div>

            {/** Buscador de carpetas y archivos (movido aquí desde la cabecera del
         navegador). Filtra el árbol de la izquierda Y el listado de la derecha
         (modo nombre) o busca texto dentro de los archivos (modo contenido).
         Los ids se conservan: los bindings viven en index-script1.ts /
         bind-toolbar.ts / search-replace.ts y van por id. */}
            <div
              id="files-search-box"
              className="border-b border-border px-3 py-2.5"
            >
              <label className="sr-only" htmlFor="files-search">
                {t.files.search.label}
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <i
                    id="files-search-icon"
                    className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
                  ></i>
                  <input
                    id="files-search"
                    type="search"
                    placeholder={t.files.search.placeholderName}
                    className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {/** Alternar: filtro por nombre ⇄ búsqueda de texto dentro de archivos. */}
                <button
                  id="btn-search-mode"
                  type="button"
                  title={t.files.search.toggleToContent}
                  aria-label={t.files.search.modeToggleAria}
                  aria-pressed="false"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <i className="ti ti-arrows-exchange text-sm"></i>
                </button>
                {/** Distinguir mayúsculas/minúsculas (solo en modo contenido). */}
                <button
                  id="btn-search-case"
                  type="button"
                  title={t.files.search.caseSensitive}
                  aria-label={t.files.search.caseSensitive}
                  aria-pressed="false"
                  className="hidden h-9 shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Aa
                </button>
                {/** Reemplazo masivo (vista previa + aplicar). */}
                <button
                  id="btn-search-replace"
                  type="button"
                  title={t.files.search.replaceTitle}
                  aria-label={t.files.search.replaceAria}
                  className="hidden h-9 shrink-0 items-center justify-center rounded-lg border border-border px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <i className="ti ti-replace text-sm"></i>
                </button>
              </div>
            </div>

            <div
              id="files-tree"
              className="lxp-branched-tree min-h-0 flex-1 overflow-y-auto px-1.5 py-2"
              role="tree"
              aria-label={t.files.tree.title}
            ></div>
            {/** Resultados de la búsqueda recursiva por nombre (GET /api/files/search
         con `base`): sustituyen al árbol mientras hay término, para poder ver
         coincidencias en carpetas que aún no se han expandido. */}
            <div
              id="files-tree-results"
              className="hidden flex-1 overflow-y-auto px-1.5 py-2"
              role="listbox"
              aria-label={t.files.tree.searchResults}
            ></div>
          </aside>
          <div className="min-w-0 flex-1">
            <FilesWorkspace
              canUseAssistant={canUseAssistant}
              canExpo={canExpo}
              locale={locale}
            />
          </div>
        </div>
        <ProjectMapDrawer locale={locale} />
      </PanelLayout>

      <dialog
        id="dialog-mkdir"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.mkdir.title}
          closeId="mkdir-close"
          closeLabel={t.files.mkdir.btnClose}
        />
        <form id="form-mkdir" className="flex flex-col gap-4 px-6 py-5">
          <input
            id="mkdir-name"
            type="text"
            required
            placeholder={t.files.placeholders.folderName}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-3">
            <button
              type="button"
              id="mkdir-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.mkdir.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.mkdir.btnCreate}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        id="dialog-rename"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.rename.title}
          closeId="rename-close"
          closeLabel={t.files.rename.btnClose}
        />
        <form id="form-rename" className="flex flex-col gap-4 px-6 py-5">
          <input
            id="rename-value"
            type="text"
            required
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-3">
            <button
              type="button"
              id="rename-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.rename.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.rename.btnRename}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        id="dialog-new-file"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.newFile.title}
          closeId="new-file-close"
          closeLabel={t.files.newFile.btnClose}
        />
        <form id="form-new-file" className="flex flex-col gap-4 px-6 py-5">
          <input
            id="new-file-name"
            type="text"
            required
            placeholder={t.files.placeholders.fileName}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-muted-foreground">
            {t.files.newFile.hint}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              id="new-file-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.newFile.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.newFile.btnCreateAndEdit}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        id="dialog-permissions"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.permissions.title}
          closeId="permissions-close"
          closeLabel={t.files.permissions.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="permissions-target"
            className="truncate text-xs text-muted-foreground"
          ></p>
        </div>
        <form id="form-permissions" className="space-y-5 px-6 py-5">
          <input type="hidden" id="permissions-path" />
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div></div>
            <div>{t.files.permissions.colUser}</div>
            <div>{t.files.permissions.colGroup}</div>
            <div>{t.files.permissions.colOthers}</div>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-4 items-center gap-2">
              <div className="text-sm font-medium">
                {t.files.permissions.rowRead}
              </div>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-u-r"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-g-r"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-o-r"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <div className="text-sm font-medium">
                {t.files.permissions.rowWrite}
              </div>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-u-w"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-g-w"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-o-w"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <div className="text-sm font-medium">
                {t.files.permissions.rowExecute}
              </div>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-u-x"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-g-x"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <label className="flex items-center justify-center rounded-lg border border-border bg-background py-2">
                <input
                  id="perm-o-x"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t.files.permissions.octalLabel}
              </p>
              <p
                id="permissions-symbolic"
                className="font-mono text-sm text-foreground"
              >
                ---
              </p>
            </div>
            <input
              id="permissions-octal"
              type="text"
              readOnly
              className="h-10 w-24 rounded-lg border border-input bg-card px-3 text-center font-mono text-sm focus:outline-none"
            />
          </div>

          {/** Recomendador de permisos (#5) */}
          <div
            id="perm-recommend"
            className="rounded-xl border border-border bg-background px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  id="perm-recommend-headline"
                  className="text-sm font-medium text-foreground"
                >
                  —
                </p>
                <ul
                  id="perm-recommend-reasons"
                  className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground"
                ></ul>
              </div>
              <button
                type="button"
                id="perm-fix"
                className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-wand text-sm"></i>{" "}
                {t.files.permissions.btnFix}
              </button>
            </div>
            <div
              id="perm-recursive-wrap"
              className="mt-3 hidden border-t border-border pt-3"
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  id="perm-recursive"
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                />
                {t.files.permissions.applyRecursive}
              </label>
              <div
                id="perm-recursive-opts"
                className="mt-2 hidden space-y-1 pl-6 text-xs"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="perm-apply-to"
                    defaultValue="all"
                    defaultChecked
                    className="accent-primary"
                  />{" "}
                  {t.files.permissions.radioAll}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="perm-apply-to"
                    defaultValue="files"
                    className="accent-primary"
                  />{" "}
                  {t.files.permissions.radioFiles}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="perm-apply-to"
                    defaultValue="dirs"
                    className="accent-primary"
                  />{" "}
                  {t.files.permissions.radioDirs}
                </label>
              </div>
            </div>
          </div>

          {/** Privacidad del directorio (Basic auth vía .htaccess) — solo carpetas */}
          <div
            id="dir-privacy-wrap"
            className="hidden rounded-xl border border-border bg-background px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  <i className="ti ti-lock text-sm"></i>{" "}
                  {t.files.directoryPrivacy.title}
                </p>
                <p
                  id="dir-privacy-status"
                  className="mt-0.5 text-xs text-muted-foreground"
                >
                  —
                </p>
              </div>
              <button
                type="button"
                id="dir-privacy-unprotect"
                className="hidden shrink-0 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <i className="ti ti-lock-open text-sm"></i>{" "}
                {t.files.directoryPrivacy.btnDisable}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.files.directoryPrivacy.hint}
            </p>
            <div id="dir-privacy-url-row" className="mt-2 hidden"></div>
            <div id="dir-privacy-publish-row" className="mt-2 hidden"></div>
            <ul id="dir-privacy-users" className="mt-2 space-y-1"></ul>
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <input
                id="dir-privacy-realm"
                type="text"
                placeholder={t.files.directoryPrivacy.placeholderRealm}
                className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  id="dir-privacy-user"
                  type="text"
                  autoComplete="off"
                  placeholder={t.files.directoryPrivacy.placeholderUser}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  id="dir-privacy-pass"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t.files.directoryPrivacy.placeholderPassword}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                type="button"
                id="dir-privacy-save"
                className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-user-plus text-sm"></i>{" "}
                {t.files.directoryPrivacy.btnProtect}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              id="permissions-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.permissions.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.permissions.btnSave}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        id="dialog-compress"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.compress.title}
          closeId="compress-close"
          closeLabel={t.files.compress.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="compress-target"
            className="truncate text-xs text-muted-foreground"
          ></p>
        </div>
        <form id="form-compress" className="flex flex-col gap-4 px-6 py-5">
          <input
            id="compress-name"
            type="text"
            required
            placeholder={t.files.placeholders.zipName}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p
            id="compress-summary"
            className="text-xs text-muted-foreground"
          ></p>
          <div className="flex gap-3">
            <button
              type="button"
              id="compress-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.compress.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.compress.btnCompress}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        id="dialog-history"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.history.title}
          closeId="history-close"
          closeLabel={t.files.history.btnClose}
        >
          <Fragment slot="actions">
            <button
              id="history-refresh"
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t.files.history.btnRefresh}
              aria-label={t.files.history.btnRefresh}
            >
              <i className="ti ti-refresh text-base"></i>
            </button>
          </Fragment>
        </ModalNavbar>
        <div className="px-6 pt-4">
          <p
            id="history-subtitle"
            className="truncate text-xs text-muted-foreground"
          >
            {t.files.history.subtitle}
          </p>
        </div>
        <div className="px-2 py-2">
          <p className="px-4 pb-2 pt-1 text-xs text-muted-foreground">
            {t.files.history.description}
          </p>
          <div
            id="history-list"
            className="max-h-[60vh] min-h-[8rem] overflow-y-auto px-2"
          ></div>
        </div>
      </dialog>

      <dialog
        id="dialog-replace"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.replace.title}
          closeId="replace-close"
          closeLabel={t.files.replace.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="replace-scope"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <form id="form-replace" className="flex flex-col gap-3 px-6 py-4">
          <div className="flex gap-2">
            <input
              id="replace-search"
              type="text"
              placeholder={t.files.replace.placeholderSearch}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              id="replace-mode"
              aria-label={t.files.replace.modeLabel}
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="text">{t.files.replace.optionText}</option>
              <option value="regex">{t.files.replace.optionRegex}</option>
            </select>
          </div>
          <input
            id="replace-with"
            type="text"
            placeholder={t.files.replace.placeholderReplaceWith}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                id="replace-case"
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
              />
              {t.files.replace.labelCaseSensitive}
            </label>
            <button
              type="submit"
              className="h-9 rounded-lg border border-border px-4 text-sm font-medium hover:bg-accent"
            >
              {t.files.replace.btnPreview}
            </button>
          </div>
        </form>
        <div className="border-t border-border px-2 py-2">
          <div
            id="replace-preview"
            className="max-h-[45vh] min-h-[5rem] overflow-y-auto px-2"
          ></div>
        </div>
        <div
          id="replace-footer"
          className="hidden items-center justify-between gap-3 border-t border-border px-6 py-4"
        >
          <p id="replace-summary" className="text-xs text-muted-foreground"></p>
          <div className="flex gap-2">
            <button
              id="replace-cancel"
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.replace.btnCancel}
            </button>
            <button
              id="replace-apply"
              type="button"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.replace.btnApply}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        id="dialog-exposure"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.exposure.title}
          description={t.files.exposure.subtitle}
          closeId="exposure-close"
          closeLabel={t.files.exposure.btnClose}
        >
          <Fragment slot="actions">
            <button
              id="exposure-refresh"
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t.files.exposure.btnRescan}
              aria-label={t.files.exposure.btnRescan}
            >
              <i className="ti ti-refresh text-base"></i>
            </button>
          </Fragment>
        </ModalNavbar>
        <div
          id="exposure-body"
          className="max-h-[60vh] min-h-[8rem] overflow-y-auto px-2 py-2"
        ></div>
      </dialog>

      <dialog
        id="dialog-validate"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.validate.title}
          icon="ti-alert-circle"
          closeId="validate-close"
          closeLabel={t.files.validate.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="validate-summary"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <div className="px-6 py-4">
          <ul
            id="validate-errors"
            className="list-disc space-y-1 pl-5 text-sm text-foreground"
          ></ul>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="validate-goto"
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <i className="ti ti-arrow-right text-sm"></i>{" "}
            {t.files.validate.btnGoto}
          </button>
          <button
            id="validate-fix-ai"
            type="button"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <i className="ti ti-sparkles text-sm"></i>{" "}
            {t.files.validate.btnFixAi}
          </button>
          <button
            id="validate-save-anyway"
            type="button"
            className="rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            {t.files.validate.btnSaveAnyway}
          </button>
        </div>
      </dialog>

      <dialog
        id="dialog-compare"
        className="w-full max-w-3xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.compare.title}
          closeId="compare-close"
          closeLabel={t.files.compare.btnClose}
        />
        <form id="form-compare" className="flex flex-col gap-3 px-6 py-4">
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.compare.labelBase}
            </span>
            <div className="flex items-center gap-2">
              <input
                id="compare-from"
                type="text"
                readOnly
                placeholder={t.files.compare.placeholderFolder}
                className="h-10 w-full min-w-0 flex-1 cursor-default rounded-lg border border-input bg-muted/30 px-3 font-mono text-sm focus:outline-none"
              />
              <button
                id="compare-from-browse"
                type="button"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
              >
                <i className="ti ti-folder-search text-sm"></i>{" "}
                {t.files.compare.btnBrowse}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.compare.labelTarget}
            </span>
            <div className="flex items-center gap-2">
              <input
                id="compare-to"
                type="text"
                readOnly
                placeholder={t.files.compare.placeholderFolder}
                className="h-10 w-full min-w-0 flex-1 cursor-default rounded-lg border border-input bg-muted/30 px-3 font-mono text-sm focus:outline-none"
              />
              <button
                id="compare-to-browse"
                type="button"
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent"
              >
                <i className="ti ti-folder-search text-sm"></i>{" "}
                {t.files.compare.btnBrowse}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.compare.btnCompare}
            </button>
          </div>
        </form>
        <div className="border-t border-border px-2 py-2">
          <div
            id="compare-results"
            className="max-h-[50vh] min-h-[6rem] overflow-y-auto px-2"
          ></div>
        </div>
      </dialog>

      <dialog
        id="dialog-folder-picker"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.folderPicker.title}
          titleId="folder-picker-title"
          closeId="folder-picker-close"
        />
        <div className="max-h-[calc(90vh-3.5rem)] space-y-3 overflow-y-auto px-5 py-3">
          <section
            id="folder-picker-tree-options"
            className="hidden rounded-xl border border-primary/20 bg-primary/5 p-3"
          >
            <h4 className="text-sm font-semibold text-foreground">
              {t.files.folderPicker.treeRootTitle}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t.files.folderPicker.treeRootHelp}
            </p>
            <fieldset className="mt-3 space-y-2">
              <legend className="mb-2 text-xs font-semibold text-foreground">
                {t.files.folderPicker.treeOpenMode}
              </legend>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 hover:bg-accent/50">
                <input
                  type="radio"
                  name="folder-picker-tree-mode"
                  defaultValue="multiple"
                  className="mt-0.5 accent-primary"
                  defaultChecked
                />
                <span>
                  <span className="block text-xs font-medium text-foreground">
                    {t.files.folderPicker.treeOpenMultiple}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {t.files.folderPicker.treeOpenMultipleHelp}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2 hover:bg-accent/50">
                <input
                  type="radio"
                  name="folder-picker-tree-mode"
                  defaultValue="single"
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block text-xs font-medium text-foreground">
                    {t.files.folderPicker.treeOpenSingle}
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {t.files.folderPicker.treeOpenSingleHelp}
                  </span>
                </span>
              </label>
            </fieldset>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t.files.folderPicker.treeOpenAutoSave}
            </p>
          </section>
          <div id="folder-picker-fav-row" className="hidden">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="folder-picker-fav"
            >
              {t.files.folderPicker.favLabel}
            </label>
            <select
              id="folder-picker-fav"
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            ></select>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="folder-picker-up"
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              <i className="ti ti-arrow-up"></i> {t.files.folderPicker.btnUp}
            </button>
            <code
              id="folder-picker-current"
              className="flex-1 truncate rounded-md bg-muted/40 px-2 py-1 text-xs"
            >
              /
            </code>
          </div>
          <div
            id="folder-picker-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          ></div>
          <ul
            id="folder-picker-list"
            className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border text-sm"
          ></ul>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              id="folder-picker-cancel"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.files.folderPicker.btnCancel}
            </button>
            <button
              type="button"
              id="folder-picker-select"
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.folderPicker.btnSelect}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        id="dialog-file-history"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.fileHistory.title}
          closeId="file-history-close"
          closeLabel={t.files.fileHistory.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="file-history-scope"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <div
          id="file-history-body"
          className="max-h-[60vh] min-h-[8rem] overflow-y-auto px-2 py-2"
        ></div>
      </dialog>

      <dialog
        id="dialog-git"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.git.title}
          icon="ti-git-branch"
          closeId="git-close"
          closeLabel={t.files.git.btnClose}
        />
        <div className="px-6 pt-4">
          <p id="git-scope" className="truncate text-xs text-muted-foreground">
            —
          </p>
        </div>
        <div id="git-body" className="px-6 py-4">
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t.files.git.loading}
          </div>
        </div>
      </dialog>

      <dialog
        id="dialog-git-clone"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.gitClone.title}
          icon="ti-git-fork"
          closeId="git-clone-close"
          closeLabel={t.files.gitClone.btnClose}
        />
        <form id="form-git-clone" className="flex flex-col gap-3 px-6 py-4">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.gitClone.labelUrl}
            </span>
            <input
              id="git-clone-url"
              type="text"
              placeholder={t.files.placeholders.gitCloneUrl}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.gitClone.labelDest}
            </span>
            <input
              id="git-clone-dest"
              type="text"
              placeholder={t.files.placeholders.gitCloneDest}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.gitClone.labelBranch}
            </span>
            <input
              id="git-clone-branch"
              type="text"
              placeholder={t.files.placeholders.gitCloneBranch}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            {t.files.gitClone.privateRepoHint}
          </p>
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.gitClone.btnClone}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        id="dialog-malware"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.malware.title}
          icon="ti-shield-check"
          closeId="malware-close"
          closeLabel={t.files.malware.btnClose}
        >
          <Fragment slot="actions">
            <button
              id="malware-rescan"
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t.files.malware.btnRescan}
              aria-label={t.files.malware.btnRescan}
            >
              <i className="ti ti-refresh text-base"></i>
            </button>
          </Fragment>
        </ModalNavbar>
        <div className="px-6 pt-4">
          <p
            id="malware-scope"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-2 py-2">
          <div className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t.files.malware.heuristicLabel}
          </div>
          <div id="malware-results" className="px-2"></div>
          <div className="mt-3 flex items-center justify-between px-2 pb-1 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.files.malware.quarantineLabel}
            </span>
            <button
              id="malware-q-refresh"
              type="button"
              className="text-[11px] text-primary hover:underline"
            >
              {t.files.malware.btnQuarantineRefresh}
            </button>
          </div>
          <div id="malware-quarantine" className="px-2"></div>
        </div>
      </dialog>

      <dialog
        id="dialog-cleanup"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.cleanup.title}
          icon="ti-sparkles"
          closeId="cleanup-close"
          closeLabel={t.files.cleanup.btnClose}
        >
          <Fragment slot="actions">
            <button
              id="cleanup-ai"
              type="button"
              className="rounded-lg px-2 py-1 text-xs text-primary hover:underline"
              title={t.files.cleanup.btnAiTitle}
            >
              <i className="ti ti-robot text-sm"></i> {t.files.cleanup.btnAi}
            </button>
            <button
              id="cleanup-rescan"
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t.files.cleanup.btnRescan}
              aria-label={t.files.cleanup.btnRescan}
            >
              <i className="ti ti-refresh text-base"></i>
            </button>
          </Fragment>
        </ModalNavbar>
        <div className="px-6 pt-4">
          <p
            id="cleanup-scope"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <div
          id="cleanup-body"
          className="max-h-[55vh] min-h-[8rem] overflow-y-auto px-2 py-2"
        ></div>
        <div
          id="cleanup-footer"
          className="hidden items-center justify-between gap-3 border-t border-border px-6 py-4"
        >
          <p id="cleanup-summary" className="text-xs text-muted-foreground"></p>
          <button
            id="cleanup-delete"
            type="button"
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            {t.files.cleanup.btnDelete}
          </button>
        </div>
      </dialog>

      <dialog
        id="dialog-image"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.image.title}
          icon="ti-photo-edit"
          closeId="image-close"
          closeLabel={t.files.image.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="image-scope"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <div className="px-6 py-4">
          <p
            id="image-caps"
            className="mb-3 text-[11px] text-muted-foreground"
          ></p>
          <div id="image-single" className="hidden flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                {t.files.image.labelQuality}
              </label>
              <input
                id="image-quality"
                type="number"
                min="1"
                max="100"
                defaultValue="80"
                className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm"
              />
              <button
                type="button"
                data-img-op="webp"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-photo text-sm"></i> {t.files.image.btnWebp}
              </button>
              <button
                type="button"
                data-img-op="compress"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-archive text-sm"></i>{" "}
                {t.files.image.btnCompress}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                {t.files.image.labelWidth}
              </label>
              <input
                id="image-width"
                type="number"
                min="1"
                max="10000"
                defaultValue="1280"
                className="h-9 w-24 rounded-lg border border-input bg-background px-2 text-sm"
              />
              <button
                type="button"
                data-img-op="resize"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-aspect-ratio text-sm"></i>{" "}
                {t.files.image.btnResize}
              </button>
              <button
                type="button"
                data-img-op="responsive"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                title={t.files.image.responsiveTitle}
              >
                <i className="ti ti-devices text-sm"></i>{" "}
                {t.files.image.btnResponsive}
              </button>
            </div>
            <div
              id="image-result"
              className="text-xs text-muted-foreground"
            ></div>
          </div>
          <div id="image-large" className="hidden"></div>
        </div>
      </dialog>

      <dialog
        id="dialog-meta"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.meta.title}
          icon="ti-tags"
          closeId="meta-close"
          closeLabel={t.files.meta.btnClose}
        />
        <div className="px-6 pt-4">
          <p id="meta-scope" className="truncate text-xs text-muted-foreground">
            —
          </p>
        </div>
        <div className="flex flex-col gap-3 px-6 py-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.meta.quickTagsLabel}
            </p>
            <div id="meta-presets" className="flex flex-wrap gap-1.5">
              <button
                type="button"
                data-tag="Cliente"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagCliente}
              </button>
              <button
                type="button"
                data-tag="Producción"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagProduccion}
              </button>
              <button
                type="button"
                data-tag="Backup"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagBackup}
              </button>
              <button
                type="button"
                data-tag="Importante"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagImportante}
              </button>
              <button
                type="button"
                data-tag="No borrar"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagNoBorrar}
              </button>
              <button
                type="button"
                data-tag="Sensible"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagSensible}
              </button>
              <button
                type="button"
                data-tag="Revisar"
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {t.files.meta.tagRevisar}
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.meta.appliedLabel}
            </p>
            <div
              id="meta-tags"
              className="flex min-h-[2rem] flex-wrap gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5"
            ></div>
            <form id="meta-add-form" className="mt-2 flex gap-2">
              <input
                id="meta-add"
                type="text"
                placeholder={t.files.meta.placeholderCustomTag}
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
              />
              <button
                type="submit"
                className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent"
              >
                {t.files.meta.btnAdd}
              </button>
            </form>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.meta.commentLabel}
            </span>
            <textarea
              id="meta-comment"
              rows={3}
              placeholder={t.files.meta.placeholderComment}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            ></textarea>
          </label>
          <div className="flex justify-end">
            <button
              id="meta-save"
              type="button"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.meta.btnSave}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        id="dialog-share"
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.files.share.title}
          icon="ti-link"
          closeId="share-close"
          closeLabel={t.files.share.btnClose}
        />
        <div className="px-6 pt-4">
          <p
            id="share-scope"
            className="truncate text-xs text-muted-foreground"
          >
            —
          </p>
        </div>
        <form id="form-share" className="flex flex-col gap-3 px-6 py-4">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.share.labelServeFrom}
            </span>
            <select
              id="share-root"
              className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
            ></select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.files.share.labelExpiry}
              </span>
              <select
                id="share-expiry"
                className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value="60">{t.files.share.option1h}</option>
                <option value="1440">{t.files.share.option24h}</option>
                <option value="10080">{t.files.share.option7d}</option>
                <option value="43200">{t.files.share.option30d}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.files.share.labelMaxDownloads}
              </span>
              <input
                id="share-max"
                type="number"
                min="0"
                max="100000"
                defaultValue="0"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.files.share.labelPassword}
            </span>
            <input
              id="share-password"
              type="password"
              autoComplete="new-password"
              placeholder={t.files.share.placeholderPassword}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.files.share.btnCreate}
            </button>
          </div>
          <div
            id="share-result"
            className="hidden items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2"
          >
            <input
              id="share-url"
              type="text"
              readOnly
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground focus:outline-none"
            />
            <button
              id="share-copy"
              type="button"
              className="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              {t.files.share.btnCopy}
            </button>
          </div>
        </form>
        <div className="border-t border-border px-2 py-2">
          <div className="flex items-center justify-between px-4 pb-1 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.files.share.activeLinksLabel}
            </span>
            <button
              id="share-refresh"
              type="button"
              className="text-[11px] text-primary hover:underline"
            >
              {t.files.share.btnRefresh}
            </button>
          </div>
          <div id="share-list" className="max-h-48 overflow-y-auto px-2"></div>
        </div>
      </dialog>

      <input
        id="upload-input"
        type="file"
        multiple
        className="hidden"
        aria-label={t.files.upload.ariaLabel}
      />
      <section
        id="files-upload-progress"
        aria-live="polite"
        className="fixed bottom-20 right-4 z-40 hidden w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {t.files.upload.progressTitle}
          </h3>
          <button
            id="files-upload-progress-close"
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label={t.files.upload.closeProgress}
          >
            <i className="ti ti-x"></i>
          </button>
        </div>
        <div
          id="files-upload-progress-count"
          className="mt-1 text-xs text-muted-foreground"
        ></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            id="files-upload-progress-bar"
            className="h-full bg-primary transition-[width] duration-200"
            style={cssStyle("width:0%")}
          ></div>
        </div>
        <div
          id="files-upload-progress-list"
          className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs"
        ></div>
      </section>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      {/** Media preview (image / video / audio) */}
      <dialog
        id="dialog-media"
        data-lxp-modal-keep
        className="w-[min(96vw,1100px)] rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              id="media-filename"
              className="text-xs font-medium text-muted-foreground truncate"
            >
              {t.files.media.filenameLabel}
            </span>
            <span
              id="media-counter"
              className="hidden shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
            ></span>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              id="media-download"
              href="#"
              download
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t.files.media.btnDownloadTitle}
            >
              <i className="ti ti-download text-base"></i>
            </a>
            <button
              id="media-close"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t.files.media.btnCloseTitle}
            >
              <i className="ti ti-x text-lg"></i>
            </button>
          </div>
        </div>
        {/** Carrusel: las flechas viven FUERA de #media-body (cuyo innerHTML se
         reemplaza en cada slide) para persistir entre imágenes. */}
        <div className="relative">
          <button
            id="media-prev"
            type="button"
            aria-label={t.files.media.prevLabel}
            className="hidden absolute left-2 top-1/2 z-10 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <i className="ti ti-chevron-left text-2xl"></i>
          </button>
          <button
            id="media-next"
            type="button"
            aria-label={t.files.media.nextLabel}
            className="hidden absolute right-2 top-1/2 z-10 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <i className="ti ti-chevron-right text-2xl"></i>
          </button>
          <div
            id="media-body"
            className="flex max-h-[80vh] min-h-[200px] items-center justify-center overflow-auto bg-black/40 p-3"
          ></div>
        </div>
      </dialog>

      <script
        type="application/json"
        id="files-i18n"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["files"]) }}
      ></script>
      {/** INVARIANTE DE CACHÉ: este `?v=` es la ÚNICA clave que el navegador vuelve a
         pedir cuando cambia cualquier módulo del bundle `files/` (todos se empaquetan
         dentro de index-script1.js) o el asset hermano `panel-files-monaco.js`. Si se
         bumpea el `?v=` interno (files/editor.ts) pero NO este, un cliente que ya
         tenga este URL cacheado sigue ejecutando el bundle viejo y con él el import
         interno viejo: el arreglo queda en `dist` y nunca llega al navegador. Bumpea
         SIEMPRE este valor junto con SW_VERSION al tocar el módulo. */}
    </Fragment>
  );
}
