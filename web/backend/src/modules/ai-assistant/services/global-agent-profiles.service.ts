// SPDX-License-Identifier: AGPL-3.0-only
import { createHash } from "node:crypto";
import { dataStore } from "../../../shared/data-store/index.js";
import { getContextUserId, getContextUser, type Executor } from "../../../shared/executor/index.js";
import { env } from "../../../config/env.js";
import { lpApiAuthorization } from "../../../shared/lp-api-key.js";
import { AppError, ValidationError } from "../../../shared/errors/index.js";
import { canonicalManifest, globalAgentManifestSchema, mergeProfileUpdate, publicProfileIssues,
  type GlobalAgentManifest, type ImportedAgentProfile, type PublishedAgentProfile } from "../models/global-agent-profile.js";
import { agentAssignments, privateAgentConfig, type AssistantAgent } from "../models/assistant-agent.types.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { projectsRepository } from "../repositories/projects.repository.js";
import { assistantConfigRepository } from "../repositories/assistant-config.repository.js";
import { assertProjectScope, assignmentError, effectiveAssignment, mayUseProject } from "./agent-context.service.js";
import { assertAssignmentTarget, withAssignmentLock } from "./agent-assignment-lock.js";
import { assertAssignmentIdle } from "./agent-market.service.js";

export interface GlobalProfileDraft {
  id: string; ownerId: number; revision: number; manifest: GlobalAgentManifest; updatedAt?: string;
}
const drafts = () => dataStore<GlobalProfileDraft>(undefined, "assistant", "global-agent-profiles", { idStrategy: "uuid" });
const hash = (manifest: GlobalAgentManifest) => createHash("sha256").update(canonicalManifest(manifest)).digest("hex");
const owner = () => {
  const id = getContextUserId();
  if (id == null) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Se requiere una sesión de usuario.", 403);
  return id;
};
export async function profileCatalogRequest<T>(path: string, input: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.LICENSE_SERVER_URL.replace(/\/$/, "")}/panel-api/${path}`, {
      method: "POST", headers: { Authorization: lpApiAuthorization(), "Content-Type": "application/json" },
      body: JSON.stringify(input), signal: AbortSignal.timeout(15000), cache: "no-store",
    });
  } catch (error) {
    const reason = error as { name?: string; cause?: { code?: string } };
    const message = reason.name === "TimeoutError" || reason.name === "AbortError"
      ? "El catálogo no respondió a tiempo. Consulta su estado antes de repetir un envío."
      : reason.cause?.code === "ECONNREFUSED" ? "El catálogo rechazó la conexión. Comprueba que el servicio esté escuchando."
      : "No se pudo conectar con el catálogo. Comprueba la dirección configurada y la conexión antes de repetir un envío.";
    throw new AppError(`${message} Tus agentes privados siguen disponibles.`, 503, "SERVICE_UNAVAILABLE");
  }
  const body = await response.json().catch(() => null) as { ok?: boolean; data?: T; error?: string } | null;
  if (!response.ok || !body?.ok) throw new AppError(
    response.status === 401 ? "El catálogo rechazó las credenciales de esta instalación. Revisa su vinculación." :
    response.status === 403 ? "La cuenta vinculada no tiene permiso para esta operación del catálogo." :
    response.status === 404 ? "Esta instalación del catálogo aún no admite perfiles de agentes." :
    body?.error || "No se pudo consultar el catálogo.", response.status >= 400 ? response.status : 502, "SERVICE_UNAVAILABLE");
  return body.data as T;
}
function portableFromPrivate(agent: AssistantAgent): GlobalAgentManifest {
  return globalAgentManifestSchema.parse({
    schemaVersion: 1, name: agent.name, description: agent.description, specialty: agent.specialty ?? "",
    technologies: agent.technologies ?? [], knowledge: agent.knowledge ?? "", systemPrompt: agent.systemPrompt,
    allowedTools: agent.allowedTools, icon: agent.icon, color: agent.color, avatarConfig: agent.avatarConfig,
  });
}
export const globalAgentProfilesService = {
  async list() { const uid = owner(); return (await drafts().list()).filter(p => p.ownerId === uid); },
  async save(executor: Executor, id: string, revision: number, value: GlobalAgentManifest) {
    const uid = owner();
    const manifest = globalAgentManifestSchema.parse(value);
    const issues = publicProfileIssues(manifest);
    if (issues.length) throw new ValidationError(issues.join(" "));
    return withAssignmentLock(executor, `global-profile:${uid}:${id}`, () => drafts().transaction(async rows => {
      const prior = rows[id];
      if (prior && prior.ownerId !== uid) throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Perfil no disponible.", 404);
      if (prior && canonicalManifest(prior.manifest) === canonicalManifest(manifest)) return { next: rows, result: prior };
      if (prior ? prior.revision !== revision : revision !== 0) throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "El borrador cambió. Recarga antes de guardar.");
      const result: GlobalProfileDraft = { id, ownerId: uid, manifest, revision: revision + 1, updatedAt: new Date().toISOString() };
      return { next: { ...rows, [id]: result }, result };
    }));
  },
  async catalog() { owner(); return profileCatalogRequest<PublishedAgentProfile[]>("agent-profiles", {}); },
  async source(source: "local" | "bazaar", id: string, version?: string): Promise<ImportedAgentProfile> {
    if (source === "local") {
      const draft = await drafts().get(id);
      if (!draft || draft.ownerId !== owner()) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Perfil no disponible.", 404);
      const current = `1.0.${draft.revision}`;
      if (version && version !== current) throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "El perfil cambió; revisa la nueva versión.");
      return { source, id, version: current, hash: hash(draft.manifest), snapshot: draft.manifest };
    }
    const [profile] = await profileCatalogRequest<PublishedAgentProfile[]>("agent-profiles", { id, ...(version ? { version } : {}) });
    if (!profile) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "El perfil ya no está publicado.", 404);
    const manifest = globalAgentManifestSchema.parse(profile.manifest);
    if (profile.id !== id || (version && profile.version !== version) || hash(manifest) !== profile.hash) {
      throw new ValidationError("No se pudo verificar la identidad, versión o integridad del perfil.");
    }
    return { source, id, version: profile.version, hash: profile.hash, snapshot: manifest };
  },
  async import(executor: Executor, input: { source: "local" | "bazaar"; id: string; version: string; projectId: string; requestId: string }) {
    const uid = owner();
    assertProjectScope(await projectsRepository.list(executor), input.projectId);
    return withAssignmentLock(executor, input.requestId, async () => {
      const prior = await agentsRepository.get(input.requestId);
      if (prior) {
        const assignment = prior.assignments?.find(a => a.projectId === input.projectId);
        if (prior.ownerId === uid && assignment?.sourceProfile?.id === input.id && assignment.sourceProfile.source === input.source && assignment.sourceProfile.version === input.version) return prior;
        throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "Esta solicitud ya se utilizó.");
      }
      const source = await this.source(input.source, input.id, input.version);
      const { schemaVersion: _version, ...portable } = source.snapshot;
      const config = await assistantConfigRepository.load(executor);
      const data = { ...portable, providerId: config.activeProvider, model: "", projectIds: [input.projectId] };
      const now = new Date().toISOString();
      return agentsRepository.create(data, { id: input.requestId, assignments: [{
        projectId: input.projectId, status: "active", sourceProfile: source, privateConfig: privateAgentConfig(data),
        revision: 1, createdAt: now, updatedAt: now,
      }] });
    });
  },
  async preview(executor: Executor, agentId: string, projectId: string) {
    assertAssignmentTarget(executor);
    const agent = await agentsRepository.get(agentId);
    if (!agent || !mayUseProject(agent)) throw assignmentError("ASSISTANT_AGENT_NOT_FOUND", "Agente no disponible.", 404);
    const all = await projectsRepository.list(executor);
    assertProjectScope(all, projectId);
    const assignment = effectiveAssignment(agent, all, projectId);
    if (!assignment?.sourceProfile) throw new ValidationError("Este agente no procede de un perfil global.");
    const incoming = await this.source(assignment.sourceProfile.source, assignment.sourceProfile.id);
    const current = portableFromPrivate({ ...agent, ...assignment.privateConfig });
    return { current: assignment.sourceProfile, incoming,
      revision: assignment.revision ?? 1, inheritedFrom: assignment.inheritedFrom,
      ...mergeProfileUpdate(current, assignment.sourceProfile.snapshot, incoming.snapshot) };
  },
  async update(executor: Executor, agentId: string, projectId: string, expectedRevision: number, expectedHash: string, expectedVersion: string) {
    return withAssignmentLock(executor, agentId, async () => {
      const preview = await this.preview(executor, agentId, projectId);
      if (preview.inheritedFrom) throw assignmentError("ASSISTANT_ASSIGNMENT_INHERITED", "Actualiza desde el proyecto de origen.");
      if (preview.incoming.hash !== expectedHash || preview.incoming.version !== expectedVersion) throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "El perfil cambió. Revisa nuevamente las diferencias.");
      if (preview.current.hash === expectedHash && preview.current.version === expectedVersion) return { updated: false, preserved: preview.preserved };
      if (preview.revision !== expectedRevision) throw assignmentError("ASSISTANT_CONTEXT_MISMATCH", "La adaptación privada cambió. Revisa nuevamente.");
      const agent = (await agentsRepository.get(agentId))!;
      await assertAssignmentIdle(executor, agent, [projectId]);
      const { schemaVersion: _schema, ...portable } = preview.manifest;
      const assignments = agentAssignments(agent).map(({ source: _source, ...a }) => a.projectId === projectId ? {
        ...a, privateConfig: { ...privateAgentConfig(agent), ...a.privateConfig, ...portable },
        ...(JSON.stringify(a.allowedTools) === JSON.stringify(preview.current.snapshot.allowedTools) ? { allowedTools: portable.allowedTools } : {}),
        sourceProfile: preview.incoming, revision: preview.revision + 1, updatedAt: new Date().toISOString(),
      } : a);
      await agentsRepository.setAssignments(agentId, assignments, agent.projectIds ?? []);
      return { updated: true, preserved: preview.preserved };
    });
  },
  async author(action: "list" | "save" | "submit" | "visibility" | "reviews", input: Record<string, unknown>) {
    // Installation credential belongs to the installation administrator, never a project author.
    if (getContextUser()?.role !== "admin") throw assignmentError("ASSISTANT_PROJECT_FORBIDDEN", "Publicar requiere administrar la cuenta vinculada al catálogo.", 403);
    return profileCatalogRequest(`service/dev/agent-profiles/${action}`, input);
  },
  async migrate(executor: Executor) {
    const result = { migrated: 0, deferred: 0 };
    for (const agent of (await agentsRepository.list()).filter(a => mayUseProject(a) && a.profileSchemaVersion !== 1)) {
      await withAssignmentLock(executor, agent.id!, async () => {
        try {
          await assertAssignmentIdle(executor, agent, agent.projectIds ?? []);
          await agentsRepository.migratePrivate(agent); result.migrated++;
        } catch (error) {
          if (!(error instanceof AppError) || error.code !== "ASSISTANT_ASSIGNMENT_BUSY") throw error;
          result.deferred++;
        }
      });
    }
    return result;
  },
};
