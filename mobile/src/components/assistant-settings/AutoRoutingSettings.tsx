import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { Select } from "../ui/Select";
import { s } from "./styles";
import { SectionHead, ToggleRow } from "./parts";
import type { AssistantConfig } from "./types";

type T = Messages["assistantSettings"];
type Tier = "low" | "medium" | "high" | "max";

/**
 * Enrutado automático (reemplaza la selección manual de modelo). Toggle on/off +
 * tope de coste (maxTier). Réplica RN del `AutoRoutingSettings` de la web
 * (ProvidersTab.tsx:80-145). Fuente de verdad del auto-routing: pasa a vivir en
 * la vista "Todos" de Proveedores (antes solo un toggle en General). Persiste vía
 * `PUT /api/ai/config/auto-routing` ({ enabled, maxTier }).
 */
export function AutoRoutingSettings({
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
  const [routing, setRouting] = useState<{ enabled: boolean; maxTier: Tier } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<{ config?: AssistantConfig }>(panelId, token, "GET", "/api/ai/config").then((body) => {
      if (cancelled) return;
      const r = body?.config?.autoRouting;
      setRouting({ enabled: r?.enabled !== false, maxTier: (r?.maxTier as Tier) ?? "max" });
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  const patch = async (p: { enabled?: boolean; maxTier?: Tier }) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await luxAssistantProxy<{ config?: AssistantConfig }>(
        panelId, token, "PUT", "/api/ai/config/auto-routing", p,
      );
      const r = res?.config?.autoRouting;
      if (r) setRouting({ enabled: r.enabled !== false, maxTier: (r.maxTier as Tier) ?? "max" });
      else setRouting((cur) => (cur ? { ...cur, ...p } : cur));
    } finally {
      setBusy(false);
    }
  };

  const tx = t.providersExtra;
  const tierLabels: Record<Tier, string> = {
    low: tx.tierLow,
    medium: tx.tierMedium,
    high: tx.tierHigh,
    max: tx.tierMax,
  };
  const enabled = routing?.enabled ?? true;

  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
      <SectionHead title={tx.autoRoutingTitle} desc={tx.autoRoutingDesc} tokens={tokens} />
      <ToggleRow
        label={tx.autoRoutingEnable}
        value={enabled}
        disabled={busy || !routing}
        onChange={(v) => void patch({ enabled: v })}
        tokens={tokens}
      />
      <View style={{ opacity: enabled ? 1 : 0.5 }}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tx.autoRoutingMaxTier}</Text>
        <Select
          value={routing?.maxTier ?? "max"}
          options={(["low", "medium", "high", "max"] as Tier[]).map((tier) => ({ value: tier, label: tierLabels[tier] }))}
          onChange={(v) => void patch({ maxTier: v as Tier })}
        />
      </View>
    </View>
  );
}

export default AutoRoutingSettings;
