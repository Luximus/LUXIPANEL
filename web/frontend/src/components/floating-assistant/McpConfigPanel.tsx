// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * MCP config — one-click. The panel writes the MCP server entry straight
 * into the target's CLI config file via SSH (button "Configurar
 * automáticamente"). A collapsible "manual" section still exposes the raw
 * snippet for power users who prefer to paste it themselves.
 */

import { useState } from "react";
import {
  assistantMcpApi,
  type AssistantProviderId,
  type McpConfigSnippet,
  type McpInstallResult,
} from "./assistant-api";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "./i18n";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

interface McpConfigPanelProps {
  providerId: AssistantProviderId;
}

type McpConfigPanelMessages = {
  noInstallResponse: string;
  summaryTitle: string;
  optional: string;
  description: string;
  configuredTitle: string;
  tokenValidUntil: string;
  restartCli: string;
  configuring: string;
  configureAutomatically: string;
  regenerate: string;
  manualTitle: string;
  generating: string;
  generateManualSnippet: string;
  fileLabel: string;
  snippetLabel: string;
  copy: string;
  mcpUrlLabel: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.mcpConfigPanel.*) and are deep-merged at runtime via mergeNamespaces.
const mcpConfigPanelFallback: McpConfigPanelMessages = {
  noInstallResponse: "",
  summaryTitle: "",
  optional: "",
  description: "",
  configuredTitle: "",
  tokenValidUntil: "",
  restartCli: "",
  configuring: "",
  configureAutomatically: "",
  regenerate: "",
  manualTitle: "",
  generating: "",
  generateManualSnippet: "",
  fileLabel: "",
  snippetLabel: "",
  copy: "",
  mcpUrlLabel: "",
};

export function McpConfigPanel({ providerId }: McpConfigPanelProps) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    mcpConfigPanel?: Partial<McpConfigPanelMessages>;
  };
  const t = mergeNamespaces(mcpConfigPanelFallback, i18n.mcpConfigPanel);
  const [busy, setBusy] = useState<null | "auto" | "manual">(null);
  const [err, setErr] = useState<string | null>(null);
  const [installed, setInstalled] = useState<McpInstallResult | null>(null);
  const [config, setConfig] = useState<McpConfigSnippet | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  async function configureAuto() {
    setBusy("auto");
    setErr(null);
    try {
      const res = await assistantMcpApi.mintToken(providerId, true);
      setInstalled(res.install ?? { ok: false, path: "", detail: t.noInstallResponse });
      setExpiresAt(res.expiresAt);
      if (res.install && !res.install.ok) setErr(res.install.detail);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function generateManual() {
    setBusy("manual");
    setErr(null);
    try {
      const res = await assistantMcpApi.mintToken(providerId, false);
      setConfig(res.config);
      setToken(res.token);
      setMcpUrl(res.mcpUrl);
      setExpiresAt(res.expiresAt);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const { copy } = useCopyToClipboard();

  if (providerId === "deepseek") return null;

  return (
    <details className="group mt-3 rounded-lg border border-border bg-card">
      <summary className="group relative flex cursor-pointer list-none items-center gap-x-4 rounded-lg p-4 transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
          <i className="ti ti-plug-connected text-lg" aria-hidden></i>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{t.summaryTitle}</span>
        </span>
        <span className="flex-none text-[11px] text-muted-foreground">{t.optional}</span>
        <i
          className="ti ti-chevron-down flex-none text-sm text-muted-foreground transition-transform duration-200 group-open:rotate-180 group-hover:text-foreground"
          aria-hidden
        />
      </summary>

      <div className="border-t border-border p-3 space-y-2 text-xs">
        <p className="text-muted-foreground">
          {formatAssistantMessage(t.description, { providerId })}
        </p>

        {installed?.ok ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 space-y-1">
            <p className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <i className="ti ti-circle-check" aria-hidden></i>
              {t.configuredTitle}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground break-all">{installed.path}</p>
            {expiresAt && (
              <p className="text-[10px] text-muted-foreground">
                {formatAssistantMessage(t.tokenValidUntil, { date: new Date(expiresAt * 1000).toLocaleDateString() })}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {t.restartCli}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={configureAuto}
            disabled={busy !== null}
            className="w-full rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === "auto" ? (
              <><i className="ti ti-loader-2 animate-spin mr-1" aria-hidden></i>{t.configuring}</>
            ) : (
              <><i className="ti ti-bolt mr-1" aria-hidden></i>{t.configureAutomatically}</>
            )}
          </button>
        )}

        {err && <p className="text-amber-500">⚠ {err}</p>}

        {installed?.ok && (
          <button
            type="button"
            onClick={configureAuto}
            disabled={busy !== null}
            className="w-full rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-50"
          >
            {t.regenerate}
          </button>
        )}

        {/* Manual fallback */}
        <details className="rounded border border-border/60">
          <summary className="cursor-pointer px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent/30">
            {t.manualTitle}
          </summary>
          <div className="p-2 space-y-2">
            {!config ? (
              <button
                type="button"
                onClick={generateManual}
                disabled={busy !== null}
                className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-50"
              >
                {busy === "manual" ? t.generating : t.generateManualSnippet}
              </button>
            ) : (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{t.fileLabel}</p>
                  <code className="block font-mono text-[11px] bg-muted/40 rounded px-2 py-1">{config.path}</code>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{formatAssistantMessage(t.snippetLabel, { format: config.format })}</p>
                    <button type="button" onClick={() => copy(config.snippet)} className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent">
                      <i className="ti ti-copy mr-1" aria-hidden></i>{t.copy}
                    </button>
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 px-2 py-1.5 font-mono text-[10px] leading-snug whitespace-pre-wrap">{config.snippet}</pre>
                </div>
                {token && (
                  <div className="flex items-center justify-between rounded bg-muted/30 px-2 py-1.5">
                    <code className="font-mono text-[10px] truncate">
                      {revealed ? token : "•".repeat(40)}
                    </code>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setRevealed((v) => !v)} className="p-1 text-muted-foreground hover:text-foreground">
                        <i className={`ti ${revealed ? "ti-eye-off" : "ti-eye"} text-xs`} aria-hidden></i>
                      </button>
                      <button type="button" onClick={() => copy(token)} className="p-1 text-muted-foreground hover:text-foreground">
                        <i className="ti ti-copy text-xs" aria-hidden></i>
                      </button>
                    </div>
                  </div>
                )}
                {mcpUrl && <p className="text-[10px] text-muted-foreground">{t.mcpUrlLabel}: <code className="font-mono">{mcpUrl}</code></p>}
              </>
            )}
          </div>
        </details>
      </div>
    </details>
  );
}
