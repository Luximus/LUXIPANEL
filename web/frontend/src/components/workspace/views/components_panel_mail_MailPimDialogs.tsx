// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailPimDialogs.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ModalNavbar from "./components_ui_ModalNavbar";
import DataTable from "@/components/ui/DataTable";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_panel_mail_MailPimDialogs(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const {
    t,
    dataTableI18n,
    MAIL_CONTACTS_COLUMNS,
    MAIL_CONTACTS_FILTERS,
    MAIL_CONTACTS_ROW_ACTIONS,
    MAIL_CALENDARS_COLUMNS,
    MAIL_CALENDARS_FILTERS,
    MAIL_CALENDARS_ROW_ACTIONS,
    MAIL_CALENDARS_VALUE_BADGES,
    MAIL_FILTERS_COLUMNS,
    MAIL_FILTERS_FILTERS,
    MAIL_FILTERS_ROW_ACTIONS,
    MAIL_FILTERS_VALUE_BADGES,
  } = Astro.props;

  return (
    <Fragment>
      {/** ── Contacts Dialog ───────────────────────────────────── */}
      <dialog
        id="dialog-contacts"
        className={`w-full max-w-3xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.contactsDialog.title}
          closeId="contacts-dialog-close"
        />
        <p
          id="contacts-account-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm font-medium">
              {t.mail.contactsDialog.savedContactsHeader}
            </div>
            <div className="max-h-[460px] overflow-auto p-3">
              <DataTable
                i18n={dataTableI18n}
                tableId="mail-contacts-table"
                title={t.mail.dataTableTitles.contacts}
                columns={MAIL_CONTACTS_COLUMNS}
                data={[]}
                filters={MAIL_CONTACTS_FILTERS}
                rowActions={MAIL_CONTACTS_ROW_ACTIONS}
              />
            </div>
          </div>

          <form
            id="contacts-form"
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <input id="contacts-edit-id" type="hidden" />
            <div
              id="contacts-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
            ></div>
            <div className="space-y-1.5">
              <label htmlFor="contacts-email" className="text-sm font-medium">
                {t.mail.contactsDialog.labelEmail}
              </label>
              <input
                id="contacts-email"
                type="email"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contacts-name" className="text-sm font-medium">
                {t.mail.contactsDialog.labelName}
              </label>
              <input
                id="contacts-name"
                type="text"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                id="contacts-new"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.contactsDialog.btnNew}
              </button>
              <button
                type="button"
                id="contacts-cancel"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.contactsDialog.btnClose}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.contactsDialog.btnSave}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {/** ── Calendars Dialog ───────────────────────────────────── */}
      <dialog
        id="dialog-calendars"
        className={`w-full max-w-4xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.calendarsDialog.title}
          closeId="calendars-dialog-close"
        />
        <p
          id="calendars-account-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-xl border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm font-medium">
              {t.mail.calendarsDialog.savedCalendarsHeader}
            </div>
            <div className="max-h-[460px] overflow-auto p-3">
              <DataTable
                i18n={dataTableI18n}
                tableId="mail-calendars-table"
                title={t.mail.dataTableTitles.calendars}
                columns={MAIL_CALENDARS_COLUMNS}
                data={[]}
                filters={MAIL_CALENDARS_FILTERS}
                rowActions={MAIL_CALENDARS_ROW_ACTIONS}
                valueBadges={MAIL_CALENDARS_VALUE_BADGES}
              />
            </div>
          </div>

          <form
            id="calendars-form"
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <input id="calendars-edit-id" type="hidden" />
            <div
              id="calendars-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
            ></div>
            <div className="space-y-1.5">
              <label htmlFor="calendars-name" className="text-sm font-medium">
                {t.mail.calendarsDialog.labelName}
              </label>
              <input
                id="calendars-name"
                type="text"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="calendars-description"
                className="text-sm font-medium"
              >
                {t.mail.calendarsDialog.labelDescription}
              </label>
              <textarea
                id="calendars-description"
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              ></textarea>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="calendars-color"
                  className="text-sm font-medium"
                >
                  {t.mail.calendarsDialog.labelColor}
                </label>
                <input
                  id="calendars-color"
                  type="color"
                  className="h-10 w-full rounded-lg border border-input bg-background px-2"
                  defaultValue="#3b82f6"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="calendars-timezone"
                  className="text-sm font-medium"
                >
                  {t.mail.calendarsDialog.labelTimezone}
                </label>
                <input
                  id="calendars-timezone"
                  type="text"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  defaultValue="UTC"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                id="calendars-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                defaultChecked
              />
              {t.mail.calendarsDialog.labelEnabled}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                id="calendars-new"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.calendarsDialog.btnNew}
              </button>
              <button
                type="button"
                id="calendars-cancel"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.calendarsDialog.btnClose}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.calendarsDialog.btnSave}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {/** ── Autoresponder Dialog ─────────────────────────────────── */}
      <dialog
        id="dialog-autoresponder"
        className={`w-full max-w-4xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.autoresponderDialog.title}
          closeId="autoresponder-dialog-close"
        />
        <p
          id="autoresponder-account-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <form id="autoresponder-form" className="space-y-4 px-6 py-5">
          <div
            id="autoresponder-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          ></div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr] md:items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                id="autoresponder-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                defaultChecked
              />
              {t.mail.autoresponderDialog.labelEnabled}
            </label>
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {t.mail.autoresponderDialog.tagsNote}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="autoresponder-charset"
                className="text-sm font-medium"
              >
                {t.mail.autoresponderDialog.labelCharset}
              </label>
              <select
                id="autoresponder-charset"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              ></select>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="autoresponder-interval"
                className="text-sm font-medium"
              >
                {t.mail.autoresponderDialog.labelInterval}
              </label>
              <input
                id="autoresponder-interval"
                type="number"
                min="0"
                max="8760"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                defaultValue="24"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.3fr]">
            <div className="space-y-1.5">
              <label
                htmlFor="autoresponder-local"
                className="text-sm font-medium"
              >
                {t.mail.autoresponderDialog.labelEmailLocal}
              </label>
              <input
                id="autoresponder-local"
                type="text"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="autoresponder-domain"
                className="text-sm font-medium"
              >
                {t.mail.autoresponderDialog.labelDomain}
              </label>
              <select
                id="autoresponder-domain"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              ></select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="autoresponder-from" className="text-sm font-medium">
              {t.mail.autoresponderDialog.labelFrom}
            </label>
            <input
              id="autoresponder-from"
              type="text"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              placeholder={t.mail.autoresponderDialog.placeholderFrom}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="autoresponder-subject"
              className="text-sm font-medium"
            >
              {t.mail.autoresponderDialog.labelSubject}
            </label>
            <input
              id="autoresponder-subject"
              type="text"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              required
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              id="autoresponder-is-html"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
            />
            {t.mail.autoresponderDialog.labelIsHtml}
          </label>

          <div className="space-y-1.5">
            <label htmlFor="autoresponder-body" className="text-sm font-medium">
              {t.mail.autoresponderDialog.labelBody}
            </label>
            <textarea
              id="autoresponder-body"
              rows={8}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="autoresponder-start"
                className="text-sm font-medium"
              >
                {t.mail.autoresponderDialog.labelStart}
              </label>
              <input
                id="autoresponder-start"
                type="datetime-local"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="autoresponder-stop"
                className="text-sm font-medium"
              >
                {t.mail.autoresponderDialog.labelStop}
              </label>
              <input
                id="autoresponder-stop"
                type="datetime-local"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              id="autoresponder-delete"
              className="rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              {t.mail.autoresponderDialog.btnDelete}
            </button>
            <button
              type="button"
              id="autoresponder-cancel"
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              {t.mail.autoresponderDialog.btnCancel}
            </button>
            <button
              type="submit"
              id="autoresponder-save"
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {t.mail.autoresponderDialog.btnSave}
            </button>
          </div>
        </form>
      </dialog>

      {/** ── Mail Filters Dialog ───────────────────────────────────── */}
      <dialog
        id="dialog-filters"
        className={`w-full max-w-6xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.filtersDialog.title}
          closeId="filters-dialog-close"
        />
        <p
          id="filters-account-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 xl:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
              <p className="text-sm font-medium">
                {t.mail.filtersDialog.savedFiltersHeader}
              </p>
              <button
                id="filters-new"
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                {t.mail.filtersDialog.btnNew}
              </button>
            </div>
            <div className="max-h-[520px] overflow-auto p-3">
              <DataTable
                i18n={dataTableI18n}
                tableId="mail-filters-table"
                title={t.mail.dataTableTitles.filters}
                columns={MAIL_FILTERS_COLUMNS}
                data={[]}
                filters={MAIL_FILTERS_FILTERS}
                rowActions={MAIL_FILTERS_ROW_ACTIONS}
                valueBadges={MAIL_FILTERS_VALUE_BADGES}
              />
            </div>
          </div>

          <form
            id="filters-form"
            className="space-y-4 rounded-xl border border-border p-4"
          >
            <input id="filters-edit-id" type="hidden" />
            <div
              id="filters-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
            ></div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <label htmlFor="filters-name" className="text-sm font-medium">
                  {t.mail.filtersDialog.labelFilterName}
                </label>
                <input
                  id="filters-name"
                  type="text"
                  required
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  placeholder={t.mail.filtersDialog.placeholderFilterName}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  id="filters-enabled"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  defaultChecked
                />
                {t.mail.filtersDialog.labelEnabled}
              </label>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {t.mail.filtersDialog.rulesTitle}
                </p>
                <button
                  type="button"
                  id="filters-add-rule"
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                >
                  {t.mail.filtersDialog.btnAddRule}
                </button>
              </div>
              <div id="filters-rules-list" className="space-y-2"></div>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {t.mail.filtersDialog.actionsTitle}
                </p>
                <button
                  type="button"
                  id="filters-add-action"
                  className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                >
                  {t.mail.filtersDialog.btnAddAction}
                </button>
              </div>
              <div id="filters-actions-list" className="space-y-2"></div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                id="filters-cancel"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.filtersDialog.btnCancel}
              </button>
              <button
                type="submit"
                id="filters-save"
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.filtersDialog.btnSave}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </Fragment>
  );
}
