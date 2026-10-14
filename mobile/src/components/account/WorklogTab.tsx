import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { request } from "../../api/client";
import { getLocaleRowDirection, getLocaleTextAlign } from "../../i18n";
import { useTheme } from "../../hooks/useTheme";
import { usePullRefresh } from "../../hooks/usePullRefresh";
import { getThemeTokens } from "../../theme/colors";
import {
  worklogStrings,
  worklogCategoryLabel,
  worklogLevelLabel,
  WORKLOG_LEVEL_COLOR,
} from "./worklogStrings";

// ── Contrato del backend (espejo de frontend/src/lib/portal-worklog.ts) ──────
type PeriodType = "day" | "week" | "month" | "year" | "lustrum" | "decade";
interface CategoryCount { category: string; count: number; }
interface WorklogOverview {
  totalActions: number;
  firstActivityAt: string | null;
  categories: CategoryCount[];
  stacks: { stack: string; count: number }[];
  panels: { panelId: string | null; panelName: string | null; count: number }[];
  levels: { level: string; count: number }[];
}
interface WorklogMetrics {
  sessions?: number; actions?: number; mb?: number; durationMin?: number; aiRuns?: number;
}
interface WorklogEntry {
  id: string;
  periodType: PeriodType;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  panelId: string | null;
  panelName: string | null;
  linuxUsername: string | null;
  summary: string | null;
  highlights: string[] | null;
  categories: CategoryCount[] | null;
  stacks: string[] | null;
  metrics: WorklogMetrics | null;
  aiGenerated: boolean;
}

const LEVELS: { value: string; key: "levelAll" | "levelDay" | "levelWeek" | "levelMonth" | "levelYear" | "levelLustrum" | "levelDecade" }[] = [
  { value: "", key: "levelAll" },
  { value: "day", key: "levelDay" },
  { value: "week", key: "levelWeek" },
  { value: "month", key: "levelMonth" },
  { value: "year", key: "levelYear" },
  { value: "lustrum", key: "levelLustrum" },
  { value: "decade", key: "levelDecade" },
];

function fmtMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

/**
 * Tab "Bitácora" del drawer derecho (espejo de la Bitácora / Hoja de vida de
 * web): tarjetas glance + perfil técnico (categorías y stacks) + timeline de
 * entradas filtrable por nivel de agregación. Lee `/portal/worklog/overview` y
 * `/portal/worklog/entries`; 403 → estado vacío con mensaje (no truena).
 */
export default function WorklogTab({
  visible,
  token,
  language,
  userId,
}: {
  visible: boolean;
  token: string;
  language: string;
  /** Si se pasa, muestra la bitácora PÚBLICA de ese usuario (perfil de otro);
   *  sin él, la propia (`/portal/worklog/...`). */
  userId?: string;
}) {
  const s = worklogStrings(language);
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const rowDirection = getLocaleRowDirection(language);
  const textAlign = getLocaleTextAlign(language);

  const [overview, setOverview] = useState<WorklogOverview | null>(null);
  const [entries, setEntries] = useState<WorklogEntry[]>([]);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localeDate = useCallback((iso: string | null, opts: Intl.DateTimeFormatOptions): string => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(language === "en" ? "en" : language, { ...opts, timeZone: "UTC" });
    } catch {
      return "—";
    }
  }, [language]);

  const periodLabel = useCallback((e: WorklogEntry): string => {
    const start = new Date(e.periodStart);
    const end = new Date(e.periodEnd);
    switch (e.periodType) {
      case "day":
        return localeDate(e.periodStart, { day: "numeric", month: "short", year: "numeric" });
      case "week": {
        const m = /W(\d{1,2})/i.exec(e.periodKey ?? "");
        const weekNo = m ? Number(m[1]) : "";
        return `${s.week} ${weekNo} · ${localeDate(e.periodStart, { day: "numeric", month: "short" })}`;
      }
      case "month":
        return localeDate(e.periodStart, { month: "long", year: "numeric" });
      case "year":
        return String(start.getUTCFullYear());
      case "lustrum":
      case "decade":
        return `${start.getUTCFullYear()}–${end.getUTCFullYear()}`;
      default:
        return e.periodKey ?? "";
    }
  }, [localeDate, s.week]);

  const metricsLabel = useCallback((m: WorklogMetrics | null): string => {
    if (!m) return "";
    const parts: string[] = [];
    if (typeof m.actions === "number") parts.push(`${m.actions} ${m.actions === 1 ? s.unitAction : s.unitActions}`);
    if (typeof m.sessions === "number") parts.push(`${m.sessions} ${m.sessions === 1 ? s.unitSession : s.unitSessions}`);
    if (typeof m.mb === "number") parts.push(fmtMb(m.mb));
    if (typeof m.durationMin === "number") parts.push(`${m.durationMin} ${s.unitMin}`);
    if (typeof m.aiRuns === "number" && m.aiRuns > 0) parts.push(`${m.aiRuns} ${m.aiRuns === 1 ? s.unitAiRun : s.unitAiRuns}`);
    return parts.join(" · ");
  }, [s]);

  const load = useCallback(async (lvl: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (lvl) qs.set("level", lvl);
      qs.set("limit", "100");
      // Base de endpoints: propia (/portal/worklog) o de otro usuario
      // (/portal/users/:id/worklog) cuando es un perfil público.
      const base = userId ? `/portal/users/${encodeURIComponent(userId)}/worklog` : "/portal/worklog";
      const [ov, en] = await Promise.all([
        request<{ ok: boolean; data: WorklogOverview }>(`${base}/overview`, token),
        request<{ ok: boolean; data: { entries: WorklogEntry[] } }>(`${base}/entries?${qs.toString()}`, token),
      ]);
      setOverview(ov.data ?? null);
      const list = en.data?.entries ?? [];
      list.sort((a, b) => (a.periodStart < b.periodStart ? 1 : a.periodStart > b.periodStart ? -1 : 0));
      setEntries(list);
    } catch (err) {
      setOverview(null);
      setEntries([]);
      // El backend no expone el status en el error (mensaje plano); un 403 de
      // permiso llega con el texto "...permiso..." → lo tratamos como prohibido.
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      setError(/permis|forbidden|worklog\.view/.test(msg) ? s.forbidden : s.loadError);
    } finally {
      setLoading(false);
    }
  }, [token, userId, s.forbidden, s.loadError]);

  useEffect(() => {
    if (!visible || !token) return;
    void load(level);
  }, [visible, token, level, load]);

  // Deslizar hacia abajo para actualizar: recarga overview + entradas del nivel.
  const { refreshing, onRefresh } = usePullRefresh(() => load(level));

  const realPanels = (overview?.panels ?? []).filter((p) => p.panelId || p.panelName);
  const cats = [...(overview?.categories ?? [])].sort((a, b) => b.count - a.count);
  const stacks = [...(overview?.stacks ?? [])].sort((a, b) => b.count - a.count).slice(0, 16);

  const renderGlance = (label: string, value: string | number, meta: string) => (
    <View style={[styles.glanceCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border }]}>
      <Text style={[styles.glanceLabel, { color: tokens.textMuted, textAlign }]}>{label}</Text>
      <Text style={[styles.glanceValue, { color: tokens.textPrimary, textAlign }]}>{value}</Text>
      <Text style={[styles.glanceMeta, { color: tokens.textMuted, textAlign }]}>{meta}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.brand} colors={[tokens.brand]} />}
    >
      {/* Tarjetas glance: acciones / activo desde / stacks / servidores. */}
      <View style={[styles.glanceRow, { flexDirection: rowDirection }]}>
        {renderGlance(s.statTotalActions, overview?.totalActions ?? 0, s.statTotalActionsMeta)}
        {renderGlance(s.statActiveSince, localeDate(overview?.firstActivityAt ?? null, { day: "numeric", month: "short", year: "numeric" }), s.statActiveSinceMeta)}
      </View>
      <View style={[styles.glanceRow, { flexDirection: rowDirection }]}>
        {renderGlance(s.statStacks, overview?.stacks.length ?? 0, s.statStacksMeta)}
        {renderGlance(s.statServers, realPanels.length, s.statServersMeta)}
      </View>

      {/* Perfil técnico: chips de categorías y stacks. */}
      <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{s.techProfile}</Text>
      {cats.length > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: tokens.textMuted, textAlign }]}>{s.workAreas}</Text>
          <View style={[styles.chips, { flexDirection: rowDirection }]}>
            {cats.map((c) => {
              const meta = worklogCategoryLabel(c.category, language);
              return (
                <View key={c.category} style={[styles.chip, { borderColor: meta.color, backgroundColor: `${meta.color}1a` }]}>
                  <Text style={[styles.chipText, { color: tokens.textPrimary }]}>{meta.label}</Text>
                  <Text style={[styles.chipCount, { color: meta.color }]}>{c.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
      {stacks.length > 0 ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: tokens.textMuted, textAlign }]}>{s.stacksTech}</Text>
          <View style={[styles.chips, { flexDirection: rowDirection }]}>
            {stacks.map((st) => (
              <View key={st.stack} style={[styles.chip, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
                <Text style={[styles.chipText, { color: tokens.textSecondary }]}>{st.stack}</Text>
                <Text style={[styles.chipCount, { color: tokens.textMuted }]}>{st.count}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Bitácora: filtro por nivel + timeline de entradas. */}
      <Text style={[styles.sectionTitle, { color: tokens.textSecondary, textAlign }]}>{s.title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={[styles.filterRow, { flexDirection: rowDirection }]}
      >
        {LEVELS.map((lv) => {
          const active = level === lv.value;
          return (
            <Pressable
              key={lv.value || "all"}
              onPress={() => setLevel(lv.value)}
              style={[
                styles.filterPill,
                { borderColor: active ? tokens.brand : tokens.border, backgroundColor: active ? tokens.brandDim : tokens.bgCardSolid },
              ]}
            >
              <Text style={[styles.filterText, { color: active ? tokens.brand : tokens.textSecondary }]}>{s[lv.key]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={tokens.brand} /></View>
      ) : error ? (
        <Text style={[styles.empty, { color: tokens.textMuted, textAlign }]}>{error}</Text>
      ) : entries.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.textMuted, textAlign }]}>{s.empty}</Text>
      ) : (
        <View style={styles.timeline}>
          {entries.map((e) => {
            const levelColor = WORKLOG_LEVEL_COLOR[e.periodType] ?? "#9ca3af";
            const host = e.linuxUsername ? `${e.linuxUsername}@${e.panelName ?? "—"}` : (e.panelName ?? "");
            const metricParts = metricsLabel(e.metrics);
            return (
              <View key={e.id} style={[styles.entryCard, { backgroundColor: tokens.bgCardSolid, borderColor: tokens.border, borderLeftColor: levelColor }]}>
                <View style={[styles.entryHead, { flexDirection: rowDirection }]}>
                  <Text style={[styles.entryPeriod, { color: tokens.textPrimary }]}>{periodLabel(e)}</Text>
                  <View style={[styles.levelBadge, { backgroundColor: `${levelColor}1a`, borderColor: levelColor }]}>
                    <Text style={[styles.levelBadgeText, { color: levelColor }]}>{worklogLevelLabel(s, e.periodType)}</Text>
                  </View>
                </View>
                {host ? <Text style={[styles.entryHost, { color: tokens.textMuted, textAlign }]}>{host}</Text> : null}
                {e.summary ? <Text style={[styles.entrySummary, { color: tokens.textSecondary, textAlign }]}>{e.summary}</Text> : null}
                {e.highlights && e.highlights.length > 0 ? (
                  <View style={styles.highlights}>
                    {e.highlights.map((h, i) => (
                      <Text key={i} style={[styles.highlight, { color: tokens.textSecondary, textAlign }]}>{`• ${h}`}</Text>
                    ))}
                  </View>
                ) : null}
                {(e.categories?.length || e.stacks?.length) ? (
                  <View style={[styles.chips, { flexDirection: rowDirection }]}>
                    {(e.categories ?? []).map((c) => {
                      const meta = worklogCategoryLabel(c.category, language);
                      return (
                        <View key={`c-${c.category}`} style={[styles.chip, { borderColor: meta.color, backgroundColor: `${meta.color}1a` }]}>
                          <Text style={[styles.chipText, { color: tokens.textPrimary }]}>{meta.label}</Text>
                        </View>
                      );
                    })}
                    {(e.stacks ?? []).map((st) => (
                      <View key={`s-${st}`} style={[styles.chip, { borderColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
                        <Text style={[styles.chipText, { color: tokens.textSecondary }]}>{st}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {metricParts || e.aiGenerated ? (
                  <Text style={[styles.entryMetrics, { color: tokens.textMuted, textAlign }]}>
                    {metricParts}{metricParts && e.aiGenerated ? " · " : ""}{e.aiGenerated ? s.aiSummary : ""}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 12, gap: 10, paddingBottom: 28 },
  glanceRow: { gap: 8 },
  glanceCard: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  glanceLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
  glanceValue: { fontSize: 20, fontWeight: "900", marginTop: 4 },
  glanceMeta: { fontSize: 10, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginTop: 6 },
  group: { gap: 6 },
  groupLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  chips: { flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "600" },
  chipCount: { fontSize: 11, fontWeight: "800" },
  filterScroll: { flexGrow: 0 },
  filterRow: { gap: 6, paddingVertical: 2 },
  filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontSize: 12, fontWeight: "700" },
  loadingWrap: { paddingVertical: 30, alignItems: "center" },
  empty: { fontSize: 13, paddingVertical: 18, lineHeight: 19 },
  timeline: { gap: 8 },
  entryCard: { borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 12, gap: 6 },
  entryHead: { alignItems: "center", gap: 8, flexWrap: "wrap" },
  entryPeriod: { flex: 1, fontSize: 14, fontWeight: "800" },
  levelBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  levelBadgeText: { fontSize: 10, fontWeight: "800" },
  entryHost: { fontSize: 11, fontWeight: "600" },
  entrySummary: { fontSize: 13, lineHeight: 18 },
  highlights: { gap: 2 },
  highlight: { fontSize: 12, lineHeight: 17 },
  entryMetrics: { fontSize: 11, fontWeight: "600" },
});
