// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/obsidian/index.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

/**
 * Obsidian — /panel/obsidian
 *
 * Vault manager for Obsidian-style markdown knowledge bases living on the
 * CONNECTED server: register/create vaults, browse the note tree, edit notes
 * with Markdown preview, wikilinks, full-text search, daily notes and
 * administrator-only context preparation for AI agents.
 */
import PanelLayout from "../module-frame";
import ModalNavbar from "./components_ui_ModalNavbar";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import { getSession, canSeeSidebar } from "../view-context";
import { getPageMessages } from "../view-context";
export default function pages_panel_obsidian_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["obsidian"]);
  const user = getSession(Astro.request);
  const isAdmin = user?.kind === "admin";
  const canUseAssistant = user ? canSeeSidebar(user, "assistant") : false;
  const ui = t.obsidian.workspace;

  return (
    <Fragment>
      <PanelLayout title={t.obsidian.pageTitle} activeModule="obsidian">
        <div slot="title-actions">
          <ViewSettingsModal
            id="obs-settings"
            title={ui.settingsTitle}
            description={ui.settingsDescription}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav
                className="flex w-14 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-2 @xl:w-48"
                aria-label={ui.settingsTitle}
              >
                <button
                  type="button"
                  data-obs-settings-tab="appearance"
                  className="obs-settings-tab flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-2 py-2.5 text-sm font-medium text-primary @xl:justify-start"
                  title={ui.appearance}
                >
                  <i className="ti ti-adjustments text-lg"></i>
                  <span className="hidden @xl:inline">{ui.appearance}</span>
                </button>
                <button
                  type="button"
                  data-obs-settings-tab="shortcuts"
                  className="obs-settings-tab flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-accent @xl:justify-start"
                  title={ui.shortcuts}
                >
                  <i className="ti ti-keyboard text-lg"></i>
                  <span className="hidden @xl:inline">{ui.shortcuts}</span>
                </button>
                {isAdmin && (
                  <Fragment>
                    <button
                      type="button"
                      data-obs-settings-tab="vaults"
                      className="obs-settings-tab flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-accent @xl:justify-start"
                      title={ui.vaults}
                    >
                      <i className="ti ti-notebook text-lg"></i>
                      <span className="hidden @xl:inline">{ui.vaults}</span>
                    </button>
                  </Fragment>
                )}
                {isAdmin && (
                  <Fragment>
                    <button
                      type="button"
                      data-obs-settings-tab="ai"
                      className="obs-settings-tab flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:bg-accent @xl:justify-start"
                      title={ui.aiIntegration}
                    >
                      <i className="ti ti-robot text-lg"></i>
                      <span className="hidden @xl:inline">
                        {ui.aiIntegration}
                      </span>
                    </button>
                  </Fragment>
                )}
              </nav>
              <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 @xl:px-7">
                <section
                  data-obs-settings-panel="appearance"
                  className="space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">{ui.appearance}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ui.personalHint}
                    </p>
                  </div>
                  <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 text-sm">
                    <span>{ui.defaultView}</span>
                    <select
                      id="obs-pref-mode"
                      className="h-9 rounded-lg border border-input bg-background px-2"
                    >
                      <option value="edit">{ui.edit}</option>
                      <option value="preview">{ui.preview}</option>
                      <option value="split">{ui.split}</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4 text-sm">
                    <span>{ui.fontSize}</span>
                    <select
                      id="obs-pref-font"
                      className="h-9 rounded-lg border border-input bg-background px-2"
                    >
                      <option value="12">12 px</option>
                      <option value="14">14 px</option>
                      <option value="16">16 px</option>
                      <option value="18">18 px</option>
                      <option value="20">20 px</option>
                    </select>
                  </label>
                  <p
                    id="obs-pref-status"
                    role="status"
                    aria-live="polite"
                    className="text-xs text-muted-foreground"
                  ></p>
                </section>
                <section
                  data-obs-settings-panel="shortcuts"
                  className="hidden space-y-4"
                >
                  <h3 className="text-base font-semibold">{ui.shortcuts}</h3>
                  <p className="text-sm text-muted-foreground">
                    {ui.shortcutsHint}
                  </p>
                  <dl className="divide-y divide-border rounded-xl border border-border bg-background px-4 text-sm">
                    <div className="flex justify-between gap-3 py-3">
                      <dt>{ui.saveShortcut}</dt>
                      <dd className="font-mono">Ctrl/⌘ + S</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-3">
                      <dt>{ui.searchShortcut}</dt>
                      <dd className="font-mono">Ctrl/⌘ + K</dd>
                    </div>
                  </dl>
                </section>
                {isAdmin && (
                  <Fragment>
                    <section
                      data-obs-settings-panel="vaults"
                      className="hidden space-y-4"
                    >
                      <div>
                        <h3 className="text-base font-semibold">{ui.vaults}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {ui.vaultsHint}
                        </p>
                      </div>
                      <button
                        id="obs-new-vault"
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                      >
                        <i className="ti ti-plus"></i>
                        {t.obsidian.toolbar.newVault}
                      </button>
                      <div
                        id="obs-settings-vault-list"
                        className="space-y-2"
                      ></div>
                      <button
                        id="obs-unregister"
                        type="button"
                        className="hidden items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive"
                      >
                        <i className="ti ti-plug-off"></i>
                        {t.obsidian.toolbar.unregister}
                      </button>
                    </section>
                  </Fragment>
                )}
                {isAdmin && (
                  <Fragment>
                    <section
                      data-obs-settings-panel="ai"
                      className="hidden space-y-4"
                    >
                      <div>
                        <h3 className="text-base font-semibold">
                          {ui.aiIntegration}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {ui.aiHint}
                        </p>
                      </div>
                      <button
                        id="obs-prepare-ai"
                        type="button"
                        className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        <i className="ti ti-robot"></i>
                        {t.obsidian.toolbar.prepareAi}
                      </button>
                      <button
                        id="obs-sync-containers"
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                      >
                        <i className="ti ti-folders"></i>
                        {t.obsidian.toolbar.syncContainers}
                      </button>
                    </section>
                  </Fragment>
                )}
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {t.obsidian.header.subheading}
        </p>
        <div
          id="obs-toolbar"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3"
        >
          <select
            id="obs-vault-select"
            aria-label={ui.vaults}
            className="h-10 min-w-44 max-w-full flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:max-w-xs"
          ></select>
          <span
            id="obs-vault-status"
            className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            role="status"
          >
            {t.obsidian.labels.loading}
          </span>
          <button
            id="obs-toolbar-new-note"
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <i className="ti ti-file-plus"></i>
            {t.obsidian.tree.newNote}
          </button>
          <button
            id="obs-today"
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <i className="ti ti-calendar"></i>
            {ui.today}
          </button>
          <button
            id="obs-daily-append"
            type="button"
            disabled
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            <i className="ti ti-plus"></i>
            {ui.quickEntry}
          </button>
        </div>

        <div
          id="obs-empty"
          className="hidden rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"
        >
          <i className="ti ti-notebook mb-3 inline-block text-4xl text-muted-foreground"></i>
          <h3 className="mb-1 text-base font-semibold">
            {t.obsidian.empty.noVaultsTitle}
          </h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            {isAdmin ? t.obsidian.empty.noVaultsDescription : ui.askAdmin}
          </p>
          {isAdmin && (
            <Fragment>
              <button
                id="obs-empty-cta"
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <i className="ti ti-plus text-base"></i>
                {t.obsidian.empty.noVaultsCta}
              </button>
            </Fragment>
          )}
        </div>

        <div
          id="obs-main"
          className="hidden h-[min(76dvh,52rem)] min-h-[26rem] grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-rows-1 lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)]"
        >
          <div
            className="mb-2 flex rounded-lg border border-border bg-muted/30 p-1 lg:hidden"
            role="group"
            aria-label={ui.mobileView}
          >
            <button
              id="obs-mobile-tree"
              type="button"
              className="flex-1 rounded-md bg-card px-3 py-2 text-sm font-medium shadow-sm"
              aria-pressed="true"
            >
              {t.obsidian.tree.title}
            </button>
            <button
              id="obs-mobile-editor"
              type="button"
              className="flex-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
              aria-pressed="false"
            >
              {ui.editorPane}
            </button>
          </div>
          <aside
            id="obs-tree-pane"
            className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">{t.obsidian.tree.title}</h3>
              <div className="flex items-center gap-1">
                <button
                  id="obs-new-note"
                  type="button"
                  disabled
                  title={t.obsidian.tree.newNote}
                  aria-label={t.obsidian.tree.newNote}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <i className="ti ti-file-plus text-base"></i>
                </button>
                <button
                  id="obs-new-folder"
                  type="button"
                  disabled
                  title={t.obsidian.tree.newFolder}
                  aria-label={t.obsidian.tree.newFolder}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <i className="ti ti-folder-plus text-base"></i>
                </button>
              </div>
            </div>
            <div className="relative border-b border-border p-2">
              <i className="ti ti-search pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"></i>
              <input
                id="obs-search"
                type="search"
                autoComplete="off"
                spellCheck="false"
                placeholder={t.obsidian.toolbar.searchPlaceholder}
                aria-label={t.obsidian.toolbar.searchPlaceholder}
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div id="obs-search-results" className="hidden">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-semibold">
                    {t.obsidian.search.title}
                  </span>
                  <button
                    id="obs-search-clear"
                    type="button"
                    className="text-xs text-primary"
                  >
                    {ui.clearSearch}
                  </button>
                </div>
                <div id="obs-search-list" className="p-1.5 text-sm"></div>
              </div>
              <div id="obs-tree" className="p-1.5 text-sm"></div>
            </div>
          </aside>

          <section
            id="obs-editor-pane"
            className="hidden min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card lg:flex"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <strong
                    id="obs-note-name"
                    className="block truncate text-sm font-semibold text-foreground"
                  >
                    {t.obsidian.editor.emptyTitle}
                  </strong>
                  <span
                    id="obs-note-path"
                    className="block truncate font-mono text-[11px] text-muted-foreground"
                  ></span>
                </div>
                <span
                  id="obs-dirty"
                  title={t.obsidian.editor.unsavedChanges}
                  className="hidden h-2 w-2 shrink-0 rounded-full bg-amber-500"
                ></span>
                <span
                  id="obs-note-readonly"
                  className="hidden shrink-0 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-600"
                >
                  {ui.readOnly}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="obs-links-toggle"
                  type="button"
                  className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <i className="ti ti-link text-sm"></i>
                  {t.obsidian.editor.links}
                  <i
                    id="obs-links-chevron"
                    className="ti ti-chevron-down text-sm"
                  ></i>
                </button>
                {canUseAssistant && (
                  <Fragment>
                    <button
                      id="obs-analyze-ai"
                      type="button"
                      className="hidden items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                    >
                      <i className="ti ti-sparkles text-sm"></i>
                      {t.obsidian.editor.analyzeAi}
                    </button>
                  </Fragment>
                )}
                <button
                  id="obs-save"
                  type="button"
                  className="hidden items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <i className="ti ti-device-floppy text-sm"></i>
                  {t.obsidian.editor.save}
                </button>
              </div>
            </div>
            <div
              id="obs-links-panel"
              className="hidden max-h-52 overflow-y-auto border-b border-border bg-muted/20 px-4 py-3 text-sm"
            ></div>
            <div id="obs-editor-empty" className="px-6 py-20 text-center">
              <i className="ti ti-file-text mb-3 inline-block text-3xl text-muted-foreground"></i>
              <p className="text-sm font-medium">
                {t.obsidian.editor.emptyTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.obsidian.editor.emptyDescription}
              </p>
            </div>
            <div
              id="obs-mode-tabs"
              className="hidden border-b border-border px-3 py-2"
              role="group"
              aria-label={ui.defaultView}
            >
              <button
                type="button"
                data-obs-mode="edit"
                className="obs-mode-btn rounded-md px-3 py-1.5 text-xs font-medium"
              >
                {ui.edit}
              </button>
              <button
                type="button"
                data-obs-mode="preview"
                className="obs-mode-btn rounded-md px-3 py-1.5 text-xs font-medium"
              >
                {ui.preview}
              </button>
              <button
                type="button"
                data-obs-mode="split"
                className="obs-mode-btn rounded-md px-3 py-1.5 text-xs font-medium"
              >
                {ui.split}
              </button>
            </div>
            <div
              id="obs-editor-content"
              className="flex min-h-0 flex-1 overflow-hidden"
            >
              <textarea
                id="obs-editor"
                rows={24}
                spellCheck="false"
                aria-label={ui.editorPane}
                className="hidden min-h-[24rem] w-full flex-1 resize-none overflow-y-auto bg-background px-5 py-4 font-mono text-sm leading-relaxed focus:outline-none"
              ></textarea>
              <div
                id="obs-preview"
                className="prose prose-sm hidden min-h-[24rem] w-full flex-1 overflow-y-auto bg-background px-6 py-4 text-sm leading-relaxed dark:prose-invert"
              ></div>
            </div>
          </section>
        </div>
      </PanelLayout>

      {/** New vault (create folder or register existing) */}
      <dialog
        id="dlg-obs-vault"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.obsidian.vaultDialog.title}
          closeId="obs-vault-x"
        />
        <div className="flex flex-col gap-4 px-6 py-4">
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              htmlFor="obs-vault-name"
            >
              {t.obsidian.vaultDialog.labelName}
            </label>
            <input
              id="obs-vault-name"
              type="text"
              placeholder={t.obsidian.vaultDialog.placeholderName}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              htmlFor="obs-vault-path"
            >
              {t.obsidian.vaultDialog.labelPath}
            </label>
            <div className="flex gap-2">
              <input
                id="obs-vault-path"
                type="text"
                placeholder={t.obsidian.vaultDialog.placeholderPath}
                spellCheck="false"
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                id="obs-vault-browse"
                type="button"
                title={t.obsidian.vaultDialog.btnBrowse}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                <i className="ti ti-folder-search text-base"></i>
                <span className="hidden sm:inline">
                  {t.obsidian.vaultDialog.btnBrowse}
                </span>
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2.5 hover:bg-accent">
              <input
                type="radio"
                name="obs-vault-mode"
                defaultValue="create"
                defaultChecked
                className="mt-0.5 h-4 w-4 border-input text-primary"
              />
              <span>
                <span className="block text-sm font-medium">
                  {t.obsidian.vaultDialog.modeCreate}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t.obsidian.vaultDialog.modeCreateHint}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2.5 hover:bg-accent">
              <input
                type="radio"
                name="obs-vault-mode"
                defaultValue="register"
                className="mt-0.5 h-4 w-4 border-input text-primary"
              />
              <span>
                <span className="block text-sm font-medium">
                  {t.obsidian.vaultDialog.modeRegister}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t.obsidian.vaultDialog.modeRegisterHint}
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="obs-vault-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.obsidian.vaultDialog.btnCancel}
          </button>
          <button
            id="obs-vault-save"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <i className="ti ti-device-floppy text-base"></i>{" "}
            {t.obsidian.vaultDialog.btnSave}
          </button>
        </div>
      </dialog>

      {/** Server folder picker for the vault path (same pattern as the users module) */}
      <dialog
        id="dlg-obs-path-browser"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar
          title={t.obsidian.pathBrowserDialog.title}
          closeId="obs-path-browser-x"
        />
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              id="obs-path-browser-up"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              <i className="ti ti-arrow-up"></i>{" "}
              {t.obsidian.pathBrowserDialog.btnUp}
            </button>
            <code
              id="obs-path-browser-current"
              className="flex-1 truncate rounded-md bg-muted/40 px-2 py-1 text-xs"
            >
              /
            </code>
          </div>
          <div
            id="obs-path-browser-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          ></div>
          <ul
            id="obs-path-browser-list"
            className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm"
          ></ul>
          <div className="flex gap-2">
            <button
              type="button"
              id="obs-path-browser-cancel"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.obsidian.pathBrowserDialog.btnCancel}
            </button>
            <button
              type="button"
              id="obs-path-browser-select"
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.obsidian.pathBrowserDialog.btnSelect}
            </button>
          </div>
        </div>
      </dialog>

      {/** Generic input dialog (new note / new folder / rename) */}
      <dialog
        id="dlg-obs-input"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <ModalNavbar title="" titleId="obs-input-title" closeId="obs-input-x" />
        <div className="px-6 py-4">
          <label
            id="obs-input-label"
            className="mb-1 block text-xs font-medium"
            htmlFor="obs-input-value"
          ></label>
          <input
            id="obs-input-value"
            type="text"
            spellCheck="false"
            autoComplete="off"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="obs-input-cancel"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t.obsidian.inputDialog.btnCancel}
          </button>
          <button
            id="obs-input-ok"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t.obsidian.inputDialog.btnOk}
          </button>
        </div>
      </dialog>

      <dialog
        id="dlg-obs-daily"
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60"
      >
        <ModalNavbar title={ui.quickEntry} closeId="obs-daily-x" />
        <div className="space-y-3 px-6 py-4">
          <p className="text-sm text-muted-foreground">{ui.quickEntryHint}</p>
          <textarea
            id="obs-daily-content"
            rows={6}
            className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label={ui.quickEntry}
          ></textarea>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            id="obs-daily-cancel"
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm"
          >
            {t.obsidian.inputDialog.btnCancel}
          </button>
          <button
            id="obs-daily-save"
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {ui.append}
          </button>
        </div>
      </dialog>

      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="obsidian-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["obsidian"]) }}
      ></script>

      <style>{`{"\\n  :global(#obs-preview h1) { font-size: 1.6em; font-weight: 700; margin: 0.9em 0 0.5em; }\\n  :global(#obs-preview h2) { font-size: 1.3em; font-weight: 650; margin: 0.9em 0 0.4em; }\\n  :global(#obs-preview h3) { font-size: 1.15em; font-weight: 600; margin: 0.8em 0 0.3em; }\\n  :global(#obs-preview p) { margin: 0.65em 0; }\\n  :global(#obs-preview ul) { list-style: disc; padding-left: 1.5em; }\\n  :global(#obs-preview ol) { list-style: decimal; padding-left: 1.5em; }\\n  :global(#obs-preview blockquote) { border-left: 3px solid var(--border); padding-left: 1em; color: var(--muted-foreground); }\\n  :global(#obs-preview pre) { overflow-x: auto; border-radius: 0.6em; background: var(--muted); padding: 1em; }\\n  :global(#obs-preview code) { font-family: ui-monospace, monospace; }\\n  :global(#obs-preview table) { width: 100%; border-collapse: collapse; }\\n  :global(#obs-preview th), :global(#obs-preview td) { border: 1px solid var(--border); padding: 0.35em 0.6em; }\\n  :global(#obs-preview a) { color: var(--primary); text-decoration: underline; }\\n"}`}</style>
    </Fragment>
  );
}
