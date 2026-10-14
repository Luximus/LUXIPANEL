// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/panel-mail/MailGlobalFiltersPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import DataTable from "@/components/ui/DataTable";
export default function components_panel_mail_MailGlobalFiltersPanel(
  props: any,
) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const {
    t,
    dataTableI18n,
    MAIL_GLOBAL_FILTERS_COLUMNS,
    MAIL_GLOBAL_FILTERS_FILTERS,
    MAIL_GLOBAL_FILTERS_ROW_ACTIONS,
    MAIL_GLOBAL_FILTERS_VALUE_BADGES,
  } = Astro.props;

  return (
    <Fragment>
      <section
        data-mail-main-panel="global-filters"
        className="hidden space-y-4"
      >
        <div className="rounded-xl border border-border bg-background p-4">
          <h4 className="text-sm font-semibold">
            {t.mail.globalFilters.sectionTitle}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.mail.globalFilters.sectionDesc}
          </p>

          <div
            id="mail-global-filters-error"
            className="mt-3 hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          ></div>

          <div className="mt-4">
            <button
              type="button"
              id="mail-global-filters-new"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t.mail.globalFilters.btnCreate}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-border overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-3 py-2 text-sm font-medium">
              {t.mail.globalFilters.currentFiltersHeader}
            </div>
            <div className="p-3">
              <DataTable
                i18n={dataTableI18n}
                tableId="mail-global-filters-table"
                title={t.mail.dataTableTitles.globalFilters}
                columns={MAIL_GLOBAL_FILTERS_COLUMNS}
                data={[]}
                filters={MAIL_GLOBAL_FILTERS_FILTERS}
                rowActions={MAIL_GLOBAL_FILTERS_ROW_ACTIONS}
                valueBadges={MAIL_GLOBAL_FILTERS_VALUE_BADGES}
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border p-3">
            <h5 className="text-sm font-semibold">
              {t.mail.globalFilters.filterTestTitle}
            </h5>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.mail.globalFilters.filterTestDesc}
            </p>
            <textarea
              id="mail-global-filters-test-message"
              rows={8}
              className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
            >
              To: test@localhost From: test@localhost Subject: test This is a
              test message.
            </textarea>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                id="mail-global-filters-test-run"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t.mail.globalFilters.btnTest}
              </button>
              <span
                id="mail-global-filters-test-summary"
                className="text-xs text-muted-foreground"
              ></span>
            </div>
            <div
              id="mail-global-filters-test-results"
              className="mt-3 space-y-2"
            ></div>
          </div>
        </div>
      </section>
    </Fragment>
  );
}
