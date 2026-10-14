// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, unwrap } from "@/lib/api-client";
import type { AgentsTabPref, ConversationsTabPref } from "../ui-prefs";
import type { VoiceConfigState, VoiceConfigPatch } from "./voice";

export type AssistantProviderId = "claude" | "codex" | "gemini" | "deepseek" | "grok" | "minimax";
export type AssistantProviderMode = "api" | "cli";

export interface AssistantProviderState {
  mode: AssistantProviderMode;
  active?: boolean;
  api: {
    hasApiKey: boolean;
    apiKeyHint: string;
    model: string;
    baseUrl?: string;
  };
  cli: {
    installed: boolean;
    loggedIn: boolean;
    binPath?: string;
    version?: string;
    model?: string;
    lastCheckedAt?: string;
  };
}

/** Current API agent models shown by the chat and agent editors. */
export const PROVIDER_MODELS: Record<AssistantProviderId, string[]> = {
  claude: ["claude-opus-5-5", "claude-sonnet-5", "claude-fable-5-1", "claude-haiku-4-5"],
  codex: ["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"],
  gemini: ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview", "gemini-3.7-flash"],
  deepseek: ["deepseek-flash", "deepseek-v4-pro"],
  grok: ["grok-4.7"],
  minimax: ["MiniMax-M3", "MiniMax-M2.7", "MiniMax-M2.7-highspeed"],
};

export type AssistantUiMode = "simple" | "advanced";

/** Complexity tiers the auto-router can pick (low → max). */
export type ComplexityTier = "low" | "medium" | "high" | "max";

/** Automatic model/effort/multi-agent selection (replaces manual model picks). */
export interface AutoRoutingState {
  enabled: boolean;
  maxTier: ComplexityTier;
}

/** How the agent conducts mutating actions: ask per action (manual),
 *  auto-approve everything (auto), or plan-first (plan). */
export type ApprovalMode = "manual" | "auto" | "plan";

/** Approval policy: the chat mode selector + the "never ask again" allowlist. */
export interface ApprovalConfigState {
  mode: ApprovalMode;
  autoApproveTools: string[];
}

export interface AssistantConfigState {
  enabled: boolean;
  activeProvider: AssistantProviderId;
  providers: Record<AssistantProviderId, AssistantProviderState>;
  /** UI complexity mode. "simple" hides provider/CLI/tool jargon. */
  uiMode?: AssistantUiMode;
  /** Voice settings; present after backend backfill. */
  voice?: VoiceConfigState;
  /** Auto-routing settings; present after backend backfill. */
  autoRouting?: AutoRoutingState;
  /** Approval mode + "never ask again" allowlist; present after backend backfill. */
  approval?: ApprovalConfigState;
  /** Which tab of the AGENTS section starts active (per-server; mirrored into
   *  the local `uiPrefs` so the dashboard / chat sidebar read it at mount). */
  defaultAgentsTab?: AgentsTabPref;
  /** Which tab of the CONVERSATIONS list starts active (per-server). */
  defaultConversationsTab?: ConversationsTabPref;
  /** Default provider for NEW loose/project chats (per-server; mirrored into
   *  `uiPrefs`). Absent → fall back to `activeProvider`. Agent chats always use
   *  the agent's own provider and ignore this. */
  defaultChatProvider?: AssistantProviderId;
  /** Default model for NEW loose/project chats. `"auto"` (or absent) → the
   *  backend auto-router picks per turn; otherwise a model id of
   *  `defaultChatProvider`. */
  defaultChatModel?: string;
}

export interface ProviderProbeResult {
  ok: boolean;
  detail: string;
  probedAt: string;
}

export interface ProviderPatchPayload {
  mode?: AssistantProviderMode;
  active?: boolean;
  api?: { apiKey?: string; model?: string; baseUrl?: string };
}

interface ConfigEnvelope {
  ok: boolean;
  config: AssistantConfigState;
}

export const assistantApi = {
  async getConfig(): Promise<AssistantConfigState> {
    const res = await api.catalog<ConfigEnvelope>("/api/ai/config");
    return unwrap(res, "Failed to load assistant config").config;
  },

  async patchConfig(patch: { enabled?: boolean; activeProvider?: AssistantProviderId; uiMode?: AssistantUiMode; voice?: VoiceConfigPatch; defaultAgentsTab?: AgentsTabPref; defaultConversationsTab?: ConversationsTabPref; defaultChatProvider?: AssistantProviderId; defaultChatModel?: string }): Promise<AssistantConfigState> {
    const res = await api.put<ConfigEnvelope>("/api/ai/config", patch);
    return unwrap(res, "Failed to update assistant config").config;
  },

  async setProvider(id: AssistantProviderId, patch: ProviderPatchPayload): Promise<AssistantConfigState> {
    const res = await api.put<ConfigEnvelope>(`/api/ai/config/providers/${id}`, patch);
    return unwrap(res, "Failed to update provider").config;
  },

  async setAutoRouting(patch: Partial<AutoRoutingState>): Promise<AssistantConfigState> {
    const res = await api.put<ConfigEnvelope>("/api/ai/config/auto-routing", patch);
    return unwrap(res, "Failed to update auto-routing").config;
  },

  /** Set how the agent conducts mutating actions (manual / auto / plan). */
  async setApprovalMode(mode: ApprovalMode): Promise<AssistantConfigState> {
    const res = await api.put<ConfigEnvelope>("/api/ai/config", { approval: { mode } });
    return unwrap(res, "Failed to update approval mode").config;
  },

  /** Replace the "never ask again" tool allowlist (merge keeps the mode). */
  async setAutoApproveTools(tools: string[]): Promise<AssistantConfigState> {
    const res = await api.put<ConfigEnvelope>("/api/ai/config", { approval: { autoApproveTools: tools } });
    return unwrap(res, "Failed to update auto-approve tools").config;
  },

  async testProvider(id: AssistantProviderId): Promise<ProviderProbeResult> {
    const res = await api.post<ProviderProbeResult>(`/api/ai/config/providers/${id}/test`);
    return unwrap(res, "Probe failed");
  },
};

export const PROVIDER_META: Record<
  AssistantProviderId,
  { label: string; icon: string; accent: string; description: string }
> = {
  claude: {
    label: "Claude (Anthropic)",
    icon: "ti-robot",
    accent: "text-orange-500 bg-orange-500/10",
    description: "Modo agente nativo con tool_use.",
  },
  codex: {
    label: "Codex (OpenAI)",
    icon: "ti-brand-openai",
    accent: "text-emerald-500 bg-emerald-500/10",
    description: "Function calling vía OpenAI o CLI @openai/codex.",
  },
  gemini: {
    label: "Gemini (Google)",
    icon: "ti-sparkles",
    accent: "text-blue-500 bg-blue-500/10",
    description: "Function declarations vía Generative Language API.",
  },
  deepseek: {
    label: "DeepSeek",
    icon: "ti-brain",
    accent: "text-violet-500 bg-violet-500/10",
    description: "OpenAI-compatible. Modo CLI próximamente.",
  },
  grok: {
    label: "Grok (xAI)",
    icon: "ti-robot-face",
    accent: "text-slate-500 bg-slate-500/10",
    description: "API compatible con OpenAI de xAI (api.x.ai)",
  },
  minimax: {
    label: "MiniMax",
    icon: "ti-sparkles",
    accent: "text-pink-500 bg-pink-500/10",
    description: "Anthropic-compatible por API · CLI headless de texto vía mmx (auth con la API key guardada).",
  },
};

export const PROVIDER_ORDER: AssistantProviderId[] = ["claude", "codex", "gemini", "deepseek", "grok", "minimax"];

/**
 * Friendly, jargon-free label for a capability tool name (`moduleId.tool`),
 * shown in Simple mode instead of the raw `monitor.cpu_top` identifier.
 */
export function humanizeToolName(name: string): { label: string; icon: string } {
  const mod = name.split(".")[0] ?? "";
  const map: Record<string, { label: string; icon: string }> = {
    monitor: { label: "Revisando el servidor", icon: "ti-activity" },
    files: { label: "Trabajando con archivos", icon: "ti-folder" },
    mail: { label: "Gestionando el correo", icon: "ti-mail" },
    nginx: { label: "Configurando el sitio web", icon: "ti-world" },
    ssl: { label: "Gestionando certificados", icon: "ti-lock" },
    cron: { label: "Programando tareas", icon: "ti-clock" },
    backup: { label: "Copias de seguridad", icon: "ti-database" },
    users: { label: "Gestionando usuarios", icon: "ti-users" },
    firewall: { label: "Ajustando el firewall", icon: "ti-shield" },
    hosting: { label: "Gestionando el hosting", icon: "ti-server" },
    dashboard: { label: "Consultando el panel", icon: "ti-layout-dashboard" },
    cli: { label: "Ejecutando en terminal", icon: "ti-terminal-2" },
  };
  return map[mod] ?? { label: "Procesando", icon: "ti-loader-2" };
}
