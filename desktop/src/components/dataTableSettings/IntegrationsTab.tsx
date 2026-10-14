import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "../DataTableSettings.module.css";
import { formatMessage, type Messages } from "../../i18n";
import {
  deleteProviderIntegration,
  getProviderCatalog,
  getProviderIntegration,
  listProviderResources,
  listProviderScopes,
  registerProviderResources,
  saveProviderIntegration,
  type ProviderCatalogEntry,
  type ProviderResource,
  type ProviderScope,
} from "../../api/client";
import DataTable, {
  type DataTableColumnConfig,
  type DataTableQuickActionConfig,
} from "../DataTable";
import { useConfirm } from "../ConfirmDialog";
import type { ResourceRow } from "./types";
import { DocLink, InlineAlert, docUrl } from "./shared";

export function IntegrationsTab({ token, t, language, fillHeight = false }: { token: string; t: Messages; language?: string; fillHeight?: boolean }) {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const cat = t.dataTableSettings.integrationsTab.catalog;
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal de credenciales (conectar / reconfigurar).
  const [credEntry, setCredEntry] = useState<ProviderCatalogEntry | null>(null);
  const [credTab, setCredTab] = useState<"connection" | "help">("connection");
  const [credValues, setCredValues] = useState<Record<string, string>>({});
  // Clave del campo de credenciales inválido (para enfocarlo/resaltarlo).
  const [credInvalidKey, setCredInvalidKey] = useState<string | null>(null);
  const credFieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  // Modal de recursos (importar VPS como paneles).
  const [resEntry, setResEntry] = useState<ProviderCatalogEntry | null>(null);
  const [scopes, setScopes] = useState<ProviderScope[]>([]);
  const [scopeId, setScopeId] = useState("");
  const [resources, setResources] = useState<ProviderResource[]>([]);
  const [resLoading, setResLoading] = useState(false);

  const loaded = useRef(false);

  async function loadCatalog() {
    try {
      setCatalog(await getProviderCatalog(token, language));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void loadCatalog();
  }, [token]);

  const fieldLabel = (key: string): string => (cat.fieldLabels as Record<string, string>)[key] ?? key;

  function statusBadge(entry: ProviderCatalogEntry): { cls: string; label: string } {
    if (!entry.implemented) return { cls: "bg-base-200 text-base-content/60 dark:bg-zinc-800", label: cat.statusComingSoon };
    if (entry.connected) return { cls: "bg-emerald-500/15 text-emerald-500", label: cat.statusConnected };
    return { cls: "bg-base-200 text-base-content/70 dark:bg-zinc-800", label: cat.statusNotConnected };
  }

  async function openConnect(entry: ProviderCatalogEntry) {
    if (!entry.implemented) return;
    setError("");
    setSuccess("");
    let values: Record<string, string> = {};
    if (entry.connected) {
      try {
        const detail = await getProviderIntegration(entry.id, token);
        values = detail.values ?? {};
      } catch {
        // sin precarga de no-secretos
      }
    }
    setCredValues(values);
    setCredInvalidKey(null);
    setCredTab("connection");
    setCredEntry(entry);
  }

  async function saveCreds() {
    const entry = credEntry;
    if (!entry) return;
    for (const f of entry.credentialFields) {
      if (f.required && !(credValues[f.key] ?? "").trim()) {
        setError(cat.fieldsRequired);
        setCredInvalidKey(f.key);
        credFieldRefs.current[f.key]?.focus();
        return;
      }
    }
    setCredInvalidKey(null);
    const payload: Record<string, string> = {};
    for (const f of entry.credentialFields) {
      const v = (credValues[f.key] ?? "").trim();
      if (v) payload[f.key] = v;
    }
    setBusy(true);
    setError("");
    try {
      await saveProviderIntegration(entry.id, payload, token);
      setCredEntry(null);
      setSuccess(cat.saved);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : cat.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(entry: ProviderCatalogEntry) {
    const ok = await confirm({
      title: cat.disconnectTitle,
      message: formatMessage(cat.disconnectText, { provider: entry.name }),
      confirmLabel: t.common.delete,
      cancelLabel: t.common.cancel,
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await deleteProviderIntegration(entry.id, token);
      setSuccess(cat.disconnected);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  async function loadResources(entry: ProviderCatalogEntry, scope: string) {
    if (entry.hasScopes && !scope) {
      setResources([]);
      return;
    }
    setResLoading(true);
    try {
      setResources(await listProviderResources(entry.id, entry.hasScopes ? scope : null, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : cat.resourcesLoadFailed);
    } finally {
      setResLoading(false);
    }
  }

  async function openResources(entry: ProviderCatalogEntry) {
    if (!entry.implemented || !entry.connected) return;
    setError("");
    setSuccess("");
    setResources([]);
    setScopes([]);
    setScopeId("");
    setResEntry(entry);
    try {
      if (entry.hasScopes) {
        const sc = await listProviderScopes(entry.id, token);
        setScopes(sc);
        const first = sc[0]?.id ?? "";
        setScopeId(first);
        await loadResources(entry, first);
      } else {
        await loadResources(entry, "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : cat.resourcesLoadFailed);
    }
  }

  async function handleScopeChange(value: string) {
    setScopeId(value);
    if (resEntry) await loadResources(resEntry, value);
  }

  async function registerSelected(rows: ResourceRow[]) {
    const entry = resEntry;
    if (!entry || rows.length === 0) return;
    setBusy(true);
    try {
      const res = await registerProviderResources(
        entry.id,
        {
          scopeId: entry.hasScopes ? (scopeId || null) : null,
          resources: rows.map((r) => ({
            id: r.id,
            name: r.name,
            ip: r.ip || null,
            privateIp: r.privateIp || null,
            region: r.region || null,
            status: r.status || null,
            size: r.size || null,
          })),
        },
        token,
      );
      setSuccess(formatMessage(cat.registered, { count: String(res.createdCount ?? rows.length) }));
      await loadResources(entry, scopeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : cat.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  const resourceRows: ResourceRow[] = useMemo(
    () => resources.map((r) => ({
      id: r.id,
      name: r.name,
      region: r.region ?? "",
      size: r.size ?? "",
      status: r.status ?? "",
      ip: r.ip ?? "",
      privateIp: r.privateIp ?? "",
    })),
    [resources],
  );

  const resourceColumns: DataTableColumnConfig<ResourceRow>[] = [
    { id: "name", header: cat.resColName, accessorKey: "name" },
    { id: "region", header: cat.resColRegion, accessorKey: "region" },
    { id: "size", header: cat.resColSize, accessorKey: "size" },
    { id: "status", header: cat.resColStatus, accessorKey: "status" },
    { id: "ip", header: cat.resColIp, accessorKey: "ip" },
  ];

  const resourceQuickActions: DataTableQuickActionConfig<ResourceRow>[] = [
    {
      id: "register_selected",
      label: cat.registerSelected,
      requiresSelection: true,
      variant: "primary",
      onClick: (rows) => void registerSelected(rows),
    },
  ];

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" : "space-y-2"}>
      <h4 className={`lp-modal-label ${styles.tabHeading}`}>{t.dataTableSettings.tabs.integrations}</h4>
      <p className="text-xs opacity-70">
        {cat.intro}{" "}
        <DocLink href={docUrl("/documentation/integrations")} label={t.dataTableSettings.integrationsTab.docsLink} />
      </p>

      <InlineAlert message={error} />
      <InlineAlert message={success} tone="ok" />

      {loading ? (
        <p className="text-xs opacity-70">{cat.loading}</p>
      ) : catalog.length === 0 ? (
        <p className="text-xs opacity-70">{cat.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {catalog.map((entry) => {
            const badge = statusBadge(entry);
            return (
              <div key={entry.id} className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-base-200 text-sm font-bold dark:bg-zinc-800">{entry.name.slice(0, 1).toUpperCase()}</span>
                  <span className="flex-1 truncate text-sm font-semibold">{entry.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!entry.implemented ? (
                    <span className="text-xs opacity-60">{cat.comingSoon}</span>
                  ) : entry.connected ? (
                    <>
                      <button type="button" className="lp-modal-btn lp-modal-btn--primary lp-modal-btn--sm" onClick={() => void openResources(entry)} disabled={busy}>{cat.viewResources}</button>
                      <button type="button" className="lp-modal-btn lp-modal-btn--ghost lp-modal-btn--sm" onClick={() => void openConnect(entry)} disabled={busy}>{cat.reconfigure}</button>
                      <button type="button" className="lp-modal-btn lp-modal-btn--danger lp-modal-btn--sm" onClick={() => void disconnect(entry)} disabled={busy}>{cat.disconnect}</button>
                    </>
                  ) : (
                    <button type="button" className="lp-modal-btn lp-modal-btn--primary lp-modal-btn--sm" onClick={() => void openConnect(entry)} disabled={busy}>{cat.connect}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {credEntry
        ? createPortal(
            <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4">
              <div className="lp-modal-card flex max-h-full w-full max-w-lg flex-col" onClick={(event) => event.stopPropagation()}>
                <div className="lp-modal-header">
                  <h3 className="lp-modal-title">{formatMessage(cat.credentialsTitle, { provider: credEntry.name })}</h3>
                  <button type="button" className="lp-modal-close" onClick={() => setCredEntry(null)} aria-label={t.dataTableSettings.closeAria}>✕</button>
                </div>
                <div role="tablist" className="lp-modal-tabs">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={credTab === "connection"}
                    className={`lp-modal-tab ${credTab === "connection" ? "is-active" : ""}`}
                    onClick={() => setCredTab("connection")}
                  >
                    {t.dataTableSettings.integrationsTab.connectionTab}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={credTab === "help"}
                    className={`lp-modal-tab ${credTab === "help" ? "is-active" : ""}`}
                    onClick={() => setCredTab("help")}
                  >
                    {t.dataTableSettings.integrationsTab.helpTab}
                  </button>
                </div>
                {credTab === "connection" ? (
                  <div className="lp-modal-body space-y-2">
                    <p className="lp-modal-hint">{cat.credentialsHint}</p>
                    {credEntry.credentialFields.map((field) => (
                      <div key={field.key}>
                        <span className="lp-modal-label">{fieldLabel(field.label)}{field.required ? " *" : ""}</span>
                        {field.type === "textarea" ? (
                          <textarea
                            ref={(el) => { credFieldRefs.current[field.key] = el; }}
                            className={`lp-modal-textarea${credInvalidKey === field.key ? " lp-modal-input--error" : ""}`}
                            aria-invalid={credInvalidKey === field.key || undefined}
                            value={credValues[field.key] ?? ""}
                            placeholder={field.placeholder ?? ""}
                            onChange={(event) => { setCredValues((c) => ({ ...c, [field.key]: event.target.value })); if (credInvalidKey === field.key) setCredInvalidKey(null); }}
                          />
                        ) : (
                          <input
                            ref={(el) => { credFieldRefs.current[field.key] = el; }}
                            className={`lp-modal-input${credInvalidKey === field.key ? " lp-modal-input--error" : ""}`}
                            aria-invalid={credInvalidKey === field.key || undefined}
                            type={field.type === "password" ? "password" : field.type === "email" ? "email" : "text"}
                            value={credValues[field.key] ?? ""}
                            placeholder={field.placeholder ?? ""}
                            autoComplete="off"
                            onChange={(event) => { setCredValues((c) => ({ ...c, [field.key]: event.target.value })); if (credInvalidKey === field.key) setCredInvalidKey(null); }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lp-modal-body space-y-2">
                    {credEntry.help ? (
                      <>
                        <p className="lp-modal-hint">{credEntry.help.intro}</p>
                        <ol className="list-decimal space-y-1 pl-5 text-xs opacity-80">
                          {credEntry.help.steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                        {credEntry.help.docUrl ? (
                          <p className="text-xs">
                            <DocLink href={credEntry.help.docUrl} label={t.dataTableSettings.integrationsTab.helpDocsLink} />
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs opacity-70">{t.dataTableSettings.integrationsTab.helpEmpty}</p>
                    )}
                  </div>
                )}
                <div className="lp-modal-footer">
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setCredEntry(null)}>{t.common.cancel}</button>
                  {credTab === "connection" ? (
                    <button type="button" className="lp-modal-btn lp-modal-btn--primary" onClick={() => void saveCreds()} disabled={busy}>{t.common.save}</button>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {resEntry
        ? createPortal(
            <div className="lp-modal-overlay fixed inset-x-0 bottom-0 top-[var(--lp-titlebar-h)] z-[160] grid place-items-center p-4">
              <div className="lp-modal-card flex max-h-full w-full max-w-3xl flex-col" onClick={(event) => event.stopPropagation()}>
                <div className="lp-modal-header">
                  <h3 className="lp-modal-title">{formatMessage(cat.resourcesTitle, { provider: resEntry.name })}</h3>
                  <button type="button" className="lp-modal-close" onClick={() => setResEntry(null)} aria-label={t.dataTableSettings.closeAria}>✕</button>
                </div>
                <div className="lp-modal-body space-y-2">
                  <p className="lp-modal-hint">{cat.resourcesSubtitle}</p>
                  {resEntry.hasScopes ? (
                    <div>
                      <span className="lp-modal-label">{resEntry.scopeLabel ? fieldLabel(resEntry.scopeLabel) : cat.scopeLabel}</span>
                      <select className="lp-modal-input" value={scopeId} onChange={(event) => void handleScopeChange(event.target.value)}>
                        {scopes.length === 0 ? <option value="">{cat.noScopes}</option> : null}
                        {scopes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                      </select>
                    </div>
                  ) : null}
                  {resLoading ? (
                    <p className="text-xs opacity-70">{cat.loading}</p>
                  ) : resourceRows.length === 0 ? (
                    <div
                      role="status"
                      className={`${styles.noResourcesAlert} rounded-lg border px-3 py-2 text-xs`}
                    >
                      {cat.noResources}
                    </div>
                  ) : (
                    <DataTable
                      tableId="data-table-provider-resources"
                      title={formatMessage(cat.resourcesTitle, { provider: resEntry.name })}
                      columns={resourceColumns}
                      data={resourceRows}
                      filters={[]}
                      quickActions={resourceQuickActions}
                      pageSizeOptions={[10, 20, 50]}
                      language={language}
                    />
                  )}
                </div>
                <div className="lp-modal-footer">
                  <button type="button" className="lp-modal-btn lp-modal-btn--ghost" onClick={() => setResEntry(null)}>{t.common.cancel}</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {confirmDialog}
    </div>
  );
}
