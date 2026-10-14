// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Scheduled AI-agent job — run an AI Assistant agent on a cron schedule.
 *
 * Sidecar (per target): `${LUXIPANEL_CONFIG_DIR}/cron/ai-agents.json`.
 *
 * Provider/model mirror the AI Assistant config; `projectId` reuses the
 * Assistant's projects (cwd + instructions). The tools the agent may call are
 * NOT defined here — they come from the Assistant's per-target module-access
 * gating (`assistantModulesService.allowedTools`), so granting/revoking the
 * agent's powers over a module is done from the Assistant's Modules tab.
 */

import type { AssistantProviderId } from "../../ai-assistant/models/assistant-config.types.js";

export interface AiAgentJob {
  id?: string;
  name: string;
  enabled: boolean;
  /**
   * 5-field cron expression or @alias. Empty string = no schedule: the job
   * never runs on its own, only via "run now" or chained from another job's
   * `nextJobId`.
   */
  schedule: string;
  /** AI provider id (claude/codex/gemini/deepseek/minimax). */
  providerId: AssistantProviderId;
  /** Model id; empty string = provider default. */
  model: string;
  /**
   * Optional saved custom agent (AI Assistant `/agents`) to run: supplies its
   * system prompt + allowed-tool subset + provider/model. The job's own
   * provider/model are prefilled from the agent in the UI; `prompt` stays the
   * task/objective. Resolved at run time by `agentService.run` (fail-open if the
   * agent was deleted). Agents are panel-host/global, same store domain as jobs.
   */
  agentId?: string | null;
  /** Optional Assistant project id (supplies cwd + instructions). */
  projectId?: string | null;
  /**
   * Optional absolute path of a git project detected by the Files module
   * (`GET /api/files/projects`). When set, it becomes the agent's working
   * directory (cwd) and is announced in the system prompt.
   */
  projectPath?: string | null;
  /**
   * Multi-project selection: when more than one path is set, each run executes
   * the task once PER project, independently (own cwd + own log file), in
   * parallel. `projectPath` mirrors the first entry for back-compat/display.
   */
  projectPaths?: string[];
  /**
   * Optional id of another scheduled agent job to trigger when this run
   * finishes (chaining). Cycles are guarded at run time.
   */
  nextJobId?: string | null;
  /**
   * Execution mode. "multi" instructs the agent to decompose the task and
   * fan out parallel subagents (native in Claude CLI via its Task tool;
   * best-effort directive elsewhere). "single" (default) forbids subagents.
   */
  agentMode?: "single" | "multi";
  /** Free-form category for quick filtering in the UI. */
  category?: string;
  /** Free-form tags for quick filtering in the UI. */
  tags?: string[];
  /** The task/objective handed to the agent each run. */
  prompt: string;
  /** Extra ad-hoc rules/guardrails appended to the prompt. */
  rules?: string;
  /**
   * References to predefined rule presets (`agent-presets.json` → rules[].id),
   * resolved to their CURRENT text at run time — editing a preset updates
   * every agent that selected it.
   */
  ruleIds?: string[];
  /**
   * Email recipients for the post-run report (sent via the mail module's
   * panel-outbound identity). Empty/absent = no email.
   */
  notifyEmails?: string[];
  /**
   * Send the post-run report to the RECOVERY EMAIL of the Linux user who
   * created the job (resolved fresh at send time from their panel record).
   */
  notifyOwner?: boolean;
  /**
   * Human-in-the-loop gate: when true, finishing a run creates a pending
   * approval (capability URL). The `nextJobId` chain does NOT fire until a
   * human APPROVES; "changes" re-runs this job with the reviewer's feedback;
   * "denied" stops the flow.
   */
  requireApproval?: boolean;
  /**
   * Approval mode override for this job (manual | auto | plan). Cron jobs run
   * in the BACKGROUND and must NOT inherit the interactive user's global
   * `auto` — a "auto" job would run with `--dangerously-skip-permissions`
   * and could mutate the target server with no human in the loop. When
   * omitted, the scheduler defaults to `"manual"` regardless of the user's
   * global setting. The UI's AI-agent job editor should require an explicit
   * choice for any non-manual mode.
   */
  approvalModeOverride?: "auto" | "manual" | "plan";
  /**
   * Panel user id of the creator. The scheduler runs the agent under this id so
   * the AI Assistant provider config (which is namespaced per user) resolves to
   * the same provider/model/API key the creator configured.
   */
  ownerUserId?: number | null;
  /** Preset namespace of the creator; separates panel and hosting identities. */
  ownerScope?: string;
  /** Last run bookkeeping. */
  lastRunAt?: string | null;
  lastStatus?: "ok" | "error" | "running" | null;
  lastError?: string | null;
  lastLogFile?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
