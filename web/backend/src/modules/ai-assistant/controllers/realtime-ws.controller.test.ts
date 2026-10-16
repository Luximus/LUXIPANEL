import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({verify:vi.fn(),permission:vi.fn(),enabled:vi.fn(),override:vi.fn(),direct:vi.fn(),attach:vi.fn(),hosting:vi.fn()}));
vi.mock("../../../shared/websocket/live-auth.js",()=>({verifyWsAuthorization:m.verify}));
vi.mock("../../../shared/websocket/upgrade-auth.js",()=>({extractOverrideBridgeId:(r:any)=>r.override}));
vi.mock("../../auth/services/token.service.js",()=>({tokenService:{toSessionUser:(p:any)=>p}}));
vi.mock("../../../shared/auth/role-permissions.js",()=>({canUseModule:m.permission,hasActionPermission:m.permission}));
vi.mock("../../admin/services/module-registry.service.js",()=>({moduleRegistryService:{isEnabled:m.enabled}}));
vi.mock("../../../shared/executor/index.js",()=>({runWithExecutor:(_e:any,f:any)=>f(),localExecutor:{target:{id:"local"}},getDirectExecutorByBridgeSessionId:m.direct}));
vi.mock("../../../shared/session/bridge-header.js",()=>({resolveOverrideBridge:m.override}));
vi.mock("../../../shared/tenant/tenant-scope.js",()=>({isHostingSession:m.hosting}));
vi.mock("../services/realtime.service.js",()=>({realtimeService:{attachPcm:m.attach}}));
import {handleRealtimeAudio} from "./realtime-ws.controller.js";
beforeEach(()=>{vi.clearAllMocks();m.verify.mockResolvedValue({userId:1});m.permission.mockReturnValue(true);m.enabled.mockResolvedValue(true);m.override.mockResolvedValue(null);m.hosting.mockReturnValue(false);});
const socket=()=>({readyState:1,close:vi.fn()});
it("binds audio to the authenticated user and selected target",async()=>{
  const ws=socket();await handleRealtimeAudio(ws as any,{url:"/api/assistant/ws/realtime-audio?session=s1"} as any);
  expect(m.attach).toHaveBeenCalledWith("s1",{target:{id:"local"}},{userId:1},ws);
});
it("rejects missing authorization, denied module, and unauthorized bridge",async()=>{
  const ws=socket();m.verify.mockResolvedValue(null);await handleRealtimeAudio(ws as any,{} as any);
  expect(m.attach).not.toHaveBeenCalled();
  m.verify.mockResolvedValue({userId:1});m.enabled.mockResolvedValue(false);await handleRealtimeAudio(ws as any,{} as any);
  expect(m.attach).not.toHaveBeenCalled();
  m.enabled.mockResolvedValue(true);await handleRealtimeAudio(ws as any,{override:"foreign"} as any);
  expect(m.attach).not.toHaveBeenCalled();expect(ws.close).toHaveBeenCalledTimes(3);
});
it("uses the authorized bridge executor and refuses unknown sessions",async()=>{
  const ws=socket();m.verify.mockResolvedValue({userId:1,direct:true,bridgeSessionId:"b"});
  m.direct.mockResolvedValue({target:{id:"remote"}});m.attach.mockImplementation(()=>{throw Error("owner mismatch");});
  await handleRealtimeAudio(ws as any,{url:"/?session=foreign"} as any);
  expect(m.attach).toHaveBeenCalledWith("foreign",{target:{id:"remote"}},expect.objectContaining({userId:1}),ws);
  expect(ws.close).toHaveBeenCalledWith(1008,"Sesión de voz no autorizada");
});
