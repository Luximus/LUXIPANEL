import { beforeEach, expect, it, vi } from "vitest";
import { assistantAgentsApi } from "./agents";
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api: mock, unwrap: vi.fn(), resolveTargetScope: () => "target", scopeHeaders: () => ({}) }));
vi.mock("./load-coordinator", () => ({ shareAssistantReads: () => undefined }));
beforeEach(() => vi.resetAllMocks());
it("keeps contextual catalog and effective member queries distinct and encodes search", async () => {
  mock.get.mockResolvedValue({ ok: true, status: 200, data: { ok: true, agents: [] } });
  await assistantAgentsApi.list({ contextProjectId: "p/a", q: "API & SQL", technology: "TypeScript" });
  expect(mock.get).toHaveBeenLastCalledWith("/api/ai/agents?contextProjectId=p%2Fa&q=API+%26+SQL&technology=TypeScript");
  await assistantAgentsApi.list({ projectId: "child" });
  expect(mock.get).toHaveBeenLastCalledWith("/api/ai/agents?projectId=child");
});
it("reads the requested effective assignment without changing project identity", async () => {
  const data = { assignments: [], effective: { projectId: "child", inheritedFrom: "root" } };
  mock.get.mockResolvedValue({ ok: true, status: 200, data });
  await expect(assistantAgentsApi.assignments("agent/a", "child")).resolves.toEqual(data);
  expect(mock.get).toHaveBeenCalledWith("/api/ai/agents/agent%2Fa/assignments?projectId=child");
});
it("incorporates with a link payload and resolves only the confirmed assignment", async () => {
  const assignment = { projectId: "child", status: "active" };
  mock.put.mockResolvedValue({ ok: true, status: 200, data: { ok: true, assignment } });
  await expect(assistantAgentsApi.updateAssignment("worker", "child", { instructions: "Revisar", allowedTools: [] })).resolves.toEqual(assignment);
  expect(mock.put).toHaveBeenCalledExactlyOnceWith("/api/ai/agents/worker/assignments/child", { instructions: "Revisar", allowedTools: [] });
});
it("removes a link without deleting the profile", async () => {
  mock.delete.mockResolvedValue({ ok: true, status: 200, data: { ok: true } });
  await assistantAgentsApi.removeAssignment("worker", "child");
  expect(mock.delete).toHaveBeenCalledExactlyOnceWith("/api/ai/agents/worker/assignments/child");
});
it.each([[403, "ASSISTANT_PROJECT_FORBIDDEN"], [409, "ASSISTANT_ASSIGNMENT_BUSY"], [409, "ASSISTANT_ASSIGNMENT_INHERITED"], [0, undefined]])("preserves structured failure %s/%s without replaying writes", async (status, code) => {
  mock.put.mockResolvedValue({ ok: false, status, code, error: "Mensaje" });
  await expect(assistantAgentsApi.updateAssignment("worker", "child")).rejects.toMatchObject({ status, code, message: "Mensaje" });
  expect(mock.put).toHaveBeenCalledTimes(1);
});

it.each([[0,undefined],[500,undefined],[403,"ASSISTANT_PROJECT_FORBIDDEN"],[409,"TARGET_SCOPE_CHANGED"]])("preserves the creation outcome for safe recovery (%s)",async(status,code)=>{
 mock.post.mockResolvedValue({ok:false,status,code,error:"Fallo"});
 await expect(assistantAgentsApi.create({name:"Perfil",description:"",providerId:"claude",systemPrompt:"",model:"",allowedTools:null})).rejects.toMatchObject({status,code});
 expect(mock.post).toHaveBeenCalledTimes(1);
});
it("treats a successful creation without a returned id as unconfirmed",async()=>{
 mock.post.mockResolvedValue({ok:true,status:201,data:{ok:true}});
 await expect(assistantAgentsApi.create({name:"Perfil",description:"",providerId:"claude",systemPrompt:"",model:"",allowedTools:null})).rejects.toMatchObject({status:0});
 expect(mock.post).toHaveBeenCalledTimes(1);
});
