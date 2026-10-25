// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Multi-agent orchestrator.
 *
 * When the auto-router classifies a turn as `max` complexity AND decomposable,
 * the assistant deploys several sub-agents instead of one:
 *   1. DECOMPOSE — one cheap call splits the task into 2–4 independent subtasks.
 *   2. FAN-OUT   — each subtask runs as its own `provider.run` (high-tier model,
 *                  full tool set) in parallel, capped by `CONCURRENCY`.
 *   3. SYNTHESIZE — one final call composes the sub-results into the user-facing
 *                  answer, which is streamed normally.
 *
 * All phases reuse the SAME provider/backend and the SAME request `Executor`
 * (AsyncLocalStorage propagates across `Promise.all`), so there is no
 * cross-server leak. Everything is fail-open: any failure degrades to a single
 * high-tier run so the user always gets an answer.
 *
 * Re-entrant from `agent.service` via `yield*` — it emits the same `AgentEvent`
 * stream the run-registry already understands (text/usage/error/done).
 */

import { createModuleLogger } from "../../../shared/logger/index.js";
import type { AgentTool } from "../../../shared/agent-capability/index.js";
import { clampTier, effortForTier, resolveModel } from "./auto-router.service.js";
import type {
  AgentEvent,
  AgentMessage,
  ProviderRunOptions,
} from "./providers/provider.types.js";
import type {
  AssistantConfig,
  AssistantProviderId,
  ComplexityTier,
} from "../models/assistant-config.types.js";
import type { Executor } from "../../../shared/executor/index.js";
import { providerModelCatalog, resolveCatalogModel } from "./provider-model-catalog.service.js";
import { runWithProviderModelFallback } from "./provider-model-fallback.service.js";

const log = createModuleLogger("ai-orchestrator");

/** Tools kind:"action" inocuas para el fan-out (no mutan el sistema). */
const MULTI_SAFE_ACTION_TOOLS = new Set(["lxp_ask"]);

/**
 * True cuando el toolset contiene herramientas MUTANTES (kind action /
 * dangerous). El fan-out multi-agente comparte el toolset completo entre N
 * sub-agentes ciegos entre sí sobre el mismo cwd — con escrituras es la vía
 * directa a cambios concurrentes sin coordinación, así que agent.service
 * degrada a run único cuando esto devuelve true (gate de solo-lectura).
 */
export function hasMutatingTools(tools: Array<Pick<AgentTool, "name" | "kind" | "dangerous">>): boolean {
  return tools.some((t) => (t.kind === "action" || t.dangerous) && !MULTI_SAFE_ACTION_TOOLS.has(t.name));
}

/** Hard caps — keep cost and parallel tool pressure bounded. */
const MAX_SUBTASKS = 4;
const MIN_SUBTASKS = 2;
/** Absolute ceiling on agent copies (a user-chosen `copies` is clamped to this). */
const MAX_COPIES = 8;
const CONCURRENCY = 3;

interface OrchestratorArgs {
  config: AssistantConfig;
  executor: Executor;
  providerId: AssistantProviderId;
  /**
   * Providers to FAN OUT the sub-agents across (round-robin). Lets a single
   * multi-agent run use several AI providers at once. Defaults to `[providerId]`.
   * Decompose + synthesize always use `providerId` (the primary).
   */
  fanoutProviders?: AssistantProviderId[];
  /** Fully-assembled run options (systemPrompt/tools/signal/cwd/…), no effort. */
  baseOpts: Omit<ProviderRunOptions, "effort">;
  /** The conversation so far (already slash-rewritten). */
  messages: AgentMessage[];
  /** Clamped decision tier (the synthesis effort ceiling). */
  tier: ComplexityTier;
  /** Admin cost cap. */
  maxTier: ComplexityTier;
  hasAttachments: boolean;
  /**
   * Explicit number of agent COPIES to deploy (the agent's `multiAgentCount`):
   * the task is split into exactly this many parts, each handled by a copy of
   * the same agent. Clamped to [2, MAX_COPIES]. Absent → auto (2–4 by the model).
   */
  copies?: number;
}

/**
 * The planner and synthesizer run with `tools: []`, so the fully-assembled
 * system prompt (tool notes, team roster, project trees…) is dead weight for
 * them — twice per multi-agent run. They get a SHORT prompt instead; only the
 * LANGUAGE OVERRIDE tail (background translation) is carried over, because it
 * governs the output language of the user-facing synthesis.
 */
function languageOverrideOf(systemPrompt: string): string {
  const idx = systemPrompt.indexOf("\n\nLANGUAGE OVERRIDE");
  return idx >= 0 ? systemPrompt.slice(idx) : "";
}

const PLANNER_SYSTEM_PROMPT =
  "Eres un planificador de tareas del Asistente IA de LUXIPANEL. Respondes ÚNICAMENTE con JSON válido, sin texto adicional.";

const SYNTH_SYSTEM_PROMPT =
  "Eres el Asistente IA de LUXIPANEL, un panel de administración de servidores Linux. " +
  "Integra los resultados que se te entregan en UNA respuesta final coherente para el usuario. " +
  "Responde en español, de forma clara y concisa, sin mencionar el proceso interno de los agentes.";

function lastUserText(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return messages[i]!.content ?? "";
  }
  return "";
}

/** Drain a provider run, forwarding usage/error and accumulating its text. */
async function collectRun(
  gen: AsyncGenerator<AgentEvent>,
  sink: AgentEvent[],
): Promise<string> {
  let text = "";
  for await (const ev of gen) {
    if (ev.type === "text") text += ev.delta;
    else if (ev.type === "usage" || ev.type === "error") sink.push(ev);
    // tool_use/tool_result/ask/status from sub-agents are internal — dropped.
    else if (ev.type === "ask") break; // sub-agents can't ask interactively
  }
  return text;
}

/** Run `items` through `fn` with a fixed concurrency cap, preserving order. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[];
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Try to parse `{ "subtasks": [...] }` out of a model reply (tolerates prose). */
function parseSubtasks(raw: string, max: number = MAX_SUBTASKS): string[] {
  const tryParse = (s: string): string[] | null => {
    try {
      const obj = JSON.parse(s) as { subtasks?: unknown };
      if (Array.isArray(obj.subtasks)) {
        const list = obj.subtasks.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        return list.length ? list : null;
      }
    } catch {
      /* fall through */
    }
    return null;
  };
  let list = tryParse(raw.trim());
  if (!list) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) list = tryParse(m[0]);
  }
  return (list ?? []).slice(0, max);
}

export const orchestratorService = {
  async *run(args: OrchestratorArgs): AsyncGenerator<AgentEvent> {
    const { config, providerId, baseOpts, messages, tier, maxTier, hasAttachments } = args;
    // Explicit copy count (agent.multiAgentCount) → target exactly this many
    // copies of the same agent; otherwise auto (model picks 2–4).
    const copies = args.copies && args.copies >= MIN_SUBTASKS ? Math.min(Math.round(args.copies), MAX_COPIES) : 0;
    const targetHi = copies || MAX_SUBTASKS;
    const modelFor = (t: ComplexityTier) => resolveModel(providerId, clampTier(t, maxTier), hasAttachments);
    const modelForP = (pid: AssistantProviderId, t: ComplexityTier) => resolveModel(pid, clampTier(t, maxTier), hasAttachments);
    // Providers to fan out across (round-robin). Default: just the primary.
    const fanProviders = args.fanoutProviders && args.fanoutProviders.length ? args.fanoutProviders : [providerId];
    const task = lastUserText(messages);

    // Fallback: one capable single run (used when decomposition isn't viable).
    const modelRun = async function* (pid: AssistantProviderId, model: string, input: AgentMessage[], options: ProviderRunOptions): AsyncGenerator<AgentEvent> {
      const catalog = await providerModelCatalog(args.executor, config, pid);
      if (catalog.status !== "verified" || !catalog.models.some((entry) => entry.available)) {
        yield { type: "error", message: `No se pudo confirmar un modelo disponible para ${pid}.` };
        return;
      }
      const selected = resolveCatalogModel(model, catalog, pid).model;
      if (!selected) {
        yield { type: "error", message: `No hay un modelo disponible para ${pid}.` };
        return;
      }
      yield* runWithProviderModelFallback({ config, executor: args.executor, providerId: pid, model: selected, catalog, messages: input, options, english: false });
    };
    const singleRun = (): AsyncGenerator<AgentEvent> => modelRun(providerId, modelFor(tier), messages, { ...baseOpts, effort: effortForTier(tier) });

    // ── 1. Decompose ────────────────────────────────────────────────────────
    let subtasks: string[] = [];
    try {
      const countClause = copies
        ? `EXACTAMENTE ${copies} subtareas (ni más ni menos)`
        : `entre ${MIN_SUBTASKS} y ${MAX_SUBTASKS} subtareas`;
      const planPrompt =
        "Eres un planificador. Divide la siguiente petición en " +
        `${countClause} INDEPENDIENTES que puedan resolverse en paralelo. ` +
        "Cada subtarea la resolverá una COPIA del mismo agente, así que repártelas " +
        "de forma equilibrada y sin solaparse. Responde ÚNICAMENTE con JSON válido " +
        'con la forma {"subtasks":["...","..."]} y nada más.\n\n' +
        `Petición:\n${task}`;
      const sink: AgentEvent[] = [];
      const raw = await collectRun(
        modelRun(providerId, modelFor("medium"), [{ role: "user", content: planPrompt }], {
          ...baseOpts,
          systemPrompt: PLANNER_SYSTEM_PROMPT,
          systemContext: "",
          tools: [],
          effort: "low",
        }),
        sink,
      );
      for (const ev of sink) if (ev.type === "usage") yield ev; // count planner tokens
      subtasks = parseSubtasks(raw, targetHi);
    } catch (err) {
      log.warn({ err }, "decomposition failed — falling back to single agent");
    }

    if (subtasks.length < MIN_SUBTASKS) {
      log.info({ subtasks: subtasks.length }, "multi-agent skipped — single run");
      yield* singleRun();
      return;
    }

    log.info({ subtasks: subtasks.length, provider: providerId, fanProviders }, "multi-agent run");
    const multiProvider = fanProviders.length > 1;
    yield {
      type: "text",
      delta:
        `🧩 Desplegando ${subtasks.length} ${copies ? "copias de este agente" : "agentes"} en paralelo` +
        (multiProvider ? ` (proveedores: ${fanProviders.join(", ")})` : "") +
        ":\n" +
        subtasks.map((s, i) => `  ${i + 1}. ${s}${multiProvider ? ` [${fanProviders[i % fanProviders.length]}]` : ""}`).join("\n") +
        "\n\n",
    };

    // ── 2. Fan-out ──────────────────────────────────────────────────────────
    // Each sub-agent runs on the next provider round-robin, so multiple AI
    // providers work the task at once. Single provider → all on that one.
    const sink: AgentEvent[] = [];
    let fanned: string[];
    try {
      fanned = await pool(subtasks, CONCURRENCY, async (st, i) => {
        const pid = fanProviders[i % fanProviders.length]!;
        return collectRun(
          modelRun(pid, modelForP(pid, "high"), [{ role: "user", content: st }], { ...baseOpts, effort: effortForTier("high") }),
          sink,
        );
      });
    } catch (err) {
      log.warn({ err }, "fan-out failed — falling back to single agent");
      yield* singleRun();
      return;
    }
    for (const ev of sink) if (ev.type === "usage") yield ev; // count sub-agent tokens

    // ── 3. Synthesize ───────────────────────────────────────────────────────
    const subResults = subtasks
      .map((st, i) => `### Subtarea ${i + 1}: ${st}\n${fanned[i] ?? "(sin resultado)"}`)
      .join("\n\n");
    const synthMessage =
      `Petición original del usuario:\n${task}\n\n` +
      `Se ejecutaron ${subtasks.length} agentes en paralelo. Resultados:\n\n${subResults}\n\n` +
      "Integra estos resultados en UNA respuesta final, coherente y completa para " +
      "el usuario. No menciones el proceso interno de los agentes; entrega solo la " +
      "respuesta consolidada.";
    yield* modelRun(providerId, modelFor(tier), [{ role: "user", content: synthMessage }], {
      ...baseOpts,
      systemPrompt: SYNTH_SYSTEM_PROMPT + languageOverrideOf(baseOpts.systemPrompt),
      systemContext: "",
      tools: [],
      effort: effortForTier(tier),
    });
  },
};
