// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailTrackDeliveryPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_panel_mail_MailTrackDeliveryPanel(
  props: any,
) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <section
        data-mail-main-panel="track-delivery"
        className="hidden space-y-4"
      >
        <div className="rounded-xl border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">
            {t.mail.trackDelivery.sectionTitle}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.mail.trackDelivery.sectionDesc}
          </p>

          <div
            id="mail-track-delivery-error"
            className="mt-3 hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          ></div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <label
                htmlFor="mail-track-delivery-recipient"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t.mail.trackDelivery.labelRecipient}
              </label>
              <input
                id="mail-track-delivery-recipient"
                type="text"
                placeholder={t.mail.trackDelivery.placeholderRecipient}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                id="mail-track-delivery-run"
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.trackDelivery.btnRun}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="mail-track-delivery-show-all"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {t.mail.trackDelivery.btnShowAll}
            </button>
            <button
              type="button"
              id="mail-track-delivery-show-blocked"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {t.mail.trackDelivery.btnShowBlocked}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-border p-3">
            <h5 className="text-base font-semibold">
              {t.mail.trackDelivery.deliveryReportTitle}
            </h5>
            <p
              id="mail-track-delivery-matches"
              className="mt-1 text-xs text-muted-foreground"
            >
              {t.mail.trackDelivery.matchesText}
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-1.5">
                <input
                  id="mail-track-delivery-show-success"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />{" "}
                {t.mail.trackDelivery.showSuccesses}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  id="mail-track-delivery-show-deferred"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />{" "}
                {t.mail.trackDelivery.showDeferred}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  id="mail-track-delivery-show-failures"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />{" "}
                {t.mail.trackDelivery.showFailures}
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  id="mail-track-delivery-show-inprogress"
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4"
                />{" "}
                {t.mail.trackDelivery.showInProgress}
              </label>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <label
                htmlFor="mail-track-delivery-max-results"
                className="text-muted-foreground"
              >
                {t.mail.trackDelivery.maxResultsLabel}
              </label>
              <select
                id="mail-track-delivery-max-results"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                defaultValue="250"
              >
                <option value="100">100</option>
                <option value="250">250</option>
                <option value="500">500</option>
              </select>
              <span
                id="mail-track-delivery-summary"
                className="ml-auto text-muted-foreground"
              ></span>
            </div>

            <div className="relative mt-3 overflow-x-auto rounded-md border border-border">
              <button
                type="button"
                id="mail-track-delivery-columns-toggle"
                className="absolute right-2 top-2 z-10 rounded border border-border bg-background p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={t.mail.trackDelivery.tableOptions}
              >
                <i className="ti ti-list-details text-sm"></i>
              </button>

              <div
                id="mail-track-delivery-columns-panel"
                className="absolute right-2 top-10 z-20 hidden w-64 rounded-lg border border-border bg-card p-3 shadow-xl"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    {t.mail.trackDelivery.tableOptions}
                  </p>
                  <button
                    type="button"
                    id="mail-track-delivery-columns-close"
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <i className="ti ti-x text-xs"></i>
                  </button>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  {t.mail.trackDelivery.selectColumns}
                </p>
                <label className="mb-2 inline-flex items-center gap-2 text-xs">
                  <input
                    id="mail-track-delivery-columns-all"
                    type="checkbox"
                    className="h-4 w-4"
                  />
                  {t.mail.trackDelivery.selectAll}
                </label>
                <div className="max-h-56 space-y-1 overflow-auto">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="event"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.event}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="fromAddress"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.fromAddress}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="sentTime"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.sentTime}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="spamScore"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.spamScore}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="recipient"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.recipient}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="domain"
                      className="h-4 w-4"
                    />{" "}
                    {t.mail.trackColumns.domain}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="queueId"
                      className="h-4 w-4"
                    />{" "}
                    {t.mail.trackColumns.queueId}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="result"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.result}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      data-track-column="actions"
                      className="h-4 w-4"
                      defaultChecked
                    />{" "}
                    {t.mail.trackColumns.actions}
                  </label>
                </div>
                <button
                  type="button"
                  id="mail-track-delivery-columns-reset"
                  className="mt-3 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent"
                >
                  {t.mail.trackDelivery.resetDefault}
                </button>
              </div>

              <table className="w-full text-xs">
                <thead id="mail-track-delivery-thead"></thead>
                <tbody id="mail-track-delivery-tbody">
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2 py-6 text-center text-muted-foreground"
                    >
                      {t.mail.trackDelivery.noRecords}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              {t.mail.trackDelivery.dataRetention}
            </p>
          </div>
        </div>
      </section>
    </Fragment>
  );
}
