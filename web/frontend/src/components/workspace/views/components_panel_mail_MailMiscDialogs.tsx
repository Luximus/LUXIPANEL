// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailMiscDialogs.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ModalNavbar from "./components_ui_ModalNavbar";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_panel_mail_MailMiscDialogs(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const { t } = Astro.props;

  return (
    <Fragment>
      {/** ── Disk Usage Dialog ───────────────────────────────────── */}
      <dialog
        id="dialog-disk-usage"
        className={`w-full max-w-5xl ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.diskUsageDialog.title}
          closeId="disk-dialog-close"
        />
        <p
          id="disk-account-label"
          className="px-6 pt-4 text-xs text-muted-foreground"
        ></p>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t.mail.diskUsageDialog.labelCopyTo}
              </label>
              <select
                id="disk-dest-account"
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              ></select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t.mail.diskUsageDialog.labelDestFolder}
              </label>
              <input
                id="disk-dest-folder"
                type="text"
                placeholder={t.mail.diskUsageDialog.placeholderDestFolder}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                id="disk-refresh"
                className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-accent"
              >
                {t.mail.diskUsageDialog.btnRefresh}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
              <p className="text-sm font-medium">
                {t.mail.diskUsageDialog.foldersHeader}
              </p>
              <p
                id="disk-total-usage"
                className="text-xs text-muted-foreground"
              ></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left">
                      {t.mail.diskUsageDialog.colMailboxName}
                    </th>
                    <th className="px-4 py-2 text-left">
                      {t.mail.diskUsageDialog.colMessages}
                    </th>
                    <th className="px-4 py-2 text-left">
                      {t.mail.diskUsageDialog.colDiskUsage}
                    </th>
                    <th className="px-4 py-2 text-left">
                      {t.mail.diskUsageDialog.colDateRange}
                    </th>
                    <th className="px-4 py-2 text-right">
                      {t.mail.diskUsageDialog.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody id="disk-usage-tbody"></tbody>
              </table>
            </div>
          </div>
          <div
            id="disk-usage-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          ></div>
        </div>
      </dialog>

      {/** ── Change Password Dialog ─────────────────────────────────── */}
      <dialog
        id="dialog-password"
        className={`w-full max-w-sm ${DIALOG_CHROME}`}
      >
        <ModalNavbar
          title={t.mail.passwordDialog.title}
          closeId="pass-dialog-close"
        />
        <form id="form-password" className="flex flex-col gap-4 px-6 py-5">
          <input
            id="pass-dialog-username"
            type="text"
            autoComplete="username"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            defaultValue=""
            readOnly
          />
          <p
            id="pass-dialog-account"
            className="text-sm text-muted-foreground"
          ></p>
          <div
            id="pass-error"
            className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
          ></div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="change-password">
              {t.mail.passwordDialog.labelNewPassword}
            </label>
            <input
              id="change-password"
              type="password"
              required
              autoComplete="new-password"
              placeholder={t.mail.passwordDialog.placeholderPassword}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              id="pass-cancel"
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {t.mail.passwordDialog.btnCancel}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.mail.passwordDialog.btnChange}
            </button>
          </div>
        </form>
      </dialog>

      {/** ── Account Toggle Loading Dialog ─────────────────────────── */}
      <dialog
        id="dialog-toggle-loading"
        className={`w-full max-w-sm ${DIALOG_CHROME}`}
      >
        <div className="px-6 py-6">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 animate-spin text-primary"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              ></circle>
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
              ></path>
            </svg>
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                {t.mail.toggleLoading.title}
              </p>
              <p
                id="toggle-loading-text"
                className="text-sm text-muted-foreground"
              >
                {t.mail.toggleLoading.defaultText}
              </p>
            </div>
          </div>
        </div>
      </dialog>
    </Fragment>
  );
}
