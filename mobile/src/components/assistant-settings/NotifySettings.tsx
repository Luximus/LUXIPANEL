import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { s } from "./styles";
import { SectionHead, ToggleRow } from "./parts";

type T = Messages["assistantSettings"];

/**
 * Preferencias de notificaciones del asistente. Réplica RN de `NotifySettings`
 * de la web: un único interruptor — avisar en los dispositivos del dueño cuando
 * un chat del asistente termina. Persiste vía `GET/PUT /api/ai/notify-prefs`
 * ({ chatFinished }).
 */
export function NotifySettings({
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
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void luxAssistantProxy<{ chatFinished?: boolean }>(panelId, token, "GET", "/api/ai/notify-prefs").then((body) => {
      if (!cancelled) setEnabled(body?.chatFinished ?? true);
    });
    return () => { cancelled = true; };
  }, [panelId, token]);

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    const prev = enabled;
    setEnabled(next); // optimista
    try {
      const res = await luxAssistantProxy<{ chatFinished?: boolean }>(
        panelId, token, "PUT", "/api/ai/notify-prefs", { chatFinished: next },
      );
      setEnabled(res?.chatFinished ?? next);
    } catch {
      setEnabled(prev ?? null);
    } finally {
      setBusy(false);
    }
  };

  const tx = t.providersExtra;
  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border }]}>
      <SectionHead title={tx.notifyTitle} desc={tx.notifyDesc} tokens={tokens} />
      <ToggleRow
        label={tx.notifyEnable}
        value={enabled ?? true}
        disabled={busy || enabled === null}
        onChange={(v) => void toggle(v)}
        tokens={tokens}
      />
    </View>
  );
}

export default NotifySettings;
