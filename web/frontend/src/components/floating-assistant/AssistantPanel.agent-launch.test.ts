// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AssistantPanel from "./AssistantPanel";
import { chatUiState } from "./chat-ui-state";
import type { AssistantAgent, AssistantConfigState } from "./assistant-api";
import type { ChatPaneProps } from "./chat-pane/vm-types";

const m = vi.hoisted(() => ({ setProvider: vi.fn(), listAgents: vi.fn(), scope: "server-a", session: "session-a", setOptions: vi.fn() }));
vi.mock("@/i18n/client", () => ({ getClientMessages: async () => ({ assistant: {}, components: {} }) }));
vi.mock("@/lib/api-client", async original => ({...await original<Record<string, unknown>>(), resolveTargetScope: () => m.scope, scopeHeaders: () => ({"X-CSRF-Token":m.session})}));
vi.mock("./assistant-api", async original => ({
 ...await original<Record<string, unknown>>(),
 assistantApi: {getConfig: async () => config, setProvider: m.setProvider},
 assistantAgentsApi: {list: m.listAgents},
}));
vi.mock("./assistant-api/conversations", () => ({assistantConversationsApi:{setOptions:m.setOptions}}));
vi.mock("./CliUsageBars", () => ({CliUsageBars: () => null}));
vi.mock("./AssistantSettingsModal", () => ({AssistantSettingsModal: () => null}));
vi.mock("@/components/ui/ViewTransition", () => ({useViewDirection: () => 0, useViewEnterReplay: () => ({current:null})}));
vi.mock("./ChatPane", () => ({ChatPane: (props: ChatPaneProps) => createElement("div", {
 "data-pane":props.provider, "data-active":String(props.active),
 "data-agent":props.openAgentId ?? "", "data-project":props.openProjectId ?? "",
 "data-draft":JSON.stringify(props.openAgentDraft ?? null),
}, ...[agent, other].map(item => createElement("button", {key:item.id,"data-launch":item.id,
 onClick: () => props.onLaunchAgent?.(item, "child", draft)}, item.name)))}));

const draft = {text:"Mensaje pendiente", attachments:[{name:"contexto.txt",mimeType:"text/plain",dataBase64:"YQ=="}]};
const agent = {id:"qa",name:"QA",providerId:"claude"} as AssistantAgent;
const other = {id:"dev",name:"Dev",providerId:"minimax"} as AssistantAgent;
const config = {enabled:true,activeProvider:"codex",providers:{
 codex:{active:true,mode:"cli",cli:{installed:true,loggedIn:true}},
 claude:{active:false,mode:"cli",cli:{installed:true,loggedIn:true}},
 minimax:{active:false,mode:"cli",cli:{installed:true,loggedIn:true}},
}} as AssistantConfigState;
function activated(id: string) { return {...config, providers:{...config.providers,[id]:{...config.providers[id as keyof typeof config.providers],active:true}}}; }
let host: HTMLDivElement, root: Root;
beforeEach(async () => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ok:true,items:[],tasks:[],runs:[]}), {headers:{"Content-Type":"application/json"}})));
 vi.clearAllMocks();m.scope="server-a";m.session="session-a";
 m.setProvider.mockImplementation(async (id:string) => activated(id));
 m.listAgents.mockResolvedValue([agent,other].map(item => ({...item,capabilities:{canExecute:true},execution:{projectId:"child",error:null}})));
 chatUiState.setActiveProvider("codex");
 chatUiState.patchPane("codex", {activeId:"original",currentProjectId:"child",currentAgentId:null,draft:draft.text,attachments:draft.attachments});
 host=document.createElement("div");document.body.append(host);root=createRoot(host);
 await act(async () => root.render(createElement(AssistantPanel,{locale:"es",variant:"view"})));
});
afterEach(async () => {await act(async () => root.unmount());host.remove();chatUiState.setActiveProvider(null);vi.unstubAllGlobals();});
async function choose(id = "qa") {
 await act(async () => host.querySelector<HTMLButtonElement>(`[data-pane="codex"] [data-launch="${id}"]`)!.click());
}
it("activates a hidden provider before opening its agent, retaining the draft and subproject", async () => {
 await choose();
 expect(m.setProvider).toHaveBeenCalledWith("claude",{active:true});
 const pane=host.querySelector('[data-pane="claude"]');
 expect(pane?.getAttribute("data-active")).toBe("true");
 expect(pane?.getAttribute("data-agent")).toBe("qa");
 expect(pane?.getAttribute("data-project")).toBe("child");
 expect(JSON.parse(pane?.getAttribute("data-draft")??"null")).toEqual(draft);
 expect(m.setOptions).not.toHaveBeenCalled();
 expect(chatUiState.getPane("codex").activeId).toBe("original");
});
it("shows a failed activation and keeps the current chat", async () => {
 m.setProvider.mockRejectedValueOnce(new Error("No se pudo activar el proveedor"));
 await choose();
 expect(host.querySelector('[role="alert"]')?.textContent).toContain("No se pudo activar el proveedor");
 expect(host.querySelector('[data-pane="codex"]')?.getAttribute("data-active")).toBe("true");
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
 await choose();
 expect(host.querySelector('[role="alert"]')).toBeNull();
 expect(host.querySelector('[data-pane="claude"]')?.getAttribute("data-agent")).toBe("qa");
});
it("opens an already active provider without updating its configuration", async () => {
 await choose();
 m.setProvider.mockClear();
 await choose();
 expect(m.setProvider).not.toHaveBeenCalled();
 expect(host.querySelector('[data-pane="claude"]')?.getAttribute("data-agent")).toBe("qa");
});
it("retains edits and attachments added while activation is pending", async () => {
 let finish!:(value:AssistantConfigState)=>void;
 m.setProvider.mockReturnValueOnce(new Promise(resolve => {finish=resolve;}));
 await choose();
 const updated = {text:"Mensaje actualizado",attachments:[...draft.attachments,{name:"nuevo.txt",mimeType:"text/plain",dataBase64:"Yg=="}]};
 chatUiState.patchPane("codex",{draft:updated.text,attachments:updated.attachments});
 await act(async () => finish(activated("claude")));
 expect(JSON.parse(host.querySelector('[data-pane="claude"]')?.getAttribute("data-draft")??"null")).toEqual(updated);
});
it("does not open an agent if the server did not enable its provider", async () => {
 m.setProvider.mockResolvedValueOnce(config);
 await choose();
 expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
});
it("denies a revoked execution capability before enabling a provider", async () => {
 m.listAgents.mockResolvedValueOnce([{...agent, capabilities:{canExecute:false},execution:{projectId:"child",error:{code:"ASSISTANT_PROJECT_FORBIDDEN",statusCode:403,message:"denied"}}}]);
 await choose();
 expect(m.setProvider).not.toHaveBeenCalled();
 expect(host.querySelector('[role="alert"]')?.textContent).toContain("No tienes permiso");
 expect(chatUiState.getPane("codex").activeId).toBe("original");
});
it("ignores an activation response after changing targets", async () => {
 let finish!:(value:AssistantConfigState)=>void;
 m.setProvider.mockReturnValueOnce(new Promise(resolve => {finish=resolve;}));
 await choose();
 await act(async () => {m.scope="server-b";window.dispatchEvent(new Event("luxipanel:target-changed"));});
 await act(async () => finish(activated("claude")));
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
});
it("ignores an activation response after changing sessions on the same target", async () => {
 let finish!:(value:AssistantConfigState)=>void;
 m.setProvider.mockReturnValueOnce(new Promise(resolve => {finish=resolve;}));
 await choose();m.session="session-b";
 await act(async () => finish(activated("claude")));
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
});
it("keeps the latest selection when provider activations finish out of order", async () => {
 let finish!:(value:AssistantConfigState)=>void;
 m.setProvider.mockReturnValueOnce(new Promise(resolve => {finish=resolve;}));
 await choose(); await choose("dev");
 await act(async () => finish(activated("claude")));
 expect(host.querySelector('[data-pane="minimax"]')?.getAttribute("data-active")).toBe("true");
 expect(host.querySelector('[data-pane="minimax"]')?.getAttribute("data-agent")).toBe("dev");
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
});
it("does not reopen an agent after the user changes the current chat", async () => {
 let finish!:(value:AssistantConfigState)=>void;
 m.setProvider.mockReturnValueOnce(new Promise(resolve => {finish=resolve;}));
 await choose();chatUiState.patchPane("codex",{activeId:"another"});
 await act(async () => finish(activated("claude")));
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
});

// Corrective QA: a catalog request can also outlive edits with an active provider.
it("keeps the latest draft when the destination is active and the catalog is delayed", async () => {
 await choose();
 chatUiState.setActiveProvider("codex");
 const current = chatUiState.getPane("codex");
 let resolve!:(value:AssistantAgent[])=>void;
 m.listAgents.mockReturnValueOnce(new Promise<AssistantAgent[]>(yes => {resolve=yes;}));
 await choose();
 const updated = {text:"Texto editado durante catálogo",attachments:[...draft.attachments,{name:"ultimo.txt",mimeType:"text/plain",dataBase64:"Yw=="}]};
 chatUiState.patchPane("codex",{draft:updated.text,attachments:updated.attachments});
 await act(async () => resolve([{...agent,capabilities:{canExecute:true}} as AssistantAgent]));
 expect(JSON.parse(host.querySelector('[data-pane="claude"]')?.getAttribute("data-draft")??"null")).toEqual(updated);
 expect(chatUiState.getPane("codex").activeId).toBe(current.activeId);
});

it.each(["project","conversation","target","session","route"])("discards delayed catalog after changing %s", async kind => {
 let resolve!:(value:AssistantAgent[])=>void;
 m.listAgents.mockReturnValueOnce(new Promise<AssistantAgent[]>(yes => {resolve=yes;}));
 await choose();
 await act(async () => {
   if(kind==="project") chatUiState.patchPane("codex",{currentProjectId:"other"});
   if(kind==="conversation") chatUiState.patchPane("codex",{activeId:"other"});
   if(kind==="target") m.scope="server-b";
   if(kind==="session") m.session="session-b";
   if(kind==="route") { window.history.pushState({}, "", "/assistant/market"); window.dispatchEvent(new Event("astro:page-load")); }
 });
 await act(async () => resolve([{...agent,capabilities:{canExecute:true}} as AssistantAgent]));
 expect(m.setProvider).not.toHaveBeenCalled();
 expect(host.querySelector('[data-pane="claude"]')).toBeNull();
 window.history.replaceState({}, "", "/");
});
