// SPDX-License-Identifier: AGPL-3.0-only
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor, getContextUser } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { globalAgentManifestSchema, profileVersionSchema } from "../models/global-agent-profile.js";
import { globalAgentProfilesService as service } from "../services/global-agent-profiles.service.js";
import { agentMarketService } from "../services/agent-market.service.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { privateAgentUpdateSchema, redactAgent } from "./agents.controller.js";
import { mayUseProject, assertProjectScope, effectiveAssignment } from "../services/agent-context.service.js";
import { projectsRepository } from "../repositories/projects.repository.js";

const id = z.string().uuid();
const revision = z.number().int().nonnegative();
const ref = z.object({ id }).strict();
const save = z.object({ id, revision, manifest: globalAgentManifestSchema }).strict();
const importSchema = z.object({ id, source: z.enum(["local", "bazaar"]), version: profileVersionSchema, projectId: id, requestId: id }).strict();
function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ValidationError("Datos del perfil no válidos.");
  return parsed.data;
}
export const globalAgentProfilesController = {
  list: asyncHandler(async (_req, res) => { res.json({ ok: true, profiles: await service.list(),
    capabilities: { schemaVersion: 1, canPublish: getContextUser()?.role === "admin" } }); }),
  save: asyncHandler(async (req, res) => {
    const input = parse(save, req.body);
    res.json({ ok: true, profile: await service.save(getExecutor(req), input.id, input.revision, input.manifest) });
  }),
  catalog: asyncHandler(async (_req, res) => { res.json({ ok: true, profiles: await service.catalog() }); }),
  import: asyncHandler(async (req, res) => {
    res.json({ ok: true, agent: redactAgent(await service.import(getExecutor(req), parse(importSchema, req.body))) });
  }),
  preview: asyncHandler(async (req, res) => {
    const { agentId, projectId } = parse(z.object({ agentId: id, projectId: id }), req.query);
    res.json({ ok: true, preview: await service.preview(getExecutor(req), agentId, projectId) });
  }),
  update: asyncHandler(async (req, res) => {
    const input = parse(z.object({ agentId: id, projectId: id, revision, version: profileVersionSchema, hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(), req.body);
    res.json({ ok: true, ...await service.update(getExecutor(req), input.agentId, input.projectId, input.revision, input.hash, input.version) });
  }),
  migrate: asyncHandler(async (req, res) => { res.json({ ok: true, ...await service.migrate(getExecutor(req)) }); }),
  author: asyncHandler(async (req, res) => {
    const action = parse(z.enum(["list", "save", "submit", "visibility", "reviews"]), req.params["action"]);
    const schemas = {
      list: z.object({}).strict(), save,
      submit: z.object({ id, revision, version: profileVersionSchema }).strict(),
      visibility: z.object({ id, visibility: z.enum(["published", "unpublished"]) }).strict(), reviews: ref,
    };
    const input = parse(schemas[action], req.body ?? {});
    res.json({ ok: true, data: await service.author(action, input) });
  }),
  privateGet: asyncHandler(async (req, res) => {
    const agent = await agentsRepository.get(String(req.params["id"]));
    if (!agent || !mayUseProject(agent)) throw new ValidationError("Agente no disponible.");
    const projectId = String(req.params["projectId"]);
    const all = await projectsRepository.list(getExecutor(req));
    assertProjectScope(all, projectId);
    const assignment = effectiveAssignment(agent, all, projectId);
    if (!assignment) throw new ValidationError("El agente no está asignado.");
    const origin = assignment.inheritedFrom || projectId;
    res.json({ ok: true, agent: redactAgent({ ...agent, ...assignment.privateConfig, projectIds: [origin],
      assignments: [{ ...assignment, projectId: origin }] }), assignment: redactAgent(assignment) });
  }),
  privateSave: asyncHandler(async (req, res) => {
    const input = parse(z.object({ revision, config: privateAgentUpdateSchema.omit({ projectIds: true }).strict() }).strict(), req.body);
    const agent = await agentMarketService.putPrivate(getExecutor(req), String(req.params["id"]), String(req.params["projectId"]), input.revision, input.config);
    res.json({ ok: true, agent: redactAgent(await agentMarketService.present(getExecutor(req), agent, undefined,
      { contextProjectId: String(req.params["projectId"]) })) });
  }),
};
