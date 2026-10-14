import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

// Selector de RANGO de fechas con calendario (sin dependencias nativas): un mes
// a la vez, flechas para navegar, primer toque = inicio, segundo = fin (se ordena
// solo si eligen una fecha anterior). Reemplaza al input de texto del filtro de
// historial de la Tienda. Tema/locale aware; se queda en LTR (los números de día
// no se invierten) aunque el locale sea RTL.

const CLEAR_LABEL: Record<string, string> = { es: "Limpiar", en: "Clear" };
function clearLabel(language?: string): string {
  return CLEAR_LABEL[(language ?? "es").slice(0, 2)] ?? CLEAR_LABEL.es;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function DateRangeCalendar({
  start,
  end,
  onChange,
  language,
}: {
  start: Date | null;
  end: Date | null;
  /** Reporta el rango elegido. `end` es null mientras solo hay un extremo. */
  onChange: (start: Date | null, end: Date | null) => void;
  language?: string;
}) {
  const { theme } = useTheme();
  const tokens = getThemeTokens(theme === "dark");
  const locale = language || "es";
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = start ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Etiquetas cortas de los días empezando en LUNES (2024-01-01 fue lunes).
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return capitalize(d.toLocaleDateString(locale, { weekday: "short" }).replace(".", ""));
    }),
    [locale],
  );

  const monthTitle = useMemo(
    () => capitalize(viewMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })),
    [viewMonth, locale],
  );

  // Matriz de semanas del mes visible (celdas null para el relleno inicial/final).
  const weeks = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewMonth]);

  const rangeStart = start ? startOfDay(start) : null;
  const rangeEnd = end ? startOfDay(end) : null;

  const handlePress = (day: Date) => {
    const d = startOfDay(day);
    // Sin inicio o con rango completo → empieza un rango nuevo.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      onChange(d, null);
      return;
    }
    // Inicio puesto, falta el fin → completa (ordena si la 2ª fecha es anterior).
    if (d.getTime() < rangeStart.getTime()) onChange(d, rangeStart);
    else onChange(rangeStart, d);
  };

  const dayState = (day: Date): "start" | "end" | "single" | "inRange" | "none" => {
    if (!rangeStart) return "none";
    const t = startOfDay(day).getTime();
    const s = rangeStart.getTime();
    const e = rangeEnd ? rangeEnd.getTime() : null;
    if (e === null) return t === s ? "single" : "none";
    if (t === s && t === e) return "single";
    if (t === s) return "start";
    if (t === e) return "end";
    if (t > s && t < e) return "inRange";
    return "none";
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setViewMonth((m) => addMonths(m, -1))}
          accessibilityLabel="‹"
          style={[styles.navBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}
        >
          <ChevronLeft size={18} color={tokens.textSecondary} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: tokens.textPrimary }]} numberOfLines={1}>{monthTitle}</Text>
        <Pressable
          onPress={() => setViewMonth((m) => addMonths(m, 1))}
          accessibilityLabel="›"
          style={[styles.navBtn, { borderColor: tokens.border, backgroundColor: tokens.bgCardSolid }]}
        >
          <ChevronRight size={18} color={tokens.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((w, i) => (
          <Text key={i} style={[styles.weekday, { color: tokens.textMuted }]}>{w}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const state = dayState(day);
            const isToday = isSameDay(day, today);
            const endpoint = state === "start" || state === "end" || state === "single";
            const cellBg = endpoint
              ? tokens.brand
              : state === "inRange"
                ? tokens.brandDim
                : "transparent";
            const textColor = endpoint
              ? "#ffffff"
              : state === "inRange"
                ? tokens.textPrimary
                : isToday
                  ? tokens.brand
                  : tokens.textSecondary;
            // Esquinas: redondea los extremos del rango; los días intermedios
            // quedan cuadrados para formar una barra continua.
            const leftRound = state === "start" || state === "single";
            const rightRound = state === "end" || state === "single";
            return (
              <Pressable
                key={di}
                onPress={() => handlePress(day)}
                style={[
                  styles.cell,
                  {
                    backgroundColor: cellBg,
                    borderTopLeftRadius: leftRound ? 999 : 0,
                    borderBottomLeftRadius: leftRound ? 999 : 0,
                    borderTopRightRadius: rightRound ? 999 : 0,
                    borderBottomRightRadius: rightRound ? 999 : 0,
                  },
                ]}
              >
                <Text style={[styles.cellText, { color: textColor, fontWeight: endpoint || isToday ? "800" : "600" }]}>
                  {day.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {rangeStart ? (
        <Pressable
          onPress={() => onChange(null, null)}
          style={[styles.clearBtn, { borderColor: tokens.border }]}
        >
          <X size={13} color={tokens.textMuted} />
          <Text style={[styles.clearText, { color: tokens.textMuted }]}>{clearLabel(language)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  navBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  monthTitle: { flex: 1, textAlign: "center", fontSize: 14, fontWeight: "800" },
  weekdayRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  weekRow: { flexDirection: "row" },
  cell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  cellText: { fontSize: 13 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  clearText: { fontSize: 12, fontWeight: "700" },
});
