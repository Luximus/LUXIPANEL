// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useMemo, useState } from "react";
import {
  assistantApi,
  PROVIDER_META,
  PROVIDER_MODELS,
  PROVIDER_ORDER,
  type AssistantConfigState,
  type AssistantProviderId,
} from "./assistant-api";
import { normalizeReasoningEffort, type ChatReasoningEffort } from "./reasoning-effort";
import { useAssistantI18n } from "./i18n";
import { AssistantPreferences } from "./AssistantPreferences";
import { uiPrefs, type AgentsTabPref, type ConversationsTabPref } from "./ui-prefs";

interface GeneralTabProps {
  config: AssistantConfigState | null;
  onConfigChange(next: AssistantConfigState): void;
}

/**
 * "General" section of the assistant settings. Holds per-server presentation
 * defaults for the panel: which tab starts active in the Agents / Conversations
 * lists, and the provider + model a NEW loose/project chat opens with.
 *
 * Defaults are persisted in the assistant configuration for the current user
 * and target, and mirrored into uiPrefs. Reasoning is only mirrored after the
 * server confirms the write, so a failed save remains visible to the user.
 */
export function GeneralTab({ config, onConfigChange }: GeneralTabProps) {
  const t = useAssistantI18n();
  const ct = t.chatTab as Record<string, any>;
  const sm = t.settingsModal as Record<string, any>;
  const gt = (sm.general ?? {}) as Record<string, any>;

  const [prefs, setPrefs] = useState(() => uiPrefs.get());
  const [savingEffort, setSavingEffort] = useState(false);
  const [effortError, setEffortError] = useState<string | null>(null);

  // The persisted server value (config) is authoritative; fall back to the
  // localStorage mirror only while the backend hasn't returned the field yet.
  const agentsTabValue = config?.defaultAgentsTab ?? prefs.defaultAgentsTab;
  const conversationsTabValue = config?.defaultConversationsTab ?? prefs.defaultConversationsTab;
  const providerValue = config?.defaultChatProvider ?? prefs.defaultChatProvider ?? "";
  // Internally "" is the Auto sentinel; normalise a backend/mirror "auto" onto it
  // so the Auto option stays selected.
  const rawModel = config?.defaultChatModel ?? prefs.defaultChatModel ?? "";
  const modelValue = rawModel === "auto" ? "" : rawModel;
  const effortValue = normalizeReasoningEffort(config ? config.defaultChatEffort : prefs.defaultChatEffort);
  const effortOptions: [ChatReasoningEffort, string][] = [
    ["", ct.modelAuto ?? "Auto"], ["low", ct.reasoningLow ?? "Bajo"],
    ["medium", ct.reasoningMedium ?? "Medio"], ["high", ct.reasoningHigh ?? "Alto"],
    ["xhigh", ct.reasoningExtra ?? "Extra"],
    ["max", ct.reasoningMax ?? "Max"],
  ];

  // Providers offered as a default = those toggled "show in chat" (active),
  // ordered canonically. Plus the "use active provider" opt-out (value "").
  const enabledProviders = useMemo<AssistantProviderId[]>(() => {
    if (!config) return [];
    return (PROVIDER_ORDER as AssistantProviderId[]).filter((id) => config.providers[id]?.active);
  }, [config]);

  // Model catalog for the currently selected default provider. When no explicit
  // provider is set we can't offer a scoped model list, so only "Auto" applies.
  const modelOptions = useMemo<string[]>(() => {
    const pid = providerValue as AssistantProviderId | "";
    return pid && PROVIDER_MODELS[pid] ? PROVIDER_MODELS[pid] : [];
  }, [providerValue]);

  const setAgentsTabPref = (v: AgentsTabPref) => {
    uiPrefs.set({ defaultAgentsTab: v });
    setPrefs(uiPrefs.get());
    void assistantApi
      .patchConfig({ defaultAgentsTab: v })
      .then(onConfigChange)
      .catch(() => { /* backend persistence pending; localStorage keeps it */ });
  };
  const setConversationsTabPref = (v: ConversationsTabPref) => {
    uiPrefs.set({ defaultConversationsTab: v });
    setPrefs(uiPrefs.get());
    void assistantApi
      .patchConfig({ defaultConversationsTab: v })
      .then(onConfigChange)
      .catch(() => { /* backend persistence pending; localStorage keeps it */ });
  };
  const setDefaultProvider = (v: string) => {
    // Changing the provider invalidates the model pick (catalog is per-provider)
    // → reset the model to Auto so we never persist a cross-provider model id.
    uiPrefs.set({ defaultChatProvider: v, defaultChatModel: "" });
    setPrefs(uiPrefs.get());
    void assistantApi
      .patchConfig({
        defaultChatProvider: (v || undefined) as AssistantProviderId | undefined,
        defaultChatModel: "",
      })
      .then(onConfigChange)
      .catch(() => { /* backend contract may be pending; mirror keeps it live */ });
  };
  const setDefaultModel = (v: string) => {
    uiPrefs.set({ defaultChatModel: v });
    setPrefs(uiPrefs.get());
    void assistantApi
      .patchConfig({ defaultChatModel: v })
      .then(onConfigChange)
      .catch(() => { /* backend contract may be pending; mirror keeps it live */ });
  };

  const setDefaultEffort = async (value: ChatReasoningEffort) => {
    setSavingEffort(true);
    setEffortError(null);
    try {
      const saved = await assistantApi.patchConfig({ defaultChatEffort: value });
      // A stale backend must not pretend a preference was persisted.
      if (saved.defaultChatEffort !== value) throw new Error("Preference was not persisted");
      uiPrefs.set({ defaultChatEffort: value });
      setPrefs(uiPrefs.get());
      onConfigChange(saved);
    } catch {
      setEffortError(gt.savePreferenceError ?? "No se pudo guardar la preferencia. Inténtalo de nuevo.");
    } finally {
      setSavingEffort(false);
    }
  };

  const selectClass =
    "mt-2 w-full rounded-[0.3rem] border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-6">
      {/* Default tabs (dashboard + chat sidebar). */}
      <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
        <div>
          <label htmlFor="lxp-assistant-default-agents-tab" className="text-sm font-semibold text-foreground">
            {sm.defaultTabs?.agentsTitle}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{sm.defaultTabs?.agentsDescription}</p>
          <select
            id="lxp-assistant-default-agents-tab"
            value={agentsTabValue}
            onChange={(e) => setAgentsTabPref(e.currentTarget.value as AgentsTabPref)}
            className={selectClass}
          >
            <option value="leaders">{ct.projectLeaders ?? "Líderes"}</option>
            <option value="projects">{ct.projectsTab ?? "Proyectos"}</option>
          </select>
        </div>
        <div>
          <label htmlFor="lxp-assistant-default-conversations-tab" className="text-sm font-semibold text-foreground">
            {sm.defaultTabs?.conversationsTitle}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{sm.defaultTabs?.conversationsDescription}</p>
          <select
            id="lxp-assistant-default-conversations-tab"
            value={conversationsTabValue}
            onChange={(e) => setConversationsTabPref(e.currentTarget.value as ConversationsTabPref)}
            className={selectClass}
          >
            <option value="agents">{ct.chatsWithAgents ?? "Agentes IA"}</option>
            <option value="loose">{ct.chatsLoose ?? "Sueltos / Proyectos"}</option>
          </select>
        </div>
      </div>

      <div className="border-t border-border" role="separator"></div>

      {/* Defaults for new chats, with reasoning beside the model. */}
      <div className="grid grid-cols-1 items-end gap-3 @xl:grid-cols-3">
        <div>
          <label htmlFor="lxp-assistant-default-chat-provider" className="text-sm font-semibold text-foreground">
            {gt.defaultProviderTitle ?? "Proveedor por defecto"}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {gt.defaultProviderDescription ?? "Proveedor con el que abren los chats nuevos sueltos y de proyecto."}
          </p>
          <select
            id="lxp-assistant-default-chat-provider"
            value={providerValue}
            onChange={(e) => setDefaultProvider(e.currentTarget.value)}
            className={selectClass}
          >
            <option value="">{gt.useActiveProvider ?? "Usar proveedor activo"}</option>
            {enabledProviders.map((id) => (
              <option key={id} value={id}>
                {PROVIDER_META[id]?.label ?? id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lxp-assistant-default-chat-model" className="text-sm font-semibold text-foreground">
            {gt.defaultModelTitle ?? "Modelo por defecto"}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {gt.defaultModelDescription ?? "Modelo inicial del composer en chats nuevos. Auto deja que el router elija por turno."}
          </p>
          <select
            id="lxp-assistant-default-chat-model"
            value={modelValue}
            onChange={(e) => setDefaultModel(e.currentTarget.value)}
            disabled={!providerValue}
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">{gt.autoModel ?? "Auto"}</option>
            {modelValue && !modelOptions.includes(modelValue) && (
              <option value={modelValue}>{modelValue}</option>
            )}
            {modelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lxp-assistant-default-chat-effort" className="text-sm font-semibold text-foreground">
            {gt.defaultEffortTitle ?? "Razonamiento por defecto"}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {gt.defaultEffortDescription ?? "Nivel inicial en chats nuevos. Auto permite la selección automática."}
          </p>
          <select
            id="lxp-assistant-default-chat-effort"
            value={effortValue}
            onChange={(e) => void setDefaultEffort(normalizeReasoningEffort(e.currentTarget.value))}
            disabled={!config || savingEffort}
            aria-busy={savingEffort}
            className={`${selectClass} disabled:opacity-50`}
          >
            {effortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>
      {effortError && <p role="alert" className="text-xs text-destructive">{effortError}</p>}
      {config && (
        <>
          <div className="border-t border-border" role="separator" />
          <AssistantPreferences config={config} onChange={onConfigChange} />
        </>
      )}
    </div>
  );
}
