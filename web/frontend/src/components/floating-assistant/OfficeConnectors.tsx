// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState } from "react";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useBodyPointerEventsWhileOpen } from "@/lib/body-pointer-events";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  assistantConnectorsApi,
  type ConnectorFetchedFile,
  type ConnectorFile,
  type OfficeConnector,
} from "./assistant-api";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "./i18n";

type OfficeConnectorsMessages = {
  statusConnected: string;
  statusError: string;
  statusConfigured: string;
  statusDisconnected: string;
  connectFailed: string;
  disconnectFailed: string;
  managerTitle: string;
  close: string;
  managerHint: string;
  howToConfigure: string;
  reconfigure: string;
  disconnect: string;
  connect: string;
  requiredMark: string;
  cancel: string;
  connecting: string;
  saveAndConnect: string;
  loadFilesFailed: string;
  attachFailed: string;
  searchPlaceholder: string;
  search: string;
  loading: string;
  noResults: string;
  openFolder: string;
  attachToChat: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.officeConnectors.*) and are deep-merged at runtime via mergeNamespaces.
const officeConnectorsFallback: OfficeConnectorsMessages = {
  statusConnected: "",
  statusError: "",
  statusConfigured: "",
  statusDisconnected: "",
  connectFailed: "",
  disconnectFailed: "",
  managerTitle: "",
  close: "",
  managerHint: "",
  howToConfigure: "",
  reconfigure: "",
  disconnect: "",
  connect: "",
  requiredMark: "",
  cancel: "",
  connecting: "",
  saveAndConnect: "",
  loadFilesFailed: "",
  attachFailed: "",
  searchPlaceholder: "",
  search: "",
  loading: "",
  noResults: "",
  openFolder: "",
  attachToChat: "",
};

function useOfficeConnectorsMessages(): OfficeConnectorsMessages {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    officeConnectors?: Partial<OfficeConnectorsMessages>;
  };
  return mergeNamespaces(officeConnectorsFallback, i18n.officeConnectors);
}

function StatusDot({ connector }: { connector: OfficeConnector }) {
  const m = useOfficeConnectorsMessages();
  const { color, label } = connector.connected
    ? { color: "bg-emerald-500", label: m.statusConnected }
    : connector.lastError
      ? { color: "bg-red-500", label: m.statusError }
      : connector.configured
        ? { color: "bg-amber-500", label: m.statusConfigured }
        : { color: "bg-muted-foreground/40", label: m.statusDisconnected };
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden></span>
      {label}
    </span>
  );
}

// ── Connectors manager: connect / disconnect office tools ────────────────────

export function ConnectorsManagerModal({
  connectors,
  onClose,
  onChanged,
}: {
  connectors: OfficeConnector[];
  onClose: () => void;
  onChanged: () => void;
}) {
  useBodyPointerEventsWhileOpen(true);
  const m = useOfficeConnectorsMessages();
  const [editing, setEditing] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEscapeToClose(onClose);

  function startEdit(c: OfficeConnector) {
    setErr(null);
    setForm({});
    setEditing((prev) => (prev === c.id ? null : c.id));
  }

  async function submit(c: OfficeConnector) {
    setBusy(c.id);
    setErr(null);
    try {
      await assistantConnectorsApi.connect(c.id, form);
      setEditing(null);
      setForm({});
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : m.connectFailed);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(c: OfficeConnector) {
    setBusy(c.id);
    setErr(null);
    try {
      await assistantConnectorsApi.disconnect(c.id);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : m.disconnectFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ModalShell onClose={onClose} icon="ti-plug" title={m.managerTitle} closeLabel={m.close} bodyClassName="space-y-2 p-4">
          <p className="text-[11px] text-muted-foreground">
            {m.managerHint}
          </p>
          {err && <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-500">{err}</p>}

          {connectors.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 bg-background/40">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <i className={`ti ${c.icon} text-xl text-muted-foreground`} aria-hidden></i>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <StatusDot connector={c} />
                    {c.setup && (
                      <button
                        type="button"
                        onClick={() => setHelpOpen((prev) => (prev === c.id ? null : c.id))}
                        title={formatAssistantMessage(m.howToConfigure, { name: c.name })}
                        aria-label={formatAssistantMessage(m.howToConfigure, { name: c.name })}
                        aria-expanded={helpOpen === c.id}
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
                          helpOpen === c.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                        }`}
                      >
                        <i className="ti ti-help" aria-hidden></i>
                      </button>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{c.description}</p>
                </div>
                {c.configured ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
                    >
                      {m.reconfigure}
                    </button>
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => void disconnect(c)}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {m.disconnect}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    className="shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                  >
                    {m.connect}
                  </button>
                )}
              </div>

              {helpOpen === c.id && c.setup && (
                <div className="border-t border-border/60 bg-muted/30 px-3 py-3">
                  <p className="mb-1.5 text-[11px] font-semibold text-foreground">
                    {formatAssistantMessage(m.howToConfigure, { name: c.name })}
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                    {c.setup.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  {c.setup.docUrl && (
                    <a
                      href={c.setup.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <i className="ti ti-external-link" aria-hidden></i>
                      {c.setup.docLabel ?? c.setup.docUrl}
                    </a>
                  )}
                </div>
              )}

              {editing === c.id && (
                <div className="space-y-2 border-t border-border/60 px-3 py-3">
                  {c.credentialFields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {f.label}{f.required ? m.requiredMark : ""}
                      </label>
                      {f.type === "textarea" ? (
                        <textarea
                          value={form[f.key] ?? ""}
                          onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          rows={3}
                          className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs outline-none focus:border-primary"
                        />
                      ) : (
                        <input
                          type={f.type === "password" ? "password" : "text"}
                          value={form[f.key] ?? ""}
                          onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                        />
                      )}
                      {f.help && <p className="text-[10px] text-muted-foreground">{f.help}</p>}
                      {f.helpUrl && (
                        <a
                          href={f.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                        >
                          <i className="ti ti-external-link" aria-hidden></i>
                          {f.helpUrlLabel ?? f.helpUrl}
                        </a>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent">
                      {m.cancel}
                    </button>
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => void submit(c)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      <i className={`ti ${busy === c.id ? "ti-loader-2 animate-spin" : "ti-plug-connected"}`} aria-hidden></i>
                      {busy === c.id ? m.connecting : m.saveAndConnect}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
    </ModalShell>
  );
}

// ── Browse modal: list/search files of one connector and attach them ─────────

export function ConnectorBrowseModal({
  connector,
  onClose,
  onAttach,
}: {
  connector: OfficeConnector;
  onClose: () => void;
  onAttach: (file: ConnectorFetchedFile) => void;
}) {
  useBodyPointerEventsWhileOpen(true);
  const m = useOfficeConnectorsMessages();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<ConnectorFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function runSearch(q: string) {
    setLoading(true);
    setErr(null);
    try {
      setFiles(await assistantConnectorsApi.browse(connector.id, q));
    } catch (e) {
      setErr(e instanceof Error ? e.message : m.loadFilesFailed);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }

  useEscapeToClose(onClose);
  useEffect(() => {
    void runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector.id]);

  async function attach(f: ConnectorFile) {
    if (f.isFolder) {
      setQuery(f.name);
      void runSearch(f.name);
      return;
    }
    setFetching(f.id);
    setErr(null);
    try {
      const file = await assistantConnectorsApi.fetchFile(connector.id, f.id, f.name);
      onAttach(file);
      setAdded((prev) => new Set(prev).add(f.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : m.attachFailed);
    } finally {
      setFetching(null);
    }
  }

  return (
    <ModalShell onClose={onClose}>
        <ModalNavbar icon={connector.icon} title={connector.name} onClose={onClose} closeLabel={m.close} />

        <form
          className="flex shrink-0 gap-2 border-b border-border px-4 py-2.5"
          onSubmit={(e) => { e.preventDefault(); void runSearch(query); }}
        >
          <div className="relative flex-1">
            <i className="ti ti-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden></i>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={formatAssistantMessage(m.searchPlaceholder, { name: connector.name })}
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <button type="submit" className="rounded-lg border border-border px-3 text-sm hover:bg-accent">{m.search}</button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {err && <p className="m-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-500">{err}</p>}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <i className="ti ti-loader-2 animate-spin" aria-hidden></i> {m.loading}
            </div>
          ) : files.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{m.noResults}</p>
          ) : (
            <ul className="space-y-1">
              {files.map((f) => {
                const isAdded = added.has(f.id);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={fetching === f.id}
                      onClick={() => void attach(f)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                      title={f.isFolder ? m.openFolder : m.attachToChat}
                    >
                      <i className={`ti ${f.isFolder ? "ti-folder" : "ti-file"} shrink-0 text-lg text-muted-foreground`} aria-hidden></i>
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      {fetching === f.id ? (
                        <i className="ti ti-loader-2 shrink-0 animate-spin text-sm text-muted-foreground" aria-hidden></i>
                      ) : isAdded ? (
                        <i className="ti ti-check shrink-0 text-sm text-emerald-500" aria-hidden></i>
                      ) : !f.isFolder ? (
                        <i className="ti ti-paperclip shrink-0 text-sm text-muted-foreground" aria-hidden></i>
                      ) : (
                        <i className="ti ti-chevron-right shrink-0 text-sm text-muted-foreground" aria-hidden></i>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
    </ModalShell>
  );
}
