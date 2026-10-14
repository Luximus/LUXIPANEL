/**
 * cron-types (desktop) — tipos de dominio del módulo Cron (espejo de
 * `app/src/screens/server/cron/cron-types`). Sin runtime: los comparten
 * `CronModule`, `cron-ui` y `cron-dialogs`.
 */

// ── Tipos (espejo de cron-types) ─────────────────────────────────────────────
export type CronJob = { id: string; schedule?: string; command?: string; comment?: string | null; enabled?: boolean; managed?: boolean };
export type CronAiJob = {
  id: string;
  name?: string;
  schedule?: string;
  prompt?: string;
  providerId?: string;
  enabled?: boolean;
  running?: boolean;
  lastStatus?: "ok" | "error" | "running" | string | null;
};
export type CronStatus = { installed?: boolean; service?: { unit?: string | null; active?: boolean }; wrapper?: boolean };
export type DaemonAction = "install" | "enable" | "disable";
export type DaemonEnvelope = { ok?: boolean; code?: string; error?: string; data?: { code?: string; output?: string } };
export type AgentTagPreset = { name: string; category: string };
export type AgentRulePreset = { id?: string; title?: string; text?: string };
export type AgentPresets = { categories: string[]; tags: AgentTagPreset[]; rules: AgentRulePreset[] };
export type CronRun = {
  file?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  durationMs?: number | null;
  running?: boolean;
};

// ── Filas planas para el DataTable ──────────────────────────────────────────
export type JobRow = { id: string; schedule: string; command: string; active: boolean; comment: string; enabled: boolean; managed: boolean };
export type AgentRow = { id: string; name: string; schedule: string; status: string; running: boolean; enabled: boolean };
