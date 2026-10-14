// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsSystemPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import ReleaseSettings from "@/components/panel-releases/ReleaseSettings";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_settings_SettingsSystemPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { t } = Astro.props;

  return (
    <Fragment>
      <div id="panel-system" className="tab-panel hidden space-y-5">
        <ReleaseSettings />
        {/** Factory reset */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-5">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-5 flex items-start gap-3">
              <i className="ti ti-alert-triangle text-amber-500 mt-0.5 shrink-0"></i>
              <div className="text-sm">
                <p className="font-medium text-amber-500 mb-0.5">
                  {t.settings.system.factoryReset.warningTitle}
                </p>
                <p className="text-muted-foreground">
                  {t.settings.system.factoryReset.warningBefore}
                  <strong>
                    {t.settings.system.factoryReset.warningAllSettings}
                  </strong>
                  {t.settings.system.factoryReset.warningMiddle}
                  <strong>
                    {t.settings.system.factoryReset.warningNotDeleted}
                  </strong>
                  {t.settings.system.factoryReset.warningAfter}
                </p>
              </div>
            </div>
            <button
              id="btn-factory-reset"
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors"
            >
              <i className="ti ti-refresh text-base"></i>
              {t.settings.system.factoryReset.btnReset}
            </button>
          </div>
        </div>

        {/** Backup restore (only shown if backup module installed) */}
        <div
          id="backup-restore-section"
          className="rounded-xl border border-border bg-card overflow-hidden hidden"
        >
          <div className="p-5">
            <div id="backup-list" className="space-y-2 mb-4">
              <p className="text-sm text-muted-foreground">
                {t.settings.system.backupRestore.loading}
              </p>
            </div>
            <button
              id="btn-restore-backup"
              disabled
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-blue-500/30"
            >
              <i className="ti ti-database-import text-base"></i>
              {t.settings.system.backupRestore.btnRestore}
            </button>
          </div>
        </div>

        {/** No backup module notice */}
        <div
          id="no-backup-notice"
          className="rounded-xl border border-border bg-card p-5 flex items-center gap-4"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <i className="ti ti-database text-muted-foreground"></i>
          </div>
          <div>
            <p className="text-sm font-medium">
              {t.settings.system.noBackup.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.settings.system.noBackup.descBefore}
              <strong>{t.settings.system.noBackup.backupsModule}</strong>
              {t.settings.system.noBackup.descAfter}
            </p>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
