import { localizeServerError } from '../../lib/server-error-localization';
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Select } from "../ui/Select";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import {
  getTerminalPreferences, patchTerminalPreferences,
  type HistoryMode, type TerminalPreferences,
} from "./terminal-preferences";

const label: Record<HistoryMode, string> = { commands: "Comandos", codex: "Codex", claude: "Claude" };

/** Preferencias por usuario y servidor que comparte con la terminal web. */
export function TerminalPreferencesPanel({ panelId, token, language, onChange, children }: {
  panelId: string; token: string; language?: string;
  children?: React.ReactNode;
  onChange?: (preferences: TerminalPreferences) => void;
}) {
  const es = (language ?? "es").startsWith("es");
  const tokens = getThemeTokens(useTheme().theme === "dark");
  const [prefs, setPrefs] = useState<TerminalPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setPrefs(null);
    setError("");
    void getTerminalPreferences(panelId, token).then((loaded) => {
      if (!current) return;
      if (loaded) { setPrefs(loaded); onChange?.(loaded); }
      else setError(es ? "No se pudieron cargar las preferencias." : "Could not load terminal preferences.");
    });
    return () => { current = false; };
  }, [panelId, token, es]);

  async function save(patch: Partial<TerminalPreferences>) {
    if (!prefs || busy) return;
    setBusy(true);
    setError("");
    const saved = await patchTerminalPreferences(panelId, token, patch);
    if (saved) { setPrefs(saved); onChange?.(saved); }
    else setError(es ? "No se pudieron guardar las preferencias." : "Could not save terminal preferences.");
    setBusy(false);
  }

  if (!prefs) return <View style={{ gap: 16 }}><View style={{ padding: 12 }}>{error
    ? <Text accessibilityRole="alert" style={{ color: tokens.danger }}>{localizeServerError(error)}</Text>
    : <ActivityIndicator color={tokens.brand} />}</View>{children}</View>;
  const button = (text: string, onPress: () => void, disabled = false) => <Pressable
    accessibilityLabel={text} disabled={busy || disabled} onPress={onPress}
    style={{ borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bgInput, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: busy || disabled ? 0.45 : 1 }}>
    <Text style={{ color: tokens.textPrimary, fontSize: 12 }}>{text}</Text>
  </Pressable>;

  return <View style={{ gap: 16 }}>
    <View testID="terminal-font-settings" style={{ padding: 16, gap: 10, borderWidth: 1, borderRadius: 12, borderColor: tokens.border }}>
      <Text style={{ color: tokens.textPrimary, fontWeight: "700", fontSize: 14 }}>{es ? "Tamaño de letra" : "Font size"}</Text>
      <Text style={{ color: tokens.textMuted, fontSize: 12 }}>{es ? "Se aplica a todas las pestañas de este servidor." : "Applies to all tabs on this server."}</Text>
      <Select value={String(prefs.fontSize)} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 11), label: `${i + 11} px` }))} onChange={value => { if (!busy) void save({ fontSize: Number(value) }); }} />
      {error ? <Text accessibilityRole="alert" style={{ color: tokens.danger }}>{localizeServerError(error)}</Text> : null}
    </View>
    {children}
    <View testID="terminal-history-settings" style={{ padding: 16, gap: 10, borderWidth: 1, borderRadius: 12, borderColor: tokens.border }}>
    <Text style={{ color: tokens.textSecondary, fontSize: 12 }}>{es ? "Historial: orden y visibilidad" : "History: order and visibility"}</Text>
    {prefs.historyOrder.map((id, index) => {
      const visible = prefs.historyVisible.includes(id);
      return <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Text style={{ color: tokens.textPrimary, flex: 1 }}>{label[id]}</Text>
        {button(visible ? (es ? "Visible" : "Visible") : (es ? "Oculto" : "Hidden"), () => {
          const next = visible ? prefs.historyVisible.filter((item) => item !== id) : [...prefs.historyVisible, id];
          if (next.length) void save({ historyVisible: next });
        }, visible && prefs.historyVisible.length === 1)}
        {button("↑", () => { const order = [...prefs.historyOrder]; [order[index - 1], order[index]] = [order[index]!, order[index - 1]!]; void save({ historyOrder: order }); }, index === 0)}
        {button("↓", () => { const order = [...prefs.historyOrder]; [order[index], order[index + 1]] = [order[index + 1]!, order[index]!]; void save({ historyOrder: order }); }, index === prefs.historyOrder.length - 1)}
      </View>;
    })}
    </View>
  </View>;
}
