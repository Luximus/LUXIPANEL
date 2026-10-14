import { nativeText } from '../../../i18n/native-text';
/**
 * cron-types — constantes, tipos y helpers PUROS del módulo Cron (sin React ni
 * RN), extraídos de CronScreen para compartirlos con sus subcomponentes
 * (diálogos) sin duplicarlos.
 */

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE", "DIRECT_AUTH_REQUIRED"];

export const PROVIDERS = [
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "grok", label: "Grok" },
  { value: "minimax", get label() { return nativeText("MiniMax"); } },
];

/** Cron job clásico (crontab). Campos defensivos: el panel puede omitir algunos. */
export type CronJob = { id: string; schedule?: string; command?: string; comment?: string | null; enabled?: boolean; managed?: boolean };
/** Agente IA programado. `lastStatus` indica si está en ejecución. */
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
/** Resumen del daemon cron (`GET /api/cron/status`). */
export type CronStatus = { installed?: boolean; service?: { unit?: string | null; active?: boolean }; wrapper?: boolean };
/** Acción sobre el daemon cron. */
export type DaemonAction = "install" | "enable" | "disable";
/**
 * Envelope del panel para install/service: el controlador responde HTTP 200
 * incluso ante un fallo lógico (`SUDO_PASSWORD_REQUIRED`/`SUDO_PASSWORD_INVALID`),
 * por eso NO se usa `runServerMutation` (que sólo mira el `ok` del gateway).
 */
export type DaemonEnvelope = { ok?: boolean; code?: string; error?: string; data?: { code?: string; output?: string } };
/** Presets reutilizables de agentes (`GET/PUT /api/cron/agent-presets`). */
export type AgentTagPreset = { name: string; category: string };
export type AgentRulePreset = { id?: string; title?: string; text?: string };
export type AgentPresets = { categories: string[]; tags: AgentTagPreset[]; rules: AgentRulePreset[] };

/** Una ejecución registrada (`GET .../logs`). Campos defensivos: el wrapper
 * puede aún no haber escrito el marcador END (running) o el panel omitir alguno. */
export type CronRun = {
  file?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  durationMs?: number | null;
  running?: boolean;
};

export const jobActive = (j: CronJob) => j.enabled !== false;
export const agentRunning = (a: CronAiJob) => a.running === true || a.lastStatus === "running";
