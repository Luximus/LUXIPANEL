// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach,beforeEach,expect,it,vi } from "vitest";
import { useAgentsTab, type AgentsTabVM } from "./use-agents-tab";
import { AgentEditor } from "./AgentEditor";
import { AgentRequestError } from "../assistant-api/agents";
import type { AssistantAgent } from "../assistant-api";
const m=vi.hoisted(()=>({list:vi.fn(),create:vi.fn(),update:vi.fn(),scope:"a"}));
vi.mock("@/lib/api-client",async original=>({...await original<Record<string,unknown>>(),resolveTargetScope:()=>m.scope,scopeHeaders:()=>({})}));
vi.mock("../use-module-catalog",()=>({useModuleCatalog:()=>undefined}));
vi.mock("../assistant-api",async original=>({...await original<Record<string,unknown>>(),
 assistantAgentsApi:{list:m.list,create:m.create,update:m.update},
 assistantAgentRolesApi:{list:async()=>[]},assistantAgentTeamsApi:{list:async()=>[]},
 assistantProjectsApi:{list:async()=>[]},fetchAssociatableConnections:async()=>[],fetchTerminalSnippetFilterOptions:async()=>({ok:false}),
}));
let root:Root,host:HTMLDivElement,vm:AgentsTabVM,records:AssistantAgent[];
const persisted={id:"persisted-id",name:"Revisor",providerId:"claude",model:"",description:"",systemPrompt:"",allowedTools:null,
 capabilities:{canEditProfile:true}} as AssistantAgent;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.clearAllMocks();m.scope=crypto.randomUUID();records=[];
 m.list.mockImplementation(async()=>records);m.update.mockResolvedValue(persisted);
 m.create.mockImplementation(async()=>{records=[persisted];throw new AgentRequestError(0,undefined,"lost response");});
 vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({ok:true,items:[]}),{headers:{"Content-Type":"application/json"}})));
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
function Probe(){vm=useAgentsTab({editorOnly:true,onLaunchAgent:()=>{}});return createElement(AgentEditor,{vm});}
async function mount(){await act(async()=>root.render(createElement(Probe)));await act(async()=>vm.setDraft(d=>d?{...d,name:"Revisor"}:d));}
it("does not repeat a creation whose response was lost after persistence",async()=>{
 await mount();await act(async()=>vm.save());await act(async()=>vm.save());
 expect(m.create).toHaveBeenCalledTimes(1);expect(records).toHaveLength(1);
 expect(host.textContent).toContain("No se pudo confirmar");
 expect(vm.draft?.name).toBe("Revisor");
});
it("recovers by explicitly choosing the persisted id, never by a matching name",async()=>{
 await mount();await act(async()=>vm.save());
 records.push({...persisted,id:"same-name"});
 await act(async()=>vm.reload());
 expect(vm.draft?.id).toBeUndefined();
 const select=host.querySelector<HTMLSelectElement>('[data-profile-recovery]')!;
 expect(select).not.toBeNull();expect(select.value).toBe("");
 await act(async()=>{select.value="persisted-id";select.dispatchEvent(new Event("change",{bubbles:true}));});
 expect(vm.draft?.id).toBe("persisted-id");
 await act(async()=>vm.save());
 expect(m.create).toHaveBeenCalledTimes(1);expect(m.update).toHaveBeenCalledWith("persisted-id",expect.any(Object));
 expect(records).toHaveLength(2);
});
it("keeps an unresolved creation blocked after closing and reopening its editor",async()=>{
 await mount();await act(async()=>vm.save());
 await act(async()=>root.render(null));await mount();await act(async()=>vm.save());
 expect(m.create).toHaveBeenCalledTimes(1);
});
it("allows correcting a definitively rejected creation",async()=>{
 m.create.mockRejectedValueOnce(new AgentRequestError(400,"VALIDATION_ERROR","invalid"));
 await mount();await act(async()=>vm.save());await act(async()=>vm.save());
 expect(m.create).toHaveBeenCalledTimes(2);
});
