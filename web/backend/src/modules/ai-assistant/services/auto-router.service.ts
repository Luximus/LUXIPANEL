// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auto-router — deterministic complexity heuristic for the assistant.
 *
 * The user no longer picks a model. This service classifies each turn into a
 * {@link ComplexityTier} from cheap signals on the latest user message (length,
 * code/stack-trace presence, heavy-task keywords, attachments, available tool
 * count, conversation depth, multi-part requests), and the active provider's
 * model + reasoning effort + whether to deploy multiple agents are derived from
 * that tier. Thresholds are HARDCODED on purpose (no env, no UI) so behaviour is
 * predictable and the Access tab stays free of routing knobs.
 *
 * The only admin control is the cost cap (`maxTier`) applied via `clampTier`.
 */

import {
  COMPLEXITY_TIERS,
  EFFORT_BY_TIER,
  PROVIDER_MODEL_TIERS,
  type AssistantProviderId,
  type ComplexityTier,
} from "../models/assistant-config.types.js";
import { modelSupportsVision } from "./providers/vision.js";
import type { AgentMessage } from "./providers/provider.types.js";

export interface RoutingContext {
  /** Number of attachments on the latest user message. */
  attachments: number;
  /** Number of tools available to the agent for this run. */
  toolCount: number;
  /** Conversation depth (number of messages so far, incl. the new one). */
  conversationTurns: number;
}

export interface RoutingDecision {
  tier: ComplexityTier;
  /** Deploy multiple sub-agents (decompose → fan-out → synthesize). */
  multiAgent: boolean;
  /** Human-readable signals that drove the decision (for logs/telemetry). */
  reasons: string[];
}

// ── Signal patterns (ES + EN) ────────────────────────────────────────────────

/** Heavy / open-ended task verbs that justify a more capable model. */
const HEAVY_PATTERNS: RegExp[] = [
  /\baudit/i,
  /audita/i,
  /\brefactor/i,
  /refactoriza/i,
  /\bdebug/i,
  /depura/i,
  /\bmigrat/i,
  /migrar/i,
  /\boptimi[sz]/i,
  /optimiza/i,
  /architecture/i,
  /arquitectura/i,
  /\banaly[sz]e/i,
  /analiza/i,
  /diagn[oó]stic/i,
  /\bimplement/i,
  /implementa|construye/i,
  /rewrite|reescrib/i,
  /step by step|paso a paso/i,
  /end[ -]to[ -]end/i,
];

/** Markers that the request spans many independent units → decomposable. */
const DECOMPOSABLE_PATTERNS: RegExp[] = [
  /todo el proyecto|entire project|whole project/i,
  /todos los m[oó]dulos|all modules|every module|cada m[oó]dulo/i,
  /toda la base de c[oó]digo|entire codebase|whole codebase/i,
  /\by tambi[eé]n\b|\band also\b|\badem[aá]s\b/i,
];

/** Code fences, file paths, or stack traces present in the message. */
const CODE_PATTERNS: RegExp[] = [
  /```/,
  /(^|\s)\/(etc|var|usr|home|opt|root)\//,
  /\.(ts|tsx|js|py|go|sh|json|yml|yaml|conf|astro)\b/i,
  /\b(Error|Exception|Traceback|at\s+\w+\.\w+)\b/,
];

/** Numbered list with ≥3 items (1. 2. 3.) → multi-part request. */
const NUMBERED_LIST = /(^|\n)\s*\d+[.)]\s+\S/g;

function lastUserText(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return messages[i]!.content ?? "";
  }
  return "";
}

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) if (p.test(text)) n++;
  return n;
}

/**
 * Classify a turn into a complexity tier + multi-agent decision. Pure and
 * deterministic — the same input always yields the same routing.
 */
export function classifyComplexity(messages: AgentMessage[], ctx: RoutingContext): RoutingDecision {
  const text = lastUserText(messages);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const reasons: string[] = [];
  let score = 0;

  // Message length.
  if (words > 400) {
    score += 3;
    reasons.push(`long(${words}w)`);
  } else if (words > 150) {
    score += 2;
    reasons.push(`medium-len(${words}w)`);
  } else if (words > 40) {
    score += 1;
    reasons.push(`short+(${words}w)`);
  }

  // Code / paths / stack traces.
  if (countMatches(text, CODE_PATTERNS) > 0) {
    score += 2;
    reasons.push("code");
  }

  // Heavy-task keywords (each distinct family contributes, capped at +3).
  const heavy = countMatches(text, HEAVY_PATTERNS);
  if (heavy > 0) {
    const add = Math.min(heavy, 3);
    score += add;
    reasons.push(`heavy(${heavy})`);
  }

  // Attachments.
  if (ctx.attachments > 2) {
    score += 2;
    reasons.push(`attachments(${ctx.attachments})`);
  } else if (ctx.attachments > 0) {
    score += 1;
    reasons.push(`attachment(${ctx.attachments})`);
  }

  // Tool-heavy environment + deep conversation (mild contributions).
  if (ctx.toolCount > 20) {
    score += 1;
    reasons.push(`tools(${ctx.toolCount})`);
  }
  if (ctx.conversationTurns > 12) {
    score += 1;
    reasons.push(`deep(${ctx.conversationTurns})`);
  }

  // Multi-part request (numbered list ≥3 OR explicit "and also" markers).
  const numbered = (text.match(NUMBERED_LIST) ?? []).length;
  const decomposableHits = countMatches(text, DECOMPOSABLE_PATTERNS);
  const multiPart = numbered >= 3 || decomposableHits > 0;
  if (multiPart) {
    score += 2;
    reasons.push(numbered >= 3 ? `list(${numbered})` : "decomposable");
  }

  // Score → tier.
  let tier: ComplexityTier;
  if (score <= 1) tier = "low";
  else if (score <= 3) tier = "medium";
  else if (score <= 5) tier = "high";
  else tier = "max";

  // Deploy multiple agents only for the hardest, genuinely decomposable work.
  const multiAgent = tier === "max" && multiPart;

  return { tier, multiAgent, reasons };
}

const TIER_INDEX: Record<ComplexityTier, number> = { low: 0, medium: 1, high: 2, max: 3 };

/** Clamp a chosen tier to the admin cost cap. */
export function clampTier(tier: ComplexityTier, maxTier: ComplexityTier): ComplexityTier {
  return TIER_INDEX[tier] <= TIER_INDEX[maxTier] ? tier : maxTier;
}

/**
 * Resolve the model for a (provider, tier). When the turn carries attachments,
 * floor to the first tier whose model accepts image input so the run isn't
 * silently stripped of its attachments (vision gating in agent.service).
 */
export function resolveModel(
  providerId: AssistantProviderId,
  tier: ComplexityTier,
  hasAttachments: boolean,
): string {
  const byTier = PROVIDER_MODEL_TIERS[providerId];
  const base = byTier[tier];
  if (!hasAttachments || modelSupportsVision(providerId, base)) return base;
  // Walk up the tiers looking for a vision-capable model.
  for (let i = TIER_INDEX[tier] + 1; i < COMPLEXITY_TIERS.length; i++) {
    const candidate = byTier[COMPLEXITY_TIERS[i]!];
    if (modelSupportsVision(providerId, candidate)) return candidate;
  }
  // A provider's most capable model may be text-only (DeepSeek V4 Pro).
  for (let i = TIER_INDEX[tier] - 1; i >= 0; i--) {
    const candidate = byTier[COMPLEXITY_TIERS[i]!];
    if (modelSupportsVision(providerId, candidate)) return candidate;
  }
  return base; // provider has no vision-capable model — attachments dropped later
}

/** Reasoning effort for a tier (provider self-gates by model). */
export function effortForTier(tier: ComplexityTier): "low" | "medium" | "high" | "xhigh" {
  return EFFORT_BY_TIER[tier];
}
