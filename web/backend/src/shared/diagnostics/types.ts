export type Severity = "warn" | "error" | "fatal";
export interface DiagnosticComponent {
  kind: "luxipanel" | "module";
  id: string; version: string; targetId?: string; userId?: number;
  projectId?: string; origin: "execution" | "tests" | "report";
  issueNumber?: number; reporter?: string;
}
export interface RepairPolicy {
  enabled: boolean; severities: Severity[]; since: string;
  userId: number; username: string;
}
export interface LogEvent {
  id: string; timestamp: string; scope: string; severity: Severity;
  source: string; module: string; message: string; stack?: string;
  requestId?: string; url?: string; status?: number; details?: unknown;
  fingerprint: string; historical?: boolean;
  component?: DiagnosticComponent;
  /** Set by the authenticated telemetry route, never accepted from the browser payload. */
  administratorId?: number;
}
export interface Incident {
  id: string; severity: Severity; source: string; module: string; message: string;
  firstSeen: string; lastSeen: string; count: number; sample: LogEvent;
}
export interface LogsConfig {
  enabled: boolean; retentionDays: number; maxStorageMiB: number;
  agentId: string; providerId: string; model: string; effort: "low" | "medium" | "high" | "xhigh";
  instructions: string; approvalMode: "auto" | "manual"; tokenBudget: number; timeoutMinutes: number;
  credentialId: string; baseBranch: string; concurrency: number;
  checks: ("backend-types" | "backend-tests" | "frontend-tests" | "frontend-build")[];
  repairPolicies?: Record<string, RepairPolicy>;
}
export const DEFAULT_LOGS_CONFIG: LogsConfig = {
  enabled: true, retentionDays: 30, maxStorageMiB: 512,
  agentId: "", providerId: "", model: "", effort: "high", instructions: "",
  approvalMode: "auto", tokenBudget: 400_000, timeoutMinutes: 30,
  credentialId: "", baseBranch: "", concurrency: 1,
  checks: ["backend-types", "backend-tests", "frontend-tests", "frontend-build"],
};
