import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Bell, Minus, Plus, Server } from "lucide-react-native";
import {
  getPanelNotificationPrefs,
  updatePanelNotificationPrefs,
  type PanelNotificationPrefs,
} from "../api/client";
import { getLocaleRowDirection, getLocaleTextAlign } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";

// Preferencias de notificaciones push (monitoreo en background) de UN servidor.
// Antes vivía como tarjeta dentro del editor del drawer izquierdo; ahora es un
// panel independiente que se muestra en el drawer central de Notificaciones
// (se abre con el botón de campana del top-bar de servidores).
function notifStrings(language?: string) {
  return (language ?? "es").startsWith("en")
    ? {
        hint: "Get a push when this server needs attention (checked every ~30 min).",
        enabled: "Enable notifications",
        status: "Server down",
        access: "Access requests",
        cpu: "High CPU (%)",
        ram: "High RAM (%)",
        disk: "Disk almost full (%)",
        empty: "Open a server to set up its notifications.",
        server: "Server",
      }
    : {
        hint: "Recibe una push cuando este servidor necesite atención (revisado cada ~30 min).",
        enabled: "Activar notificaciones",
        status: "Servidor caído",
        access: "Solicitudes de acceso",
        cpu: "CPU alta (%)",
        ram: "RAM alta (%)",
        disk: "Disco casi lleno (%)",
        empty: "Abre un servidor para configurar sus notificaciones.",
        server: "Servidor",
      };
}

const clampPct = (n: number) => Math.max(5, Math.min(100, n));

export default function ServerNotificationsPanel({
  panelId,
  panelName,
  token,
  language,
}: {
  /** Servidor cuyas preferencias se editan (el visible en el carousel). */
  panelId: string | null;
  panelName?: string;
  token: string;
  language?: string;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const copy = notifStrings(language);

  const [prefs, setPrefs] = useState<PanelNotificationPrefs | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!panelId) { loadedIdRef.current = null; setPrefs(null); return; }
    if (loadedIdRef.current === panelId) return;
    loadedIdRef.current = panelId;
    setPrefs(null);
    let alive = true;
    getPanelNotificationPrefs(panelId, token)
      .then((p) => { if (alive) setPrefs(p); })
      .catch(() => { if (alive) setPrefs(null); });
    return () => { alive = false; };
  }, [panelId, token]);

  const patch = (p: Partial<PanelNotificationPrefs>) => {
    if (!panelId) return;
    setPrefs((c) => (c ? { ...c, ...p } : c));
    void updatePanelNotificationPrefs(panelId, p, token).catch(() => undefined);
  };

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <Text style={[styles.label, { color: tokens.textSecondary, textAlign }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: tokens.brand, false: tokens.border }}
        thumbColor="#ffffff"
      />
    </View>
  );

  const stepper = (label: string, value: number, step: number, onChange: (v: number) => void) => (
    <View style={[styles.row, { flexDirection: rowDirection }]}>
      <Text style={[styles.label, { color: tokens.textSecondary, textAlign }]}>{label}</Text>
      <View style={[styles.stepper, { flexDirection: rowDirection }]}>
        <Pressable onPress={() => onChange(value - step)} style={[styles.stepBtn, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
          <Minus size={13} color={tokens.textPrimary} />
        </Pressable>
        <Text style={[styles.stepValue, { color: tokens.textPrimary }]}>{value}</Text>
        <Pressable onPress={() => onChange(value + step)} style={[styles.stepBtn, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
          <Plus size={13} color={tokens.textPrimary} />
        </Pressable>
      </View>
    </View>
  );

  if (!panelId) {
    return (
      <View style={styles.empty}>
        <Bell size={30} color={tokens.textMuted} />
        <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{copy.empty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {panelName ? (
        <View style={[styles.serverChip, { borderColor: tokens.border, backgroundColor: tokens.bgInput, flexDirection: rowDirection }]}>
          <Server size={13} color={tokens.brand} />
          <Text numberOfLines={1} style={[styles.serverName, { color: tokens.textPrimary, textAlign }]}>{panelName}</Text>
        </View>
      ) : null}

      <Text style={[styles.hint, { color: tokens.textMuted, textAlign }]}>{copy.hint}</Text>

      <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.bgInput }]}>
        <View style={[styles.row, { flexDirection: rowDirection }]}>
          <Text style={[styles.label, { color: tokens.textSecondary, fontWeight: "700", textAlign }]}>{copy.enabled}</Text>
          <Switch
            value={!!prefs?.enabled}
            disabled={!prefs}
            onValueChange={(v) => patch({ enabled: v })}
            trackColor={{ true: tokens.brand, false: tokens.border }}
            thumbColor="#ffffff"
          />
        </View>
        {prefs && prefs.enabled ? (
          <View style={styles.group}>
            {toggle(copy.status, prefs.statusEnabled, (v) => patch({ statusEnabled: v }))}
            {toggle(copy.access, prefs.accessEnabled, (v) => patch({ accessEnabled: v }))}
            {stepper(copy.cpu, prefs.cpuPct, 5, (v) => patch({ cpuPct: clampPct(v) }))}
            {stepper(copy.ram, prefs.ramPct, 5, (v) => patch({ ramPct: clampPct(v) }))}
            {stepper(copy.disk, prefs.diskPct, 5, (v) => patch({ diskPct: clampPct(v) }))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  serverChip: { alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  serverName: { flex: 1, fontSize: 14, fontWeight: "800" },
  hint: { fontSize: 12, lineHeight: 17 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  group: { gap: 6, marginTop: 4 },
  row: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { flex: 1, fontSize: 13 },
  stepper: { alignItems: "center", gap: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 30, fontSize: 14, fontWeight: "800", textAlign: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 13, maxWidth: 280, textAlign: "center" },
});
