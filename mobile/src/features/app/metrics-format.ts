import { formatMessage, getMessages } from "../../i18n";
import type { ServerMetricsState } from "./viewModels";

/** Etiquetas de métricas del panel (subconjunto de `t.panelTable`). */
type PanelMessages = ReturnType<typeof getMessages>["panelTable"];

export type MetricKind = "cpu" | "ram" | "disk" | "traffic";

/** Severidad de la barra de progreso → la mapea cada cliente a un color del tema. */
export type MetricSeverity = "muted" | "low" | "mid" | "high" | "neutral";

/** 12345678 → "1.2 MB". Para subtítulos de RAM/disco/datos. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export type MetricDisplay = {
  /** Valor principal ("47%", "53.0 MB", "···", "—"). */
  value: string;
  /** Texto secundario (cores, "usado / total", estado de carga…). */
  secondary: string;
  /** Ancho de la barra ("47%" / "100%") o null si no aplica. */
  barWidth: string | null;
  /** Severidad para colorear la barra. */
  severity: MetricSeverity;
};

/**
 * Calcula los valores de presentación de una métrica (CPU/RAM/disco/tráfico) a
 * partir de su estado en vivo. Extraído del `MetricStat` del carousel para que
 * la window card y el `ServerDrawer` no dupliquen la lógica de formato/colores.
 */
export function computeMetricDisplay(
  kind: MetricKind,
  state: ServerMetricsState | undefined,
  tp: PanelMessages,
): MetricDisplay {
  if (!state || state.status === "loading") {
    return { value: "···", secondary: tp.metrics.loading, barWidth: null, severity: "muted" };
  }
  if (state.status === "error") {
    return { value: "—", secondary: tp.metrics.unavailable, barWidth: null, severity: "muted" };
  }
  const m = state.metrics;
  if (kind === "traffic") {
    return { value: formatBytes(m.traffic.usedBytes), secondary: tp.metrics.dataConsumed, barWidth: "100%", severity: "neutral" };
  }
  const live = kind === "cpu" ? m.cpu : kind === "ram" ? m.ram : m.disk;
  if (!live) {
    return { value: "—", secondary: tp.metrics.unavailable, barWidth: null, severity: "muted" };
  }
  const clamped = Math.max(0, Math.min(100, live.percent));
  const severity: MetricSeverity = clamped >= 90 ? "high" : clamped >= 70 ? "mid" : "low";
  const secondary = kind === "cpu"
    ? formatMessage(tp.metrics.cores, { count: m.cpu!.cores })
    : kind === "ram"
      ? `${formatBytes(m.ram!.usedBytes)} / ${formatBytes(m.ram!.totalBytes)}`
      : `${formatBytes(m.disk!.usedBytes)} / ${formatBytes(m.disk!.totalBytes)}`;
  return { value: `${Math.round(clamped)}%`, secondary, barWidth: `${clamped}%`, severity };
}
