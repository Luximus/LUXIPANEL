// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/users/HostingTemplates.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_users_HostingTemplates(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { p } = Astro.props;
  const limits = [
    ["diskQuotaMb", "disk", 1, 10000000],
    ["maxDomains", "domains", 0, 100000],
    ["maxEmailAccounts", "emails", 0, 100000],
    ["maxDatabases", "databases", 0, 100000],
    ["maxSubUsers", "subusers", 0, 100000],
    ["cpuPercent", "cpu", 1, 10000],
    ["memoryMb", "memory", 64, 1048576],
    ["maxProcesses", "processes", 8, 65536],
  ];
  const security = [
    ["maxTerminalSessions", "maxSessions", 1, 20],
    ["commandTimeoutSeconds", "timeout", 1, 3600],
    ["sessionHours", "sessionHours", 0.1, 720],
  ];

  return (
    <Fragment>
      <dialog
        id="hosting-plans-dialog"
        aria-labelledby="hosting-plans-title"
        className="w-[min(64rem,calc(100vw-2rem))] max-h-[90dvh] rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 id="hosting-plans-title" className="text-lg font-semibold">
              {p.title}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {p.hint}
            </p>
          </div>
          <button
            id="hosting-plans-close"
            type="button"
            aria-label={p.close}
            className="rounded-lg border border-border px-3 py-2"
          >
            ×
          </button>
        </header>
        <div className="grid gap-5 p-5 md:grid-cols-[13rem_1fr]">
          <aside className="space-y-3">
            <button
              id="hosting-plan-new"
              type="button"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              {p.new}
            </button>
            <div
              id="hosting-plan-list"
              className="space-y-2"
              aria-label={p.title}
            ></div>
            <p
              id="hosting-plan-capabilities"
              className="text-xs leading-relaxed text-muted-foreground"
            ></p>
          </aside>
          <form id="hosting-plan-form" className="min-w-0 space-y-4">
            <p
              id="hosting-plan-status"
              role="status"
              className="text-sm text-muted-foreground"
            ></p>
            <fieldset
              id="hosting-plan-fields"
              disabled
              className="min-w-0 space-y-4 disabled:opacity-60"
            >
              <label className="block text-sm">
                {p.name}
                <input
                  id="hosting-plan-name"
                  required
                  minLength={2}
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                />
              </label>
              <details open className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {p.permissions}
                </summary>
                <div
                  id="hosting-plan-permissions"
                  className="mt-3 space-y-2"
                ></div>
              </details>
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {p.limits}
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {limits.map(([key, label, min, max]) => (
                    <Fragment>
                      <label className="text-xs">
                        {p[label]}
                        <input
                          data-plan-limit={key}
                          required
                          type="number"
                          min={min}
                          max={max}
                          className="mt-1 w-full rounded-lg border border-border bg-background p-2 tabular-nums"
                        />
                      </label>
                    </Fragment>
                  ))}
                </div>
              </details>
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {p.paths}
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["allowPaths", "allowed"],
                    ["denyPaths", "denied"],
                    ["readOnlyPaths", "readonly"],
                  ].map(([key, label]) => (
                    <Fragment>
                      <label className="text-xs">
                        {p[label]}
                        <textarea
                          data-plan-path={key}
                          rows={3}
                          spellCheck="false"
                          className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-mono"
                        ></textarea>
                      </label>
                    </Fragment>
                  ))}
                  <label className="text-xs">
                    {p.defaultPath}
                    <input
                      id="hosting-plan-default-path"
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-mono"
                    />
                  </label>
                </div>
              </details>
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {p.commands}
                </summary>
                <div
                  id="hosting-plan-command-groups"
                  className="mt-3 grid grid-cols-2 gap-2 text-xs"
                ></div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["allowCommands", "allowCommands"],
                    ["denyCommands", "denyCommands"],
                  ].map(([key, label]) => (
                    <Fragment>
                      <label className="text-xs">
                        {p[label]}
                        <textarea
                          data-plan-command={key}
                          rows={3}
                          spellCheck="false"
                          className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-mono"
                        ></textarea>
                      </label>
                    </Fragment>
                  ))}
                </div>
              </details>
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {p.security}
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs">
                    {p.shell}
                    <select
                      id="hosting-plan-shell"
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                    >
                      <option value="disabled">{p.disabled}</option>
                      <option value="jailed">{p.jailed}</option>
                    </select>
                  </label>
                  {security.map(([key, label, min, max]) => (
                    <Fragment>
                      <label className="text-xs">
                        {p[label]}
                        <input
                          data-plan-security={key}
                          type="number"
                          required
                          min={min}
                          max={max}
                          step={key === "sessionHours" ? 0.1 : 1}
                          className="mt-1 w-full rounded-lg border border-border bg-background p-2"
                        />
                      </label>
                    </Fragment>
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs">
                  <input id="hosting-plan-mfa" type="checkbox" />
                  {p.mfa}
                </label>
                <label className="mt-3 block text-xs">
                  {p.mailTargets}
                  <textarea
                    id="hosting-plan-mail-targets"
                    rows={2}
                    spellCheck="false"
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 font-mono"
                  ></textarea>
                </label>
              </details>
              <footer className="flex items-center justify-between gap-3">
                <button
                  id="hosting-plan-delete"
                  type="button"
                  className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive"
                >
                  {p.delete}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {p.save}
                </button>
              </footer>
            </fieldset>
          </form>
        </div>
      </dialog>
    </Fragment>
  );
}
