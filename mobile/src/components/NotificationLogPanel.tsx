import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  ArrowDownUp,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HardDrive,
  MemoryStick,
  ServerOff,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { getNotificationLog, type NotificationLogEntry } from "../api/client";
import { getLocaleRowDirection, getLocaleTextAlign } from "../i18n";
import { useTheme } from "../hooks/useTheme";
import { usePullRefresh } from "../hooks/usePullRefresh";
import { getThemeTokens } from "../theme/colors";

// Icono por señal del monitor (mismo set que el resto de la app).
const SIGNAL_ICON: Record<string, LucideIcon> = {
  status: ServerOff,
  cpu: Cpu,
  ram: MemoryStick,
  disk: HardDrive,
  mb: ArrowDownUp,
  access: Users,
};

function logStrings(language?: string) {
  return (language ?? "es").startsWith("en")
    ? { empty: "No notifications yet. They'll appear here when a server needs attention.", justNow: "now" }
    : { empty: "Aún no hay notificaciones. Aparecerán aquí cuando un servidor necesite atención.", justNow: "ahora" };
}

/** Cuántas notificaciones se muestran por página en el registro. */
const PAGE_SIZE = 6;

/** Fecha relativa compacta ("ahora", "5 min", "3 h", "2 d", o dd/mm/aaaa). */
function relativeDate(iso: string, justNow: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return justNow;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} d`;
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Tab "Registro" del centro de notificaciones: historial de las push enviadas por
 * el monitor de servidores (todas las del cliente), recientes primero. Lee
 * `/portal/notifications/log`; deslizar hacia abajo recarga.
 */
export default function NotificationLogPanel({
  token,
  language,
  onOpenServer,
}: {
  token: string;
  language?: string;
  /** Click en una notificación de un servidor → enfoca su tarjeta en el carousel. */
  onOpenServer?: (panelId: string) => void;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);
  const copy = logStrings(language);

  const [entries, setEntries] = useState<NotificationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; } // sin token → estado vacío, no spinner colgado
    try {
      setEntries(await getNotificationLog(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const { refreshing, onRefresh } = usePullRefresh(load);

  // Paginación: 6 por página. Al recargar (la lista puede encoger) se acota la
  // página actual para no quedar fuera de rango.
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  useEffect(() => { setPage((p) => Math.min(p, totalPages - 1)); }, [totalPages]);
  const pageEntries = useMemo(
    () => entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [entries, page],
  );

  const renderItem = useCallback(({ item }: { item: NotificationLogEntry }) => {
    const icons = (item.signals ?? []).map((s) => SIGNAL_ICON[s]).filter(Boolean) as LucideIcon[];
    // Las notificaciones del monitor referencian un servidor (panelId): al tocarlas
    // se va a su tarjeta del carousel (CPU/RAM/disco/datos/estado elevados, etc.).
    const navigable = Boolean(item.panelId);
    return (
      <Pressable
        disabled={!navigable}
        onPress={() => { if (item.panelId) onOpenServer?.(item.panelId); }}
        style={({ pressed }) => [styles.card, { borderColor: tokens.border, backgroundColor: tokens.bgInput, opacity: pressed && navigable ? 0.85 : 1 }]}
      >
        <View style={[styles.cardHead, { flexDirection: rowDirection }]}>
          <View style={[styles.iconChip, { backgroundColor: tokens.brandDim }]}>
            <Bell size={14} color={tokens.brand} />
          </View>
          <Text numberOfLines={1} style={[styles.title, { color: tokens.textPrimary, textAlign }]}>
            {item.panelName || item.title}
          </Text>
          <Text style={[styles.time, { color: tokens.textMuted }]}>{relativeDate(item.createdAt, copy.justNow)}</Text>
          {navigable ? <ChevronRight size={16} color={tokens.textMuted} style={rowDirection === "row-reverse" ? styles.chevronFlip : undefined} /> : null}
        </View>
        <Text style={[styles.body, { color: tokens.textSecondary, textAlign }]}>{item.body}</Text>
        {icons.length > 0 ? (
          <View style={[styles.signalsRow, { flexDirection: rowDirection }]}>
            {icons.map((Icon, i) => (
              <View key={i} style={[styles.signalDot, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
                <Icon size={12} color={tokens.textMuted} />
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>
    );
  }, [tokens, rowDirection, textAlign, copy.justNow, onOpenServer]);

  if (loading && entries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.brand} />
      </View>
    );
  }

  const pager = totalPages > 1 ? (
    <View style={[styles.pager, { flexDirection: rowDirection, borderColor: tokens.border }]}>
      <Pressable
        disabled={page === 0}
        onPress={() => setPage((p) => Math.max(0, p - 1))}
        style={[styles.pagerBtn, { backgroundColor: tokens.bgInput, borderColor: tokens.border, opacity: page === 0 ? 0.4 : 1 }]}
      >
        <ChevronLeft size={18} color={tokens.textPrimary} style={rowDirection === "row-reverse" ? styles.chevronFlip : undefined} />
      </Pressable>
      <Text style={[styles.pagerText, { color: tokens.textSecondary }]}>{page + 1} / {totalPages}</Text>
      <Pressable
        disabled={page >= totalPages - 1}
        onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        style={[styles.pagerBtn, { backgroundColor: tokens.bgInput, borderColor: tokens.border, opacity: page >= totalPages - 1 ? 0.4 : 1 }]}
      >
        <ChevronRight size={18} color={tokens.textPrimary} style={rowDirection === "row-reverse" ? styles.chevronFlip : undefined} />
      </Pressable>
    </View>
  ) : null;

  return (
    <FlatList
      data={pageEntries}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={entries.length === 0 ? styles.emptyContent : styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
      ListFooterComponent={pager}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Bell size={30} color={tokens.textMuted} />
          <Text style={[styles.emptyText, { color: tokens.textMuted, textAlign }]}>{copy.empty}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { gap: 8, paddingTop: 2, paddingBottom: 16 },
  emptyContent: { flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 12, padding: 11, gap: 6 },
  cardHead: { alignItems: "center", gap: 8 },
  iconChip: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 14, fontWeight: "800" },
  time: { fontSize: 11, fontWeight: "700" },
  body: { fontSize: 13, lineHeight: 18 },
  signalsRow: { gap: 6, flexWrap: "wrap" },
  signalDot: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  center: { paddingVertical: 50, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 13, maxWidth: 280, textAlign: "center" },
  chevronFlip: { transform: [{ scaleX: -1 }] },
  pager: { alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  pagerBtn: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pagerText: { fontSize: 13, fontWeight: "700", minWidth: 48, textAlign: "center" },
});
