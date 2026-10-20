import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Select } from "../ui/Select";
import { SegmentedControl, type SegmentItem } from "../ui/SegmentedControl";
import { PROVIDER_META, PROVIDER_MODELS, PROVIDER_ORDER, ProviderIcon, type AssistantProviderId } from "../ProviderIcon";
import { s } from "./styles";
import { SectionHead, LoadState, ToggleRow } from "./parts";
import type { AssistantConfig, ApprovalMode, UiMode, AgentsTabPref, ConversationsTabPref } from "./types";

type T = Messages["assistantSettings"];

/** Same four presentation defaults, in the web GeneralTab order. */
export function GeneralSubTab({
  panelId,
  token,
  t,
  tokens,
}: {
  panelId: string;
  token: string;
  t: T;
  tokens: ThemeTokens;
}) {
  const gt = t.generalTabs;
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [verifiedModelOptions, setVerifiedModelOptions] = useState<string[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);

  const load = React.useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    void luxAssistantProxy<{ config?: AssistantConfig }>(panelId, token, "GET", "/api/ai/config").then((body) => {
      if (cancelled) return;
      if (body?.config) { setConfig(body.config); setStatus("ready"); }
      else setStatus("error");
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  useEffect(() => load(), [load]);

  /**
   * Aplica un patch al backend con actualización OPTIMISTA local: fusiona las
   * claves en el config visible de inmediato (así los selects reaccionan aunque
   * el backend aún no acepte los campos `default*`, contrato en despliegue
   * paralelo) y adopta el config devuelto si llega.
   */
  const patch = async (body: Record<string, unknown>, optimistic?: Partial<AssistantConfig>) => {
    if (busy) return;
    setBusy(true);
    if (optimistic) setConfig((cur) => (cur ? { ...cur, ...optimistic } : cur));
    try {
      const res = await luxAssistantProxy<{ config?: AssistantConfig }>(panelId, token, "PUT", "/api/ai/config", body);
      if (res?.config) setConfig(res.config);
    } finally {
      setBusy(false);
    }
  };

  const enabledProviders = useMemo<AssistantProviderId[]>(() => {
    if (!config) return [];
    return PROVIDER_ORDER.filter((id) => config.providers?.[id]?.active);
  }, [config]);
  const providerValue = config?.defaultChatProvider ?? "";
  useEffect(() => {
    let live = true;
    setVerifiedModelOptions(null);
    if (!providerValue || !PROVIDER_MODELS[providerValue as AssistantProviderId]) return;
    void luxAssistantProxy<{ catalog?: { status?: string; models?: Array<{ id: string; available: boolean }> } }>(panelId, token, "GET", `/api/ai/config/providers/${encodeURIComponent(providerValue)}/models`)
      .then((result) => { if (live && result?.catalog?.status === "verified") setVerifiedModelOptions((result.catalog.models ?? []).filter((model) => model.available).map((model) => model.id)); });
    return () => { live = false; };
  }, [panelId, token, providerValue]);

  if (status !== "ready" || !config) {
    return <LoadState t={t} tokens={tokens} mode={status === "error" ? "error" : "loading"} onRetry={load} />;
  }

  const approval: ApprovalMode = config.approval?.mode ?? "manual";
  const approvalHint =
    approval === "auto" ? t.approvalAutoHint : approval === "plan" ? t.approvalPlanHint : t.approvalManualHint;
  const uiMode: UiMode = config.uiMode ?? "advanced";

  const agentsTab: AgentsTabPref = config.defaultAgentsTab ?? "leaders";
  const conversationsTab: ConversationsTabPref = config.defaultConversationsTab ?? "agents";
  const rawModel = config.defaultChatModel ?? "";
  const modelValue = rawModel === "auto" ? "" : rawModel;
  const modelOptions = verifiedModelOptions ?? (providerValue && PROVIDER_MODELS[providerValue as AssistantProviderId]
    ? PROVIDER_MODELS[providerValue as AssistantProviderId]
    : []);

  // Proveedor por defecto: "" = usar proveedor activo, + los "mostrar en chat".
  const providerItems: SegmentItem[] = [
    { key: "", label: gt.useActiveProvider },
    ...enabledProviders.map((id) => ({
      key: id,
      label: PROVIDER_META[id]?.label ?? id,
      icon: <ProviderIcon id={id} size={14} />,
    })),
  ];
  const modelItems: SegmentItem[] = [
    { key: "", label: gt.autoModel },
    ...(modelValue && !modelOptions.includes(modelValue) ? [{ key: modelValue, label: modelValue }] : []),
    ...modelOptions.map((m) => ({ key: m, label: m })),
  ];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
      <SectionHead title={t.generalTitle} desc={t.generalDescription} tokens={tokens} />

      {/* Tabs por defecto (dashboard + barra de conversaciones) */}
      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
        <SectionHead title={gt.agentsTabTitle} desc={gt.agentsTabDescription} tokens={tokens} />
        <Select
          options={[
            { value: "leaders", label: gt.agentsTabLeaders },
            { value: "projects", label: gt.agentsTabProjects },
          ]}
          value={agentsTab}
          onChange={(k) => void patch({ defaultAgentsTab: k }, { defaultAgentsTab: k as AgentsTabPref })}
        />
      </View>

      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
        <SectionHead title={gt.convTabTitle} desc={gt.convTabDescription} tokens={tokens} />
        <Select
          options={[
            { value: "agents", label: gt.convTabAgents },
            { value: "loose", label: gt.convTabLoose },
          ]}
          value={conversationsTab}
          onChange={(k) => void patch({ defaultConversationsTab: k }, { defaultConversationsTab: k as ConversationsTabPref })}
        />
      </View>

      {/* Proveedor + modelo por defecto de chats nuevos */}
      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
        <SectionHead title={gt.defaultProviderTitle} desc={gt.defaultProviderDescription} tokens={tokens} />
        <Select
          options={providerItems.map(item=>({value:item.key,label:item.label}))}
          value={providerValue}
          onChange={(k) => void patch(
            { defaultChatProvider: k || undefined, defaultChatModel: "" },
            { defaultChatProvider: k || undefined, defaultChatModel: "" },
          )}
        />
      </View>

      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, opacity: providerValue ? 1 : 0.55 }]}>
        <SectionHead title={gt.defaultModelTitle} desc={gt.defaultModelDescription} tokens={tokens} />
        {providerValue ? (
          <Select
              options={modelItems.map(item=>({value:item.key,label:item.label}))}
            value={modelValue}
            onChange={(k) => void patch({ defaultChatModel: k || "auto" }, { defaultChatModel: k || "auto" })}
          />
        ) : (
          <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{gt.autoModel}</Text>
        )}
      </View>

    </ScrollView>
  );
}

export default GeneralSubTab;
