// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/users/index.astro.
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
 * Users & Roles page — /panel/users
 */
import HostingTemplates from "./components_users_HostingTemplates";
import PanelLayout from "../module-frame";
import ModalNavbar from "./components_ui_ModalNavbar";
import DataTable from "@/components/ui/DataTable";
import ViewSettingsModal from "./components_ui_ViewSettingsModal";
import {
  buildRoleTableColumns,
  buildRoleTableFilters,
  buildRoleTableQuickActions,
  buildRoleTableRowActions,
  buildRoleTableValueBadges,
  buildUserTableColumns,
  buildUserTableFilters,
  buildUserTableQuickActions,
  buildUserTableRowActions,
  buildUserTableValueBadges,
} from "@/config/tables/users-table-config";
import { getPageMessages } from "../view-context";
export default function pages_panel_users_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["users", "components", "permissions"]);
  const tu = t.users;
  const us = tu.settingsUi;
  const dataTableI18n = t.components.dataTable;
  const USER_TABLE_COLUMNS = buildUserTableColumns(tu);
  const USER_TABLE_FILTERS = buildUserTableFilters(tu);
  const USER_TABLE_ROW_ACTIONS = buildUserTableRowActions(tu);
  const USER_TABLE_QUICK_ACTIONS = buildUserTableQuickActions(tu);
  const USER_TABLE_VALUE_BADGES = buildUserTableValueBadges(tu);
  const ROLE_TABLE_COLUMNS = buildRoleTableColumns(tu);
  const ROLE_TABLE_FILTERS = buildRoleTableFilters(tu);
  const ROLE_TABLE_ROW_ACTIONS = buildRoleTableRowActions(tu);
  const ROLE_TABLE_QUICK_ACTIONS = buildRoleTableQuickActions(tu);
  const ROLE_TABLE_VALUE_BADGES = buildRoleTableValueBadges(tu);
  const usersView = Astro.url.searchParams.get("workspaceView");
  const isolatedUsersView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["users", "roles"].includes(usersView ?? "");
  const showUsersView = (view: string) =>
    !isolatedUsersView || usersView === view;

  return (
    <Fragment>
      <PanelLayout title={t.users.pageTitle} activeModule="users">
        <div slot="title-actions">
          <ViewSettingsModal
            id="users-settings-modal"
            title={us.title}
            description={us.description}
            variant="drawer"
            hideFooter={true}
          >
            <div className="flex h-full min-h-0 w-full @container">
              <nav
                className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-muted/20 p-2 @xl:w-52"
                role="tablist"
                aria-label={us.title}
              >
                <button
                  type="button"
                  role="tab"
                  title={tu.tabs.users}
                  aria-label={tu.tabs.users}
                  aria-selected="true"
                  aria-controls="users-settings-view-users"
                  data-users-settings-nav="users"
                  className="flex items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-2.5 py-2 text-sm font-medium text-primary transition-colors @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <i className="ti ti-users shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {tu.tabs.users}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  title={us.roles}
                  aria-label={us.roles}
                  aria-selected="false"
                  aria-controls="users-settings-view-roles"
                  data-users-settings-nav="roles"
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <i className="ti ti-shield-lock shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">{us.roles}</span>
                </button>
                <div className="my-1 border-t border-border"></div>
                <button
                  type="button"
                  role="tab"
                  title={us.summary}
                  aria-label={us.summary}
                  aria-selected="false"
                  aria-controls="users-settings-view-summary"
                  data-users-settings-nav="summary"
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <i className="ti ti-chart-bar shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {us.summary}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  title={us.access}
                  aria-label={us.access}
                  aria-selected="false"
                  aria-controls="users-settings-view-access"
                  data-users-settings-nav="access"
                  className="flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground @xl:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <i className="ti ti-login-2 shrink-0 text-lg"></i>
                  <span className="hidden truncate @xl:inline">
                    {us.access}
                  </span>
                </button>
              </nav>
              <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-5">
                <section
                  id="users-settings-view-users"
                  role="tabpanel"
                  data-users-settings-view="users"
                  data-users-table="users-main-table"
                  className="space-y-5"
                >
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.pagination}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.components.tableSettings.rowsPerPage}
                    </p>
                    <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-border">
                      {[10, 25, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-users-pagesize={n}
                            className="border-r border-border px-3.5 py-1.5 text-sm font-medium transition-colors last:border-r-0 hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.visibleActions}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.components.tableSettings.actionsHint}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {USER_TABLE_ROW_ACTIONS.map((a: any) => (
                        <Fragment>
                          <label className="flex items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-accent/40">
                            <input
                              type="checkbox"
                              data-users-action-toggle={a.id}
                              defaultChecked
                              className="h-4 w-4 rounded border-border"
                            />
                            {a.icon && (
                              <Fragment>
                                <i
                                  className={`ti ${a.icon} text-base text-muted-foreground`}
                                ></i>
                              </Fragment>
                            )}
                            <span>{a.label}</span>
                          </label>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </section>
                <section
                  id="users-settings-view-roles"
                  role="tabpanel"
                  data-users-settings-view="roles"
                  data-users-table="roles-main-table"
                  className="hidden space-y-5"
                >
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.pagination}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.components.tableSettings.rowsPerPage}
                    </p>
                    <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-border">
                      {[10, 25, 50, 100].map((n: any) => (
                        <Fragment>
                          <button
                            type="button"
                            data-users-pagesize={n}
                            className="border-r border-border px-3.5 py-1.5 text-sm font-medium transition-colors last:border-r-0 hover:bg-accent"
                          >
                            {n}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t.components.tableSettings.visibleActions}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.components.tableSettings.actionsHint}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {ROLE_TABLE_ROW_ACTIONS.map((a: any) => (
                        <Fragment>
                          <label className="flex items-center gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-accent/40">
                            <input
                              type="checkbox"
                              data-users-action-toggle={a.id}
                              defaultChecked
                              className="h-4 w-4 rounded border-border"
                            />
                            {a.icon && (
                              <Fragment>
                                <i
                                  className={`ti ${a.icon} text-base text-muted-foreground`}
                                ></i>
                              </Fragment>
                            )}
                            <span>{a.label}</span>
                          </label>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </section>
                <section
                  id="users-settings-view-summary"
                  role="tabpanel"
                  data-users-settings-view="summary"
                  className="hidden space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {us.serverAccounts}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {us.serverAccountsHint}
                    </p>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-3">
                      <dt className="text-xs text-muted-foreground">
                        {us.visibleUsers}
                      </dt>
                      <dd
                        id="users-summary-total"
                        className="mt-1 text-2xl font-semibold tabular-nums"
                      >
                        —
                      </dd>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <dt className="text-xs text-muted-foreground">
                        {us.lockedPasswords}
                      </dt>
                      <dd
                        id="users-summary-locked"
                        className="mt-1 text-2xl font-semibold tabular-nums"
                      >
                        —
                      </dd>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <dt className="text-xs text-muted-foreground">
                        {us.interactiveConnections}
                      </dt>
                      <dd
                        id="users-summary-connections"
                        className="mt-1 text-2xl font-semibold tabular-nums"
                      >
                        —
                      </dd>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-3">
                      <dt className="text-xs text-muted-foreground">
                        {us.visibleGroups}
                      </dt>
                      <dd
                        id="users-summary-roles"
                        className="mt-1 text-2xl font-semibold tabular-nums"
                      >
                        —
                      </dd>
                    </div>
                  </dl>
                  <p
                    id="users-summary-status"
                    role="status"
                    className="text-xs text-muted-foreground"
                  >
                    {us.openSectionHint}
                  </p>
                  <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      id="users-settings-refresh"
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <i className="ti ti-refresh mr-1" aria-hidden="true"></i>
                      {us.refreshSummary}
                    </button>
                    <button
                      type="button"
                      id="users-settings-export-users"
                      disabled
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <i className="ti ti-download mr-1" aria-hidden="true"></i>
                      {us.exportUsers}
                    </button>
                    <button
                      type="button"
                      id="users-settings-export-roles"
                      disabled
                      className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <i className="ti ti-download mr-1" aria-hidden="true"></i>
                      {us.exportGroups}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{us.csvHint}</p>
                </section>
                <section
                  id="users-settings-view-access"
                  role="tabpanel"
                  data-users-settings-view="access"
                  className="hidden space-y-5"
                >
                  <div>
                    <h3 className="text-base font-semibold">
                      {us.detectedAccess}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {us.detectedAccessHint}
                    </p>
                  </div>
                  <p
                    id="users-access-status"
                    role="status"
                    className="text-xs text-muted-foreground"
                  >
                    {us.openSectionHint}
                  </p>
                  <div id="users-access-list" className="space-y-2"></div>
                  <p className="text-xs text-muted-foreground">
                    {us.sshSessionHint}
                  </p>
                  <button
                    type="button"
                    id="users-access-refresh"
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <i className="ti ti-refresh mr-1" aria-hidden="true"></i>
                    {us.checkAccess}
                  </button>
                </section>
              </div>
            </div>
          </ViewSettingsModal>
        </div>

        <div className="space-y-6 pt-5">
          {/** Tabs (estilo modules: underline + count badge) */}
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            {isolatedUsersView && (
              <Fragment>
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                  {usersView === "roles"
                    ? t.users.tabs.groups
                    : t.users.tabs.users}
                </h2>
              </Fragment>
            )}
            <div
              className={
                isolatedUsersView
                  ? "sr-only"
                  : "flex min-w-0 flex-1 gap-1 overflow-x-auto"
              }
            >
              <button
                id="tab-users"
                data-tab="users"
                className="tab-btn inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:text-primary/80"
              >
                <span>{t.users.tabs.users}</span>
                <span
                  id="tab-users-count"
                  className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  —
                </span>
              </button>
              <button
                id="tab-roles"
                data-tab="roles"
                className="tab-btn inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
              >
                <span>{t.users.tabs.groups}</span>
                <span
                  id="tab-roles-count"
                  className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
                >
                  —
                </span>
              </button>
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-2 pr-1">
              <button
                id="btn-new-user"
                data-tab-action="users"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <i className="ti ti-user-plus text-base"></i>
                {t.users.buttons.newUser}
              </button>
              {Astro.locals.user?.kind === "admin" && (
                <Fragment>
                  <button
                    id="btn-hosting-plans"
                    type="button"
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    {t.permissions.title}
                  </button>
                </Fragment>
              )}
              <button
                id="btn-new-role"
                data-tab-action="roles"
                style={cssStyle("display:none")}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                <i className="ti ti-plus text-base"></i>
                {t.users.buttons.newGroup}
              </button>
            </div>
          </div>

          {/** ── Users panel ─────────────────────────────────────────── */}
          <div id="panel-users">
            {showUsersView("users") && (
              <Fragment>
                <DataTable
                  tableId="users-main-table"
                  title={t.users.columns.tableUsers}
                  columns={USER_TABLE_COLUMNS}
                  data={[]}
                  filters={USER_TABLE_FILTERS}
                  rowActions={USER_TABLE_ROW_ACTIONS}
                  quickActions={USER_TABLE_QUICK_ACTIONS}
                  valueBadges={USER_TABLE_VALUE_BADGES}
                  i18n={dataTableI18n}
                />
              </Fragment>
            )}
          </div>

          {/** ── Roles panel ─────────────────────────────────────────── */}
          <div id="panel-roles" className="hidden">
            {showUsersView("roles") && (
              <Fragment>
                <DataTable
                  tableId="roles-main-table"
                  title={t.users.columns.tableGroups}
                  columns={ROLE_TABLE_COLUMNS}
                  data={[]}
                  filters={ROLE_TABLE_FILTERS}
                  rowActions={ROLE_TABLE_ROW_ACTIONS}
                  quickActions={ROLE_TABLE_QUICK_ACTIONS}
                  valueBadges={ROLE_TABLE_VALUE_BADGES}
                  i18n={dataTableI18n}
                />
              </Fragment>
            )}
          </div>
        </div>
      </PanelLayout>

      {/** ── User Dialog ────────────────────────────────────────────── */}
      {showUsersView("users") && (
        <Fragment>
          <dialog
            id="dialog-user"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.userDialog.titleNew}
              titleId="user-dialog-title"
              closeId="user-dialog-close"
            />
            <form
              id="form-user"
              className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto"
            >
              <div
                id="user-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    htmlFor="user-username"
                  >
                    {t.users.userDialog.labelUsername}
                  </label>
                  <input
                    id="user-username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder={t.users.userDialog.placeholderUsername}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="user-display">
                    {t.users.userDialog.labelDisplayName}
                  </label>
                  <input
                    id="user-display"
                    type="text"
                    placeholder={t.users.userDialog.placeholderDisplayName}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="user-email">
                  {t.users.userDialog.labelEmail}
                </label>
                <input
                  id="user-email"
                  type="email"
                  placeholder={t.users.userDialog.placeholderEmail}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="user-password">
                  {t.users.userDialog.labelPassword}{" "}
                  <span
                    id="pass-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {t.users.userDialog.passwordHint}
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="user-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    id="user-password-toggle"
                    tabIndex={-1}
                    aria-label={t.users.userDialog.ariaTogglePassword}
                    aria-pressed="false"
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <i
                      id="user-password-toggle-icon"
                      className="ti ti-eye text-base"
                    ></i>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t.users.userDialog.labelGroups}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t.users.userDialog.groupsHelp}
                </p>
                <div className="relative">
                  <i className="ti ti-search absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"></i>
                  <input
                    id="user-groups-search"
                    type="text"
                    placeholder={t.users.userDialog.placeholderFilterGroups}
                    className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div
                  id="user-groups-grid"
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-48 overflow-y-auto"
                >
                  <p className="col-span-full text-xs text-muted-foreground">
                    {t.users.userDialog.noGroupsAvailable}
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="user-enabled"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 accent-primary cursor-pointer"
                />
                <span className="text-sm">
                  {t.users.userDialog.labelUserActive}
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="user-ai-help"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <i className="ti ti-sparkles text-base"></i>
                  {t.users.userDialog.btnAiHelp}
                </button>
                <button
                  type="button"
                  id="user-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.users.userDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  id="user-submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {t.users.userDialog.btnSave}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** ── Generate login key (ask passphrase) ─────────────────────── */}
      {showUsersView("users") && (
        <Fragment>
          <dialog
            id="dialog-gen-key"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.genKeyDialog.title}
              titleId="gen-key-title"
              closeId="gen-key-close"
            />
            <form id="form-gen-key" className="flex flex-col gap-4 px-6 py-5">
              <input
                id="gen-key-username"
                type="text"
                autoComplete="username"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                defaultValue=""
                readOnly
              />
              <div
                id="gen-key-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
                <div className="flex items-start gap-2">
                  <i className="ti ti-key text-sm text-emerald-600 dark:text-emerald-400 mt-0.5"></i>
                  <span>
                    {t.users.genKeyDialog.infoPublicKey}{" "}
                    <strong>{t.users.genKeyDialog.infoPublicKeyBold}</strong>
                    {t.users.genKeyDialog.infoPublicKeyInstall}{" "}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono">
                      ~/.ssh/authorized_keys
                    </code>{" "}
                    {t.users.genKeyDialog.infoPublicKeySuffix}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <i className="ti ti-lock text-sm text-amber-600 dark:text-amber-400 mt-0.5"></i>
                  <span>
                    {t.users.genKeyDialog.infoPrivateKey}{" "}
                    <strong>{t.users.genKeyDialog.infoPrivateKeyBold}</strong>{" "}
                    {t.users.genKeyDialog.infoPrivateKeyEncrypted}{" "}
                    <strong>{t.users.genKeyDialog.infoPrivateKeyOnce}</strong>{" "}
                    {t.users.genKeyDialog.infoPrivateKeyNoSave}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="gen-key-pass">
                  {t.users.genKeyDialog.labelPassword}
                </label>
                <div className="relative">
                  <input
                    id="gen-key-pass"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    id="gen-key-pass-toggle"
                    tabIndex={-1}
                    aria-label={t.users.genKeyDialog.ariaTogglePassword}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    <i
                      id="gen-key-pass-toggle-icon"
                      className="ti ti-eye text-base"
                    ></i>
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.users.genKeyDialog.passwordHelp}
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="gen-key-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.users.genKeyDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  id="gen-key-submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {t.users.genKeyDialog.btnGenerate}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** ── Change password (ADMIN only · gated by admin's own 2FA) ──── */}
      {showUsersView("users") && (
        <Fragment>
          <dialog
            id="dialog-change-pw"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.changePwDialog.title}
              titleId="change-pw-title"
              closeId="change-pw-close"
            />
            <form id="form-change-pw" className="flex flex-col gap-4 px-6 py-5">
              <input
                id="change-pw-username"
                type="text"
                autoComplete="username"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                defaultValue=""
                readOnly
              />
              <div
                id="change-pw-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>
              <div
                id="change-pw-2fa-hint"
                className="hidden rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
              >
                <p className="font-medium">
                  <i className="ti ti-shield-lock mr-1"></i>
                  {t.users.changePwDialog.twoFaHintTitle}
                </p>
                <p className="mt-1">{t.users.changePwDialog.twoFaHintBody}</p>
                <a
                  href="/panel/settings#seguridad"
                  className="mt-2 inline-flex items-center gap-1 font-medium underline"
                >
                  <i className="ti ti-arrow-right"></i>{" "}
                  {t.users.changePwDialog.twoFaHintLink}
                </a>
              </div>
              <div id="change-pw-fields" className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  <i className="ti ti-info-circle mr-1"></i>
                  {t.users.changePwDialog.infoText}
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    htmlFor="change-pw-password"
                  >
                    {t.users.changePwDialog.labelNewPassword}
                  </label>
                  <div className="relative">
                    <input
                      id="change-pw-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      id="change-pw-pass-toggle"
                      tabIndex={-1}
                      aria-label={t.users.changePwDialog.ariaTogglePassword}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                      <i
                        id="change-pw-pass-toggle-icon"
                        className="ti ti-eye text-base"
                      ></i>
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.users.changePwDialog.passwordStrengthHint}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm font-medium"
                    htmlFor="change-pw-totp"
                  >
                    {t.users.changePwDialog.labelTotp}
                  </label>
                  <input
                    id="change-pw-totp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    placeholder="000000"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm tracking-widest placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="change-pw-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.users.changePwDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  id="change-pw-submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {t.users.changePwDialog.btnSubmit}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** ── Login key result (shown ONCE) ───────────────────────────── */}
      {showUsersView("users") && (
        <Fragment>
          <dialog
            id="dialog-user-key"
            className="w-full max-w-xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.keyResultDialog.title}
              closeId="user-key-close"
            />
            <div className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <i className="ti ti-alert-triangle mr-1"></i>
                {t.users.keyResultDialog.warningCopyNow}{" "}
                <strong>{t.users.keyResultDialog.warningCopyNowBold}</strong>{" "}
                {t.users.keyResultDialog.warningBothKeys}{" "}
                <strong>{t.users.keyResultDialog.warningOnce}</strong>{" "}
                {t.users.keyResultDialog.warningNoSave}
                {t.users.keyResultDialog.warningPublicInstalled}{" "}
                <code className="rounded bg-amber-500/15 px-1 py-0.5 font-mono text-xs">
                  ~/.ssh/authorized_keys
                </code>
                .
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {t.users.keyResultDialog.labelPrivateKey}
                  </label>
                  <button
                    type="button"
                    id="user-key-copy-priv"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <i className="ti ti-copy"></i>{" "}
                    {t.users.keyResultDialog.btnCopyPrivate}
                  </button>
                </div>
                <textarea
                  id="user-key-private"
                  readOnly
                  rows={8}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {t.users.keyResultDialog.labelPublicKey}
                  </label>
                  <button
                    type="button"
                    id="user-key-copy-pub"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <i className="ti ti-copy"></i>{" "}
                    {t.users.keyResultDialog.btnCopyPublic}
                  </button>
                </div>
                <textarea
                  id="user-key-public"
                  readOnly
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
              </div>

              <p className="text-xs text-muted-foreground">
                {t.users.keyResultDialog.fingerprintLabel}{" "}
                <span id="user-key-fp" className="font-mono"></span>
              </p>

              <div className="pt-1">
                <button
                  type="button"
                  id="user-key-done"
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.users.keyResultDialog.btnDone}
                </button>
              </div>
            </div>
          </dialog>
        </Fragment>
      )}

      {/** ── SSH Keys Dialog ────────────────────────────────────────── */}
      {showUsersView("users") && (
        <Fragment>
          <dialog
            id="dialog-ssh-keys"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.sshKeysDialog.title}
              titleId="ssh-keys-title"
              closeId="ssh-keys-close"
            />
            <div className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto">
              <div
                id="ssh-keys-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t.users.sshKeysDialog.keysRegisteredInfo}{" "}
                  <code>~/.ssh/authorized_keys</code>{" "}
                  {t.users.sshKeysDialog.keysRegisteredSuffix}
                </p>
                <ul
                  id="ssh-keys-list"
                  className="divide-y divide-border rounded-lg border border-border text-sm"
                >
                  <li className="px-4 py-3 text-xs text-muted-foreground">
                    {t.users.sshKeysDialog.loadingKeys}
                  </li>
                </ul>
              </div>

              <form
                id="form-ssh-key"
                className="space-y-2 border-t border-border pt-4"
              >
                <label className="text-sm font-medium" htmlFor="ssh-key-input">
                  {t.users.sshKeysDialog.labelAddKey}
                </label>
                <textarea
                  id="ssh-key-input"
                  rows={3}
                  placeholder={t.users.sshKeysDialog.placeholderKey}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    id="ssh-key-add"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <i className="ti ti-plus text-base"></i>{" "}
                    {t.users.sshKeysDialog.btnAddKey}
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        </Fragment>
      )}

      {/** ── Role Dialog ────────────────────────────────────────────── */}
      {showUsersView("roles") && (
        <Fragment>
          <dialog
            id="dialog-role"
            className="w-full max-w-3xl rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.roleDialog.titleNew}
              titleId="role-dialog-title"
              closeId="role-dialog-close"
            />
            <p
              id="role-plan-hint"
              hidden
              className="px-6 pt-3 text-xs font-mono text-muted-foreground"
            ></p>
            <form
              id="form-role"
              className="flex flex-col gap-4 px-6 py-5 max-h-[82vh] overflow-y-auto"
            >
              <div
                id="role-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
              ></div>
              <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
                <button
                  type="button"
                  data-role-tab="general"
                  className="role-tab-btn rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all bg-card text-foreground shadow-sm"
                >
                  {t.users.roleDialog.tabGeneral}
                </button>
                <button
                  type="button"
                  data-role-tab="panel"
                  className="role-tab-btn rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
                >
                  {t.users.roleDialog.tabPanel}
                </button>
                <button
                  type="button"
                  data-role-tab="server"
                  className="role-tab-btn rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
                >
                  {t.users.roleDialog.tabServer}
                </button>
              </div>

              <div
                id="role-pane-general"
                data-role-pane="general"
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="role-name">
                    {t.users.roleDialog.labelGroupName}
                  </label>
                  <input
                    id="role-name"
                    type="text"
                    required
                    placeholder={t.users.roleDialog.placeholderGroupName}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p
                    id="role-name-hint"
                    className="hidden text-xs text-amber-600 dark:text-amber-400"
                  >
                    {t.users.roleDialog.groupNameHint}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="role-desc">
                    {t.users.roleDialog.labelDescription}
                  </label>
                  <input
                    id="role-desc"
                    type="text"
                    placeholder={t.users.roleDialog.placeholderDescription}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {t.users.roleDialog.generalInfo}{" "}
                  <strong>{t.users.roleDialog.generalInfoPanelTab}</strong>.
                </p>
              </div>

              <div
                id="role-pane-panel"
                data-role-pane="panel"
                className="hidden space-y-3"
              >
                <p className="text-xs text-muted-foreground">
                  {t.users.roleDialog.panelPermsInfo}
                </p>
                {/** Sub-pestañas por módulo (se renderizan desde el catálogo en JS) */}
                <div
                  id="role-module-tabs"
                  className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1"
                ></div>
                <div id="role-module-panes"></div>
              </div>

              <div
                id="role-pane-server"
                data-role-pane="server"
                className="hidden space-y-4"
              >
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      id="perm-file-allow-all"
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-input text-primary"
                    />
                    {t.users.roleDialog.labelFileAllowAll}
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">
                          {t.users.roleDialog.labelAllowedPaths}
                        </label>
                        <button
                          type="button"
                          data-path-add="perm-file-allow-paths"
                          className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent"
                        >
                          <i className="ti ti-folder-plus"></i>{" "}
                          {t.users.roleDialog.btnAddPath}
                        </button>
                      </div>
                      <div
                        id="chips-perm-file-allow-paths"
                        className="flex flex-wrap gap-1 min-h-[2rem] rounded-lg border border-input bg-background p-2"
                      ></div>
                      <textarea
                        id="perm-file-allow-paths"
                        className="hidden"
                      ></textarea>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">
                          {t.users.roleDialog.labelReadonlyPaths}
                        </label>
                        <button
                          type="button"
                          data-path-add="perm-file-readonly-paths"
                          className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent"
                        >
                          <i className="ti ti-folder-plus"></i>{" "}
                          {t.users.roleDialog.btnAddPath}
                        </button>
                      </div>
                      <div
                        id="chips-perm-file-readonly-paths"
                        className="flex flex-wrap gap-1 min-h-[2rem] rounded-lg border border-input bg-background p-2"
                      ></div>
                      <textarea
                        id="perm-file-readonly-paths"
                        className="hidden"
                      ></textarea>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">
                          {t.users.roleDialog.labelDeniedPaths}
                        </label>
                        <button
                          type="button"
                          data-path-add="perm-file-deny-paths"
                          className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent"
                        >
                          <i className="ti ti-folder-plus"></i>{" "}
                          {t.users.roleDialog.btnAddPath}
                        </button>
                      </div>
                      <div
                        id="chips-perm-file-deny-paths"
                        className="flex flex-wrap gap-1 min-h-[2rem] rounded-lg border border-input bg-background p-2"
                      ></div>
                      <textarea
                        id="perm-file-deny-paths"
                        className="hidden"
                      ></textarea>
                    </div>
                  </div>
                  <div className="border-t border-border pt-3">
                    <label
                      className="text-xs text-muted-foreground"
                      htmlFor="perm-file-default-path"
                    >
                      {t.users.roleDialog.labelDefaultPath}
                    </label>
                    <input
                      id="perm-file-default-path"
                      type="text"
                      placeholder={t.users.roleDialog.placeholderDefaultPath}
                      className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t.users.roleDialog.defaultPathHelp}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      id="perm-cmd-allow-all"
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-input text-primary"
                    />
                    {t.users.roleDialog.labelCmdAllowAll}
                  </label>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      {t.users.roleDialog.labelCmdGroupsAllowed}
                    </label>
                    <div
                      id="perm-command-groups-grid"
                      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    ></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        {t.users.roleDialog.labelCmdAllowExtra}
                      </label>
                      <textarea
                        id="perm-cmd-allow-list"
                        rows={3}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      ></textarea>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        {t.users.roleDialog.labelCmdDenyList}
                      </label>
                      <textarea
                        id="perm-cmd-deny-list"
                        rows={3}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  id="role-cancel"
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.users.roleDialog.btnCancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.users.roleDialog.btnSave}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}

      {/** ── Path browser ───────────────────────────────────────────── */}
      {showUsersView("roles") && (
        <Fragment>
          <dialog
            id="dialog-path-browser"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
          >
            <ModalNavbar
              title={t.users.pathBrowserDialog.title}
              closeId="path-browser-close"
            />
            <div className="px-5 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  id="path-browser-up"
                  className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  <i className="ti ti-arrow-up"></i>{" "}
                  {t.users.pathBrowserDialog.btnUp}
                </button>
                <code
                  id="path-browser-current"
                  className="flex-1 truncate rounded-md bg-muted/40 px-2 py-1 text-xs"
                >
                  /
                </code>
              </div>
              <div
                id="path-browser-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              ></div>
              <ul
                id="path-browser-list"
                className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border text-sm"
              ></ul>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  id="path-browser-cancel"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  {t.users.pathBrowserDialog.btnCancel}
                </button>
                <button
                  type="button"
                  id="path-browser-select"
                  className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.users.pathBrowserDialog.btnSelect}
                </button>
              </div>
            </div>
          </dialog>
        </Fragment>
      )}

      {Astro.locals.user?.kind === "admin" && (
        <Fragment>
          <HostingTemplates p={t.permissions} />
        </Fragment>
      )}
      <script
        id="permissions-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t.permissions) }}
      ></script>

      {/** Toast */}
      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        id="users-i18n"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["users"]) }}
      ></script>
    </Fragment>
  );
}
