// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailSpamFiltersPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_panel_mail_MailSpamFiltersPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <section data-mail-main-panel="spam-filters" className="hidden space-y-4">
        <div className="rounded-xl border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">
            {t.mail.spamFilters.sectionTitle}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.mail.spamFilters.sectionDesc}
          </p>
          <div
            id="mail-spam-error"
            className="mt-3 hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          ></div>
          <p
            id="mail-spam-status"
            role="status"
            className="mt-3 rounded-lg border border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground"
          ></p>

          <div className="mt-4 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span id="mail-spam-breadcrumb">
              {t.mail.spamFilters.overviewLabel}
            </span>
          </div>

          <div data-mail-spam-view="overview" className="mt-4 space-y-3">
            <div className="rounded-lg border border-border p-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  id="mail-spam-enabled"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                />
                {t.mail.spamFilters.processNewLabel}
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.mail.spamFilters.processNewDesc}
              </p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  id="mail-spam-box-enabled"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                />
                {t.mail.spamFilters.spamBoxLabel}
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.mail.spamFilters.spamBoxDesc}
              </p>
              <button
                type="button"
                data-mail-spam-open="spam-box"
                className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                {t.mail.spamFilters.btnConfigSpamBox}
              </button>
            </div>

            <div className="rounded-lg border border-border p-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  id="mail-spam-autodelete-enabled"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                />
                {t.mail.spamFilters.autoDeleteLabel}
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.mail.spamFilters.autoDeleteDesc}
              </p>
              <button
                type="button"
                data-mail-spam-open="auto-delete"
                className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                {t.mail.spamFilters.btnConfigAutoDelete}
              </button>
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {t.mail.spamFilters.additionalConfig}
                </p>
                <button
                  type="button"
                  id="mail-spam-toggle-advanced"
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  {t.mail.spamFilters.btnShowAdditional}
                </button>
              </div>
              <div id="mail-spam-advanced" className="mt-3 hidden space-y-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">
                    {t.mail.spamFilters.thresholdTitle}
                  </p>
                  <button
                    type="button"
                    data-mail-spam-open="adjust-threshold"
                    className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {t.mail.spamFilters.btnAdjustThreshold}
                  </button>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">
                    {t.mail.spamFilters.whitelistTitle}
                  </p>
                  <button
                    type="button"
                    data-mail-spam-open="whitelist"
                    className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {t.mail.spamFilters.btnEditWhitelist}
                  </button>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">
                    {t.mail.spamFilters.blacklistTitle}
                  </p>
                  <button
                    type="button"
                    data-mail-spam-open="blacklist"
                    className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {t.mail.spamFilters.btnEditBlacklist}
                  </button>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">
                    {t.mail.spamFilters.calculatedTitle}
                  </p>
                  <button
                    type="button"
                    data-mail-spam-open="calculated"
                    className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
                  >
                    {t.mail.spamFilters.btnConfigCalculated}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div
            data-mail-spam-view="adjust-threshold"
            className="mt-4 hidden space-y-3"
          >
            <h5 className="text-base font-semibold">
              {t.mail.spamFilters.adjustThresholdTitle}
            </h5>
            <p className="text-xs text-muted-foreground">
              {t.mail.spamFilters.adjustThresholdDesc}
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="mail-spam-required-score-select"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t.mail.spamFilters.thresholdScoreLabel}
              </label>
              <select
                id="mail-spam-required-score-select"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="1">{t.mail.spamFilters.score1}</option>
                <option value="4">{t.mail.spamFilters.score4}</option>
                <option value="5">{t.mail.spamFilters.score5}</option>
                <option value="8">{t.mail.spamFilters.score8}</option>
                <option value="10">{t.mail.spamFilters.score10}</option>
                <option value="custom">{t.mail.spamFilters.scoreCustom}</option>
              </select>
            </div>
            <div
              id="mail-spam-custom-score-wrap"
              className="hidden space-y-1.5"
            >
              <label
                htmlFor="mail-spam-custom-score"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t.mail.spamFilters.customScoreLabel}
              </label>
              <input
                id="mail-spam-custom-score"
                type="number"
                min="0"
                max="999"
                step="0.1"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                id="mail-spam-save-threshold"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.spamFilters.btnUpdateThreshold}
              </button>
              <button
                type="button"
                data-mail-spam-open="overview"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.spamFilters.btnReturnOverview}
              </button>
            </div>
          </div>

          <div data-mail-spam-view="spam-box" className="mt-4 hidden space-y-3">
            <h5 className="text-base font-semibold">
              {t.mail.spamFilters.spamBoxViewTitle}
            </h5>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                id="mail-spam-box-view-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
              />
              {t.mail.spamFilters.spamBoxViewEnabledLabel}
            </label>
            <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
              {t.mail.spamFilters.spamBoxNote}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                id="mail-spam-save-spam-box"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.spamFilters.btnSaveSpamBox}
              </button>
              <button
                type="button"
                data-mail-spam-open="overview"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.spamFilters.btnReturnOverview}
              </button>
            </div>
          </div>

          <div
            data-mail-spam-view="auto-delete"
            className="mt-4 hidden space-y-3"
          >
            <h5 className="text-base font-semibold">
              {t.mail.spamFilters.autoDeleteViewTitle}
            </h5>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                id="mail-spam-autodelete-view-enabled"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
              />
              {t.mail.spamFilters.autoDeleteViewEnabledLabel}
            </label>
            <div className="space-y-1.5">
              <label
                htmlFor="mail-spam-autodelete-threshold"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {t.mail.spamFilters.autoDeleteThresholdLabel}
              </label>
              <input
                id="mail-spam-autodelete-threshold"
                type="number"
                min="1"
                max="999"
                step="1"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                id="mail-spam-save-autodelete"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.spamFilters.btnSaveAutoDelete}
              </button>
              <button
                type="button"
                data-mail-spam-open="overview"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.spamFilters.btnReturnOverview}
              </button>
            </div>
          </div>

          <div
            data-mail-spam-view="whitelist"
            className="mt-4 hidden space-y-3"
          >
            <h5 className="text-base font-semibold">
              {t.mail.spamFilters.whitelistViewTitle}
            </h5>
            <p className="text-xs text-muted-foreground">
              {t.mail.spamFilters.whitelistDesc}
            </p>
            <div id="mail-spam-whitelist-items" className="space-y-2"></div>
            <button
              type="button"
              id="mail-spam-whitelist-add"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {t.mail.spamFilters.btnAddWhitelist}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                id="mail-spam-save-whitelist"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.spamFilters.btnUpdateWhitelist}
              </button>
              <button
                type="button"
                data-mail-spam-open="overview"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.spamFilters.btnReturnOverview}
              </button>
            </div>
          </div>

          <div
            data-mail-spam-view="blacklist"
            className="mt-4 hidden space-y-3"
          >
            <h5 className="text-base font-semibold">
              {t.mail.spamFilters.blacklistViewTitle}
            </h5>
            <p className="text-xs text-muted-foreground">
              {t.mail.spamFilters.blacklistDesc}
            </p>
            <div id="mail-spam-blacklist-items" className="space-y-2"></div>
            <button
              type="button"
              id="mail-spam-blacklist-add"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {t.mail.spamFilters.btnAddBlacklist}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                id="mail-spam-save-blacklist"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.spamFilters.btnUpdateBlacklist}
              </button>
              <button
                type="button"
                data-mail-spam-open="overview"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.spamFilters.btnReturnOverview}
              </button>
            </div>
          </div>

          <div
            data-mail-spam-view="calculated"
            className="mt-4 hidden space-y-3"
          >
            <h5 className="text-base font-semibold">
              {t.mail.spamFilters.calculatedViewTitle}
            </h5>
            <p className="text-xs text-muted-foreground">
              {t.mail.spamFilters.calculatedDesc}
            </p>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {t.mail.spamFilters.calculatedWarning}
            </div>
            <div id="mail-spam-calculated-items" className="space-y-2"></div>
            <button
              type="button"
              id="mail-spam-calculated-add"
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {t.mail.spamFilters.btnAddCalculated}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                id="mail-spam-save-calculated"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.spamFilters.btnUpdateCalculated}
              </button>
              <button
                type="button"
                data-mail-spam-open="overview"
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                {t.mail.spamFilters.btnReturnOverview}
              </button>
            </div>
          </div>
        </div>
      </section>
    </Fragment>
  );
}
