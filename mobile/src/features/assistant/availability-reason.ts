import type { ServerMetricsState } from "../app/viewModels";

export type AvailabilityReason = "creds" | "fingerprint" | "unreachable" | "generic" | null;

/** Las métricas del portal LP no describen una sesión directa de LUXIPANEL. */
export function assistantAvailabilityReason(metrics: ServerMetricsState | undefined, directConnected: boolean): AvailabilityReason {
  if (directConnected) return null;
  if (!metrics || metrics.status === "loading") return null;
  if (metrics.status === "error") return "generic";
  const ls = metrics.metrics.liveStatus;
  if (ls === "ok") return null;
  if (ls === "no_credentials") return "creds";
  if (ls === "fingerprint_pending") return "fingerprint";
  if (ls === "unreachable") return "unreachable";
  return "generic";
}
