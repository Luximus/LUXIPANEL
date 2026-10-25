import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Executor } from "../../../shared/executor/index.js";

const state = vi.hoisted(() => ({
  target: { target: { id: "target-A" } } as any, user: { userId: 7, role: "admin" } as any,
  stores: new Map<string, Record<string, any>>(), projects: [] as any[], tasks: [] as any[],
}));
vi.mock("../../../shared/executor/index.js", () => ({
  getContextExecutor: () => state.target, getContextUser: () => state.user, getContextUserId: () => state.user?.userId,
}));
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: (_executor: unknown, module: string, collection: string) => {
    const key = `${state.target.target.id}:${module}:${collection}`;
    const rows = () => { if (!state.stores.has(key)) state.stores.set(key, {}); return state.stores.get(key)!; };
    const clone = <T>(v: T): T => structuredClone(v);
    return {
      list: async () => clone(Object.values(rows())),
      get: async (id: string) => clone(rows()[id] ?? null),
      create: async (data: any) => { rows()[data.id] = clone(data); return clone(data); },
      set: async (id: string, data: any) => { rows()[id] = clone(data); return clone(data); },
      update: async (id: string, patch: any) => {
        if (!rows()[id]) return null;
        rows()[id] = { ...rows()[id], ...clone(patch) }; return clone(rows()[id]);
      },
      transaction: async (fn: any) => { const next = await fn(clone(rows())); state.stores.set(key, clone(next.next)); return clone(next.result); },
    };
  },
}));
vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: { list: async () => state.projects },
  sanitizeServers: (value: any) => value ?? [], sanitizeSnippetCategory: (value: any) => value ?? "",
  sanitizeSnippetTags: (value: any) => value ?? [],
}));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: async () => ({ activeProvider: "claude" }) } }));
vi.mock("./assistant-skills.service.js", () => ({ assistantSkillsService: { sanitizeMap: (x: any) => x ?? {} } }));
vi.mock("../repositories/agent-roles.repository.js", () => ({ agentRolesRepository: { get: async () => null } }));
vi.mock("../repositories/agent-teams.repository.js", () => ({ agentTeamsRepository: { get: async () => null } }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { listActive: async () => state.tasks } }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { listPending: async () => [] } }));
vi.mock("../repositories/agent-activity.repository.js", () => ({ agentActivityRepository: { forAssignment: async () => [] } }));
vi.mock("../repositories/agent-messages.repository.js", () => ({ agentMessagesRepository: { listPending: async () => [] } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { isActive: () => false } }));
vi.mock("./permission-broker.js", () => ({ permissionBroker: { pendingCount: () => 0 } }));
vi.mock("../../../shared/lp-api-key.js", () => ({ lpApiAuthorization: () => "Bearer fixture-only" }));
vi.mock("../../../shared/agent-capability/index.js", () => ({
  agentCapabilityRegistry: {
    list: () => [{ tools: [{ name: "files.read" }] }],
    findTool: (name: string) => name === "files.read" ? { tool: { name } } : undefined,
  },
}));

import { globalAgentProfilesService as service, profileCatalogRequest } from "./global-agent-profiles.service.js";
import { globalAgentManifestSchema, canonicalManifest } from "../models/global-agent-profile.js";
import { agentsRepository } from "../repositories/agents.repository.js";
import { agentMarketService } from "./agent-market.service.js";
import { resolveAgentContext } from "./agent-context.service.js";

const executor = () => state.target as Executor;
const manifest = () => globalAgentManifestSchema.parse({
  schemaVersion: 1, name: "API specialist", description: "", specialty: "Backend",
  technologies: ["TypeScript"], knowledge: "HTTP", systemPrompt: "Explain decisions.",
  allowedTools: ["files.read", "future.safe-tool"],
});
const input = { id: "global-a", source: "local" as const, version: "1.0.1", projectId: "A", requestId: "agent-a" };
beforeEach(() => {
  vi.unstubAllGlobals();
  state.target = { target: { id: "target-A" } }; state.user = { userId: 7, role: "admin" };
  state.stores.clear(); state.tasks = [];
  state.projects = ["A", "B"].map(id => ({ id, ownerId: 7, title: id, path: `/project-${id}`, servers: [] }));
});
describe("private adaptations with a versioned global source", () => {
  it("imports independently, retries once and rejects reuse for a different project", async () => {
    await service.save(executor(), input.id, 0, manifest());
    const [a, again] = await Promise.all([service.import(executor(), input), service.import(executor(), input)]);
    expect(a.id).toBe(again.id);
    await expect(service.import(executor(), { ...input, projectId: "B" })).rejects.toMatchObject({ statusCode: 409 });
    const b = await service.import(executor(), { ...input, projectId: "B", requestId: "agent-b" });
    await agentMarketService.putPrivate(executor(), a.id!, "A", 1, { model: "private-model", systemPrompt: "Only project A", allowedTools: a.allowedTools });
    expect((await resolveAgentContext(executor(), a.id, "A")).agent).toMatchObject({ model: "private-model", allowedTools: ["files.read"] });
    expect((await resolveAgentContext(executor(), b.id, "B")).agent?.model).toBe("");
    expect((await service.list())[0]!.manifest).toEqual(manifest());
    expect(JSON.stringify(await service.list())).not.toContain("Only project A");
  });
  it("does not apply updates until requested and keeps private model, paths and prompt", async () => {
    await service.save(executor(), input.id, 0, manifest());
    await service.import(executor(), input);
    await agentMarketService.putPrivate(executor(), "agent-a", "A", 1, { model: "private-model", projectPaths: ["/project-A"], systemPrompt: "Private prompt", knowledge: "Private knowledge" });
    await service.save(executor(), input.id, 1, { ...manifest(), name: "Updated name", knowledge: "Global update" });
    expect((await resolveAgentContext(executor(), "agent-a", "A")).agent?.name).toBe("API specialist");
    const preview = await service.preview(executor(), "agent-a", "A");
    expect(preview.preserved).toContain("knowledge");
    await expect(service.update(executor(), "agent-a", "A", 1, preview.incoming.hash, preview.incoming.version)).rejects.toMatchObject({ statusCode: 409 });
    await service.update(executor(), "agent-a", "A", preview.revision, preview.incoming.hash, preview.incoming.version);
    const effective = (await resolveAgentContext(executor(), "agent-a", "A")).agent!;
    expect(effective).toMatchObject({ name: "Updated name", model: "private-model", projectPaths: ["/project-A"] });
    expect(effective.systemPrompt).toBe("Private prompt\n\nPrivate knowledge");
    expect(await service.update(executor(), "agent-a", "A", preview.revision, preview.incoming.hash, preview.incoming.version)).toMatchObject({ updated: false });
  });
  it("rejects other identities, projects and targets", async () => {
    await service.save(executor(), input.id, 0, manifest()); await service.import(executor(), input);
    state.user = { userId: 9, role: "user" };
    expect(await service.list()).toEqual([]);
    await expect(service.preview(executor(), "agent-a", "A")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.source("local", input.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.author("list", {})).rejects.toMatchObject({ statusCode: 403 });
    state.user = { userId: 7, role: "admin" };
    await expect(agentMarketService.putPrivate(executor(), "agent-a", "B", 1, { model: "bad" })).rejects.toMatchObject({ statusCode: 409 });
    const original = executor(); state.target = { target: { id: "target-B" } };
    expect(await service.list()).toEqual([]);
    await expect(service.save(original, "x", 0, manifest())).rejects.toMatchObject({ statusCode: 403 });
  });
  it("backs up a legacy agent once, freezes each project and defers busy agents", async () => {
    const old = { id: "legacy", ownerId: 7, name: "Legacy", description: "", providerId: "claude" as const, model: "old", systemPrompt: "Private legacy", allowedTools: null, projectIds: ["A", "B"], parentAgentId: null, credential: { username: "qa", secret: "fixture-only" } };
    state.stores.set("target-A:assistant:agents", { legacy: old });
    state.tasks = [{ workerAgentId: "legacy", projectId: "A" }];
    expect(await service.migrate(executor())).toEqual({ migrated: 0, deferred: 1 });
    expect(await agentsRepository.get("legacy")).toEqual(old);
    state.tasks = [];
    expect(await service.migrate(executor())).toEqual({ migrated: 1, deferred: 0 });
    expect(await service.migrate(executor())).toEqual({ migrated: 0, deferred: 0 });
    expect(state.stores.get("target-A:assistant:agent-profile-migration-backups")?.legacy).toEqual(old);
    await agentMarketService.putPrivate(executor(), "legacy", "A", 1, { model: "new" });
    expect((await resolveAgentContext(executor(), "legacy", "B")).agent?.model).toBe("old");
    expect((await resolveAgentContext(executor(), "legacy", "A")).agent?.model).toBe("new");
    expect(await service.list()).toEqual([]);
  });
  it("keeps private execution available when the catalog is offline and rejects altered manifests", async () => {
    await service.save(executor(), input.id, 0, manifest()); await service.import(executor(), input);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("fixture", "TimeoutError")));
    await expect(service.catalog()).rejects.toThrow("no respondió a tiempo");
    expect((await resolveAgentContext(executor(), "agent-a", "A")).agent?.name).toBe("API specialist");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [{ id: "remote", version: "1.0.0", hash: "0".repeat(64), manifest: manifest() }] }))));
    await expect(service.source("bazaar", "remote")).rejects.toThrow("integridad");
  });
  it("rejects a catalog response for another identity or pinned version", async () => {
    const m = manifest(), hash = createHash("sha256").update(canonicalManifest(m)).digest("hex");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [{ id: "wrong", version: "1.0.0", hash, manifest: m }] })));
    vi.stubGlobal("fetch", fetch);
    await expect(service.source("bazaar", "remote", "1.0.0")).rejects.toThrow("identidad");
    fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, data: [{ id: "remote", version: "2.0.0", hash, manifest: m }] })));
    await expect(service.source("bazaar", "remote", "1.0.0")).rejects.toThrow("versión");
  });
  it("preserves both legacy and explicit hierarchy during migration", async () => {
    const base = { ownerId: 7, name: "Old", description: "", providerId: "claude" as const, model: "", systemPrompt: "", allowedTools: null, projectIds: ["A"], teamId: "legacy-team", parentAgentId: null };
    state.projects[0].leaderAgentId = "leader";
    state.stores.set("target-A:assistant:agents", {
      legacy: { ...base, id: "legacy" },
      explicit: { ...base, id: "explicit", assignments: [{ projectId: "A", status: "active" }] },
      leader: { ...base, id: "leader" },
    });
    const before = await Promise.all(["legacy", "explicit"].map(id => resolveAgentContext(executor(), id, "A")));
    expect(before.map(x => [x.agent?.parentAgentId, x.agent?.teamId])).toEqual([[null, "legacy-team"], ["leader", null]]);
    await service.migrate(executor());
    const after = await Promise.all(["legacy", "explicit"].map(id => resolveAgentContext(executor(), id, "A")));
    expect(after.map(x => [x.agent?.parentAgentId, x.agent?.teamId])).toEqual(before.map(x => [x.agent?.parentAgentId, x.agent?.teamId]));
  });
  it("forks an inherited adaptation without losing its pinned source or restrictions", async () => {
    state.projects[1].parentId = "A";
    await service.save(executor(), input.id, 0, manifest()); await service.import(executor(), input);
    await agentMarketService.putPrivate(executor(), "agent-a", "A", 1, { model: "inherited-model", knowledge: "Private knowledge" });
    await agentMarketService.put(executor(), "agent-a", "B", { instructions: "Child instructions" });
    const child = (await agentsRepository.get("agent-a"))?.assignments?.find(a => a.projectId === "B");
    expect(child?.sourceProfile?.id).toBe(input.id);
    expect(child?.privateConfig).toMatchObject({ model: "inherited-model", knowledge: "Private knowledge" });
    await agentMarketService.putPrivate(executor(), "agent-a", "B", 1, { model: "child-model" });
    expect((await resolveAgentContext(executor(), "agent-a", "A")).agent?.model).toBe("inherited-model");
    expect((await resolveAgentContext(executor(), "agent-a", "B")).agent?.model).toBe("child-model");
    const shown = await agentMarketService.present(executor(), (await agentsRepository.get("agent-a"))!, undefined, { contextProjectId: "A" });
    expect(JSON.stringify(shown)).not.toContain("child-model");
    expect(shown.assignments.map(a => a.projectId)).toEqual(["A", "B"]);
  });
  it("advances an approved version even when the manifest hash did not change", async () => {
    const m = manifest(), hash = createHash("sha256").update(canonicalManifest(m)).digest("hex");
    let version = "1.0.0";
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, data: [{ id: "remote", version, hash, manifest: m }] })))));
    await service.import(executor(), { ...input, source: "bazaar", id: "remote", version });
    version = "1.0.1";
    const preview = await service.preview(executor(), "agent-a", "A");
    await service.update(executor(), "agent-a", "A", 1, hash, version);
    expect((await agentsRepository.get("agent-a"))?.assignments?.[0]?.sourceProfile?.version).toBe("1.0.1");
    expect(preview.current.hash).toBe(preview.incoming.hash);
  });
  it.each([["ECONNREFUSED", "rechazó la conexión"], ["ENOTFOUND", "No se pudo conectar"]])("reports %s without inventing a timeout", async (code, message) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("fixture"), { cause: { code } })));
    await expect(profileCatalogRequest("agent-profiles", {})).rejects.toThrow(message);
  });
});
