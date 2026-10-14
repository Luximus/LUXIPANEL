// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { AlertTriangle, Gauge, RefreshCw } from "lucide-react-native";
import { getThemeTokens } from "../../theme/colors";
import { CliUsageBars, cliUsageBarsLabels, type UsageBarRow } from "../CliUsageBars";
import type { AssistantStrings } from "./types";
import { styles } from "./CliUsageBarsLive.styles";
import { cliQuotaRows, hasCliQuotaWindow, type LiveCliQuota } from "./cli-usage-rows";

/** Cableado de datos de la barra "USO CLI": lee la cuota real de la cuenta
 *  (`/api/ai/stats/cli-quota`) y, si no hay, cae al estimado local de tokens
 *  (`/api/ai/stats/usage-summary`), construye las filas y las pinta con el
 *  componente presentacional `CliUsageBars`. Réplica del data-flow web.
 *  La red NO vive aquí (regla A3: los componentes no importan `src/api`): el
 *  pane inyecta `proxyGet` (GET por el proxy SSO del panel). */
type LiveUsageSummary = { session: { totalTokens: number }; weekly: { totalTokens: number }; sessionHours: number; budgets: { session: number; weekly: number }; estimated: boolean };
function fmtUsageTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
function fmtUsageReset(iso: string | null, t: AssistantStrings): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return (t.usageResetSameDay ?? "reinicia {time}").replace("{time}", time);
  const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  return (t.usageResetOtherDay ?? "reinicia {day}, {time}").replace("{day}", day).replace("{time}", time);
}
export const CliUsageBarsLive = React.memo(function CliUsageBarsLive({ panelId, token, provider, refreshKey, theme, language, t, proxyGet }: {
  panelId: string; token: string; provider: string; refreshKey: number;
  theme: "dark" | "light"; language?: string; t: AssistantStrings;
  /** GET al gateway `/api/ai/*` del panel (lo inyecta el pane; ver regla A3). */
  proxyGet: <T>(path: string) => Promise<T | null>;
}) {
  const tokens = getThemeTokens(theme === "dark");
  const [quota, setQuota] = useState<LiveCliQuota | null>(null);
  const [summary, setSummary] = useState<LiveUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [localBump, setLocalBump] = useState(0);
  const activeRef = useRef(provider);
  activeRef.current = provider;
  const lastQuotaRef = useRef<{ provider: string; quota: LiveCliQuota } | null>(null);
  // La identidad de `proxyGet` cambia por render (closure del pane): se lee por
  // ref para conservar las MISMAS deps del efecto que el original.
  const proxyGetRef = useRef(proxyGet);
  proxyGetRef.current = proxyGet;

  useEffect(() => {
    if (!provider || !token) { setQuota(null); setSummary(null); setLoading(false); return; }
    let cancelled = false;
    const p = encodeURIComponent(provider);
    setLoading(true); setFailed(false);
    void (async () => {
      try {
        const qRes = await proxyGetRef.current<{ quota?: LiveCliQuota | null }>(`/api/ai/stats/cli-quota?provider=${p}`).catch(() => null);
        if (cancelled || activeRef.current !== provider) return;
        const q = qRes?.quota ?? null;
        if (q && q.provider === provider && hasCliQuotaWindow(q)) { lastQuotaRef.current = { provider, quota: q }; setQuota(q); setSummary(null); return; }
        const prev = lastQuotaRef.current;
        if (prev && prev.provider === provider) { setQuota(prev.quota); setSummary(null); return; }
        const sRes = await proxyGetRef.current<{ summary?: LiveUsageSummary }>(`/api/ai/stats/usage-summary?provider=${p}&mode=cli`).catch(() => null);
        if (cancelled || activeRef.current !== provider) return;
        setQuota(null); setSummary(sRes?.summary ?? null); setFailed(!sRes?.summary);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [panelId, token, provider, refreshKey, localBump]);

  // Primera carga sin números aún → skeleton (evita el parpadeo "0%").
  if (loading && !quota && !summary) {
    return (
      <View style={[styles.cliUsageWrap, { borderBottomColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
        <View style={styles.cliUsageHeadRow}>
          <Gauge size={11} color={tokens.textMuted} />
          <Text style={[styles.cliUsageTitle, { color: tokens.textMuted }]}>{`${cliUsageBarsLabels(language).title} · ${provider}`}</Text>
          <ActivityIndicator size="small" color={tokens.textMuted} style={{ marginLeft: 4 }} />
        </View>
        <View style={styles.cliUsageBarRow}>
          <View style={[styles.cliUsageSkelLabel, { backgroundColor: tokens.border }]} />
          <View style={[styles.cliUsageTrack, { backgroundColor: tokens.border }]}>
            <View style={[styles.cliUsageFill, { width: "33%", backgroundColor: tokens.textMuted, opacity: 0.4 }]} />
          </View>
          <View style={[styles.cliUsageSkelPct, { backgroundColor: tokens.border }]} />
        </View>
      </View>
    );
  }

  // Sin cuota ni estimado tras resolver: aviso ámbar + reintentar manual.
  if (failed && !quota && !summary) {
    return (
      <View style={[styles.cliUsageWrap, { borderBottomColor: tokens.border, backgroundColor: "rgba(245,158,11,0.10)" }]}>
        <View style={styles.cliUsageHeadRow}>
          <Gauge size={11} color={tokens.warning} />
          <Text style={[styles.cliUsageTitle, { color: tokens.warning }]}>{`${cliUsageBarsLabels(language).title} · ${provider}`}</Text>
        </View>
        <View style={styles.cliUsageFailRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
            <AlertTriangle size={12} color={tokens.warning} />
            <Text numberOfLines={1} style={[styles.cliUsageFailText, { color: tokens.warning }]}>
              {(t.usageUnavailable ?? "Sin datos de uso de {provider}").replace("{provider}", provider)}
            </Text>
          </View>
          <Pressable onPress={() => setLocalBump((n) => n + 1)} style={[styles.cliUsageRetry, { borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.10)" }]}>
            <RefreshCw size={11} color={tokens.warning} />
            <Text style={[styles.cliUsageRetryText, { color: tokens.warning }]}>{t.usageRetry ?? "Reintentar"}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const rows: UsageBarRow[] = quota
    ? cliQuotaRows(quota, {
        session: t.usageSession5h ?? "Sesión 5h",
        week: t.usageWeek ?? "Semana",
      }, (value) => fmtUsageReset(value, t))
    : summary
      ? [
          { label: (t.usageSessionHours ?? "Sesión {hours}h").replace("{hours}", String(summary.sessionHours)), pct: summary.budgets.session > 0 ? (summary.session.totalTokens / summary.budgets.session) * 100 : 0, detail: `${fmtUsageTokens(summary.session.totalTokens)} / ${fmtUsageTokens(summary.budgets.session)}` },
          { label: t.usageWeek ?? "Semana", pct: summary.budgets.weekly > 0 ? (summary.weekly.totalTokens / summary.budgets.weekly) * 100 : 0, detail: `${fmtUsageTokens(summary.weekly.totalTokens)} / ${fmtUsageTokens(summary.budgets.weekly)}` },
        ]
      : [];
  if (rows.length === 0) return null;
  const source = quota ? (t.usageSourceReal ?? "cuenta") : summary?.estimated ? (t.usageSourceEstimated ?? "estimado") : (t.usageSourceTokens ?? "tokens");
  return <CliUsageBars rows={rows} theme={theme} source={source} title={provider} labels={cliUsageBarsLabels(language)} />;
});
