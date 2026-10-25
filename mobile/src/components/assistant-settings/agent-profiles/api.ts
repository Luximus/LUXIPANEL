import { callServerApi, getDirectSessionRevision } from "../../../api/serverApi";
import { ensureDirectPanelSession } from "../../../api/terminalSession";
import { invalidateAssistantReads } from "../../../api/client/assistant";
import type { AgentPayload, AssistantAgent } from "../types";
import type { GlobalDraft, PublishedProfile, UpdatePreview, AuthorProfile, ProfileHistory } from "./types";

export function mobileProfilesApi(panelId: string, token: string) {
  let scope: number | undefined;
  async function request<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
    if (scope !== undefined && scope !== getDirectSessionRevision(panelId)) throw new Error("La sesión cambió. Vuelve a abrir el perfil.");
    if (!await ensureDirectPanelSession(panelId, token)) throw new Error("Conecta la sesión del servidor.");
    const revision = getDirectSessionRevision(panelId);
    scope ??= revision;
    if (scope !== revision) throw new Error("La sesión cambió. Vuelve a abrir el perfil.");
    const response = await callServerApi<T>(panelId, token, method, path, body);
    if (getDirectSessionRevision(panelId) !== revision) throw new Error("La sesión cambió. Vuelve a abrir el perfil.");
    if (!response.ok || !response.data) throw new Error(response.error || "No se pudo confirmar el resultado. Vuelve a consultar su estado.");
    if (method !== "GET") invalidateAssistantReads();
    return response.data as T;
  }
  const base = "/api/ai/agent-profiles";
  return {
    list: () => request<{ profiles: GlobalDraft[]; capabilities: { canPublish: boolean } }>("GET", base),
    catalog: async () => (await request<{ profiles: PublishedProfile[] }>("GET", `${base}/catalog`)).profiles,
    save: async (draft: GlobalDraft) => (await request<{ profile: GlobalDraft }>("POST", base, { id: draft.id, revision: draft.revision, manifest: draft.manifest })).profile,
    import: async (input: { id: string; version: string; source: "local" | "bazaar"; projectId: string; requestId: string }) =>
      (await request<{ agent: AssistantAgent }>("POST", `${base}/import`, input)).agent,
    preview: async (agentId: string, projectId: string) =>
      (await request<{ preview: UpdatePreview }>("GET", `${base}/update-preview?agentId=${encodeURIComponent(agentId)}&projectId=${encodeURIComponent(projectId)}`)).preview,
    update: (agentId: string, projectId: string, preview: UpdatePreview) => request("POST", `${base}/update`, { agentId, projectId, revision: preview.revision, hash: preview.incoming.hash, version: preview.incoming.version }),
    publish: async (draft: GlobalDraft, version: string) => {
      const prior = (await request<{ data: AuthorProfile[] }>("POST", `${base}/author/list`, {})).data.find(p => p.id === draft.id);
      const saved = (await request<{ data: AuthorProfile }>("POST", `${base}/author/save`, { id: draft.id, revision: prior?.revision ?? 0, manifest: draft.manifest })).data;
      return request("POST", `${base}/author/submit`, { id: saved.id, revision: saved.revision, version });
    },
    history: async (id: string) => (await request<{ data: ProfileHistory }>("POST", `${base}/author/reviews`, { id })).data,
    visibility: (id: string, visibility: "published" | "unpublished") => request("POST", `${base}/author/visibility`, { id, visibility }),
    privateGet: (id: string, projectId: string) => request<{ agent: AssistantAgent; assignment: { revision?: number; inheritedFrom?: string | null } }>("GET", `/api/ai/agents/${id}/project-profile/${projectId}`),
    privateSave: async (id: string, projectId: string, revision: number, data: Partial<AgentPayload>) => {
      const { projectIds: _links, ...config } = data;
      return (await request<{ agent: AssistantAgent }>("PUT", `/api/ai/agents/${id}/project-profile/${projectId}`, { revision, config })).agent;
    },
  };
}
