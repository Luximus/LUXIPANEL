// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Team templates service — list / get / apply.
 *
 * "apply" materialises a TeamTemplate into REAL AssistantAgent records
 * persisted in the per-server `assistant/agents.json` sidecar (reuses
 * `agentsRepository.create/update`). It walks the slot graph in
 * topological order (root first), creates each agent and rewrites the
 * `parentSlotId` references to the freshly-minted agent ids. A second
 * pass wires up `connections` (bidirectional). The root always gets
 * `canSpawnChats: true` regardless of the template flag — defence in
 * depth: the hierarchy only makes sense if the head can spawn / delegate.
 *
 * Idempotency / partial failure: this service is NOT transactional
 * (data-store is per-collection JSON sidecars). If creation fails mid-way,
 * the already-created agents stay in the sidecar and are returned to the
 * caller with `createdIds` so the UI can offer cleanup.
 */
import {
  TEAM_TEMPLATE_CATEGORIES,
  type TeamTemplate,
  type TemplateAgentSlot,
} from "../models/team-template.types.js";
import { TEAM_TEMPLATES } from "../seed/team-templates.seed.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentTeamsRepository } from "../repositories/agent-teams.repository.js";
import { sanitizePaths, isAssistantProviderId } from "../models/assistant-agent.types.js";
import { normalizeAllowedTools } from "./tool-allowlist.js";
import { PROVIDER_IDS, type AssistantProviderId } from "../models/assistant-config.types.js";
import { AppError, ValidationError, NotFoundError } from "../../../shared/errors/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { AssistantAgent, AvatarConfig } from "../models/assistant-agent.types.js";

const log = createModuleLogger("assistant-team-templates");

/**
 * Public apply input. `slotOverrides` keys are SLOT ids (`"ceo"`, `"frontend"`,
 * …) — NOT agent ids — so the user edits the blueprint before materialisation.
 */
export interface ApplySlotOverrides {
  name?: string;
  description?: string;
  systemPrompt?: string;
  providerId?: AssistantProviderId;
  model?: string;
  /** null = clear override (CEO-style); array = narrow. */
  allowedTools?: string[] | null;
  icon?: string;
  color?: string;
  avatarConfig?: AvatarConfig;
  projectPaths?: string[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
  realtime?: boolean;
}

export interface ApplyInput {
  slotOverrides?: Record<string, ApplySlotOverrides>;
  defaults?: {
    providerId?: AssistantProviderId;
    model?: string;
    projectPaths?: string[];
  };
  /** Force `canSpawnChats: true` on the root. Default true. */
  rootCanSpawnChats?: boolean;
  /** Optional prefix prepended to each slot name (≤60 chars). */
  namePrefix?: string;
}

export interface ApplyResult {
  /** Agents created, ordered by hierarchy (root first). */
  agents: AssistantAgent[];
  /** All slot ids that were created (subset of `agents[].id`). */
  createdIds: string[];
}

/** Slimmed-down slot for the list endpoint (no systemPrompt/allowedTools). */
export interface TeamTemplateSlotSummary {
  slotId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  avatarConfig?: AvatarConfig;
  parentSlotId: string | null;
  connectionSlotIds?: string[];
  agentMode?: "single" | "multi";
  multiAgentCount?: number;
}

export interface TeamTemplateSummary {
  id: string;
  category: TeamTemplate["category"];
  tags: string[];
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultProvider?: AssistantProviderId;
  defaultModel?: string;
  recommendMultiAgent?: boolean;
  /** Number of slots (cheap preview; full slot list on `get`). */
  slotCount: number;
  /** Slim slot list for the wizard preview card. */
  slots: TeamTemplateSlotSummary[];
}

/** Look up a template or throw NotFoundError. */
function findTemplate(id: string): TeamTemplate {
  const t = TEAM_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new NotFoundError(`Plantilla de equipo '${id}' no encontrada`);
  return t;
}

/** Validate that all `parentSlotId` / `connectionSlotIds` reference real sibling
 *  slots; reject templates with multiple roots or dangles. Runs once at boot on
 *  the seed (cheap), and again per apply call (defence against in-place edits).
 */
function validateTemplate(t: TeamTemplate): void {
  const ids = new Set(t.slots.map((s) => s.slotId));
  if (ids.size !== t.slots.length) {
    throw new Error(`Plantilla '${t.id}': slotIds duplicados`);
  }
  const roots = t.slots.filter((s) => s.parentSlotId === null);
  if (roots.length !== 1) {
    throw new Error(`Plantilla '${t.id}': debe haber exactamente 1 root (hay ${roots.length})`);
  }
  for (const slot of t.slots) {
    if (slot.parentSlotId !== null && !ids.has(slot.parentSlotId)) {
      throw new Error(`Plantilla '${t.id}': slot '${slot.slotId}' referencia parent inexistente '${slot.parentSlotId}'`);
    }
    for (const conn of slot.connectionSlotIds ?? []) {
      if (!ids.has(conn)) {
        throw new Error(`Plantilla '${t.id}': slot '${slot.slotId}' referencia connection inexistente '${conn}'`);
      }
      if (conn === slot.slotId) {
        throw new Error(`Plantilla '${t.id}': slot '${slot.slotId}' se conecta a sí mismo`);
      }
    }
  }
}

/** Walk the slot tree in topological order (root first). Stable across runs. */
function topologicalOrder(slots: TemplateAgentSlot[]): TemplateAgentSlot[] {
  const byId = new Map(slots.map((s) => [s.slotId, s] as const));
  const visited = new Set<string>();
  const out: TemplateAgentSlot[] = [];
  const root = slots.find((s) => s.parentSlotId === null);
  if (!root) throw new Error("template sin root");
  const visit = (s: TemplateAgentSlot): void => {
    if (visited.has(s.slotId)) return;
    visited.add(s.slotId);
    if (s.parentSlotId) {
      const parent = byId.get(s.parentSlotId);
      if (parent) visit(parent);
    }
    out.push(s);
  };
  // Visit root first, then everyone (children come after because `visit` walks
  // through the parent chain before appending).
  visit(root);
  for (const s of slots) visit(s);
  return out;
}

/** Coerce a slot override provider to a valid id or undefined. */
function coerceProvider(v: unknown): AssistantProviderId | undefined {
  if (!v) return undefined;
  return isAssistantProviderId(v) ? v : undefined;
}

/** Compose the effective create payload for a slot given overrides + defaults. */
function composeCreate(
  template: TeamTemplate,
  slot: TemplateAgentSlot,
  input: ApplyInput,
  resolvedParentId: string | null,
  isRoot: boolean,
  teamId: string | null,
): {
  name: string;
  description: string;
  systemPrompt: string;
  providerId: AssistantProviderId;
  model: string;
  allowedTools: string[] | null;
  icon: string;
  color: string;
  avatarConfig: AvatarConfig | undefined;
  projectPaths: string[];
  parentAgentId: string | null;
  agentMode: "single" | "multi";
  multiAgentCount?: number;
  realtime: boolean;
  canSpawnChats: boolean;
  templateId: string;
  templateNodeKey: string;
  teamId: string | null;
} {
  const ov = input.slotOverrides?.[slot.slotId] ?? {};
  const defaults = input.defaults ?? {};
  const nameRaw = ov.name ?? slot.name;
  const name = input.namePrefix
    ? `${input.namePrefix.slice(0, 60)} · ${nameRaw}`.slice(0, 120)
    : nameRaw;

  const providerId =
    coerceProvider(ov.providerId) ??
    coerceProvider(defaults.providerId) ??
    template.defaultProvider ??
    "claude";

  if (!PROVIDER_IDS.includes(providerId)) {
    throw new ValidationError(`providerId inválido: ${String(ov.providerId)}`);
  }

  // Slot's `allowedTools` is null = "no narrowing" → we send null so the
  // resulting agent has unrestricted tools. Overrides may narrow further.
  // Defensa en profundidad: aliases muertos migran y desconocidos se
  // descartan aunque un seed vuelva a desviarse del registro.
  const rawAllowed =
    ov.allowedTools !== undefined
      ? ov.allowedTools
      : slot.allowedTools;
  const allowedTools =
    rawAllowed == null
      ? null
      : (normalizeAllowedTools(rawAllowed, { onUnknown: "drop", context: "team-templates.compose" })?.valid ?? rawAllowed);

  // projectPaths: per-slot override > default > template default.
  const rawPaths =
    ov.projectPaths ?? defaults.projectPaths ?? template.defaultProjectPaths ?? [];
  const projectPaths = sanitizePaths(rawPaths);

  const agentMode: "single" | "multi" =
    ov.agentMode === "multi" || slot.agentMode === "multi" ? "multi" : "single";
  const multiAgentCount =
    typeof ov.multiAgentCount === "number"
      ? ov.multiAgentCount
      : slot.multiAgentCount;

  return {
    name,
    description: ov.description ?? slot.description,
    systemPrompt: ov.systemPrompt ?? slot.systemPrompt,
    providerId,
    model: (ov.model ?? defaults.model ?? template.defaultModel ?? "").slice(0, 80),
    allowedTools,
    icon: ov.icon ?? slot.icon,
    color: ov.color ?? slot.color,
    avatarConfig: ov.avatarConfig ?? slot.avatarConfig,
    projectPaths,
    parentAgentId: resolvedParentId,
    agentMode,
    multiAgentCount,
    realtime: Boolean(ov.realtime),
    // Defence in depth: root MUST be able to spawn / delegate.
    canSpawnChats: isRoot ? input.rootCanSpawnChats !== false : Boolean(slot.canSpawnChats),
    // Provenance markers: enable template RESYNC (compare tree vs blueprint).
    templateId: template.id,
    templateNodeKey: slot.slotId,
    // First-class team membership (when a namePrefix/team was resolved).
    teamId,
  };
}

/** Find-or-create the AgentTeam matching `namePrefix` (case-insensitive) so all
 *  agents of this "Equipo rápido" share one first-class team. Best-effort: a
 *  failure returns null (the agents are still created, just without a teamId). */
async function findOrCreateTeamByName(namePrefix: string): Promise<string | null> {
  const name = namePrefix.trim();
  if (!name) return null;
  try {
    const existing = await agentTeamsRepository.findByName(name);
    if (existing?.id) return existing.id;
    const created = await agentTeamsRepository.create({ name });
    return created.id ?? null;
  } catch (err) {
    log.warn({ err: (err as Error).message, name }, "team-templates: find-or-create de equipo falló");
    return null;
  }
}

/** Validate a candidate apply input (slotOverrides keys ⊂ slots). */
function validateInput(template: TeamTemplate, input: ApplyInput): void {
  if (input.namePrefix && input.namePrefix.length > 60) {
    throw new ValidationError("namePrefix debe tener ≤60 caracteres");
  }
  const slotIds = new Set(template.slots.map((s) => s.slotId));
  for (const key of Object.keys(input.slotOverrides ?? {})) {
    if (!slotIds.has(key)) {
      throw new ValidationError(`slotOverrides referencia slotId desconocido: '${key}'`);
    }
    const ov = input.slotOverrides![key]!;
    if (ov.providerId && !isAssistantProviderId(ov.providerId)) {
      throw new ValidationError(`slotOverrides.${key}.providerId inválido`);
    }
    if (typeof ov.multiAgentCount === "number" && (ov.multiAgentCount < 2 || ov.multiAgentCount > 8)) {
      throw new ValidationError(`slotOverrides.${key}.multiAgentCount debe estar en [2,8]`);
    }
    if (ov.allowedTools !== undefined && ov.allowedTools !== null) {
      if (!Array.isArray(ov.allowedTools)) {
        throw new ValidationError(`slotOverrides.${key}.allowedTools debe ser array o null`);
      }
      if (ov.allowedTools.length > 500) {
        throw new ValidationError(`slotOverrides.${key}.allowedTools excede 500 entradas`);
      }
      // Input del usuario en el wizard: desconocidos reales → 400 (aliases migran).
      normalizeAllowedTools(ov.allowedTools, { onUnknown: "reject", context: "team-templates.apply" });
    }
  }
  if (input.defaults?.providerId && !isAssistantProviderId(input.defaults.providerId)) {
    throw new ValidationError(`defaults.providerId inválido`);
  }
}

export const teamTemplatesService = {
  /** Validate the seed once at boot. Logs a clear error and rethrows if broken. */
  validateAllAtBoot(): void {
    for (const t of TEAM_TEMPLATES) {
      try {
        validateTemplate(t);
      } catch (err) {
        log.error({ err: (err as Error).message, templateId: t.id }, "team-templates seed inválido");
        throw err;
      }
    }
    log.info({ count: TEAM_TEMPLATES.length }, "team-templates seed cargado");
  },

  /** GET /api/ai/team-templates — categories + slimmed templates. */
  list(): { categories: typeof TEAM_TEMPLATE_CATEGORIES; templates: TeamTemplateSummary[] } {
    const templates: TeamTemplateSummary[] = TEAM_TEMPLATES.map((t) => ({
      id: t.id,
      category: t.category,
      tags: t.tags,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      defaultProvider: t.defaultProvider,
      defaultModel: t.defaultModel,
      recommendMultiAgent: t.recommendMultiAgent,
      slotCount: t.slots.length,
      slots: t.slots.map((s) => ({
        slotId: s.slotId,
        name: s.name,
        description: s.description,
        icon: s.icon,
        color: s.color,
        avatarConfig: s.avatarConfig,
        parentSlotId: s.parentSlotId,
        connectionSlotIds: s.connectionSlotIds,
        agentMode: s.agentMode,
        multiAgentCount: s.multiAgentCount,
      })),
      // Echo translations so the wizard can render in the active platform locale.
      translations: t.translations,
    }));
    return { categories: TEAM_TEMPLATE_CATEGORIES, templates };
  },

  /** GET /api/ai/team-templates/:id — full template (with systemPrompts). */
  get(id: string): TeamTemplate {
    return findTemplate(id);
  },

  /** POST /api/ai/team-templates/:id/apply — materialise into real agents. */
  async apply(id: string, input: ApplyInput): Promise<ApplyResult> {
    const template = findTemplate(id);
    validateTemplate(template);
    validateInput(template, input);

    const ordered = topologicalOrder(template.slots);
    const slotIdToAgentId = new Map<string, string>();
    const created: AssistantAgent[] = [];

    // "Equipo rápido": when a namePrefix is given, find-or-create a first-class
    // AgentTeam once so every materialised agent shares its teamId.
    const teamId = input.namePrefix ? await findOrCreateTeamByName(input.namePrefix) : null;

    // First pass: create agents in topological order so we can resolve
    // `parentSlotId` to the freshly-minted id of the parent.
    for (const slot of ordered) {
      const parentSlotId = slot.parentSlotId;
      const resolvedParentId =
        parentSlotId === null ? null : (slotIdToAgentId.get(parentSlotId) ?? null);
      const isRoot = parentSlotId === null;
      const payload = composeCreate(template, slot, input, resolvedParentId, isRoot, teamId);
      try {
        const agent = await agentsRepository.create(payload);
        if (!agent.id) throw new AppError("El repositorio no devolvió id", 500, "TEMPLATE_APPLY_NO_ID");
        slotIdToAgentId.set(slot.slotId, agent.id);
        created.push(agent);
      } catch (err) {
        log.warn(
          { err: (err as Error).message, templateId: id, slotId: slot.slotId, createdCount: created.length },
          "team-templates apply: fallo parcial",
        );
        throw new AppError(
          `Falló la creación del slot '${slot.slotId}'. ${created.length} agente(s) ya creados.`,
          500,
          "TEMPLATE_APPLY_FAILED",
          { createdIds: created.map((a) => a.id).filter(Boolean) as string[] },
        );
      }
    }

    // Second pass: wire up bidirectional connections. After updating, re-fetch
    // each agent so the response reflects the FINAL state (with connections).
    const finalAgents: AssistantAgent[] = [];
    for (const slot of template.slots) {
      const conns = slot.connectionSlotIds ?? [];
      if (conns.length === 0) continue;
      const myId = slotIdToAgentId.get(slot.slotId);
      if (!myId) continue;
      // De-duplicate + intersect with actually-created ids.
      const myConnIds = Array.from(
        new Set(conns.map((c) => slotIdToAgentId.get(c)).filter((x): x is string => Boolean(x))),
      );
      try {
        await agentsRepository.update(myId, { connections: myConnIds });
      } catch (err) {
        log.warn(
          { err: (err as Error).message, templateId: id, slotId: slot.slotId, myId },
          "team-templates apply: fallo actualizando connections (agentes quedan sin connections)",
        );
        // Non-fatal: agents already exist and the hierarchy is intact.
      }
    }

    // Re-read every created agent so the response contains the up-to-date
    // `connections` (and any other second-pass mutations). The first pass's
    // `created` array only reflects the state right after `create()`, which
    // predates the connections write.
    for (const a of created) {
      if (!a.id) continue;
      const fresh = await agentsRepository.get(a.id);
      finalAgents.push(fresh ?? a);
    }

    return {
      agents: finalAgents,
      createdIds: created.map((a) => a.id).filter(Boolean) as string[],
    };
  },

  /**
   * POST /api/ai/team-templates/:id/resync — compare a materialised team
   * (the tree under `rootAgentId`) against the blueprint and PROPOSE what
   * diverged. Read-only: it never creates/edits agents — the UI decides what
   * to do with the proposal (e.g. re-apply the missing slots with overrides).
   * Matching uses the provenance markers written by `apply`
   * (`templateId`/`templateNodeKey`); teams created before the markers existed
   * return `markersMissing: true` and no reliable diff.
   */
  async resync(
    id: string,
    rootAgentId: string,
  ): Promise<{
    markersMissing: boolean;
    missing: Array<{ slotId: string; name: string; description: string }>;
    present: Array<{ slotId: string; agentId: string; name: string }>;
    extra: Array<{ agentId: string; name: string }>;
  }> {
    const template = findTemplate(id);
    validateTemplate(template);
    const all = await agentsRepository.list();
    const root = all.find((a) => a.id === rootAgentId);
    if (!root?.id) throw new NotFoundError(`Agente raíz '${rootAgentId}' no encontrado`);
    // Collect the tree under the root (BFS over parentAgentId).
    const members: AssistantAgent[] = [root];
    const queue = [root.id];
    const seen = new Set([root.id]);
    while (queue.length) {
      const pid = queue.shift()!;
      for (const a of all) {
        if (a.id && a.parentAgentId === pid && !seen.has(a.id)) {
          seen.add(a.id);
          members.push(a);
          queue.push(a.id);
        }
      }
    }
    const bySlot = new Map<string, AssistantAgent>();
    for (const m of members) {
      if (m.templateId === id && m.templateNodeKey) bySlot.set(m.templateNodeKey, m);
    }
    const markersMissing = bySlot.size === 0;
    const missing = markersMissing
      ? []
      : template.slots
          .filter((s) => !bySlot.has(s.slotId))
          .map((s) => ({ slotId: s.slotId, name: s.name, description: s.description }));
    const present = [...bySlot.entries()].map(([slotId, a]) => ({ slotId, agentId: a.id ?? "", name: a.name }));
    const extra = members
      .filter((m) => m.id !== root.id && m.templateId !== id)
      .map((m) => ({ agentId: m.id ?? "", name: m.name }));
    return { markersMissing, missing, present, extra };
  },

  /**
   * POST /api/ai/team-templates/:id/apply-missing — materialise SOLO los slots
   * faltantes aceptados por el usuario tras un resync. El padre de cada slot
   * nuevo se resuelve contra los agentes PRESENTES (o los recién creados en
   * esta pasada); si su padre tampoco existe y no fue aceptado, cuelga del
   * root del grupo (documentado en la respuesta del resync). Los agentes
   * "extra" (añadidos a mano) nunca se tocan.
   */
  async applyMissing(id: string, rootAgentId: string, slotIds: string[]): Promise<ApplyResult> {
    const template = findTemplate(id);
    validateTemplate(template);
    const diff = await this.resync(id, rootAgentId);
    if (diff.markersMissing) {
      throw new ValidationError(
        "Este equipo se creó antes del marcado de procedencia (templateId/templateNodeKey); no hay diff fiable que sincronizar.",
      );
    }
    const missingIds = new Set(diff.missing.map((m) => m.slotId));
    const wanted = [...new Set(slotIds)];
    const invalid = wanted.filter((s) => !missingIds.has(s));
    if (invalid.length) {
      throw new ValidationError(`Slots no faltantes o desconocidos para esta plantilla: ${invalid.join(", ")}`);
    }
    // slot → agentId, sembrado con los presentes; los nuevos se añaden al vuelo.
    const slotIdToAgentId = new Map<string, string>(diff.present.map((p) => [p.slotId, p.agentId] as const));
    const ordered = topologicalOrder(template.slots).filter((s) => wanted.includes(s.slotId));
    const created: AssistantAgent[] = [];
    const emptyInput: ApplyInput = {};
    // New members inherit the existing root agent's team so the group stays whole.
    const rootAgent = await agentsRepository.get(rootAgentId);
    const inheritedTeamId = rootAgent?.teamId ?? null;
    for (const slot of ordered) {
      // Presente → recién creado en esta pasada → fallback: root del grupo.
      // Nunca isRoot=true: el grupo YA tiene raíz (rootAgentId).
      const resolvedParentId =
        slot.parentSlotId === null ? rootAgentId : (slotIdToAgentId.get(slot.parentSlotId) ?? rootAgentId);
      const payload = composeCreate(template, slot, emptyInput, resolvedParentId, false, inheritedTeamId);
      try {
        const agent = await agentsRepository.create(payload);
        if (!agent.id) throw new AppError("El repositorio no devolvió id", 500, "TEMPLATE_APPLY_NO_ID");
        slotIdToAgentId.set(slot.slotId, agent.id);
        created.push(agent);
      } catch (err) {
        log.warn(
          { err: (err as Error).message, templateId: id, slotId: slot.slotId, createdCount: created.length },
          "team-templates apply-missing: fallo parcial",
        );
        throw new AppError(
          `Falló la creación del slot '${slot.slotId}'. ${created.length} agente(s) ya creados.`,
          500,
          "TEMPLATE_APPLY_FAILED",
          { createdIds: created.map((a) => a.id).filter(Boolean) as string[] },
        );
      }
    }
    // Connections de los slots nuevos, solo hacia pares existentes.
    for (const slot of ordered) {
      const conns = slot.connectionSlotIds ?? [];
      const myId = slotIdToAgentId.get(slot.slotId);
      if (!myId || conns.length === 0) continue;
      const myConnIds = Array.from(
        new Set(conns.map((c) => slotIdToAgentId.get(c)).filter((x): x is string => Boolean(x))),
      );
      if (myConnIds.length === 0) continue;
      await agentsRepository
        .update(myId, { connections: myConnIds })
        .catch((err) =>
          log.warn({ err: (err as Error).message, slotId: slot.slotId }, "apply-missing: connections no aplicadas"),
        );
    }
    const finalAgents: AssistantAgent[] = [];
    for (const a of created) {
      if (!a.id) continue;
      finalAgents.push((await agentsRepository.get(a.id)) ?? a);
    }
    return { agents: finalAgents, createdIds: created.map((a) => a.id).filter(Boolean) as string[] };
  },
};