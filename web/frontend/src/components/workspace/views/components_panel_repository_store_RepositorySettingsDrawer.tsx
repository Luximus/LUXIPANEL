// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-repository-store/RepositorySettingsDrawer.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import { getMessages } from "../view-context";
import { localeFromRequest } from "../view-context";
export default function components_panel_repository_store_RepositorySettingsDrawer(
  props: any,
) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const messages = getMessages(localeFromRequest(Astro.request), [
    "repositoryStore",
    "components",
  ]);
  const rs = messages.repositoryStore;
  const ui = rs.settingsUi;
  const tabs = [
    { id: "catalog", label: ui.catalog, icon: "ti-layout-grid" },
    { id: "cloning", label: ui.cloning, icon: "ti-git-branch" },
    { id: "connection", label: ui.connection, icon: "ti-plug-connected" },
  ] as const;

  return (
    <Fragment>
      <ViewSettingsModal
        id="repo-settings"
        title={ui.title}
        description={ui.description}
        variant="drawer"
        hideFooter={true}
      >
        <div
          data-repo-settings-tabs
          className="flex h-full min-h-0 w-full @container"
        >
          <nav
            className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
            role="tablist"
            aria-label={ui.title}
            aria-orientation="vertical"
          >
            {tabs.map((tab: any, index: number) => (
              <Fragment>
                <button
                  id={`repo-settings-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  title={tab.label}
                  aria-label={tab.label}
                  aria-selected={index === 0 ? "true" : "false"}
                  aria-controls={`repo-settings-panel-${tab.id}`}
                  tabIndex={index === 0 ? 0 : -1}
                  data-repo-settings-tab={tab.id}
                  className={classList([
                    "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    index === 0
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  ])}
                >
                  <i
                    className={`ti ${tab.icon} shrink-0 text-lg`}
                    aria-hidden="true"
                  ></i>
                  <span className="hidden truncate @xl:inline">
                    {tab.label}
                  </span>
                </button>
              </Fragment>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            <form
              id="repo-settings-form"
              className="mx-auto max-w-2xl space-y-5"
            >
              <section
                id="repo-settings-panel-catalog"
                data-repo-settings-panel="catalog"
                role="tabpanel"
                aria-labelledby="repo-settings-tab-catalog"
                className="space-y-4"
              >
                <div>
                  <h2 className="text-base font-semibold">{ui.catalogView}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ui.catalogHint}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-muted-foreground">
                    {ui.defaultTab}
                    <select
                      name="defaultTab"
                      className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm"
                    >
                      <option value="all">{rs.tabs.todos}</option>
                      <option value="saved">{ui.saved}</option>
                      <option value="cloned">{ui.cloned}</option>
                      <option value="update">{ui.updates}</option>
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    {ui.initialSort}
                    <select
                      name="sort"
                      className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm"
                    >
                      <option value="relevance">{rs.sort.relevancia}</option>
                      <option value="stars_desc">
                        {rs.sort.starsMayorAMenor}
                      </option>
                      <option value="stars_asc">
                        {rs.sort.starsMenorAMayor}
                      </option>
                      <option value="updated_desc">
                        {rs.sort.recienActualizados}
                      </option>
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    {messages.components.dataTable.resultsPerPage}
                    <select
                      name="pageSize"
                      className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm"
                    >
                      <option value="24">24</option>
                      <option value="36">36</option>
                      <option value="60">60</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end rounded-lg border border-border p-2 text-sm">
                    <input name="showArchived" type="checkbox" />{" "}
                    {ui.showArchived}
                  </label>
                </div>
              </section>

              <section
                id="repo-settings-panel-cloning"
                data-repo-settings-panel="cloning"
                role="tabpanel"
                aria-labelledby="repo-settings-tab-cloning"
                className="hidden space-y-4"
              >
                <div>
                  <h2 className="text-base font-semibold">{ui.cloning}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ui.cloneHint}
                  </p>
                </div>
                <label className="block text-xs text-muted-foreground">
                  {ui.parentFolder}
                  <input
                    name="cloneParent"
                    type="text"
                    placeholder="/var/www"
                    className="mt-1 w-full rounded-lg border border-border bg-card p-2 font-mono text-sm"
                  />
                </label>
                <label className="block text-xs text-muted-foreground">
                  {ui.preferredMethod}
                  <select
                    name="transport"
                    className="mt-1 w-full rounded-lg border border-border bg-card p-2 text-sm"
                  >
                    <option value="https">HTTPS</option>
                    <option value="ssh">SSH</option>
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">
                  {ui.cloneWarning}
                </p>
              </section>

              <div
                data-repo-settings-save
                className="flex flex-wrap items-center gap-3 border-t border-border pt-5"
              >
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  {ui.saveSettings}
                </button>
                <span
                  id="repo-settings-message"
                  role="status"
                  className="text-sm text-muted-foreground"
                ></span>
              </div>
            </form>

            <form
              id="repo-link-form"
              data-repo-settings-panel="cloning"
              className="mx-auto mt-6 hidden max-w-2xl space-y-3 border-t border-border pt-5"
            >
              <h2 className="text-sm font-semibold">{ui.linkExisting}</h2>
              <p className="text-xs text-muted-foreground">{ui.linkHint}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  {ui.repository}
                  <input
                    name="fullName"
                    required
                    placeholder="owner/repo"
                    className="mt-1 w-full rounded-lg border border-border bg-card p-2 font-mono text-sm"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  {ui.folderPath}
                  <input
                    name="path"
                    required
                    placeholder="/var/www/repo"
                    className="mt-1 w-full rounded-lg border border-border bg-card p-2 font-mono text-sm"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {ui.link}
                </button>
                <span
                  id="repo-link-message"
                  role="status"
                  className="text-sm text-muted-foreground"
                ></span>
              </div>
            </form>

            <section
              id="repo-settings-panel-connection"
              data-repo-settings-panel="connection"
              role="tabpanel"
              aria-labelledby="repo-settings-tab-connection"
              className="mx-auto hidden max-w-2xl space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold">{ui.connection}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ui.connectionHint}
                </p>
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-4">
                <p
                  id="repo-settings-token"
                  className="text-sm text-muted-foreground"
                >
                  {ui.checkingToken}
                </p>
                <p
                  id="repo-settings-git"
                  className="text-sm text-muted-foreground"
                >
                  {ui.checkingGitSsh}
                </p>
              </div>
              <a
                href="/panel/settings#cred-repository-store"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {ui.manageCredentials} <i className="ti ti-arrow-right"></i>
              </a>
            </section>
          </div>
        </div>
      </ViewSettingsModal>
    </Fragment>
  );
}
