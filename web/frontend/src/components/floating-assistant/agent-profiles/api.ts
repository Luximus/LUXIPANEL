import { api, scopeHeaders, resolveTargetScope, type ApiResponse } from "@/lib/api-client";
import { AgentRequestError, type AssistantAgent, type AgentPayload, type AgentProjectAssignment } from "../assistant-api/agents";
import type { GlobalDraft, PublishedProfile, UpdatePreview, ProfileHistory, AuthorProfile } from "./types";
function result<T>(response: ApiResponse<T>): T {
  if (!response.ok || !response.data) throw new AgentRequestError(response.status, response.code, response.error || "No se pudo completar la operación.");
  return response.data;
}
const base = "/api/ai/agent-profiles";
export const profilesApi = {
  async list() { return result(await api.get<{ profiles: GlobalDraft[]; capabilities: { canPublish: boolean } }>(base)); },
  async save(draft: GlobalDraft) { return result(await api.post<{ profile: GlobalDraft }>(base, { id: draft.id, revision: draft.revision, manifest: draft.manifest })).profile; },
  async catalog() { return result(await api.get<{ profiles: PublishedProfile[] }>(`${base}/catalog`)).profiles; },
  async import(input: { source: "local" | "bazaar"; id: string; version: string; projectId: string; requestId: string }) {
    return result(await api.post<{ agent: AssistantAgent }>(`${base}/import`, input)).agent;
  },
  async preview(agentId: string, projectId: string) {
    return result(await api.get<{ preview: UpdatePreview }>(`${base}/update-preview?${new URLSearchParams({ agentId, projectId })}`)).preview;
  },
  async update(agentId: string, projectId: string, preview: UpdatePreview) {
    return result(await api.post(`${base}/update`, { agentId, projectId, revision: preview.revision, hash: preview.incoming.hash, version: preview.incoming.version }));
  },
  async authorList() { return result(await api.post<{ data: AuthorProfile[] }>(`${base}/author/list`, {})).data; },
  async publish(draft: GlobalDraft, version: string) {
    const scope = () => JSON.stringify([resolveTargetScope(), scopeHeaders(true)]);
    const captured = scope();
    const assertScope = () => { if (captured !== scope()) throw new Error("La sesión o el servidor cambiaron. Vuelve a abrir el perfil."); };
    const prior = (await this.authorList()).find(p => p.id === draft.id);
    assertScope();
    const saved = result(await api.post<{ data: AuthorProfile }>(`${base}/author/save`, { id: draft.id, revision: prior?.revision ?? 0, manifest: draft.manifest })).data;
    assertScope();
    return result(await api.post(`${base}/author/submit`, { id: draft.id, revision: saved.revision, version }));
  },
  async history(id: string) { return result(await api.post<{ data: ProfileHistory }>(`${base}/author/reviews`, { id })).data; },
  async visibility(id: string, visibility: "published" | "unpublished") { return result(await api.post(`${base}/author/visibility`, { id, visibility })); },
  async privateGet(id: string, projectId: string) {
    return result(await api.get<{ agent: AssistantAgent; assignment: AgentProjectAssignment }>(`/api/ai/agents/${encodeURIComponent(id)}/project-profile/${encodeURIComponent(projectId)}`));
  },
  async privateSave(id: string, projectId: string, revision: number, data: Partial<AgentPayload>) {
    const { projectIds: _memberships, ...config } = data;
    return result(await api.put<{ agent: AssistantAgent }>(`/api/ai/agents/${encodeURIComponent(id)}/project-profile/${encodeURIComponent(projectId)}`, { revision, config })).agent;
  },
};
