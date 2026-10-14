// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailUpperDialogs.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ModalNavbar from "./components_ui_ModalNavbar";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_panel_mail_MailUpperDialogs(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const { t, view } = Astro.props;

  return (
    <Fragment>
      {(!view || view === "track-delivery") && (
        <Fragment>
          <dialog
            id="mail-track-delivery-detail-dialog"
            className={`w-full max-w-2xl ${DIALOG_CHROME}`}
          >
            <ModalNavbar
              title={t.mail.trackDelivery.dialogTitle}
              closeId="mail-track-delivery-detail-close"
            />
            <div className="space-y-2 px-4 py-3">
              <p
                id="mail-track-delivery-detail-meta"
                className="text-xs text-muted-foreground"
              ></p>
              <pre
                id="mail-track-delivery-detail-raw"
                className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] leading-relaxed text-foreground"
              ></pre>
            </div>
          </dialog>
        </Fragment>
      )}

      {(!view || view === "global-filters") && (
        <Fragment>
          <dialog
            id="mail-global-filter-dialog"
            className={`w-full max-w-5xl ${DIALOG_CHROME}`}
          >
            <ModalNavbar
              title={t.mail.globalFilters.dialogTitle}
              titleId="mail-global-filter-dialog-title"
              closeId="mail-global-filter-dialog-close"
            />
            <form id="mail-global-filter-form" className="space-y-4 px-4 py-4">
              <input id="mail-global-filter-id" type="hidden" />
              <div
                id="mail-global-filter-form-error"
                className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
              ></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-1.5">
                  <label
                    htmlFor="mail-global-filter-name"
                    className="text-sm font-medium"
                  >
                    {t.mail.globalFilters.labelFilterName}
                  </label>
                  <input
                    id="mail-global-filter-name"
                    type="text"
                    required
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    id="mail-global-filter-enabled"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    defaultChecked
                  />
                  {t.mail.globalFilters.labelEnabled}
                </label>
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t.mail.globalFilters.rulesTitle}
                  </p>
                  <button
                    type="button"
                    id="mail-global-filter-add-rule"
                    className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                  >
                    {t.mail.globalFilters.btnAddRule}
                  </button>
                </div>
                <div
                  id="mail-global-filter-rules-list"
                  className="space-y-2"
                ></div>
              </div>

              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t.mail.globalFilters.actionsTitle}
                  </p>
                  <button
                    type="button"
                    id="mail-global-filter-add-action"
                    className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
                  >
                    {t.mail.globalFilters.btnAddAction}
                  </button>
                </div>
                <div
                  id="mail-global-filter-actions-list"
                  className="space-y-2"
                ></div>
              </div>

              <div className="flex gap-3 pb-1">
                <button
                  type="button"
                  id="mail-global-filter-cancel"
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
                >
                  {t.mail.globalFilters.btnCancel}
                </button>
                <button
                  type="submit"
                  id="mail-global-filter-save"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t.mail.globalFilters.btnSave}
                </button>
              </div>
            </form>
          </dialog>
        </Fragment>
      )}
    </Fragment>
  );
}
