import { api } from "@/lib/api-client";
export const logsRequest = async <T>(method: "get" | "post" | "put", path: string, body?: unknown): Promise<T> => {
  const response = method === "get" ? await api.get(`/api/module-dev/logs${path}`) : method === "put" ? await api.put(`/api/module-dev/logs${path}`, body) : await api.post(`/api/module-dev/logs${path}`, body);
  if (response && typeof response === "object" && "ok" in response && !response.ok) throw new Error(String((response as { error?: string }).error || "Error"));
  return (response as { data: T }).data;
};
export type LogsLabels = Record<string, string>;
export interface LogConfig {
  enabled: boolean; retentionDays: number; maxStorageMiB: number;
  agentId: string; providerId: string; model: string; effort: string; instructions: string;
  approvalMode: string; tokenBudget: number; timeoutMinutes: number; credentialId: string;
  baseBranch: string; repairTarget?: "auto" | "web" | "desktop" | "mobile" | "developer"; concurrency: number; checks: string[];
  repairPolicies?: Record<string, { enabled: boolean; severities: string[] }>;
}
export interface Setup {
  components?: string[]; policyPrefix?: string;
  config: LogConfig; ready: boolean; issues: string[]; repository: string;
  agents: { id: string; name: string; providerId: string; model: string }[];
  providers: { id: string; model: string; ready: boolean; mode: string }[];
  credentials: { id: string; label: string }[]; authenticated: boolean;
}
export function openLogsSettings(): void {
  const standalone = document.querySelector<HTMLButtonElement>("#module-dev-log-settings-trigger");
  if (standalone) { standalone.click(); return; }
  document.querySelector<HTMLButtonElement>('[data-moduledev-settings-nav="logs"]')?.click();
  document.querySelector<HTMLDialogElement>("#module-dev-settings-modal")?.showModal();
}
