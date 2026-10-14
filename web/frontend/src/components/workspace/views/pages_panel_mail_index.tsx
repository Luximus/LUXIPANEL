// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/pages/panel/mail/index.astro.
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
 * Mail accounts page — /panel/mail
 */
import PanelLayout from "../module-frame";
import ModuleDepsBanner from "./components_ModuleDepsBanner";
import DataTable from "@/components/ui/DataTable";
import { getPageMessages } from "../view-context";
import {
  buildMailAccountsColumns,
  buildMailAccountsFilters,
  buildMailAccountsQuickActions,
  buildMailAccountsRowActions,
  buildMailAccountsValueBadges,
  buildMailCalendarsColumns,
  buildMailCalendarsFilters,
  buildMailCalendarsRowActions,
  buildMailCalendarsValueBadges,
  buildMailContactsColumns,
  buildMailContactsFilters,
  buildMailContactsRowActions,
  buildMailEncryptionColumns,
  buildMailEncryptionFilters,
  buildMailEncryptionRowActions,
  buildMailFiltersColumns,
  buildMailFiltersFilters,
  buildMailFiltersRowActions,
  buildMailFiltersValueBadges,
  buildMailGlobalFiltersColumns,
  buildMailGlobalFiltersFilters,
  buildMailGlobalFiltersRowActions,
  buildMailGlobalFiltersValueBadges,
  buildMailRedirectColumns,
  buildMailRedirectFilters,
  buildMailRedirectRowActions,
} from "@/config/tables/mail-table-config";
// Domain filter options are loaded client-side after mount (see the
// inline script at the bottom). Rendering the page no longer waits on
// an SSR fetch to /api/nginx/domains — the page paints immediately and
// the filter dropdown populates a few ms later via
// `lxp:data-table:set-filter-options`.
import MailSettingsModal from "./components_panel_mail_MailSettingsModal";
import MailUpperDialogs from "./components_panel_mail_MailUpperDialogs";
import MailTrackDeliveryPanel from "./components_panel_mail_MailTrackDeliveryPanel";
import MailGlobalFiltersPanel from "./components_panel_mail_MailGlobalFiltersPanel";
import MailSpamFiltersPanel from "./components_panel_mail_MailSpamFiltersPanel";
import MailAccountDialogs from "./components_panel_mail_MailAccountDialogs";
import MailPimDialogs from "./components_panel_mail_MailPimDialogs";
import MailMiscDialogs from "./components_panel_mail_MailMiscDialogs";
import MailInboxDrawer from "@/components/panel-mail/MailInboxDrawer";
import MailSignaturesDrawer from "@/components/panel-mail/MailSignaturesDrawer";
export default function pages_panel_mail_index(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const t = getPageMessages(Astro, ["mail", "deps", "components"]);
  const dataTableI18n = t.components.dataTable;
  const mt = t.mail?.table;
  const MAIL_REDIRECT_COLUMNS = buildMailRedirectColumns(mt);
  const MAIL_REDIRECT_FILTERS = buildMailRedirectFilters(mt);
  const MAIL_REDIRECT_ROW_ACTIONS = buildMailRedirectRowActions(mt);
  const MAIL_ENCRYPTION_COLUMNS = buildMailEncryptionColumns(mt);
  const MAIL_ENCRYPTION_FILTERS = buildMailEncryptionFilters(mt);
  const MAIL_ENCRYPTION_ROW_ACTIONS = buildMailEncryptionRowActions(mt);
  const MAIL_ACCOUNTS_COLUMNS = buildMailAccountsColumns(mt);
  const MAIL_ACCOUNTS_FILTERS = buildMailAccountsFilters(mt);
  const MAIL_ACCOUNTS_ROW_ACTIONS = buildMailAccountsRowActions(mt);
  const MAIL_ACCOUNTS_QUICK_ACTIONS = buildMailAccountsQuickActions(mt);
  const MAIL_ACCOUNTS_VALUE_BADGES = buildMailAccountsValueBadges(mt);
  const MAIL_GLOBAL_FILTERS_COLUMNS = buildMailGlobalFiltersColumns(mt);
  const MAIL_GLOBAL_FILTERS_FILTERS = buildMailGlobalFiltersFilters(mt);
  const MAIL_GLOBAL_FILTERS_ROW_ACTIONS = buildMailGlobalFiltersRowActions(mt);
  const MAIL_GLOBAL_FILTERS_VALUE_BADGES =
    buildMailGlobalFiltersValueBadges(mt);
  const MAIL_CONTACTS_COLUMNS = buildMailContactsColumns(mt);
  const MAIL_CONTACTS_FILTERS = buildMailContactsFilters(mt);
  const MAIL_CONTACTS_ROW_ACTIONS = buildMailContactsRowActions(mt);
  const MAIL_CALENDARS_COLUMNS = buildMailCalendarsColumns(mt);
  const MAIL_CALENDARS_FILTERS = buildMailCalendarsFilters(mt);
  const MAIL_CALENDARS_ROW_ACTIONS = buildMailCalendarsRowActions(mt);
  const MAIL_CALENDARS_VALUE_BADGES = buildMailCalendarsValueBadges(mt);
  const MAIL_FILTERS_COLUMNS = buildMailFiltersColumns(mt);
  const MAIL_FILTERS_FILTERS = buildMailFiltersFilters(mt);
  const MAIL_FILTERS_ROW_ACTIONS = buildMailFiltersRowActions(mt);
  const MAIL_FILTERS_VALUE_BADGES = buildMailFiltersValueBadges(mt);
  // The workspace submenu opens a real, focused document for each mail area.
  // Settings uses a separate overlay request, which still needs its own modal.
  const mailView = Astro.url.searchParams.get("workspaceView");
  const isolatedMailView =
    Astro.url.searchParams.get("embed") === "1" &&
    !Astro.url.searchParams.has("settingsOverlay") &&
    ["emails", "spam-filters", "track-delivery", "global-filters"].includes(
      mailView ?? "",
    );
  const showMailView = (view: string) => !isolatedMailView || mailView === view;

  return (
    <Fragment>
      <PanelLayout title={t.mail.pageTitle} activeModule="mail">
        <div
          className="space-y-6 pt-5"
          data-workspace-isolated-view={isolatedMailView ? mailView : undefined}
        >
          {!isolatedMailView && (
            <Fragment>
              <MailSettingsModal
                t={t}
                dataTableI18n={dataTableI18n}
                MAIL_REDIRECT_COLUMNS={MAIL_REDIRECT_COLUMNS}
                MAIL_REDIRECT_FILTERS={MAIL_REDIRECT_FILTERS}
                MAIL_REDIRECT_ROW_ACTIONS={MAIL_REDIRECT_ROW_ACTIONS}
                MAIL_ENCRYPTION_COLUMNS={MAIL_ENCRYPTION_COLUMNS}
                MAIL_ENCRYPTION_FILTERS={MAIL_ENCRYPTION_FILTERS}
                MAIL_ENCRYPTION_ROW_ACTIONS={MAIL_ENCRYPTION_ROW_ACTIONS}
                MAIL_ACCOUNTS_ROW_ACTIONS={MAIL_ACCOUNTS_ROW_ACTIONS}
              />
            </Fragment>
          )}

          {(!isolatedMailView ||
            mailView === "track-delivery" ||
            mailView === "global-filters") && (
            <Fragment>
              <MailUpperDialogs
                t={t}
                view={isolatedMailView ? mailView : undefined}
              />
            </Fragment>
          )}

          {/** Required mail components banner (postfix/dovecot/opendkim) — driven by
         initModuleDeps in index-script1.ts; same placement as firewall's
         #fw-not-installed: right under the page header, before the cards. */}
          <ModuleDepsBanner module="mail" t={t.deps} />

          {/** Tabs (estilo modules: underline + count badge) */}
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
            {isolatedMailView ? (
              <Fragment>
                <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                  {mailView === "emails"
                    ? t.mail.tabs.emails
                    : mailView === "spam-filters"
                      ? t.mail.tabs.spamFilters
                      : mailView === "track-delivery"
                        ? t.mail.tabs.trackDelivery
                        : t.mail.tabs.globalFilters}
                </h2>
              </Fragment>
            ) : (
              <Fragment>
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                  <button
                    type="button"
                    data-mail-main-tab="emails"
                    className="mail-main-tab inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-all hover:text-primary/80"
                  >
                    <span>{t.mail.tabs.emails}</span>
                    <span
                      id="tab-emails-count"
                      className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold"
                    >
                      —
                    </span>
                  </button>
                  <button
                    type="button"
                    data-mail-main-tab="spam-filters"
                    className="mail-main-tab inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
                  >
                    <span>{t.mail.tabs.spamFilters}</span>
                    <span
                      id="tab-spam-filters-count"
                      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
                    >
                      —
                    </span>
                  </button>
                  <button
                    type="button"
                    data-mail-main-tab="track-delivery"
                    className="mail-main-tab inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
                  >
                    <span>{t.mail.tabs.trackDelivery}</span>
                    <span
                      id="tab-track-delivery-count"
                      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
                    >
                      —
                    </span>
                  </button>
                  <button
                    type="button"
                    data-mail-main-tab="global-filters"
                    className="mail-main-tab inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
                  >
                    <span>{t.mail.tabs.globalFilters}</span>
                    <span
                      id="tab-global-filters-count"
                      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
                    >
                      —
                    </span>
                  </button>
                </div>
              </Fragment>
            )}
            {showMailView("emails") && (
              <Fragment>
                <button
                  id="btn-new-account"
                  className="ml-2 inline-flex shrink-0 items-center gap-2 self-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
                >
                  <i className="ti ti-plus text-base"></i>
                  {t.mail.emailsPanel.btnNewAccount}
                </button>
              </Fragment>
            )}
          </div>

          {showMailView("emails") && (
            <Fragment>
              <section data-mail-main-panel="emails">
                {/** Storage usage summary */}
                <div
                  id="mail-usage-summary"
                  className="mb-4 hidden rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {t.mail.emailsPanel.usageTotal}
                    </p>
                    <p
                      id="mail-usage-summary-text"
                      className="text-xs text-muted-foreground"
                    ></p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      id="mail-usage-summary-bar"
                      className="h-full rounded-full bg-emerald-500 transition-all"
                    ></div>
                  </div>
                  <p
                    id="mail-usage-summary-percent"
                    className="mt-1.5 text-right text-[11px] text-muted-foreground"
                  ></p>
                </div>

                {/** Accounts table */}
                <DataTable
                  i18n={dataTableI18n}
                  tableId="mail-accounts-table"
                  externalPagination={true}
                  serverQuery={true}
                  title={t.mail.dataTableTitles.accounts}
                  columns={MAIL_ACCOUNTS_COLUMNS}
                  data={[]}
                  filters={MAIL_ACCOUNTS_FILTERS}
                  rowActions={MAIL_ACCOUNTS_ROW_ACTIONS}
                  quickActions={MAIL_ACCOUNTS_QUICK_ACTIONS}
                  valueBadges={MAIL_ACCOUNTS_VALUE_BADGES}
                />
              </section>
            </Fragment>
          )}

          {showMailView("track-delivery") && (
            <Fragment>
              <MailTrackDeliveryPanel t={t} />
            </Fragment>
          )}

          {showMailView("global-filters") && (
            <Fragment>
              <MailGlobalFiltersPanel
                t={t}
                dataTableI18n={dataTableI18n}
                MAIL_GLOBAL_FILTERS_COLUMNS={MAIL_GLOBAL_FILTERS_COLUMNS}
                MAIL_GLOBAL_FILTERS_FILTERS={MAIL_GLOBAL_FILTERS_FILTERS}
                MAIL_GLOBAL_FILTERS_ROW_ACTIONS={
                  MAIL_GLOBAL_FILTERS_ROW_ACTIONS
                }
                MAIL_GLOBAL_FILTERS_VALUE_BADGES={
                  MAIL_GLOBAL_FILTERS_VALUE_BADGES
                }
              />
            </Fragment>
          )}

          {showMailView("spam-filters") && (
            <Fragment>
              <MailSpamFiltersPanel t={t} />
            </Fragment>
          )}
        </div>
      </PanelLayout>

      {showMailView("emails") && (
        <Fragment>
          <MailAccountDialogs t={t} />
        </Fragment>
      )}

      {showMailView("emails") && (
        <Fragment>
          <MailPimDialogs
            t={t}
            dataTableI18n={dataTableI18n}
            MAIL_CONTACTS_COLUMNS={MAIL_CONTACTS_COLUMNS}
            MAIL_CONTACTS_FILTERS={MAIL_CONTACTS_FILTERS}
            MAIL_CONTACTS_ROW_ACTIONS={MAIL_CONTACTS_ROW_ACTIONS}
            MAIL_CALENDARS_COLUMNS={MAIL_CALENDARS_COLUMNS}
            MAIL_CALENDARS_FILTERS={MAIL_CALENDARS_FILTERS}
            MAIL_CALENDARS_ROW_ACTIONS={MAIL_CALENDARS_ROW_ACTIONS}
            MAIL_CALENDARS_VALUE_BADGES={MAIL_CALENDARS_VALUE_BADGES}
            MAIL_FILTERS_COLUMNS={MAIL_FILTERS_COLUMNS}
            MAIL_FILTERS_FILTERS={MAIL_FILTERS_FILTERS}
            MAIL_FILTERS_ROW_ACTIONS={MAIL_FILTERS_ROW_ACTIONS}
            MAIL_FILTERS_VALUE_BADGES={MAIL_FILTERS_VALUE_BADGES}
          />
        </Fragment>
      )}

      {showMailView("emails") && (
        <Fragment>
          <MailMiscDialogs t={t} />
        </Fragment>
      )}

      {/** Right-side drawers (correo): inbox (iframe), firmas y configuración del módulo */}
      {showMailView("emails") && (
        <Fragment>
          <MailInboxDrawer />
        </Fragment>
      )}
      {showMailView("emails") && (
        <Fragment>
          <MailSignaturesDrawer />
        </Fragment>
      )}

      {/** ── Toast ───────────────────────────────────────────────────── */}
      <div
        id="toast"
        className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
      >
        <p id="toast-msg" className="text-sm font-medium"></p>
      </div>

      <script
        type="application/json"
        id="mail-i18n"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(t["mail"]) }}
      ></script>

      {/**
      The "Dominio" filter is populated client-side from the loaded accounts in
      index-script1.ts (renderAccounts → `lxp:data-table:set-filter-options`).
      Deriving the options from the actual rows keeps them in sync with the table
      (a mailbox can live on a domain that has no nginx site, which made the old
      /api/nginx/domains source return an empty dropdown).
    */}
    </Fragment>
  );
}
