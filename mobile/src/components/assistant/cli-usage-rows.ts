import type { UsageBarRow } from "../CliUsageBars";

export type CliQuotaWindow = { utilization: number; resetsAt: string | null };
export type LiveCliQuota = {
  provider: string;
  fiveHour: CliQuotaWindow | null;
  sevenDay: CliQuotaWindow | null;
};

/** La API de proveedores puede publicar solo una ventana de cuota. */
export function hasCliQuotaWindow(quota: LiveCliQuota): boolean {
  return quota.fiveHour !== null || quota.sevenDay !== null;
}

export function cliQuotaRows(
  quota: LiveCliQuota,
  labels: { session: string; week: string },
  formatReset: (value: string | null) => string | undefined,
): UsageBarRow[] {
  const rows: UsageBarRow[] = [];
  if (quota.fiveHour) {
    rows.push({
      label: labels.session,
      pct: quota.fiveHour.utilization,
      detail: formatReset(quota.fiveHour.resetsAt),
    });
  }
  if (quota.sevenDay) {
    rows.push({
      label: labels.week,
      pct: quota.sevenDay.utilization,
      detail: formatReset(quota.sevenDay.resetsAt),
    });
  }
  return rows;
}
