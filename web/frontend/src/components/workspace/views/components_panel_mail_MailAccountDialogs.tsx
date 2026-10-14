// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailAccountDialogs.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ModalNavbar from "./components_ui_ModalNavbar";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_panel_mail_MailAccountDialogs(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const { t } = Astro.props;

  return (
    <Fragment>
      {/** ── Create Account Dialog ──────────────────────────────────── */}
      <dialog
        id="dialog-create"
        className={`w-full max-w-md ${DIALOG_CHROME} open:flex open:flex-col`}
      >
        <ModalNavbar title={t.mail.createDialog.title} closeId="dialog-close" />

        <form id="form-create" className="flex flex-col gap-4 px-6 py-5">
          <div
            id="create-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-local-part">
              {t.mail.createDialog.labelAccount}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1.3fr] sm:items-center">
              <input
                id="new-local-part"
                type="text"
                required
                autoComplete="username"
                placeholder={t.mail.createDialog.placeholderUsername}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="hidden sm:inline text-center text-sm text-muted-foreground">
                @
              </span>
              <select
                id="new-domain"
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">{t.mail.createDialog.selectDomain}</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.mail.createDialog.domainsFromDns}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-password">
              {t.mail.createDialog.labelPassword}
            </label>
            <div className="relative">
              <input
                id="new-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder={t.mail.createDialog.placeholderPassword}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                id="toggle-new-pass"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <i className="ti ti-eye text-base" id="new-pass-icon"></i>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="new-quota">
              {t.mail.createDialog.labelQuota}
              <span className="ml-1 text-xs text-muted-foreground">
                {t.mail.createDialog.quotaUnlimited}
              </span>
            </label>
            <input
              id="new-quota"
              type="number"
              defaultValue="1024"
              min="0"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="new-enabled"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="new-enabled" className="text-sm">
              {t.mail.createDialog.labelEnabled}
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t.mail.createDialog.labelForwards}
              </label>
              <button
                type="button"
                id="new-add-forward"
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t.mail.createDialog.btnAddForward}
              </button>
            </div>
            <div id="new-forwards-list" className="space-y-2"></div>
            <p className="text-xs text-muted-foreground">
              {t.mail.createDialog.optionalForwardsNote}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              id="dialog-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {t.mail.createDialog.btnCancel}
            </button>
            <button
              type="submit"
              id="btn-create-submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <span id="create-btn-text">{t.mail.createDialog.btnCreate}</span>
              <span id="create-btn-spinner" className="hidden">
                <svg
                  className="mx-auto h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
            </button>
          </div>
        </form>
      </dialog>

      {/** ── Edit Account Dialog ─────────────────────────────────────── */}
      <dialog id="dialog-edit" className={`w-full max-w-xl ${DIALOG_CHROME}`}>
        <ModalNavbar
          title={t.mail.editDialog.title}
          closeId="edit-dialog-close"
        />
        <form id="form-edit" className="flex flex-col gap-4 px-6 py-5">
          <p
            id="edit-account-original"
            className="text-sm text-muted-foreground"
          ></p>
          <div
            id="edit-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="edit-local-part">
              {t.mail.editDialog.labelUsername}
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                id="edit-local-part"
                type="text"
                required
                placeholder={t.mail.editDialog.placeholderUsername}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-center text-sm text-muted-foreground">
                @
              </span>
              <input
                id="edit-domain"
                type="text"
                readOnly
                className="h-10 w-full rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-3 text-sm font-semibold">
              {t.mail.editDialog.restrictionsTitle}
            </p>

            <div className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t.mail.editDialog.incomingTitle}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-incoming-mode"
                    defaultValue="allow"
                    defaultChecked
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.allow}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-incoming-mode"
                    defaultValue="suspend"
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.suspend}
                </label>
              </div>
            </div>

            <div className="mb-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t.mail.editDialog.outgoingTitle}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-outgoing-mode"
                    defaultValue="allow"
                    defaultChecked
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.allow}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-outgoing-mode"
                    defaultValue="suspend"
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.suspend}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-outgoing-mode"
                    defaultValue="hold"
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.hold}
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t.mail.editDialog.loginTitle}
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-login-mode"
                    defaultValue="allow"
                    defaultChecked
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.allow}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="edit-login-mode"
                    defaultValue="suspend"
                    className="h-4 w-4"
                  />{" "}
                  {t.mail.editDialog.suspend}
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-1 text-sm font-semibold">
              {t.mail.editDialog.plusAddressingTitle}
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              {t.mail.editDialog.plusAddressingDescription}
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="edit-plus-autofolder"
                  defaultValue="yes"
                  defaultChecked
                  className="h-4 w-4"
                />{" "}
                {t.mail.editDialog.plusAddressingAutoCreate}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="edit-plus-autofolder"
                  defaultValue="no"
                  className="h-4 w-4"
                />{" "}
                {t.mail.editDialog.plusAddressingNoAutoCreate}
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                {t.mail.editDialog.labelForwards}
              </label>
              <button
                type="button"
                id="edit-add-forward"
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {t.mail.editDialog.btnAddForward}
              </button>
            </div>
            <div id="edit-forwards-list" className="space-y-2"></div>
            <p className="text-xs text-muted-foreground">
              {t.mail.editDialog.forwardsApplyNote}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              id="edit-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.mail.editDialog.btnCancel}
            </button>
            <button
              type="submit"
              id="edit-submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.mail.editDialog.btnSave}
            </button>
          </div>
        </form>
      </dialog>

      {/** ── Forwards Dialog (gestionar reenvíos por cuenta) ────── */}
      <dialog
        id="dialog-forwards"
        className={`w-full max-w-3xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.forwardsDialog.title}
          closeId="forwards-dialog-close"
        />
        <p
          id="forwards-account-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <div className="space-y-4 px-6 py-5">
          <form
            id="forwards-form"
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <p className="text-sm font-medium">
              {t.mail.forwardsDialog.addEditTitle}
            </p>
            <input id="forwards-edit-idx" type="hidden" />
            <div
              id="forwards-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
            ></div>
            <div className="space-y-1.5">
              <label htmlFor="forwards-dest" className="text-sm font-medium">
                {t.mail.forwardsDialog.labelDest}
              </label>
              <input
                id="forwards-dest"
                type="email"
                required
                placeholder={t.mail.forwardsDialog.placeholderDest}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                id="forwards-keepcopy"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-input"
              />
              {t.mail.forwardsDialog.labelKeepCopy}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                id="forwards-new"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.forwardsDialog.btnNew}
              </button>
              <button
                type="button"
                id="forwards-cancel"
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
              >
                {t.mail.forwardsDialog.btnClose}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.forwardsDialog.btnSave}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t.mail.forwardsDialog.immediateNote}{" "}
              <code className="text-[11px]">/etc/postfix/virtual</code>{" "}
              {t.mail.forwardsDialog.immediateSuffix}
            </p>
          </form>

          <div className="rounded-xl border border-border">
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-sm font-medium">
              {t.mail.forwardsDialog.tableHeader}
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">
                      {t.mail.forwardsDialog.colForwardsTo}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t.mail.forwardsDialog.colKeepsCopy}
                    </th>
                    <th className="px-4 py-2 text-right font-medium">
                      {t.mail.forwardsDialog.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody id="forwards-tbody"></tbody>
              </table>
              <p
                id="forwards-empty"
                className="hidden px-4 py-6 text-center text-sm text-muted-foreground"
              >
                {t.mail.forwardsDialog.emptyState}
              </p>
            </div>
          </div>
        </div>
      </dialog>

      {/** ── Clonar correo (copia todas las carpetas/correos a otra cuenta) ── */}
      <dialog id="dialog-clone" className={`w-full max-w-md ${DIALOG_CHROME}`}>
        <ModalNavbar
          title={t.mail.cloneDialog.title}
          closeId="clone-dialog-close"
        />
        <p
          id="clone-source-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <form
          id="form-clone"
          onSubmit={() => {
            return false;
          }}
          className="space-y-4 px-6 py-5"
        >
          <input
            id="clone-new-username"
            type="text"
            autoComplete="username"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            defaultValue=""
            readOnly
          />
          <div
            id="clone-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          ></div>

          <p className="text-xs text-muted-foreground">
            {t.mail.cloneDialog.description}{" "}
            <span className="font-medium text-foreground">
              {t.mail.cloneDialog.descriptionBold}
            </span>{" "}
            {t.mail.cloneDialog.descriptionSuffix}{" "}
            <code className="text-[11px]">Message-ID</code>
            {t.mail.cloneDialog.descriptionSafe}
          </p>

          <div className="flex gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="clone-mode"
                defaultValue="existing"
                defaultChecked
                className="h-4 w-4"
              />{" "}
              {t.mail.cloneDialog.modeExisting}
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="clone-mode"
                defaultValue="new"
                className="h-4 w-4"
              />{" "}
              {t.mail.cloneDialog.modeNew}
            </label>
          </div>

          <div id="clone-existing-block" className="space-y-1.5">
            <label htmlFor="clone-dest-account" className="text-sm font-medium">
              {t.mail.cloneDialog.labelDestAccount}
            </label>
            <select
              id="clone-dest-account"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            ></select>
          </div>

          <div id="clone-new-block" className="hidden space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <label
                  htmlFor="clone-new-local"
                  className="text-sm font-medium"
                >
                  {t.mail.cloneDialog.labelLocalPart}
                </label>
                <input
                  id="clone-new-local"
                  type="text"
                  autoComplete="username"
                  placeholder={t.mail.cloneDialog.placeholderLocal}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label
                  htmlFor="clone-new-domain"
                  className="text-sm font-medium"
                >
                  {t.mail.cloneDialog.labelDomain}
                </label>
                <select
                  id="clone-new-domain"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                ></select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="clone-new-password"
                className="text-sm font-medium"
              >
                {t.mail.cloneDialog.labelPassword}
              </label>
              <input
                id="clone-new-password"
                type="password"
                autoComplete="new-password"
                placeholder={t.mail.cloneDialog.placeholderPassword}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div
            id="clone-result"
            className="hidden rounded-lg border border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
          ></div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              id="clone-cancel"
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              {t.mail.cloneDialog.btnCancel}
            </button>
            <button
              type="button"
              id="clone-submit"
              className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t.mail.cloneDialog.btnClone}
            </button>
          </div>
        </form>
      </dialog>

      {/** ── Input Dialog (reemplaza window.prompt en acciones en lote) ── */}
      <dialog id="dialog-input" className={`w-full max-w-sm ${DIALOG_CHROME}`}>
        <ModalNavbar
          title={t.mail.inputDialog.defaultTitle}
          titleId="input-dialog-title"
          closeId="input-dialog-close"
        />
        <form id="form-input" className="flex flex-col gap-4 px-6 py-5">
          <label
            id="input-dialog-label"
            className="text-sm font-medium"
            htmlFor="input-dialog-field"
          ></label>
          <input
            id="input-dialog-field"
            type="text"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex gap-3">
            <button
              type="button"
              id="input-dialog-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.mail.inputDialog.btnCancel}
            </button>
            <button
              type="submit"
              id="input-dialog-ok"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.mail.inputDialog.btnOk}
            </button>
          </div>
        </form>
      </dialog>
    </Fragment>
  );
}
