// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/backups/BackupSources.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_backups_BackupSources(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  // SPDX-License-Identifier: AGPL-3.0-only
  // Copyright (C) 2026 LUXISOFT
  /**
   * BackupSources — reusable source selector for the "Backup now" and "Schedule"
   * dialogs. `prefix` namespaces every element id so two instances can coexist on
   * the same page (e.g. "bk" and "sch"). Wired client-side by setupBackupSources().
   */
  interface Props {
    prefix: string;
    s: {
      title: string;
      scopeFull: string;
      scopeFullHint: string;
      scopeCustom: string;
      labelDatabases: string;
      dbAll: string;
      dbPick: string;
      dbChoose: string;
      dbNone: string;
      labelMail: string;
      labelPanelConfig: string;
      foldersTitle: string;
      addFolder: string;
      noFolders: string;
    };
  }
  const { prefix, s } = Astro.props;

  return (
    <Fragment>
      <div className="space-y-3" data-sources={prefix}>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {s.title}
        </p>

        {/** Scope: full server vs custom */}
        <div className="grid gap-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent/50">
            <input
              type="radio"
              name={`${prefix}-scope`}
              defaultValue="full"
              className="mt-0.5 h-4 w-4 border-input text-primary"
              data-scope
            />
            <span>
              <span className="block text-sm font-medium">{s.scopeFull}</span>
              <span className="block text-xs text-muted-foreground">
                {s.scopeFullHint}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent/50">
            <input
              type="radio"
              name={`${prefix}-scope`}
              defaultValue="custom"
              defaultChecked
              className="mt-0.5 h-4 w-4 border-input text-primary"
              data-scope
            />
            <span className="block text-sm font-medium">{s.scopeCustom}</span>
          </label>
        </div>

        {/** Custom panel */}
        <div
          id={`${prefix}-custom`}
          className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3"
        >
          {/** Databases */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id={`${prefix}-db`}
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-input text-primary"
                data-db-toggle
              />
              <label htmlFor={`${prefix}-db`} className="text-sm font-medium">
                {s.labelDatabases}
              </label>
            </div>
            <div id={`${prefix}-db-detail`} className="space-y-1.5 pl-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${prefix}-db-mode`}
                  defaultValue="all"
                  defaultChecked
                  className="h-4 w-4 border-input text-primary"
                  data-db-mode
                />
                {s.dbAll}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${prefix}-db-mode`}
                  defaultValue="pick"
                  className="h-4 w-4 border-input text-primary"
                  data-db-mode
                />
                {s.dbPick}
              </label>
              <div id={`${prefix}-db-pick`} className="hidden space-y-1.5 pt-1">
                <button
                  type="button"
                  id={`${prefix}-db-choose`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  <i className="ti ti-database-cog text-sm"></i>
                  {s.dbChoose}
                </button>
                <div
                  id={`${prefix}-db-chips`}
                  className="flex flex-wrap gap-1 text-xs text-muted-foreground"
                >
                  {s.dbNone}
                </div>
              </div>
            </div>
          </div>

          {/** Mail */}
          <div className="flex items-center gap-2">
            <input
              id={`${prefix}-mail`}
              type="checkbox"
              className="h-4 w-4 rounded border-input text-primary"
              data-mail
            />
            <label htmlFor={`${prefix}-mail`} className="text-sm">
              {s.labelMail}
            </label>
          </div>

          {/** Panel config */}
          <div className="flex items-center gap-2">
            <input
              id={`${prefix}-panel`}
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-input text-primary"
              data-panel
            />
            <label htmlFor={`${prefix}-panel`} className="text-sm">
              {s.labelPanelConfig}
            </label>
          </div>

          {/** Folders */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{s.foldersTitle}</span>
              <button
                type="button"
                id={`${prefix}-add-folder`}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
              >
                <i className="ti ti-folder-plus text-sm"></i>
                {s.addFolder}
              </button>
            </div>
            <div
              id={`${prefix}-folders`}
              className="flex flex-wrap gap-1 text-xs text-muted-foreground"
              data-no-folders={s.noFolders}
            >
              {s.noFolders}
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
