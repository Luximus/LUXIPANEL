// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useModuleCatalog } from "./use-module-catalog";
import { useEffect, useState } from "react";
import {
  assistantModulesApi,
  PROVIDER_ORDER,
  type AssistantProviderId,
  type ResolvedModule,
} from "./assistant-api";
import { ProviderIcon } from "./ProviderIcon";
import { MODULE_ICON_SVGS } from "./module-icons.generated";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "./i18n";

type ModulesTabMessages = {
  all: string;
  errorPrefix: string;
  loading: string;
  noCapabilities: string;
  providerHint: string;
  generalHint: string;
  toolCountOne: string;
  toolCountOther: string;
  dataPanelSuffix: string;
  activeSuffix: string;
  coverageSummary: string;
  riskBadge: string;
  confirm: string;
  requireConfirmTitle: string;
  dataPanelsTitle: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.modulesTab.*) and are deep-merged at runtime via mergeNamespaces.
const modulesTabFallback: ModulesTabMessages = {
  all: "",
  errorPrefix: "",
  loading: "",
  noCapabilities: "",
  providerHint: "",
  generalHint: "",
  toolCountOne: "",
  toolCountOther: "",
  dataPanelSuffix: "",
  activeSuffix: "",
  coverageSummary: "",
  riskBadge: "",
  confirm: "",
  requireConfirmTitle: "",
  dataPanelsTitle: "",
};

/** Backend tool/dataPanel catalog text is Spanish-sourced; the frontend i18n
 *  supplies localized title/description keyed by the stable tool/panel name,
 *  falling back to the backend string when a locale lacks the entry. */
type ModulesCatalogI18n = {
  toolCatalog?: Record<string, { title?: string }>;
  dataPanelCatalog?: Record<string, { title?: string; description?: string }>;
};

const MODULE_ICONS: Record<string, string> = {
  admin: "ti-shield-cog",
  backup: "ti-archive",
  bitninja: "ti-shield-check",
  cron: "ti-clock",
  dashboard: "ti-layout-dashboard",
  databases: "ti-database",
  files: "ti-folder",
  firewall: "ti-shield-lock",
  hosting: "ti-building",
  mail: "ti-mail",
  monitor: "ti-activity",
  "server-alerts": "ti-bell-ringing",
  openclaw: "ti-brain",
  "security-audit": "ti-shield-search",
  users: "ti-users",
  webhooks: "ti-webhook",
};

/**
 * Icono de un módulo: logo de marca offline (simple-icons, mismo enfoque que
 * ProviderIcon) si el módulo ES un producto con marca (nginx/cloudflare/
 * obsidian); para el resto, su icono Tabler.
 */
function ModuleIcon({ moduleId }: { moduleId: string }) {
  const svg = MODULE_ICON_SVGS[moduleId];
  if (svg) {
    return (
      <span
        className="text-lg leading-none text-muted-foreground"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  const icon = MODULE_ICONS[moduleId] ?? "ti-puzzle";
  return <i className={`ti ${icon} text-lg text-muted-foreground`} aria-hidden></i>;
}

export function ModulesTab() {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    modulesTab?: Partial<ModulesTabMessages>;
  };
  const t = mergeNamespaces(modulesTabFallback, i18n.modulesTab);
  const cat = i18n as unknown as ModulesCatalogI18n;
  const [modules, setModules] = useState<ResolvedModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedProvider, setSelectedProvider] = useState<AssistantProviderId | null>(null);

  useModuleCatalog(rows => { setModules(rows); setError(null); }, error => setError(error.message));

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchModule(id: string, enabled: boolean) {
    try {
      const rows = await assistantModulesApi.setModule(id, enabled);
      setModules(rows);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function patchTool(
    moduleId: string,
    toolName: string,
    patch: { enabled?: boolean; requireConfirm?: boolean },
  ) {
    try {
      const rows = await assistantModulesApi.setTool(moduleId, toolName, patch);
      setModules(rows);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const providerBar = (
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
      {PROVIDER_ORDER.map((id) => (
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
          <ProviderIcon id={id} className="text-sm" />
          <span className="capitalize">{id}</span>
        </button>
      ))}
    </div>
  );

  if (!modules) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {providerBar}
        <div className="p-6 text-sm text-muted-foreground">
          {error ? formatAssistantMessage(t.errorPrefix, { message: error }) : t.loading}
        </div>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {providerBar}
        <div className="p-10 text-center text-sm text-muted-foreground">
          {t.noCapabilities}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {providerBar}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2 p-4">
          <p className="text-xs text-muted-foreground mb-3">
            {selectedProvider
              ? formatAssistantMessage(t.providerHint, { provider: selectedProvider })
              : t.generalHint}
          </p>

          {modules.map((mod) => {
            const isOpen = expanded.has(mod.moduleId);
            const enabledTools = mod.tools.filter((t) => t.enabled).length;
            return (
              <div
                key={mod.moduleId}
                className={`rounded-lg border ${mod.enabled ? "border-border" : "border-border/50 opacity-70"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(mod.moduleId)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2.5">
                    <ModuleIcon moduleId={mod.moduleId} />
                    <div>
                      <p className="text-sm font-medium capitalize">{mod.moduleId}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatAssistantMessage(
                          mod.tools.length === 1 ? t.toolCountOne : t.toolCountOther,
                          { count: mod.tools.length },
                        )}
                        {mod.dataPanels.length > 0 && formatAssistantMessage(t.dataPanelSuffix, { count: mod.dataPanels.length })}
                        {mod.enabled && formatAssistantMessage(t.activeSuffix, { count: enabledTools })}
                        {mod.coverage && <span className="block">{formatAssistantMessage(t.coverageSummary, { count: mod.coverage.operations })}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label
                      className="relative inline-flex cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={mod.enabled}
                        onChange={(e) => patchModule(mod.moduleId, e.currentTarget.checked)}
                      />
                      <div className="h-4 w-7 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-3"></div>
                    </label>
                    <i
                      className={`ti ti-chevron-${isOpen ? "up" : "down"} text-sm text-muted-foreground`}
                      aria-hidden
                    ></i>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-3 py-2 space-y-1.5">
                    {mod.tools.map((tool) => (
                      <ToolRow
                        key={tool.name}
                        tool={tool}
                        disabled={!mod.enabled}
                        onPatch={(patch) => patchTool(mod.moduleId, tool.name, patch)}
                      />
                    ))}
                    {mod.dataPanels.length > 0 && (
                      <div className="pt-2 mt-1 border-t border-border/50">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                          {t.dataPanelsTitle}
                        </p>
                        {mod.dataPanels.map((p) => (
                          <p key={p.name} className="text-xs text-muted-foreground">
                            · {cat.dataPanelCatalog?.[p.name]?.title ?? p.title} <span className="opacity-60">— {cat.dataPanelCatalog?.[p.name]?.description ?? p.description}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ToolRow({
  tool,
  disabled,
  onPatch,
}: {
  tool: ResolvedModule["tools"][number];
  disabled: boolean;
  onPatch(patch: { enabled?: boolean; requireConfirm?: boolean }): void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    modulesTab?: Partial<ModulesTabMessages>;
  };
  const t = mergeNamespaces(modulesTabFallback, i18n.modulesTab);
  const cat = i18n as unknown as ModulesCatalogI18n;
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${
        disabled ? "opacity-50" : "hover:bg-card/60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{cat.toolCatalog?.[tool.name]?.title ?? tool.title}</span>
          {tool.dangerous && (
            <span className="text-[10px] rounded bg-amber-500/15 text-amber-600 px-1.5 py-0.5">
              {t.riskBadge}
            </span>
          )}
          <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
            {tool.kind}
          </span>
        </p>
        <p className="text-muted-foreground font-mono text-[10px] truncate">{tool.name}</p>
      </div>
      <div className="flex items-center gap-2">
        <label
          className="flex items-center gap-1 text-[10px] text-muted-foreground"
          title={t.requireConfirmTitle}
        >
          <input
            type="checkbox"
            className="h-3 w-3"
            checked={tool.requireConfirm}
            disabled={disabled || !tool.enabled}
            onChange={(e) => onPatch({ requireConfirm: e.currentTarget.checked })}
          />
          {t.confirm}
        </label>
        <label className="relative inline-flex cursor-pointer">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={tool.enabled}
            disabled={disabled}
            onChange={(e) => onPatch({ enabled: e.currentTarget.checked })}
          />
          <div className="h-3.5 w-6 rounded-full bg-muted peer-checked:bg-primary transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-2.5"></div>
        </label>
      </div>
    </div>
  );
}
