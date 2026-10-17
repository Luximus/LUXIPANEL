import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  sockets: [] as any[], cfg: { enabled: true, voice: { enabled: true, realtimeEnabled: true }, providers: { codex: { api: { apiKey: "private-test-key" } } } },
  meta: vi.fn(), projects: vi.fn(), agents: vi.fn(), messages: vi.fn(), enqueue: vi.fn(), update: vi.fn(), dispatch: vi.fn(), assign: vi.fn(), list: vi.fn(), record: vi.fn(), append: vi.fn(), validate: vi.fn(),
}));
vi.mock("ws", async () => {
  const { EventEmitter } = await import("node:events");
  return { default: class extends EventEmitter {
    static OPEN = 1; readyState = 1; sent: any[] = [];
    constructor() { super(); m.sockets.push(this); queueMicrotask(() => this.emit("open")); }
    send(data: string) { const event=JSON.parse(data); this.sent.push(event); if(event.type==="session.update")queueMicrotask(()=>this.emit("message",Buffer.from(JSON.stringify({type:"session.updated"})))); }
    close() { this.readyState = 3; this.emit("close"); }
  }};
});
vi.mock("../../../shared/executor/context.js", () => ({ getContextUserId: () => 1, getContextExecutor: () => ({ target: { id: "target-a" } }), runWithExecutor: (_e: unknown, fn: () => unknown) => fn() }));
vi.mock("./execution-scope.js", () => ({ executionKey: (id: string, target: string) => JSON.stringify([target, id]) }));
vi.mock("../repositories/assistant-config.repository.js", () => ({ assistantConfigRepository: { load: () => m.cfg } }));
vi.mock("../repositories/projects.repository.js", () => ({ projectsRepository: { list: m.projects } }));
vi.mock("../repositories/agents.repository.js", () => ({ agentsRepository: {
  list: m.agents,
  get: async (id: string) => (await m.agents()).find((a: any) => a.id === id) ?? null,
} }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: {
  listIds: async () => new Set(["chat"]), getMeta: m.meta, messages: m.messages, appendMessages: m.append, patchRuntime: vi.fn(),
} }));
vi.mock("../repositories/usage.repository.js", () => ({ usageRepository: { record: m.record } }));
vi.mock("./team-tasks.service.js", () => ({ teamTasksService: { assignTask: m.assign, listForLeaderConversation: m.list, cancelTask: vi.fn() }, validateWorkerProject: m.validate }));
vi.mock("../repositories/team-tasks.repository.js", () => ({ teamTasksRepository: { updateTask: m.update } }));
vi.mock("../repositories/agent-queue.repository.js", () => ({ agentQueueRepository: { enqueue: m.enqueue } }));
vi.mock("./team-tasks/lifecycle.js", () => ({ deferDispatch: m.dispatch }));
vi.mock("./turn-queue.service.js", () => ({drainConversationQueue:vi.fn(async()=>{})}));
vi.mock("./agent.service.js", () => ({ agentService: { run: vi.fn() } }));
vi.mock("./agent-run-registry.js", () => ({ agentRunRegistry: { attach: vi.fn(), runContext: vi.fn() } }));
import { realtimeService } from "./realtime.service.js";
const executor = { target: { id: "target-a" } } as any;
const user = { userId: 1, role: "admin" } as any;
const input = { conversationId: "chat", sdp: "offer-sdp", panelOrigin: "https://panel.example" };
let id: string | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  m.meta.mockResolvedValue({projectId:"p1"});
  m.projects.mockResolvedValue([{id:"p1",title:"Uno",ownerId:1},{id:"private",ownerId:2}]);
  m.agents.mockResolvedValue([{id:"a1",name:"Worker",ownerId:1,teamId:"t1",projectIds:["p1"]}]);
  m.messages.mockResolvedValue({ items: [] }); m.enqueue.mockResolvedValue({id:"q1"}); m.sockets.length = 0; m.list.mockResolvedValue([]); m.record.mockResolvedValue(undefined); m.append.mockResolvedValue(undefined);
  m.assign.mockResolvedValue({ id: "task1", workerConversationId: "worker1", status: "pending" });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/hangup") ? new Response(null, { status: 200 }) :
    new Response("answer-sdp", { status: 201, headers: { location: "/v1/realtime/calls/rtc_test" } })));
});
afterEach(async () => { if (id) await realtimeService.stop(id, executor, user); id = undefined; vi.unstubAllGlobals(); });
it("keeps the key private, scopes ownership and rejects another controller", async () => {
  const result = await realtimeService.start(executor, user, input); id = result.id;
  expect(JSON.stringify(result)).not.toContain("private-test-key");
  expect(() => realtimeService.snapshot(id!, executor, { ...user, userId: 2 }, 0)).toThrow();
  expect(() => realtimeService.snapshot(id!, { target: { id: "other" } } as any, user, 0)).toThrow();
  await expect(realtimeService.start(executor, user, input)).rejects.toThrow("ya tiene");
});
it("rejects an unauthorized project before opening OpenAI", async () => {
  m.meta.mockResolvedValue({projectId:"private"});
  await expect(realtimeService.start(executor, user, input)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("delegates once per tool call and never exposes an approval tool", async () => {
  const result = await realtimeService.start(executor, user, input); id = result.id;
  const socket = m.sockets[0];
  const event = { type: "response.function_call_arguments.done", call_id: "call-1", name: "task_assign",
    arguments: JSON.stringify({ projectId: "p1", agentId: "a1", title: "Revisar", task: "Revisar nginx" }) };
  socket.emit("message", Buffer.from(JSON.stringify(event)));
  socket.emit("message", Buffer.from(JSON.stringify(event)));
  await vi.waitFor(() => expect(m.assign).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(socket.sent.some((e: any) => e.item?.call_id === "call-1")).toBe(true));
  expect(m.assign.mock.calls[0][0]).toMatchObject({ projectId: "p1", leaderConversationId: "chat", executor, user });
  socket.emit("message", Buffer.from(JSON.stringify({ ...event, call_id: "call-2", name: "permission_approve" })));
  await vi.waitFor(() => expect(socket.sent.find((e: any) => e.item?.call_id === "call-2")?.item.output).toContain("no permitida"));
});
it("stores each transcription once and records provider usage once", async () => {
  id = (await realtimeService.start(executor, user, input)).id;
  const socket = m.sockets[0];
  const e = { type: "conversation.item.input_audio_transcription.completed", item_id: "item1", transcript: "Revisa el servidor" };
  socket.emit("message", Buffer.from(JSON.stringify(e))); socket.emit("message", Buffer.from(JSON.stringify(e)));
  const u = { type: "response.done", response: { id: "r1", usage: { input_tokens: 20, output_tokens: 10 } } };
  socket.emit("message", Buffer.from(JSON.stringify(u))); socket.emit("message", Buffer.from(JSON.stringify(u)));
  await vi.waitFor(() => expect(m.append).toHaveBeenCalledTimes(1));
  expect(m.record).toHaveBeenCalledTimes(1);
});

it("only queues an exact pending button choice once, preserving worker scope", async () => {
  // A worker has its own persisted binding; it is not the leader's general chat.
  m.meta.mockImplementation(async (_executor, conversationId) => conversationId === "worker1"
    ? { agentId: "a1", projectId: "p1", messageCount: 2 } : { projectId: "p1" });
  id = (await realtimeService.start(executor, user, input)).id;
  m.list.mockResolvedValue([{id:"task1", status:"pending", pendingPermission:true, workerAgentId:"a1", workerConversationId:"worker1", projectId:"p1", isolation:{cwd:"/isolated",leasePath:"/resource"}}]);
  m.messages.mockResolvedValue({items:[{role:"assistant",ts:"ts1",askKind:"plan-approval",ask:[{id:"plan",type:"single",text:"¿Aprobar?",options:["Aprobar","Cambios"]}]}]});
  await expect(realtimeService.answer(id,executor,user,"task1","stale",0)).rejects.toThrow();
  expect(m.enqueue).not.toHaveBeenCalled();
  await realtimeService.answer(id,executor,user,"task1","ts1",0);
  expect(m.enqueue).toHaveBeenCalledWith(executor,expect.objectContaining({conversationId:"worker1",projectId:"p1",forcedCwd:"/isolated",isWorker:true,planDecision:"approve",user}));
  expect(m.dispatch).toHaveBeenCalledWith(expect.objectContaining({executor,taskId:"task1",leasePath:"/resource"}));
  await expect(realtimeService.answer(id,executor,user,"task1","ts1",0)).rejects.toThrow();
  expect(m.enqueue).toHaveBeenCalledTimes(1);
});

it("supports the existing mobile PCM client without exposing credentials or accepting other owners",async()=>{
  const result=await realtimeService.start(executor,user,{...input,sdp:undefined,transport:"pcm"});id=result.id;
  expect(fetch).not.toHaveBeenCalled();expect(result.sdp).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("private-test-key");
  expect(m.sockets[0].sent[0]).toMatchObject({type:"session.update",session:{audio:{input:{format:{type:"audio/pcm",rate:24000}}}}});
  expect(()=>realtimeService.attachPcm(id!,executor,{...user,userId:2},{} as any)).toThrow();
  expect(()=>realtimeService.attachPcm(id!,{target:{id:"other"}} as any,user,{} as any)).toThrow();
});

it("uses only the conversation project, ignoring an obsolete selection in metadata or input",async()=>{
  m.meta.mockResolvedValue({projectId:"p1",voiceScope:{projectIds:["private"],teamIds:["foreign"]}});
  id=(await realtimeService.start(executor,user,{...input,projectIds:["private"],teamIds:["foreign"]} as any)).id;
  expect(realtimeService.snapshot(id,executor,user,0)).toMatchObject({projectId:"p1"});
  const form=(fetch as any).mock.calls[0][1].body as FormData;
  const session=JSON.parse(String(form.get("session")));
  expect(session.instructions).toContain('Proyecto actual: {"id":"p1"');
  expect(session.instructions).not.toContain("private");
  expect(session.tools[0].parameters.properties.projectId).toBeUndefined();
});
it("refuses delegation to agents outside the project and stale project context",async()=>{
  m.agents.mockResolvedValue([{id:"a1",name:"Worker",ownerId:1,projectIds:["another"]}]);
  id=(await realtimeService.start(executor,user,input)).id;
  const socket=m.sockets[0];
  const call={type:"response.function_call_arguments.done",name:"task_assign",call_id:"outside",arguments:JSON.stringify({agentId:"a1",task:"Inspecciona"})};
  socket.emit("message",Buffer.from(JSON.stringify(call)));
  await vi.waitFor(()=>expect(socket.sent.find((e:any)=>e.item?.call_id==="outside")?.item.output).toContain("no está disponible"));
  expect(m.assign).not.toHaveBeenCalled();
  m.meta.mockResolvedValue({projectId:"private"});
  socket.emit("message",Buffer.from(JSON.stringify({...call,call_id:"changed"})));
  await vi.waitFor(()=>expect(socket.sent.some((e:any)=>e.item?.call_id==="changed")).toBe(true));
  expect(m.assign).not.toHaveBeenCalled();
});
it("inherits an agent's parent project access without requiring a team selector",async()=>{
  m.projects.mockResolvedValue([{id:"root",ownerId:1},{id:"p1",parentId:"root",ownerId:1}]);
  m.agents.mockResolvedValue([{id:"a1",name:"Worker",ownerId:1,projectIds:["root"]}]);
  id=(await realtimeService.start(executor,user,input)).id;
  m.sockets[0].emit("message",Buffer.from(JSON.stringify({type:"response.function_call_arguments.done",call_id:"child",name:"task_assign",arguments:JSON.stringify({agentId:"a1",projectId:"private",task:"Revisar"})})));
  await vi.waitFor(()=>expect(m.assign).toHaveBeenCalledWith(expect.objectContaining({projectId:"p1"})));
});
it.each(["webrtc","pcm"] as const)("supports a general chat using %s without loading or assuming a project",async transport=>{
  m.meta.mockResolvedValue({provider:"codex",projectId:null});
  m.projects.mockRejectedValue(new Error("Projects must not be queried"));
  m.agents.mockResolvedValue([]);
  id=(await realtimeService.start(executor,user,{...input,transport})).id;
  expect(realtimeService.snapshot(id,executor,user,0).projectId).toBeNull();
  const session=transport==="pcm"?m.sockets[0].sent[0].session:JSON.parse(String((fetch as any).mock.calls[0][1].body.get("session")));
  expect(session.instructions).toContain("Chat general del servidor conectado");
  expect(session.instructions).toContain('"id":"assistant"');
  expect(session.instructions).not.toContain("Proyecto actual:");
  expect(m.projects).not.toHaveBeenCalled();expect(m.agents).not.toHaveBeenCalled();
  const socket=m.sockets[0];
  const call={type:"response.function_call_arguments.done",name:"task_assign",call_id:"general",arguments:JSON.stringify({agentId:"assistant",projectId:"private",task:"Revisa el servidor"})};
  socket.emit("message",Buffer.from(JSON.stringify(call)));
  await vi.waitFor(()=>expect(m.assign).toHaveBeenCalledOnce());
  expect(m.assign.mock.calls[0][0]).toMatchObject({projectId:null,worker:{name:"Asistente del chat",providerId:"codex"},executor,user});
  expect(m.assign.mock.calls[0][0].worker.id).toBeUndefined();expect(m.validate).not.toHaveBeenCalled();
  socket.emit("message",Buffer.from(JSON.stringify({...call,call_id:"other-agent",arguments:JSON.stringify({agentId:"a1",task:"Revisar"})})));
  await vi.waitFor(()=>expect(socket.sent.find((e:any)=>e.item?.call_id==="other-agent")?.item.output).toContain("no está disponible"));
  expect(m.assign).toHaveBeenCalledOnce();
});
it("uses the chat's custom agent for general voice and denies an unavailable agent",async()=>{
  m.meta.mockResolvedValue({provider:"codex",projectId:null,agentId:"a1"});
  m.agents.mockResolvedValue([{ id: "a1", name: "Worker", ownerId: 1, projectIds: [] }]);
  id=(await realtimeService.start(executor,user,input)).id;
  const socket=m.sockets[0];
  socket.emit("message",Buffer.from(JSON.stringify({type:"response.function_call_arguments.done",name:"task_assign",call_id:"custom",arguments:JSON.stringify({agentId:"a1",task:"Revisar"})})));
  await vi.waitFor(()=>expect(m.assign).toHaveBeenCalledOnce());
  expect(m.assign.mock.calls[0][0]).toMatchObject({projectId:null,worker:{id:"a1"}});
  await realtimeService.stop(id,executor,user);id=undefined;
  m.meta.mockResolvedValue({projectId:null,agentId:"private"});
  await expect(realtimeService.start(executor,user,input)).rejects.toMatchObject({ code: "ASSISTANT_AGENT_NOT_FOUND" });
});
it("keeps project tasks outside a general chat and supports its approval buttons",async()=>{
  m.meta.mockResolvedValue({provider:"codex"});
  id=(await realtimeService.start(executor,user,input)).id;
  m.list.mockResolvedValue([
    {id:"general",status:"pending",pendingPermission:true,workerAgentId:"",workerConversationId:"worker1",projectId:null},
    {id:"project",status:"pending",pendingPermission:true,workerAgentId:"a1",workerConversationId:"worker2",projectId:"p1"},
  ]);
  m.messages.mockResolvedValue({items:[{role:"assistant",ts:"ask1",askKind:"plan-approval",ask:[{id:"plan",type:"single",text:"¿Aprobar?",options:["Aprobar","Cambios"]}]}]});
  await expect(realtimeService.answer(id,executor,user,"project","ask1",0)).rejects.toThrow("no está pendiente");
  await realtimeService.answer(id,executor,user,"general","ask1",0);
  expect(m.enqueue).toHaveBeenCalledWith(executor,expect.objectContaining({conversationId:"worker1",provider:"codex",agentId:null,projectId:null,planDecision:"approve"}));
});
it("rejects a changed general chat context before delegating",async()=>{
  m.meta.mockResolvedValue({provider:"codex",projectId:null});
  id=(await realtimeService.start(executor,user,input)).id;
  m.meta.mockResolvedValue({projectId:"p1"});
  const socket=m.sockets[0];
  socket.emit("message",Buffer.from(JSON.stringify({type:"response.function_call_arguments.done",name:"task_assign",call_id:"changed",arguments:JSON.stringify({agentId:"a1",task:"Revisar"})})));
  await vi.waitFor(()=>expect(socket.sent.find((e:any)=>e.item?.call_id==="changed")?.item.output).toContain("cambió"));
  expect(m.assign).not.toHaveBeenCalled();
});
it("rejects missing conversation metadata before opening a provider",async()=>{
  m.meta.mockResolvedValue(null);
  await expect(realtimeService.start(executor,user,input)).rejects.toThrow("Conversación no disponible");
  expect(fetch).not.toHaveBeenCalled();
});

it("emits a transcript only after history persistence so clients can refresh it once", async () => {
 let saved!:()=>void;m.append.mockReturnValue(new Promise<void>(r=>{saved=r;}));
 id=(await realtimeService.start(executor,user,input)).id;
 m.sockets[0].emit("message",Buffer.from(JSON.stringify({type:"conversation.item.input_audio_transcription.completed",item_id:"saved-first",transcript:"Hola"})));
 await vi.waitFor(()=>expect(m.append).toHaveBeenCalledTimes(1));
 expect(realtimeService.snapshot(id,executor,user,0).events.some(e=>e.type==="transcript")).toBe(false);
 saved();await vi.waitFor(()=>expect(realtimeService.snapshot(id!,executor,user,0).events.filter(e=>e.type==="transcript")).toHaveLength(1));
});

it("refuses to recontextualize existing general voice and rejects withdrawn assignments", async () => {
  m.agents.mockResolvedValue([{ id: "a1", ownerId: 1, projectIds: ["p1", "other"] }]);
  m.meta.mockResolvedValue({ agentId: "a1", projectId: null });
  await expect(realtimeService.start(executor, user, input)).rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
  m.meta.mockResolvedValue({ agentId: "a1", projectId: "p1" });
  m.agents.mockResolvedValue([{ id: "a1", ownerId: 1, projectIds: ["p1"], assignments: [{ projectId: "p1", status: "removed" }] }]);
  await expect(realtimeService.start(executor, user, input)).rejects.toMatchObject({ code: "ASSISTANT_ASSIGNMENT_REMOVED" });
  expect(fetch).not.toHaveBeenCalled();
});
it("holds the bound assignment while voice is active and releases it on close", async () => {
  const { hasAssignmentAdmission } = await import("./agent-assignment-lock.js");
  m.meta.mockResolvedValue({ agentId: "a1", projectId: "p1" });
  id = (await realtimeService.start(executor, user, input)).id;
  expect(hasAssignmentAdmission(executor, "a1", new Set(["p1"]))).toBe(true);
  await realtimeService.stop(id, executor, user); id = undefined;
  expect(hasAssignmentAdmission(executor, "a1", new Set(["p1"]))).toBe(false);
});

it("rejects approval if the worker conversation no longer has its original binding", async () => {
  id = (await realtimeService.start(executor, user, input)).id;
  m.meta.mockImplementation(async (_executor, conversationId) => conversationId === "worker1"
    ? { agentId: null, projectId: null, messageCount: 0 } : { projectId: "p1" });
  m.list.mockResolvedValue([{ id: "task1", status: "pending", pendingPermission: true, workerAgentId: "a1", workerConversationId: "worker1", projectId: "p1" }]);
  m.messages.mockResolvedValue({ items: [{ role: "assistant", ts: "ts1", askKind: "plan-approval", ask: [{ id: "plan", type: "single", text: "¿Aprobar?", options: ["Aprobar", "Cambios"] }] }] });
  await expect(realtimeService.answer(id, executor, user, "task1", "ts1", 0)).rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
  expect(m.enqueue).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
  expect(m.dispatch).not.toHaveBeenCalled();
});

it("does not infer a single new assignment for an existing general voice chat", async () => {
  m.meta.mockResolvedValue({ agentId: "a1", projectId: null, messageCount: 2 });
  await expect(realtimeService.start(executor, user, input)).rejects.toMatchObject({ code: "ASSISTANT_CONTEXT_MISMATCH" });
  expect(fetch).not.toHaveBeenCalled();
});
