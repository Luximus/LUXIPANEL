// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useModuleCatalog } from "./use-module-catalog";
import { useEffect, useMemo, useState } from "react";
import {
  assistantApi,
  assistantAuditApi,
  assistantModulesApi,
  humanizeToolName,
  PROVIDER_ORDER,
  type ApprovalConfigState,
  type AuditEntry,
  type AssistantProviderId,
  type ResolvedModule,
} from "./assistant-api";
import { ProviderIcon } from "./ProviderIcon";
import { mergeNamespaces, useAssistantI18n } from "./i18n";

type AccessTabMessages = {
  all: string;
  permissionsTitle: string;
  permissionsDescription: string;
  recentInvocations: string;
  refreshAriaLabel: string;
  loading: string;
  emptyRecent: string;
  emptyProvider: string;
  byUser: string;
  crossServerTitle: string;
  autoApproveTitle: string;
  autoApproveDescription: string;
  autoApproveEmpty: string;
  autoApproveRevoke: string;
  autoApproveModeAuto: string;
  /** Prefix rendered before the command in a cross-server audit entry ("$ "). */
  cmdPrefix: string;
  /** Label prefix before a masked password value in an audit entry. */
  passwordLabel: string;
  /** Label prefix before a masked passphrase value in an audit entry. */
  passphraseLabel: string;
  /** Summary label for the collapsible private-key block in an audit entry. */
  privateKeyLabel: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// and are deep-merged at runtime (see useAssistantI18n + mergeNamespaces).
const accessTabFallback: AccessTabMessages = {
  all: "",
  permissionsTitle: "",
  permissionsDescription: "",
  recentInvocations: "",
  refreshAriaLabel: "",
  loading: "",
  emptyRecent: "",
  emptyProvider: "",
  byUser: "",
  crossServerTitle: "",
  autoApproveTitle: "",
  autoApproveDescription: "",
  autoApproveEmpty: "",
  autoApproveRevoke: "",
  autoApproveModeAuto: "",
  cmdPrefix: "$ ",
  passwordLabel: "password: ",
  passphraseLabel: "passphrase: ",
  privateKeyLabel: "private key",
};

const PROVIDER_ID_SET = new Set<string>(PROVIDER_ORDER);
function isProviderId(p: string): p is AssistantProviderId {
  return PROVIDER_ID_SET.has(p);
}

export function AccessTab() {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    accessTab?: Partial<AccessTabMessages>;
  };
  const t = mergeNamespaces(accessTabFallback, i18n.accessTab);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // "Aprobación automática": the approval config's never-ask-again allowlist.
  const [approval, setApproval] = useState<ApprovalConfigState | null>(null);
  const [approvalErr, setApprovalErr] = useState<string | null>(null);
  const [modules, setModules] = useState<ResolvedModule[]>([]);
  useModuleCatalog(setModules);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    assistantApi
      .getConfig()
      .then((cfg) => {
        if (!cancelled) setApproval(cfg.approval ?? { mode: "manual", autoApproveTools: [] });
      })
      .catch((e) => {
        if (!cancelled) setApprovalErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Human title per tool name (module catalog first, generic humanizer after).
  const toolTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const mod of modules) {
      for (const tool of mod.tools) {
        if (tool.title) map.set(tool.name, tool.title);
      }
    }
    return map;
  }, [modules]);

  async function revokeAutoApprove(tool: string) {
    if (!approval || revoking) return;
    const prev = approval;
    const next = approval.autoApproveTools.filter((x) => x !== tool);
    // Optimistic removal with rollback on failure.
    setApproval({ ...approval, autoApproveTools: next });
    setApprovalErr(null);
    setRevoking(tool);
    try {
      const cfg = await assistantApi.setAutoApproveTools(next);
      if (cfg.approval) setApproval(cfg.approval);
    } catch (e) {
      setApproval(prev);
      setApprovalErr((e as Error).message);
    } finally {
      setRevoking(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    assistantAuditApi
      .list(100)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const availableProviders = useMemo(() => {
    if (!entries) return [];
    const seen = new Set<string>();
    const arr: string[] = [];
    for (const e of entries) {
      if (e.provider && !seen.has(e.provider)) { seen.add(e.provider); arr.push(e.provider); }
    }
    return arr;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    if (!entries) return [];
    if (!selectedProvider) return entries;
    return entries.filter((e) => e.provider === selectedProvider);
  }, [entries, selectedProvider]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {availableProviders.length > 0 && (
        <div className="flex shrink-0 gap-1 border-b border-border bg-muted/20 px-2 py-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedProvider(null)}
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
              selectedProvider === null
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:bg-card/50"
            }`}
          >
            {t.all}
          </button>
          {availableProviders.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedProvider(id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedProvider === id
                  ? "bg-card shadow-sm text-foreground"
                  : "text-muted-foreground hover:bg-card/50"
              }`}
            >
              {isProviderId(id) && <ProviderIcon id={id} className="text-sm" />}
              <span className="capitalize">{id}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
          <p className="font-medium">{t.permissionsTitle}</p>
          <p className="text-muted-foreground mt-1">
            {t.permissionsDescription}
          </p>
        </div>

        {/* ── Aprobación automática (allowlist "no preguntar más") ── */}
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              <i className="ti ti-shield-check mr-1 text-emerald-500" aria-hidden></i>
              {t.autoApproveTitle}
            </p>
            {approval?.mode === "auto" && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-500">
                {t.autoApproveModeAuto}
              </span>
            )}
          </div>
          <p className="mt-1 text-muted-foreground">{t.autoApproveDescription}</p>
          {approvalErr && <p className="mt-1 text-amber-500">{approvalErr}</p>}
          {approval === null && !approvalErr && (
            <p className="mt-2 text-muted-foreground">{t.loading}</p>
          )}
          {approval !== null && approval.autoApproveTools.length === 0 && (
            <p className="mt-2 text-muted-foreground">{t.autoApproveEmpty}</p>
          )}
          {approval !== null && approval.autoApproveTools.length > 0 && (
            <ul className="mt-2 space-y-1">
              {approval.autoApproveTools.map((tool) => {
                const title = toolTitles.get(tool) ?? humanizeToolName(tool).label;
                return (
                  <li
                    key={tool}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      {title && title !== tool && (
                        <span className="mr-1.5 text-foreground">{title}</span>
                      )}
                      <span className="font-mono text-[10px] text-muted-foreground">{tool}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void revokeAutoApprove(tool)}
                      disabled={revoking !== null}
                      className="shrink-0 rounded-md border border-red-500/30 px-2 py-0.5 text-[11px] text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {revoking === tool
                        ? <i className="ti ti-loader-2 animate-spin" aria-hidden></i>
                        : t.autoApproveRevoke}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.recentInvocations}
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            aria-label={t.refreshAriaLabel}
            title={t.refreshAriaLabel}
          >
            <i className="ti ti-refresh" aria-hidden></i>
          </button>
        </div>

        {err && <p className="text-xs text-amber-500">{err}</p>}

        {entries === null && !err && (
          <p className="text-xs text-muted-foreground">{t.loading}</p>
        )}

        {entries && entries.length === 0 && (
          <p className="text-xs text-muted-foreground">{t.emptyRecent}</p>
        )}

        {entries && entries.length > 0 && visibleEntries.length === 0 && (
          <p className="text-xs text-muted-foreground">{t.emptyProvider}</p>
        )}

        {visibleEntries.length > 0 && (
          <ul className="space-y-1">
            {visibleEntries.map((e) => {
              const isCross = e.kind === "cross-server";
              return (
              <li
                key={String(e.id ?? e.ts)}
                className={`rounded-md border px-2 py-1.5 text-xs ${
                  isCross ? "border-sky-500/40 bg-sky-500/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <i
                      className={`ti ${e.success ? "ti-check text-emerald-500" : "ti-x text-amber-500"}`}
                      aria-hidden
                    ></i>
                    {isCross && <i className="ti ti-arrows-cross text-sky-500" aria-hidden title={t.crossServerTitle}></i>}
                    <span className="font-mono truncate">{e.tool}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(e.ts).toLocaleTimeString()} · {e.durationMs}ms
                  </span>
                </div>

                {isCross && (
                  <div className="mt-1 space-y-0.5 rounded bg-sky-500/5 px-1.5 py-1 text-[10px]">
                    <div className="flex items-center gap-1 flex-wrap">
                      <i className="ti ti-server text-sky-500" aria-hidden></i>
                      <span className="font-medium">{e.targetServerName || e.targetServerId}</span>
                      {e.targetHost && <span className="text-muted-foreground">· IP {e.targetHost}</span>}
                      {e.linuxUser && <span className="text-muted-foreground">· {e.linuxUser}</span>}
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground mt-0.5">
                  <span className="rounded bg-muted px-1 py-0.5 mr-1">{e.provider}</span>
                  {(e.username || e.userId) && (
                    <span className="opacity-70">{t.byUser} {e.username || e.userId}</span>
                  )}
                </p>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
