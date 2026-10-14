// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/hosting/ProviderGroupSettings.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

export default function components_hosting_ProviderGroupSettings(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;

  const { h, hs, pplan } = Astro.props;
  const p = hs.groupPolicy;
  const quotas = [
    ["diskQuotaMb", h.stats.disk, 256],
    ["bandwidthQuotaMb", h.stats.bandwidth, 1024],
    ["maxDomains", h.stats.domains, 1],
    ["maxEmailAccounts", hs.emailAccounts, 0],
    ["maxDatabases", h.stats.databases, 0],
    ["maxSubUsers", hs.subusers, 0],
  ];

  return (
    <Fragment>
      <section
        data-hosting-settings-view="providers"
        className="hidden space-y-5"
      >
        <div>
          <h4 className="text-sm font-semibold">{hs.providerConnections}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {hs.providerConnectionsHint}
          </p>
        </div>
        <div
          id="hosting-provider-list"
          className="space-y-2 text-sm"
          aria-live="polite"
        ></div>
        <p
          id="hosting-provider-status"
          role="status"
          className="text-xs text-muted-foreground"
        ></p>
        <button
          id="provider-retry"
          type="button"
          className="hidden rounded-lg border border-border px-3 py-2 text-xs"
        >
          {hs.retry}
        </button>
        <form
          id="hosting-provider-form"
          className="space-y-4 border-t border-border pt-5"
        >
          <fieldset
            id="provider-fields"
            disabled
            className="space-y-4 disabled:opacity-60"
          >
            <h5 id="provider-form-title" className="text-sm font-semibold">
              {hs.newProvider}
            </h5>
            <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
              <label className="block text-xs">
                {h.modal.labelName}
                <input
                  id="provider-name"
                  required
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
                  placeholder="Luxisoft"
                />
              </label>
              <label className="block text-xs">
                {hs.managedServer}
                <select
                  id="provider-target"
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
                >
                  <option value="local">{hs.localServer}</option>
                </select>
              </label>
              <label className="block text-xs">
                {hs.panelHttpsOrigin}
                <input
                  id="provider-panel-url"
                  required
                  type="url"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
                  placeholder="https://panel.example.org"
                />
              </label>
              <label className="block text-xs">
                {hs.siteEngine}
                <input
                  id="provider-upstream"
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
                  defaultValue="http://127.0.0.1:3400"
                />
              </label>
            </div>
            <label className="block text-xs">
              {pplan.title}
              <select
                id="provider-template-id"
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
              >
                <option value="">{pplan.legacy}</option>
              </select>
              <span className="mt-1 block text-muted-foreground">
                {pplan.hint}
              </span>
            </label>
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div>
                <h6 className="text-sm font-semibold">{p.templateTitle}</h6>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.templateHint}
                </p>
              </div>
              <div
                id="provider-module-picker"
                className="max-h-96 space-y-2 overflow-y-auto overscroll-contain"
                aria-label={hs.accountModules}
              ></div>
            </div>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {p.filesScope}
              </summary>
              <p className="mt-2 text-xs text-muted-foreground">
                {p.relativeHint}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2">
                {[
                  ["allowPaths", p.allowPaths],
                  ["denyPaths", p.denyPaths],
                  ["readOnlyPaths", p.readOnlyPaths],
                ].map(([key, label]) => (
                  <Fragment>
                    <label className="block text-xs">
                      {label}
                      <textarea
                        id={`provider-${key}`}
                        rows={3}
                        spellCheck="false"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 font-mono text-xs"
                      ></textarea>
                    </label>
                  </Fragment>
                ))}
                <label className="block text-xs">
                  {p.defaultPath}
                  <input
                    id="provider-defaultPath"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 font-mono text-xs"
                    placeholder="."
                  />
                </label>
              </div>
            </details>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {p.commands}
              </summary>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input id="provider-allowAllCommands" type="checkbox" />
                {p.allowAllCommands}
              </label>
              <fieldset className="mt-3">
                <legend className="text-xs font-medium">
                  {p.commandGroups}
                </legend>
                <div
                  id="provider-command-groups"
                  className="mt-2 grid grid-cols-1 gap-2 text-xs @xl:grid-cols-2"
                ></div>
              </fieldset>
              <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2">
                {[
                  ["allowCommands", p.allowedCommands],
                  ["denyCommands", p.deniedCommands],
                ].map(([key, label]) => (
                  <Fragment>
                    <label className="block text-xs">
                      {label}
                      <textarea
                        id={`provider-${key}`}
                        rows={3}
                        spellCheck="false"
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 font-mono text-xs"
                      ></textarea>
                    </label>
                  </Fragment>
                ))}
              </div>
            </details>
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {h.modal.resourcesTitle}
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3 text-xs @xl:grid-cols-2">
                <label>
                  {h.modal.labelPlan}
                  <select
                    id="provider-plan"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
                  >
                    {[
                      ["basic", h.options.planBasic],
                      ["pro", h.options.planPro],
                      ["business", h.options.planBusiness],
                      ["custom", h.options.planCustom],
                    ].map(([value, label]) => (
                      <Fragment>
                        <option value={value}>{label}</option>
                      </Fragment>
                    ))}
                  </select>
                </label>
                {quotas.map(([key, label, min]) => (
                  <Fragment>
                    <label>
                      {label}
                      <input
                        id={`provider-${key}`}
                        type="number"
                        min={min}
                        max={
                          key === "diskQuotaMb"
                            ? 10000000
                            : key === "bandwidthQuotaMb"
                              ? 100000000
                              : 100000
                        }
                        required
                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2"
                      />
                    </label>
                  </Fragment>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs">
                <input id="provider-jailEnabled" type="checkbox" />
                {h.modal.labelJail}
              </label>
            </details>
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">
                {hs.apiOperations}
              </legend>
              <div
                id="provider-operations"
                className="grid grid-cols-1 gap-2 text-xs @xl:grid-cols-2"
              ></div>
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button
                id="provider-submit"
                type="submit"
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                {hs.createProviderKey}
              </button>
              <button
                id="provider-cancel-edit"
                type="button"
                className="hidden rounded-lg border border-border px-3 py-2 text-xs"
              >
                {h.modal.btnCancel}
              </button>
            </div>
          </fieldset>
        </form>
        <div
          id="hosting-provider-key-box"
          className="hidden rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
        >
          <p className="font-semibold">{hs.copyKeyNow}</p>
          <code
            id="hosting-provider-key"
            className="mt-2 block break-all select-all"
          ></code>
        </div>
      </section>
    </Fragment>
  );
}
