import { githubCopy } from "@/lib/github-copy";
// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsCredentialsPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

import ModalNavbar from "./components_ui_ModalNavbar";
import { GitCredentialFields } from "../credentials/GitCredentialFields";
import { AssistantCredentialSettings } from "../credentials/AssistantCredentialSettings";
import { useCredentialsLayout } from "../use-credentials-layout";
import { DIALOG_CHROME } from "@/lib/ui-classes";
export default function components_settings_SettingsCredentialsPanel(
  props: any,
) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  const {
    isAdmin,
    cred,
    t,
    credHelp,
    credGuides,
    TOKEN_CREDENTIALS,
    STORAGE_CREDENTIALS,
    CONNECTOR_CREDENTIALS,
    MANAGED_CREDENTIALS,
  } = Astro.props;
  useCredentialsLayout(Boolean(cred));

  return (
    <Fragment>
      {cred && (
        <Fragment>
          <div
            id="panel-credentials"
            className="tab-panel hidden space-y-5"
            data-lxp-collapse-group
          >
            <a href="/connect-github" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 font-medium hover:bg-muted"><i className="ti ti-brand-github" aria-hidden="true"/>{githubCopy(context.scope.document.documentElement.lang || "en").title}</a>
            <div
              id="cred-empty"
              className="hidden rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground"
            >
              <i className="ti ti-key-off mb-2 block text-2xl opacity-60"></i>
              {t.settings.credentials.empty}
            </div>

            <div id="cred-grid" className="grid gap-4 lg:grid-cols-2">
              {TOKEN_CREDENTIALS.map((c: any) => (
                <Fragment>
                  <div
                    id={`cred-card-${c.id}`}
                    className="cred-card rounded-xl border border-border bg-card overflow-hidden transition-shadow"
                    data-lxp-collapse
                    data-cred-card
                    data-cred-id={c.id}
                    data-cred-gate={c.gate ?? c.id}
                    data-cred-base={c.base}
                    data-cred-delete={c.del}
                    data-cred-test={c.test}
                    data-cred-put-key={c.putKey}
                    data-cred-set-field={c.setField}
                    data-cred-preview-field={c.previewField}
                  >
                    <div
                      className="cred-collapse-head group flex cursor-pointer select-none items-center gap-x-4 px-5 py-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      data-lxp-collapse-toggle
                      role="button"
                      tabIndex={0}
                      aria-expanded="false"
                    >
                      <div className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                        {c.id === "openclaw" ? (
                          <Fragment>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 120 120"
                              width="1em"
                              height="1em"
                              fill="currentColor"
                              className="text-base text-foreground"
                              aria-hidden="true"
                            >
                              <mask id="oc-claw-eyes">
                                <rect width="120" height="120" fill="#fff" />
                                <circle cx="45" cy="35" r="5.5" fill="#000" />
                                <circle cx="75" cy="35" r="5.5" fill="#000" />
                              </mask>
                              <g mask="url(#oc-claw-eyes)">
                                <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" />
                                <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" />
                                <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" />
                              </g>
                              <path
                                d="M45 15 Q35 5 30 8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                              <path
                                d="M75 15 Q85 5 90 8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>
                          </Fragment>
                        ) : (
                          <Fragment>
                            <i
                              className={`ti ${c.icon} text-base text-foreground`}
                            ></i>
                          </Fragment>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {c.label}
                        </h3>
                        <p className="cred-state mt-0.5 text-xs text-muted-foreground">
                          {t.settings.credentials.statusMissing}
                        </p>
                      </div>
                      <span className="cred-badge inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <i className="ti ti-circle-x text-xs"></i>{" "}
                        {t.settings.credentials.statusMissing}
                      </span>
                      <i
                        className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                        data-lxp-collapse-chevron
                      ></i>
                    </div>
                    <div className="m-4 overflow-hidden rounded-xl bg-muted/30">
                      <div className="cred-tabs flex gap-4 border-b border-border px-5">
                        <button
                          type="button"
                          data-cred-tab="config"
                          className="cred-tab -mb-px border-b-2 border-primary py-2.5 text-xs font-medium text-foreground"
                        >
                          {credHelp.tabConfig}
                        </button>
                        <button
                          type="button"
                          data-cred-tab="help"
                          className="cred-tab -mb-px border-b-2 border-transparent py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {credHelp.tabHelp}
                        </button>
                      </div>
                      <div
                        className="cred-pane space-y-2.5 p-5"
                        data-pane="config"
                      >
                        <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t.settings.credentials.tokenLabel}
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              className="cred-input w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              type="password"
                              autoComplete="off"
                              placeholder={
                                t.settings.credentials.tokenPlaceholder
                              }
                            />
                            <button
                              type="button"
                              className="cred-toggle absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                              aria-label={t.settings.credentials.show}
                            >
                              <i className="ti ti-eye text-base"></i>
                            </button>
                          </div>
                          <button className="cred-save inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            <i className="ti ti-device-floppy text-base"></i>{" "}
                            {t.settings.credentials.save}
                          </button>
                        </div>
                        {c.extraField && (
                          <Fragment>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {c.extraField.label}
                              </label>
                              <input
                                className="cred-extra w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                type="text"
                                autoComplete="off"
                                data-cred-extra-key={c.extraField.key}
                                data-cred-extra-get={c.extraField.getField}
                                placeholder={c.extraField.placeholder}
                              />
                            </div>
                          </Fragment>
                        )}
                        {c.hint && (
                          <Fragment>
                            <p className="text-xs text-muted-foreground">
                              {c.hint}
                            </p>
                          </Fragment>
                        )}
                        {/* Nota viva del contrato genérico: el GET de la tarjeta puede
                devolver un resumen legible (p.ej. el plan de Tolqia y sus
                límites) que se pinta aquí y se refresca tras "Probar". */}
                        {c.noteField && (
                          <Fragment>
                            <p
                              className="cred-note hidden rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground"
                              data-cred-note-get={c.noteField}
                            ></p>
                          </Fragment>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {c.test && (
                            <Fragment>
                              <button className="cred-test inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50">
                                <i className="ti ti-plug-connected text-sm"></i>{" "}
                                {t.settings.credentials.test}
                              </button>
                            </Fragment>
                          )}
                          <button className="cred-clear hidden items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                            <i className="ti ti-trash text-sm"></i>{" "}
                            {t.settings.credentials.clear}
                          </button>
                        </div>
                      </div>
                      <div
                        className="cred-pane hidden space-y-3 p-5"
                        data-pane="help"
                      >
                        {credGuides[c.id]?.steps?.length ? (
                          <Fragment>
                            <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
                              {credGuides[c.id].steps.map((s: any) => (
                                <Fragment>
                                  <li>{s}</li>
                                </Fragment>
                              ))}
                            </ol>
                          </Fragment>
                        ) : null}
                        {credGuides[c.id]?.docUrl && (
                          <Fragment>
                            <a
                              href={credGuides[c.id].docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <i className="ti ti-external-link text-sm"></i>{" "}
                              {credGuides[c.id].docLabel || credHelp.openLink}
                            </a>
                          </Fragment>
                        )}
                        {/* Segundo enlace opcional: hay proveedores (Tolqia) donde
                "dónde se crea el token" y "la documentación" son páginas
                distintas y ambas hacen falta. */}
                        {credGuides[c.id]?.docUrl2 && (
                          <Fragment>
                            <a
                              href={credGuides[c.id].docUrl2}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <i className="ti ti-book text-sm"></i>{" "}
                              {credGuides[c.id].docLabel2 || credHelp.openLink}
                            </a>
                          </Fragment>
                        )}
                      </div>
                    </div>
                    {c.id === "repository-store" && <GitCredentialFields t={t} />}
                  </div>
                </Fragment>
              ))}

              {STORAGE_CREDENTIALS.map((c: any) => (
                <Fragment>
                  <div
                    id={`cred-card-${c.provider}`}
                    className="cred-card rounded-xl border border-border bg-card overflow-hidden transition-shadow"
                    data-lxp-collapse
                    data-cred-storage
                    data-cred-id={c.provider}
                    data-cred-gate={c.gate}
                    data-cred-provider={c.provider}
                  >
                    <div
                      className="cred-collapse-head group flex cursor-pointer select-none items-center gap-x-4 px-5 py-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      data-lxp-collapse-toggle
                      role="button"
                      tabIndex={0}
                      aria-expanded="false"
                    >
                      <div className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                        <i
                          className={`ti ${c.icon} text-base text-foreground`}
                        ></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {c.label}
                        </h3>
                        <p className="cred-state mt-0.5 text-xs text-muted-foreground">
                          {t.settings.credentials.statusMissing}
                        </p>
                      </div>
                      <span className="cred-badge inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <i className="ti ti-circle-x text-xs"></i>{" "}
                        {t.settings.credentials.statusMissing}
                      </span>
                      <i
                        className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                        data-lxp-collapse-chevron
                      ></i>
                    </div>
                    <div className="m-4 overflow-hidden rounded-xl bg-muted/30">
                      <div className="cred-tabs flex gap-4 border-b border-border px-5">
                        <button
                          type="button"
                          data-cred-tab="config"
                          className="cred-tab -mb-px border-b-2 border-primary py-2.5 text-xs font-medium text-foreground"
                        >
                          {credHelp.tabConfig}
                        </button>
                        <button
                          type="button"
                          data-cred-tab="help"
                          className="cred-tab -mb-px border-b-2 border-transparent py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {credHelp.tabHelp}
                        </button>
                      </div>
                      <div
                        className="cred-pane space-y-3 p-5"
                        data-pane="config"
                      >
                        <p className="text-xs text-muted-foreground">
                          {c.provider === "r2"
                            ? t.settings.credentials.storage.r2Hint
                            : t.settings.credentials.storage.s3Hint}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {c.provider === "r2" && (
                            <Fragment>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t.settings.credentials.storage.accountId}
                                </label>
                                <input
                                  data-field="accountId"
                                  type="text"
                                  autoComplete="off"
                                  className="cred-sf w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </div>
                            </Fragment>
                          )}
                          <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t.settings.credentials.storage.accessKeyId}
                            </label>
                            <input
                              data-field="accessKeyId"
                              type="text"
                              autoComplete="off"
                              className="cred-sf w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t.settings.credentials.storage.secret}
                            </label>
                            <div className="relative">
                              <input
                                data-field="secretAccessKey"
                                type="password"
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="cred-sf cred-secret w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <button
                                type="button"
                                className="cred-toggle absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                                aria-label={t.settings.credentials.show}
                              >
                                <i className="ti ti-eye text-base"></i>
                              </button>
                            </div>
                          </div>
                          {c.provider === "s3" && (
                            <Fragment>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t.settings.credentials.storage.endpoint}
                                </label>
                                <input
                                  data-field="endpoint"
                                  type="text"
                                  autoComplete="off"
                                  placeholder="https://s3.amazonaws.com"
                                  className="cred-sf w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </div>
                            </Fragment>
                          )}
                          {c.provider === "s3" && (
                            <Fragment>
                              <div>
                                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t.settings.credentials.storage.region}
                                </label>
                                <input
                                  data-field="region"
                                  type="text"
                                  autoComplete="off"
                                  placeholder="us-east-1"
                                  className="cred-sf w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </div>
                            </Fragment>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                          <button className="cred-save inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            <i className="ti ti-device-floppy text-base"></i>{" "}
                            {t.settings.credentials.save}
                          </button>
                          <button className="cred-clear hidden items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                            <i className="ti ti-trash text-base"></i>{" "}
                            {t.settings.credentials.clear}
                          </button>
                        </div>
                      </div>
                      <div
                        className="cred-pane hidden space-y-3 p-5"
                        data-pane="help"
                      >
                        {credGuides[c.provider]?.steps?.length ? (
                          <Fragment>
                            <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
                              {credGuides[c.provider].steps.map((s: any) => (
                                <Fragment>
                                  <li>{s}</li>
                                </Fragment>
                              ))}
                            </ol>
                          </Fragment>
                        ) : null}
                        {credGuides[c.provider]?.docUrl && (
                          <Fragment>
                            <a
                              href={credGuides[c.provider].docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              <i className="ti ti-external-link text-sm"></i>{" "}
                              {credGuides[c.provider].docLabel ||
                                credHelp.openLink}
                            </a>
                          </Fragment>
                        )}
                      </div>
                    </div>
                  </div>
                </Fragment>
              ))}

              {CONNECTOR_CREDENTIALS.map((c: any) => (
                <Fragment>
                  <div
                    id={`cred-card-${c.id}`}
                    className="cred-card rounded-xl border border-border bg-card overflow-hidden transition-shadow"
                    data-lxp-collapse
                    data-cred-connector
                    data-cred-id={c.id}
                  >
                    <div
                      className="cred-collapse-head group flex cursor-pointer select-none items-center gap-x-4 px-5 py-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      data-lxp-collapse-toggle
                      role="button"
                      tabIndex={0}
                      aria-expanded="false"
                    >
                      <div className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                        <i
                          className={`ti ${c.icon} text-base text-foreground`}
                        ></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {c.label}
                        </h3>
                        <p className="cred-state mt-0.5 text-xs text-muted-foreground">
                          {t.settings.credentials.connector.notConnected}
                        </p>
                      </div>
                      <span className="cred-badge inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <i className="ti ti-circle-x text-xs"></i>{" "}
                        {t.settings.credentials.connector.notConnected}
                      </span>
                      <i
                        className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                        data-lxp-collapse-chevron
                      ></i>
                    </div>
                    <div className="m-4 overflow-hidden rounded-xl bg-muted/30">
                      <div className="cred-tabs flex gap-4 border-b border-border px-5">
                        <button
                          type="button"
                          data-cred-tab="config"
                          className="cred-tab -mb-px border-b-2 border-primary py-2.5 text-xs font-medium text-foreground"
                        >
                          {credHelp.tabConfig}
                        </button>
                        <button
                          type="button"
                          data-cred-tab="help"
                          className="cred-tab -mb-px border-b-2 border-transparent py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {credHelp.tabHelp}
                        </button>
                      </div>
                      <div
                        className="cred-pane space-y-3 p-5"
                        data-pane="config"
                      >
                        <div className="cred-connector-fields grid grid-cols-2 gap-3"></div>
                        <p className="cred-connector-err hidden text-[11px] text-destructive"></p>
                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                          <button className="cred-connect inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            <i className="ti ti-plug-connected text-base"></i>{" "}
                            {t.settings.credentials.connector.connect}
                          </button>
                          <button className="cred-disconnect hidden items-center gap-2 rounded-lg border border-destructive/30 bg-background px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                            <i className="ti ti-plug-off text-base"></i>{" "}
                            {t.settings.credentials.connector.disconnect}
                          </button>
                        </div>
                      </div>
                      <div
                        className="cred-pane hidden space-y-3 p-5"
                        data-pane="help"
                      >
                        <ol className="cred-help-steps list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground"></ol>
                        <div className="cred-help-link"></div>
                      </div>
                    </div>
                  </div>
                </Fragment>
              ))}

              {MANAGED_CREDENTIALS.map((c: any) => (
                <Fragment>
                  <div
                    id={`cred-card-${c.id}`}
                    className="cred-card rounded-xl border border-border bg-card overflow-hidden transition-shadow"
                    data-lxp-collapse
                    data-cred-managed
                    data-cred-id={c.id}
                  >
                    <div
                      className="cred-collapse-head group flex cursor-pointer select-none items-center gap-x-4 px-5 py-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      data-lxp-collapse-toggle
                      role="button"
                      tabIndex={0}
                      aria-expanded="false"
                    >
                      <div className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                        <i
                          className={`ti ${c.icon} text-base text-foreground`}
                        ></i>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold">
                          {c.label}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.summary}
                        </p>
                      </div>
                      <i
                        className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                        data-lxp-collapse-chevron
                      ></i>
                    </div>
                    <div className="m-4 overflow-hidden rounded-xl bg-muted/30">
                      <AssistantCredentialSettings />
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>

            {isAdmin && <>
            {/** ── hCaptcha (site key + secret; protege el login del panel) ── */}
            <div
              id="cred-card-hcaptcha"
              className="rounded-xl border border-border bg-card overflow-hidden"
              data-lxp-collapse
            >
              <div
                className="cred-collapse-head group flex cursor-pointer select-none items-center gap-x-4 px-5 py-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                data-lxp-collapse-toggle
                role="button"
                tabIndex={0}
                aria-expanded="false"
              >
                <div className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-muted">
                  <i className="ti ti-shield-lock text-base text-foreground"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">
                    {t.settings.credentials.hcaptcha.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.settings.credentials.hcaptcha.desc}
                  </p>
                </div>
                <span
                  id="cred-hcaptcha-status"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  <i className="ti ti-circle-x text-xs"></i>{" "}
                  {t.settings.credentials.hcaptcha.statusMissing}
                </span>
                <i
                  className="ti ti-chevron-down shrink-0 text-base text-muted-foreground transition-transform duration-200"
                  data-lxp-collapse-chevron
                ></i>
              </div>
              <div className="m-4 overflow-hidden rounded-xl bg-muted/30">
                <div className="space-y-4 p-5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cred-hcaptcha-sitekey"
                      className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {t.settings.credentials.hcaptcha.sitekeyLabel}
                    </label>
                    <input
                      id="cred-hcaptcha-sitekey"
                      type="text"
                      autoComplete="off"
                      spellCheck="false"
                      placeholder={
                        t.settings.credentials.hcaptcha.sitekeyPlaceholder
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="cred-hcaptcha-secret"
                      className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {t.settings.credentials.hcaptcha.secretLabel}
                    </label>
                    <div className="relative">
                      <input
                        id="cred-hcaptcha-secret"
                        type="password"
                        autoComplete="new-password"
                        spellCheck="false"
                        placeholder={
                          t.settings.credentials.hcaptcha.secretPlaceholder
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        id="cred-hcaptcha-secret-toggle"
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                        aria-label={t.settings.credentials.show}
                      >
                        <i className="ti ti-eye text-base"></i>
                      </button>
                    </div>
                    <p
                      id="cred-hcaptcha-secret-hint"
                      className="hidden text-[11px] text-muted-foreground"
                    >
                      {t.settings.credentials.hcaptcha.secretConfigured}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <button
                      id="cred-hcaptcha-save"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <i className="ti ti-device-floppy text-base"></i>{" "}
                      {t.settings.credentials.save}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/** ── Credenciales Git (gestión movida desde el módulo Files) ── */}
            
            {/** GitHub · SSH manager (migrado desde el módulo repository-store) */}
            <dialog
              id="dlg-git-creds"
              className={`fixed inset-auto top-1/2 left-1/2 m-0 h-fit max-h-[calc(100dvh-2rem)] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto ${DIALOG_CHROME}`}
            >
              <ModalNavbar
                title="GitHub · SSH"
                description={t.repositoryStore.sshDialog.subtitle}
                icon="ti-brand-github"
                closeId="git-creds-close"
                closeLabel={t.repositoryStore.sshDialog.cerrarAriaLabel}
              >
                <Fragment slot="actions">
                  <select
                    id="git-ssh-user"
                    title={t.repositoryStore.sshDialog.usuarioLinuxTitle}
                    className="h-9 max-w-[11rem] rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">
                      {t.repositoryStore.sshDialog.usuarioActual}
                    </option>
                  </select>
                  <button
                    id="git-ssh-refresh"
                    type="button"
                    title={t.repositoryStore.sshDialog.refrescarTitle}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <i className="ti ti-refresh text-sm"></i>
                  </button>
                </Fragment>
              </ModalNavbar>

              <div className="max-h-[calc(100dvh-8rem)] space-y-5 overflow-y-auto px-6 py-5">
                {/** 1. Environment */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <i className="ti ti-folder-search text-base text-primary"></i>{" "}
                    {t.repositoryStore.sshDialog.envSection}
                  </h4>
                  <div
                    id="git-ssh-env"
                    className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs"
                  >
                    <div className="text-muted-foreground">
                      {t.repositoryStore.sshDialog.cargando}
                    </div>
                  </div>
                  <pre
                    id="git-ssh-ls"
                    className="hidden max-h-44 overflow-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed"
                  ></pre>
                </section>

                {/** 2. Test connection */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <i className="ti ti-plug-connected text-base text-primary"></i>{" "}
                    {t.repositoryStore.sshDialog.testSection}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="git-ssh-host"
                      type="text"
                      defaultValue="github.com"
                      className="h-9 w-40 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      id="git-ssh-test-key"
                      title={t.repositoryStore.sshDialog.keySelectTitle}
                      className="h-9 min-w-[12rem] flex-1 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">
                        {t.repositoryStore.sshDialog.keyAutoOption}
                      </option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        id="git-ssh-verbose"
                        type="checkbox"
                        className="rounded border-input"
                      />{" "}
                      {t.repositoryStore.sshDialog.verboso}
                    </label>
                    <button
                      id="git-ssh-test-btn"
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <i className="ti ti-radar text-sm"></i>{" "}
                      {t.repositoryStore.sshDialog.probar}
                    </button>
                  </div>
                  <div
                    id="git-ssh-test-result"
                    className="hidden rounded-lg border border-border text-sm"
                  ></div>
                </section>

                {/** 3. ~/.ssh/config */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <i className="ti ti-settings text-base text-primary"></i>{" "}
                    {t.repositoryStore.sshDialog.configSection} (
                    <code className="text-xs">~/.ssh/config</code>)
                  </h4>
                  <div
                    id="git-ssh-config-current"
                    className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground"
                  >
                    —
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="git-ssh-config-hostname"
                      type="text"
                      defaultValue="github.com"
                      title="HostName"
                      className="h-9 w-40 rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      id="git-ssh-config-key"
                      title="IdentityFile"
                      className="h-9 min-w-[12rem] flex-1 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    ></select>
                    <button
                      id="git-ssh-config-save"
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <i className="ti ti-device-floppy text-sm"></i>{" "}
                      {t.repositoryStore.sshDialog.guardar}
                    </button>
                    <button
                      id="git-ssh-fixperms"
                      type="button"
                      title={t.repositoryStore.sshDialog.permisosTitle}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-accent"
                    >
                      <i className="ti ti-lock-cog text-sm"></i>{" "}
                      {t.repositoryStore.sshDialog.permisos}
                    </button>
                  </div>
                  <div
                    id="git-ssh-config-status"
                    className="hidden text-xs"
                  ></div>
                </section>

                {/** 4. Per-repo override */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <i className="ti ti-git-branch text-base text-primary"></i>{" "}
                    {t.repositoryStore.sshDialog.perRepoSection} (
                    <code className="text-xs">core.sshCommand</code>)
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="git-ssh-repo-path"
                      type="text"
                      placeholder={
                        t.repositoryStore.sshDialog.repoPathPlaceholder
                      }
                      className="h-9 min-w-[14rem] flex-1 rounded-lg border border-input bg-background px-3 font-mono text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      id="git-ssh-repo-read"
                      type="button"
                      title={t.repositoryStore.sshDialog.verTitle}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-accent"
                    >
                      <i className="ti ti-eye text-sm"></i>{" "}
                      {t.repositoryStore.sshDialog.ver}
                    </button>
                  </div>
                  <div
                    id="git-ssh-repo-current"
                    className="hidden rounded-lg border border-border bg-muted/30 px-4 py-2 font-mono text-[11px]"
                  ></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      id="git-ssh-repo-key"
                      title={t.repositoryStore.sshDialog.llaveParaRepoTitle}
                      className="h-9 min-w-[12rem] flex-1 rounded-lg border border-input bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    ></select>
                    <button
                      id="git-ssh-repo-apply"
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      <i className="ti ti-check text-sm"></i>{" "}
                      {t.repositoryStore.sshDialog.aplicar}
                    </button>
                    <button
                      id="git-ssh-repo-unset"
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-accent hover:text-destructive"
                    >
                      <i className="ti ti-x text-sm"></i>{" "}
                      {t.repositoryStore.sshDialog.quitar}
                    </button>
                  </div>
                  <div
                    id="git-ssh-repo-status"
                    className="hidden text-xs"
                  ></div>
                </section>
              </div>
            </dialog>
            </>}
          </div>
        </Fragment>
      )}
    </Fragment>
  );
}
