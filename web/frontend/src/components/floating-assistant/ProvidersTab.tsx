// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  assistantApi,
  assistantCliApi,
  PROVIDER_META,
  PROVIDER_ORDER,
  type AssistantConfigState,
  type AssistantProviderId,
  type ComplexityTier,
  type ProviderProbeResult,
} from "./assistant-api";
import { bubblePrefs, type BubblePrefs } from "./bubble-prefs";
import { CollapsibleSection } from "./CollapsibleSection";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { McpConfigPanel } from "./McpConfigPanel";
import { ProviderIcon } from "./ProviderIcon";
import { TranslationSettings } from "./TranslationSettings";
import { VoiceSettings } from "./VoiceSettings";
import { SkillsSettings } from "./SkillsSettings";
import { NotifySettings } from "./NotifySettings";
import { useAssistantI18n, mergeNamespaces } from "./i18n";
import { useRegisterScreenProvider, SCREEN_PROVIDER_ALL } from "./screen-provider";
import { CredentialsLink } from "../workspace/credentials/CredentialsLink";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

type ProvidersTabExtraMessages = {
  modelNamePlaceholder: string;
  closeCustomModel: string;
  domainDiagnosticsTitle: string;
  domainDiagnosticsDescription: string;
};

const providersTabExtraFallback: ProvidersTabExtraMessages = {
  modelNamePlaceholder: "nombre-del-modelo",
  closeCustomModel: "x",
  domainDiagnosticsTitle: "Diagnóstico de dominio",
  domainDiagnosticsDescription: "La herramienta de diagnóstico DNS / mail está disponible vía el endpoint",
};

function useProvidersTabExtra(): ProvidersTabExtraMessages {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    providersTabExtra?: Partial<ProvidersTabExtraMessages>;
  };
  return mergeNamespaces(providersTabExtraFallback, i18n.providersTabExtra);
}

function BubbleToggle({
  provider,
  field,
  label,
  title,
}: {
  provider: string;
  field: keyof BubblePrefs;
  label: string;
  title?: string;
}) {
  useSyncExternalStore(bubblePrefs.subscribe, () => JSON.stringify(bubblePrefs.get(provider)), () => "{}");
  const checked = bubblePrefs.get(provider)[field];
  return (
    <label title={title} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
      <span className="relative inline-flex">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => bubblePrefs.set(provider, { [field]: e.currentTarget.checked })}
        />
        <span className="h-3.5 w-6 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-2.5 after:w-2.5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-2.5"></span>
      </span>
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}

/**
 * Auto-routing controls (replaces manual model selection). The user never picks
 * a model; the backend heuristic does. The admin keeps only an on/off toggle
 * and a cost cap (max tier). Shown in the "General" sub-tab.
 */
function AutoRoutingSettings({
  config,
  onChange,
}: {
  config: AssistantConfigState;
  onChange(next: AssistantConfigState): void;
}) {
  const t = useAssistantI18n().providersTab;
  const routing = config.autoRouting ?? { enabled: true, maxTier: "max" as ComplexityTier };
  const [busy, setBusy] = useState(false);

  async function patch(p: { enabled?: boolean; maxTier?: ComplexityTier }) {
    setBusy(true);
    try {
      const next = await assistantApi.setAutoRouting(p);
      onChange(next);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const tierLabels: Record<ComplexityTier, string> = {
    low: t.tierLow,
    medium: t.tierMedium,
    high: t.tierHigh,
    max: t.tierMax,
  };

  return (
    <CollapsibleSection
      icon={<i className="ti ti-wand text-lg" aria-hidden></i>}
      title={t.autoRoutingTitle}
      description={t.autoRoutingDesc}
    >
      <label className="flex cursor-pointer items-center gap-2">
        <span className="relative inline-flex">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={routing.enabled}
            disabled={busy}
            onChange={(e) => void patch({ enabled: e.currentTarget.checked })}
          />
          <span className="h-4 w-7 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-3"></span>
        </span>
        <span className="text-xs">{t.autoRoutingEnable}</span>
      </label>

      <label className={`mt-3 block text-xs ${routing.enabled ? "" : "opacity-50"}`}>
        <span className="text-muted-foreground">{t.autoRoutingMaxTier}</span>
        <select
          value={routing.maxTier}
          disabled={busy || !routing.enabled}
          onChange={(e) => void patch({ maxTier: e.currentTarget.value as ComplexityTier })}
          className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
        >
          {(["low", "medium", "high", "max"] as ComplexityTier[]).map((tier) => (
            <option key={tier} value={tier}>{tierLabels[tier]}</option>
          ))}
        </select>
      </label>
    </CollapsibleSection>
  );
}

interface ProvidersTabProps {
  config: AssistantConfigState | null;
  onChange(next: AssistantConfigState): void;
  locale: string;
}

export function ProvidersTab({ config, onChange, locale }: ProvidersTabProps) {
  const t = useAssistantI18n().providersTab;
  const [selectedProvider, setSelectedProvider] = useState<AssistantProviderId | null>(null);
  const providerDirection = useViewDirection<AssistantProviderId | null>(selectedProvider, [null, ...PROVIDER_ORDER]);

  // Mobile: drive this screen's provider selector via the shared bottom strip.
  useRegisterScreenProvider(
    {
      options: [{ id: SCREEN_PROVIDER_ALL }, ...PROVIDER_ORDER.map((id) => ({ id }))],
      selected: selectedProvider ?? SCREEN_PROVIDER_ALL,
      onSelect: (id) =>
        setSelectedProvider(id === SCREEN_PROVIDER_ALL ? null : (id as AssistantProviderId)),
    },
  );

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-sm text-muted-foreground">
        <i className="ti ti-loader-2 animate-spin text-4xl text-primary/70" aria-hidden></i>
        <p className="font-medium text-foreground">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top provider strip — hidden on phones (driven by the bottom strip). */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/20 px-2 py-1.5 max-sm:hidden">
        <button
          type="button"
          onClick={() => setSelectedProvider(null)}
          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-200 ease-out ${
            selectedProvider === null ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:bg-card/50"
          }`}
        >
          {t.all}
        </button>
        {PROVIDER_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelectedProvider(id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-200 ease-out ${
              selectedProvider === id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:bg-card/50"
            }`}
          >
            <ProviderIcon id={id} className="text-sm" />
            <span className="capitalize">{id}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Vista General ↔ tarjeta de proveedor con la transición de vista del
            panel, direccional según el orden de la tira superior. */}
        <ViewTransition viewKey={selectedProvider ?? "general"} direction={providerDirection} className="flex flex-col gap-4 p-5">
          {selectedProvider === null ? (
            // "General" → selección automática de modelo, traducción, voz y skills.
            // Las skills son universales (aplican a cualquier proveedor), por eso
            // viven aquí como una sola sección y no por proveedor.
            <>
              <AutoRoutingSettings config={config} onChange={onChange} />
              <TranslationSettings config={config} locale={locale} />
              <VoiceSettings config={config} onChange={onChange} />
              <NotifySettings />
              <SkillsSettings />
            </>
          ) : (
            // Proveedor seleccionado → solo su tarjeta de configuración.
            <div className="grid gap-3 @xl:grid-cols-2">
              <CredentialsLink label={t.apiKeyMode} credential="assistant" />
            </div>
          )}
        </ViewTransition>
      </div>
    </div>
  );
}

interface ProviderCardProps {
  id: AssistantProviderId;
  state: AssistantConfigState["providers"][AssistantProviderId];
  onPatch(patch: {
    mode?: "api" | "cli";
    active?: boolean;
    api?: { apiKey?: string };
  }): Promise<void>;
}

const MODE_ORDER = ["api", "cli"] as const;

export function ProviderCard({ id, state, onPatch }: ProviderCardProps) {
  const t = useAssistantI18n().providersTab;
  const tx = useProvidersTabExtra();
  const active = Boolean(state.active);
  const meta = PROVIDER_META[id];
  const cliDisabled = id === "deepseek";
  const [showKey, setShowKey] = useState(false);
  // Dirección de la transición API ↔ CLI (orden del conmutador).
  const modeDirection = useViewDirection(state.mode, MODE_ORDER);
  const [apiKey, setApiKey] = useState("");
  const [probe, setProbe] = useState<ProviderProbeResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cliDisabled && state.mode === "cli") void switchMode("api");
  }, [cliDisabled, state.mode]);

  async function test() {
    setBusy(true);
    try {
      const result = await assistantApi.testProvider(id);
      setProbe(result);
    } catch (err) {
      setProbe({ ok: false, detail: (err as Error).message, probedAt: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (apiKey.length === 0) return;
    setBusy(true);
    try {
      await onPatch({ api: { apiKey } });
      setApiKey("");
      setShowKey(false);
    } catch (err) {
      setProbe({ ok: false, detail: (err as Error).message, probedAt: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  async function switchMode(mode: "api" | "cli") {
    if (mode === state.mode) return;
    setBusy(true);
    try {
      await onPatch({ mode });
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleSection
      className={active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}
      icon={<ProviderIcon id={id} className="text-lg" />}
      iconClassName={`flex size-11 flex-none items-center justify-center rounded-lg transition-colors ${meta.accent}`}
      title={meta.label}
      description={meta.description}
      headerAction={
        <label className="flex cursor-pointer items-center gap-2">
          <span className="relative inline-flex">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={Boolean(state.active)}
              onChange={(e) => void onPatch({ active: e.currentTarget.checked })}
            />
            <span className="h-4 w-7 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-3"></span>
          </span>
          <span className="text-xs">{t.showInChat}</span>
        </label>
      }
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <BubbleToggle provider={id} field="input" label={t.showInputBubble} />
        <BubbleToggle provider={id} field="modifiedFiles" label={t.showModifiedFiles} title={t.showModifiedFilesHint} />
        <BubbleToggle provider={id} field="terminalLive" label={t.terminalLive} title={t.terminalLiveHint} />
      </div>

      <div className="mt-3 flex gap-1.5 rounded-lg bg-muted/40 p-1 text-xs">
        {(cliDisabled ? (["api"] as const) : (["api", "cli"] as const)).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            disabled={busy}
            className={`flex-1 rounded-md px-2 py-1 transition-colors duration-200 ease-out ${state.mode === m ? "bg-card shadow-sm" : "hover:bg-card/40"}`}
          >
            {m === "api" ? t.apiKeyMode : t.localCliMode}
          </button>
        ))}
      </div>

      {/* Bloque del modo activo (API / CLI) con la transición de vista. */}
      <ViewTransition viewKey={state.mode} direction={modeDirection}>
      {state.mode === "cli" && (
        <>
          <CliPanel
            id={id}
            installed={state.cli.installed}
            version={state.cli.version}
            hasApiKey={state.api.hasApiKey}
            apiKeyHint={state.api.apiKeyHint}
            // Se delega en `onPatch` (la prop que este componente YA recibe), que
            // hace exactamente esto: llama a setProvider y propaga el resultado
            // al padre. Aquí se duplicaba la llamada y se invocaba `onChange`,
            // que vive en el componente PADRE y aquí está fuera de ámbito → un
            // ReferenceError al guardar la API key.
            onPatchApiKey={async (apiKey) => {
              await onPatch({ api: { apiKey } });
            }}
            onRefresh={async () => {
              try {
                const status = await assistantCliApi.status(id);
                setProbe({
                  ok: status.installed,
                  detail: status.installed ? `${t.cliReady}${status.version ? ` · ${status.version}` : ""}` : t.cliNotInstalled,
                  probedAt: new Date().toISOString(),
                });
              } catch (err) {
                setProbe({ ok: false, detail: (err as Error).message, probedAt: new Date().toISOString() });
              }
            }}
          />
        </>
      )}

      {state.mode === "api" && (
        <div className="mt-3 space-y-2 text-xs">
          <label className="block">
            <span className="text-muted-foreground">
              {t.apiKey} {state.api.hasApiKey && <span className="text-emerald-500">· {state.api.apiKeyHint}</span>}
            </span>
            <div className="relative mt-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={state.api.hasApiKey ? t.replacePlaceholder : t.pasteApiKeyPlaceholder}
                className="h-8 w-full rounded-md border border-input bg-background px-2 pr-7 font-mono text-xs focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={t.toggleSecret}
              >
                <i className={`ti ${showKey ? "ti-eye-off" : "ti-eye"}`} aria-hidden></i>
              </button>
            </div>
          </label>
        </div>
      )}
      </ViewTransition>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={test}
          disabled={busy}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
        >
          {busy ? t.testing : t.test}
        </button>
        {state.mode === "api" && (
          <button
            type="button"
            onClick={save}
            disabled={busy || apiKey.length === 0}
            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {t.save}
          </button>
        )}
      </div>

      {probe && (
        <p className={`mt-2 text-xs ${probe.ok ? "text-emerald-500" : "text-amber-500"}`}>
          {probe.ok ? `${t.okPrefix} ` : `${t.warningPrefix} `}
          {probe.detail}
        </p>
      )}

      {/* Diagnóstico de dominio (fusionado desde la antigua pestaña Diagnóstico). */}
      <div className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground mb-0.5">{tx.domainDiagnosticsTitle}</p>
        <p>
          {tx.domainDiagnosticsDescription}{" "}
          <code>/api/ai/diagnostics/&lt;domain&gt;</code>.
        </p>
      </div>
    </CollapsibleSection>
  );
}

function CliPanel({
  id,
  installed,
  version,
  hasApiKey,
  apiKeyHint,
  onPatchApiKey,
  onRefresh,
}: {
  id: AssistantProviderId;
  installed: boolean;
  version?: string;
  hasApiKey?: boolean;
  apiKeyHint?: string;
  onPatchApiKey(apiKey: string): Promise<void>;
  onRefresh(): Promise<void>;
}) {
  const t = useAssistantI18n().providersTab;
  const [specs, setSpecs] = useState<Awaited<ReturnType<typeof assistantCliApi.specs>> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Local input state for the Subscription Key (minimax) — saves back to the
  // shared `api.apiKey` slot, which the bridge reads to write the env file.
  const [subKey, setSubKey] = useState("");
  const [showSubKey, setShowSubKey] = useState(false);
  const [savingSubKey, setSavingSubKey] = useState(false);
  // Sin feedback visual en este panel (se copia un comando): sólo reutilizamos
  // la escritura al portapapeles del hook compartido (F-17).
  const { copy: copyToClipboard } = useCopyToClipboard();
  useEffect(() => {
    let cancelled = false;
    assistantCliApi.specs().then((rows) => {
      if (!cancelled) setSpecs(rows);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const spec = specs?.find((s) => s.id === id);
  const installCmd = spec?.installCmd ?? "";

  async function copy(text: string) {
    if (!text) return;
    await copyToClipboard(text);
  }

  function openFloatingTerminal() {
    type Api = { requestOpen?(): void };
    const api = (window as unknown as { __lxpFloatingTerminalAPI?: Api }).__lxpFloatingTerminalAPI;
    api?.requestOpen?.();
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
        <p className="flex items-center gap-2">
          <i className={`ti ${installed ? "ti-check text-emerald-500" : "ti-x text-amber-500"}`} aria-hidden></i>
          <span>{installed ? `${t.cliReady}${version ? ` · ${version}` : ""}` : t.cliNotInstalled}</span>
        </p>
        <p className="mt-1.5 text-[10px] text-muted-foreground">{t.cliStatusManaged}</p>
      </div>

      {!installed && spec?.supported && (
        <div className="space-y-1.5 rounded-md border border-border bg-card p-2 text-xs">
          <p className="text-muted-foreground">{t.installCliHint}</p>
          <CodeRow text={installCmd} onCopy={() => void copy(installCmd)} />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={openFloatingTerminal}
              className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <i className="ti ti-terminal-2 mr-1" aria-hidden></i>
              {t.openTerminal}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
              title={t.refreshStatus}
            >
              <i className={`ti ${refreshing ? "ti-loader-2 animate-spin" : "ti-refresh"}`} aria-hidden></i>
            </button>
          </div>
        </div>
      )}

      {installed && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="flex-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            title={t.refreshStatus}
          >
            <i className={`ti ${refreshing ? "ti-loader-2 animate-spin" : "ti-refresh"} mr-1`} aria-hidden></i>
            {t.refreshStatus}
          </button>
        </div>
      )}

      {/* MiniMax CLI: this provider's user-facing name is "minimax-cli" (what
       *  shows in the chat's mini-terminal header and in the Providers tab
       *  picker). Internally the bridge deploys a thin wrapper script at
       *  ~/.local/bin/claude-minimax (or /usr/local/bin/claude-minimax in the
       *  system-wide install) that execs the real `claude` CLI with the
       *  MiniMax endpoint env vars — keeping the binary name stable so
       *  existing installs keep working. The wrapper needs a Subscription
       *  Key (sk-cp-…) which the bridge writes to
       *  /etc/luxipanel/claude-minimax.env (mode 0600) from the shared
       *  `api.apiKey` slot. */}
      {id === "minimax" && (
        <div className="space-y-2 rounded-md border border-border bg-card p-2 text-xs">
          <label className="block">
            <span className="text-muted-foreground">
              {t.apiKeySubscription ?? "Subscription Key (sk-cp)"}{" "}
              {hasApiKey && <span className="text-emerald-500">· {apiKeyHint}</span>}
            </span>
            <div className="relative mt-1">
              <input
                type={showSubKey ? "text" : "password"}
                value={subKey}
                onChange={(e) => setSubKey(e.target.value)}
                placeholder={
                  hasApiKey
                    ? t.replacePlaceholder
                    : t.pasteSubscriptionKeyPlaceholder ?? "Paste your Subscription Key (sk-cp-…)"
                }
                className="h-8 w-full rounded-md border border-input bg-background px-2 pr-7 font-mono text-xs focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowSubKey((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={t.toggleSecret}
              >
                <i className={`ti ${showSubKey ? "ti-eye-off" : "ti-eye"}`} aria-hidden></i>
              </button>
            </div>
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={savingSubKey || subKey.length === 0}
              onClick={async () => {
                if (subKey.length === 0) return;
                setSavingSubKey(true);
                try {
                  await onPatchApiKey(subKey);
                  setSubKey("");
                  setShowSubKey(false);
                } finally {
                  setSavingSubKey(false);
                }
              }}
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t.save}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t.pasteSubscriptionKeyHint ??
              "Se escribe a /etc/luxipanel/claude-minimax.env (0600) al ejecutar el siguiente turno."}
          </p>
        </div>
      )}

      {!spec?.supported && (
        <p className="text-[10px] text-amber-600">
          {t.noStableCli} {t.useApiMode}
        </p>
      )}

      {installed && <McpConfigPanel providerId={id} />}
    </div>
  );
}

const CodeRow = ({
  text,
  onCopy,
}: {
  text: string;
  onCopy(): void;
}) => {
  const t = useAssistantI18n().providersTab;
  return (
    <div className="flex items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-1">
      <code className="flex-1 truncate font-mono text-[11px]">{text}</code>
      <button
        type="button"
        onClick={onCopy}
        className="p-0.5 text-muted-foreground hover:text-foreground"
        title={t.copyCommand}
      >
        <i className="ti ti-copy text-sm" aria-hidden></i>
      </button>
    </div>
  );
};
