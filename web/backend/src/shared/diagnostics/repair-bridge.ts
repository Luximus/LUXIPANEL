import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionUser } from "../types/index.js";
import type { LogsConfig } from "./types.js";

export const REPAIR_TOOLS = ["module-dev.logs_read", "module-dev.logs_write", "module-dev.logs_list", "module-dev.logs_evidence"];
export interface RepairRuntime {
  cwd: string; evidenceFile: string; allowedRoots?: string[];
  signal?: AbortSignal;
  approve: (path: string, preview: string) => Promise<boolean>;
}
export const repairRuntime = new AsyncLocalStorage<RepairRuntime>();
export interface RepairAgentAdapter {
  authorize?(user: SessionUser): Promise<SessionUser>;
  options(user: SessionUser): Promise<{ agents: { id: string; name: string; providerId: string; model: string; repairReady?: boolean }[]; providers: { id: string; model: string; ready: boolean; mode: string }[] }>;
  run(input: { user: SessionUser; config: LogsConfig; cwd: string; prompt: string; signal: AbortSignal; onEvent: (event: { type: string; delta?: string; message?: string; usage?: unknown; name?: string; inputTokens?: number; outputTokens?: number }) => Promise<void> }): Promise<{ text: string; tokens: number }>;
}
export interface GithubAdapter {
  options(): Promise<{ credentials: { id: string; label: string }[]; authenticated: boolean }>;
  withAuth<T>(credentialId: string, fn: (auth: { env: Record<string, string>; api: (method: string, route: string, body?: unknown) => Promise<unknown> }) => Promise<T>): Promise<T>;
}
let agentAdapter: RepairAgentAdapter | undefined;
let githubAdapter: GithubAdapter | undefined;
export const repairBridge = {
  registerAgent(adapter: RepairAgentAdapter) { agentAdapter = adapter; },
  registerGithub(adapter: GithubAdapter) { githubAdapter = adapter; },
  agent() { if (!agentAdapter) throw new Error("El módulo Asistente IA no está disponible."); return agentAdapter; },
  github() { if (!githubAdapter) throw new Error("El módulo Archivos no está disponible para las credenciales GitHub."); return githubAdapter; },
};
