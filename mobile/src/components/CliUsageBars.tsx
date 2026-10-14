// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, Gauge } from "lucide-react-native";
import { getThemeTokens } from "../theme/colors";

/**
 * Barras de uso compactas (réplica nativa de `CliUsageBars.tsx` de LUXIPANEL):
 * una barra horizontal por métrica (CPU / memoria / ventana de contexto, o el
 * cupo real de la cuenta), con etiqueta, relleno coloreado por porcentaje
 * (verde → ámbar → rojo) y % a la derecha. Presentacional: recibe las filas ya
 * calculadas; el cableado de datos (cupo real vs. estimación) lo hace la Ola 2.
 */

export interface UsageBarRow {
  label: string;
  /** 0–100. Se recorta al rango. */
  pct: number;
  /** Detalle al final (hora de reinicio o conteo de tokens). */
  detail?: string;
}

export interface CliUsageBarsLabels {
  /** Título de la sección (encabezado colapsable). */
  title: string;
}

// i18n: default en ESPAÑOL (la Fase F7 inyecta locales reales al cablear).
export const CLI_USAGE_BARS_LABELS_ES: CliUsageBarsLabels = {
  title: "Uso CLI",
};

// Locales reales (F7). El selector toma el prefijo de 2 letras y cae a `es`.
const CLI_USAGE_BARS_LABELS: Record<string, CliUsageBarsLabels> = {
  es: CLI_USAGE_BARS_LABELS_ES,
  en: { title: "CLI usage" },
  fr: { title: "Utilisation CLI" },
  pt: { title: "Uso da CLI" },
  it: { title: "Utilizzo CLI" },
  ru: { title: "Использование CLI" },
  zh: { title: "CLI 用量" },
  ko: { title: "CLI 사용량" },
  ja: { title: "CLI 使用量" },
  hi: { title: "CLI उपयोग" },
  ar: { title: "استخدام CLI" },
};

/** Etiquetas de las barras de uso CLI para el locale dado (prefijo de 2 letras). */
export function cliUsageBarsLabels(lang?: string): CliUsageBarsLabels {
  return CLI_USAGE_BARS_LABELS[(lang ?? "es").slice(0, 2)] ?? CLI_USAGE_BARS_LABELS_ES;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Color de la barra según el llenado: verde → ámbar → rojo. */
function accentFor(pct: number, tokens: ReturnType<typeof getThemeTokens>): string {
  if (pct >= 90) return tokens.danger;
  if (pct >= 70) return tokens.warning;
  return tokens.success;
}

export function CliUsageBars({
  rows,
  theme,
  source,
  title,
  collapsible = true,
  labels = CLI_USAGE_BARS_LABELS_ES,
}: {
  /** Filas a pintar (CPU/mem/contexto, o cupo de cuenta). */
  rows: UsageBarRow[];
  theme: "dark" | "light";
  /** Texto entre paréntesis junto al título (p. ej. "uso real de la cuenta"). */
  source?: string;
  /** Sufijo opcional del título (p. ej. el proveedor). */
  title?: string;
  /** Si true, solo se muestra la 1.ª fila hasta expandir. */
  collapsible?: boolean;
  labels?: CliUsageBarsLabels;
}) {
  const tokens = getThemeTokens(theme === "dark");
  const [expanded, setExpanded] = useState(!collapsible);
  if (!rows || rows.length === 0) return null;

  const visibleRows = expanded ? rows : rows.slice(0, 1);
  const headerLabel = title ? `${labels.title} · ${title}` : labels.title;

  return (
    <View style={[styles.wrap, { borderBottomColor: tokens.border, backgroundColor: tokens.bgSecondary }]}>
      <Pressable
        onPress={collapsible ? () => setExpanded((v) => !v) : undefined}
        style={styles.header}
        accessibilityRole={collapsible ? "button" : undefined}
      >
        <Gauge size={11} color={tokens.textMuted} />
        <Text style={[styles.headerText, { color: tokens.textMuted }]} numberOfLines={1}>
          {headerLabel}
          {source ? <Text style={[styles.source, { color: tokens.textMuted }]}>{`  (${source})`}</Text> : null}
        </Text>
        {collapsible ? (
          <ChevronDown
            size={13}
            color={tokens.textMuted}
            style={{ marginLeft: "auto", transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        ) : null}
      </Pressable>

      {visibleRows.map((r, i) => {
        const pct = clampPct(r.pct);
        return (
          <View key={`${r.label}-${i}`} style={styles.row}>
            <Text style={[styles.rowLabel, { color: tokens.textMuted }]} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={[styles.track, { backgroundColor: tokens.border }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: accentFor(pct, tokens) }]} />
            </View>
            <Text style={[styles.pct, { color: tokens.textSecondary }]} numberOfLines={1}>
              {Math.round(pct)}%{r.detail ? ` · ${r.detail}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 5 },
  headerText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, flexShrink: 1 },
  source: { fontSize: 10, fontWeight: "400", textTransform: "none", opacity: 0.7 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { width: 70, fontSize: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  pct: { width: 110, textAlign: "right", fontSize: 9, fontVariant: ["tabular-nums"] },
});

export default CliUsageBars;
