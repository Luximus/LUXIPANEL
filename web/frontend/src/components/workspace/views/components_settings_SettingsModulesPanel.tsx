// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsModulesPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_settings_SettingsModulesPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <div id="panel-modules" className="tab-panel hidden space-y-5">
        <div
          className="rounded-xl border border-border bg-card overflow-hidden"
          data-lxp-collapse
        >
          <button
            type="button"
            data-lxp-collapse-toggle
            aria-expanded="false"
            className="group flex w-full cursor-pointer select-none items-center gap-x-4 px-5 py-4 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
          >
            <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-emerald-500/10">
              <i className="ti ti-bolt text-lg text-emerald-500"></i>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                {t.settings.modules.sectionTitle}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t.settings.modules.sectionDesc1}
              </span>
            </span>
            <i
              className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
              data-lxp-collapse-chevron
            ></i>
          </button>
          <div className="m-4 overflow-hidden rounded-xl bg-muted/30">
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground mb-3">
                <strong>{t.settings.modules.sectionDescBold}</strong>
                {t.settings.modules.managedInPre}
                <a href="/panel/modules" className="underline">
                  {t.settings.modules.modulesLink}
                </a>
                {t.settings.modules.managedInPost}
                {t.settings.modules.sectionDesc2}
              </p>
              <div
                id="cache-modules-status"
                className="text-xs text-muted-foreground mb-3"
              >
                {t.settings.modules.loading}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.module}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.source}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.active}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.interval}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.lastRefresh}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.duration}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.size}
                      </th>
                      <th className="text-left font-medium py-2 pr-3">
                        {t.settings.modules.tableHeaders.hitRatio}
                      </th>
                      <th className="text-right font-medium py-2"></th>
                    </tr>
                  </thead>
                  <tbody
                    id="cache-modules-rows"
                    className="divide-y divide-border"
                  ></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
