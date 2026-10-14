import { WorkspaceCommunity } from "./WorkspaceCommunity";
import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { Bell, CheckCheck, Search, X } from "lucide-react-native";
import { PanelText as Text } from "../../components/ui/PanelText";
import { luxAssistantProxy } from "../../api/client";
import { serverNotificationsApi, type GatewayResponse } from "../../api/serverApi";
import type { Conversation } from "../../features/assistant/types";
import type { ThemeTokens } from "../../theme/colors";

export type WorkspaceNotification = {
  id: string;
  source: string;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string | null;
  target?: { href?: string; query?: Record<string, string>; event?: { name: string; detail?: Record<string, unknown> } } | null;
};

type Common = { panelId: string; token: string; language: string; colors: ThemeTokens; onClose: () => void };

const errorOf = (result: GatewayResponse) => result.error || `HTTP ${result.status}`;

export function WorkspaceNotifications({ panelId, token, language, colors, onClose, onCount, onOpen }: Common & {
  onCount: (count: number) => void;
  onOpen: (notification: WorkspaceNotification) => void;
}) {
  const es = language.startsWith("es");
  const [items, setItems] = useState<WorkspaceNotification[]>([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setBusy(true);
    const result = await serverNotificationsApi.list(panelId, token, "?pageSize=50");
    if (!result.ok) setError(errorOf(result));
    else {
      const data = result.data as { data?: WorkspaceNotification[]; unread?: number } | undefined;
      const rows = Array.isArray(data?.data) ? data.data : [];
      setItems(rows);
      onCount(typeof data?.unread === "number" ? data.unread : rows.filter(row => !row.read).length);
      setError("");
    }
    setBusy(false);
  };
  useEffect(() => { void load(); }, [panelId]);
  const update = async (id?: string) => {
    const result = id ? await serverNotificationsApi.markRead(panelId, token, id) : await serverNotificationsApi.readAll(panelId, token);
    if (!result.ok) { setError(errorOf(result)); return; }
    const rows = items.map(row => !id || row.id === id ? { ...row, read: true } : row);
    setItems(rows);
    onCount(rows.filter(row => !row.read).length);
  };
  const sources = ["all", "system", "module", "ai", "security", "user"];
  const labels: Record<string, string> = es
    ? { all: "Todas", system: "Sistema", module: "Módulos", ai: "IA", security: "Seguridad", user: "Chat" }
    : { all: "All", system: "System", module: "Modules", ai: "AI", security: "Security", user: "Chat" };
  const visible = filter === "all" ? items : items.filter(row => row.source === filter);
  return <View style={[panelStyles.overlay, { backgroundColor: colors.bgPrimary }]}>
    <View style={[panelStyles.header, { borderColor: colors.border }]}>
      <Bell size={20} color={colors.textPrimary}/><Text style={[panelStyles.heading, { color: colors.textPrimary }]}>{es ? nativeText("Notificaciones") : nativeText("Notifications")}</Text>
      <Pressable accessibilityLabel={es ? nativeText("Marcar todas como leídas") : nativeText("Mark all as read")} onPress={() => void update()}><CheckCheck size={19} color={colors.textSecondary}/></Pressable>
      <Pressable accessibilityLabel={es ? nativeText("Cerrar") : nativeText("Close")} onPress={onClose}><X size={22} color={colors.textSecondary}/></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 58 }} contentContainerStyle={{ gap: 7, padding: 12 }}>
      {sources.map(source => <Pressable key={source} onPress={() => setFilter(source)} style={[panelStyles.chip, { borderColor: colors.border, backgroundColor: filter === source ? colors.brandDim : colors.bgInput }]}><Text style={{ color: filter === source ? colors.brand : colors.textSecondary, fontSize: 12 }}>{nativeText(labels[source])}</Text></Pressable>)}
    </ScrollView>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30, gap: 8 }}>
      <WorkspaceCommunity panelId={panelId} token={token} colors={colors} />
      {busy && <ActivityIndicator color={colors.brand}/>}
      {!!error && <Pressable onPress={() => void load()}><Text style={{ color: colors.danger }}>{localizeServerError(error)} · {es ? nativeText("Reintentar") : nativeText("Retry")}</Text></Pressable>}
      {!busy && !error && !visible.length && <Text style={{ color: colors.textMuted }}>{es ? nativeText("No hay notificaciones.") : nativeText("No notifications.")}</Text>}
      {visible.map(row => <Pressable key={row.id} onPress={() => { if (!row.read) void update(row.id); onOpen(row); }} style={[panelStyles.row, { borderColor: colors.border, backgroundColor: row.read ? colors.bgPrimary : colors.bgCardSolid }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.read ? colors.textMuted : row.severity === "error" ? colors.danger : colors.brand }}/><Text style={{ color: colors.textPrimary, flex: 1, fontWeight: row.read ? "500" : "700" }}>{row.title}</Text><Text style={{ color: colors.textMuted, fontSize: 10 }}>{nativeText(labels[row.source] ?? row.source)}</Text></View>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{row.message}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{new Date(row.createdAt).toLocaleString(language)}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}

export type WorkspaceSearchItem = { id: string; label: string; description?: string; kind: "module" | "conversation"; moduleId?: string; viewId?: string };
export function WorkspaceSearch({ panelId, token, language, colors, onClose, modules, onModule, onConversation }: Common & {
  modules: WorkspaceSearchItem[];
  onModule: (moduleId: string, viewId?: string) => void;
  onConversation: (id: string) => void;
}) {
  const es = language.startsWith("es");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const local = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? modules.filter(row => `${row.label} ${row.description ?? ""} ${row.moduleId ?? ""}`.toLocaleLowerCase().includes(q)) : modules.filter(row => !row.viewId);
  }, [modules, query]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setConversations([]); setBusy(false); setError(""); return; }
    let current = true;
    const timer = setTimeout(() => {
      setBusy(true);
      void luxAssistantProxy<{ items?: Conversation[]; conversations?: Conversation[] } | Conversation[]>(panelId, token, "GET", `/api/ai/conversations?q=${encodeURIComponent(q)}&limit=15&paged=1`)
        .then(result => { if (current) { setConversations(Array.isArray(result) ? result : result?.items ?? result?.conversations ?? []); setError(""); } })
        .catch(cause => { if (current) setError(String(cause)); })
        .finally(() => { if (current) setBusy(false); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [panelId, token, query]);
  return <View style={[panelStyles.overlay, { backgroundColor: colors.bgPrimary }]}>
    <View style={[panelStyles.header, { borderColor: colors.border }]}><Search size={20} color={colors.textPrimary}/><Text style={[panelStyles.heading, { color: colors.textPrimary }]}>{es ? nativeText("Buscar en LUXIPANEL") : nativeText("Search LUXIPANEL")}</Text><Pressable accessibilityLabel={es ? nativeText("Cerrar") : nativeText("Close")} onPress={onClose}><X size={22} color={colors.textSecondary}/></Pressable></View>
    <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={es ? nativeText("Módulos, herramientas, conversaciones…") : nativeText("Modules, tools, conversations…")} placeholderTextColor={colors.textMuted} style={[panelStyles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgInput }]}/>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 30, gap: 5 }} keyboardShouldPersistTaps="handled">
      {local.length > 0 && <Text style={[panelStyles.section, { color: colors.textMuted }]}>{es ? nativeText("Módulos y vistas") : nativeText("Modules and views")}</Text>}
      {local.map(row => <Pressable key={row.id} onPress={() => { if (row.moduleId) onModule(row.moduleId, row.viewId); }} style={[panelStyles.result, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{row.label}</Text>{row.description && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{row.description}</Text>}</Pressable>)}
      {(busy || conversations.length > 0) && <Text style={[panelStyles.section, { color: colors.textMuted }]}>{es ? nativeText("Conversaciones") : nativeText("Conversations")}</Text>}
      {busy && <ActivityIndicator color={colors.brand}/>}
      {conversations.map(row => <Pressable key={row.id} onPress={() => onConversation(row.id)} style={[panelStyles.result, { borderColor: colors.border }]}><Text style={{ color: colors.textPrimary, fontWeight: "600" }}>{row.title || (es ? nativeText("Sin título") : nativeText("Untitled"))}</Text>{row.preview && <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: 11 }}>{row.preview}</Text>}</Pressable>)}
      {!!error && <Text style={{ color: colors.danger }}>{localizeServerError(error)}</Text>}
      {query.length > 1 && !busy && !error && !local.length && !conversations.length && <Text style={{ color: colors.textMuted }}>{es ? nativeText("Sin resultados") : nativeText("No results")}</Text>}
    </ScrollView>
  </View>;
}

const panelStyles = {
  overlay: { position: "absolute" as const, top: 0, bottom: 0, left: 0, right: 0, zIndex: 120 },
  header: { minHeight: 56, paddingHorizontal: 16, gap: 13, flexDirection: "row" as const, alignItems: "center" as const, borderBottomWidth: 1 },
  heading: { flex: 1, fontWeight: "700" as const, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  row: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  input: { margin: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 46, fontSize: 15 },
  section: { paddingVertical: 9, fontWeight: "700" as const, fontSize: 11, textTransform: "uppercase" as const },
  result: { borderBottomWidth: 1, paddingVertical: 12, gap: 3 },
};
