import React,{act} from "react";
import {create,type ReactTestRenderer} from "react-test-renderer";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({caps:vi.fn(),prepare:vi.fn(),prior:vi.fn(),start:vi.fn(),stop:vi.fn(),patch:vi.fn(),selected:{conversationId:"current"},voice:null as any,subs:new Set<()=>void>()}));
vi.mock("react-native",()=>({Pressable:"Pressable",Text:"Text",View:"View",ScrollView:"ScrollView"}));
vi.mock("../../features/assistant/chat-controller",()=>({chatController:{realtimeCapabilities:m.caps,prepareRealtimeContext:m.prepare,realtimeConversation:m.prior,reloadMessages:vi.fn()}}));
vi.mock("../../features/assistant/chat-store",()=>({chatStore:{patchComposer:m.patch,getSession:()=>m.selected,subscribeSession:(_p:string,fn:()=>void)=>{m.subs.add(fn);return()=>m.subs.delete(fn);}}}));
vi.mock("../../features/assistant/realtime-voice",()=>({useRealtimeVoiceState:()=>m.voice,getRealtimeVoiceState:()=>m.voice,startRealtimeVoice:m.start,stopRealtimeVoice:m.stop,muteRealtimeVoice:vi.fn(),respondRealtimePermission:vi.fn(),cancelRealtimeTask:vi.fn(),answerRealtimeAsk:vi.fn()}));
import {useRealtimeComposer} from "./use-realtime-composer";
import {voiceInputLocked} from "../../features/assistant/input-lock";
let hook:ReturnType<typeof useRealtimeComposer>,root:ReactTestRenderer;
function Harness(){hook=useRealtimeComposer("panel",true);return null;}
beforeEach(async()=>{
 vi.clearAllMocks();m.selected={conversationId:"current"};m.voice=null;m.caps.mockResolvedValue({enabled:true,available:true});m.prior.mockResolvedValue({activeId:null});
 m.prepare.mockResolvedValue({panelId:"panel",token:"token",conversationId:"current"});m.start.mockResolvedValue(undefined);m.stop.mockResolvedValue(undefined);
 await act(async()=>{root=create(React.createElement(Harness));});
});
afterEach(async()=>{await act(async()=>root.unmount());});
it("starts using the current conversation directly, with no project or team selection",async()=>{
 expect(root.toJSON()).toBeNull();await act(async()=>hook.toggle());
 expect(m.start).toHaveBeenCalledWith({panelId:"panel",token:"token",conversationId:"current"},expect.any(Function));
 expect(JSON.stringify(root.toJSON())).not.toMatch(/Proyectos|Equipos|Iniciar conversación/);
 expect(voiceInputLocked("panel")).toBe(false);
});
it("cancels preparation without opening a late microphone or leaving text blocked",async()=>{
 let resolve!:(v:any)=>void;m.prepare.mockReturnValue(new Promise(r=>{resolve=r;}));
 let pending!:Promise<void>;await act(async()=>{pending=hook.toggle();});
 expect(voiceInputLocked("panel")).toBe(true);
 await act(async()=>hook.toggle());
 resolve({panelId:"panel",token:"token",conversationId:"current"});
 await act(async()=>pending);
 expect(m.start).not.toHaveBeenCalled();expect(voiceInputLocked("panel")).toBe(false);
});

it("does not expose another conversation's voice or errors",async()=>{
 m.voice={panelId:"panel",conversationId:"other",phase:"idle",muted:false,error:"old",events:[{seq:1,type:"transcript",text:"secret"}]};
 await act(async()=>root.update(React.createElement(Harness)));expect(hook.active).toBe(false);expect(hook.error).toBe("");expect(root.toJSON()).toBeNull();
});
it("cancels a late preparation when the selected chat changes",async()=>{
 let resolve!:(v:any)=>void;m.prepare.mockReturnValue(new Promise(r=>{resolve=r;}));let pending!:Promise<void>;
 await act(async()=>{pending=hook.toggle();});m.selected={conversationId:"other"};
 await act(async()=>{m.subs.forEach(fn=>fn());});
 resolve({panelId:"panel",token:"token",conversationId:"current"});await act(async()=>pending);
 expect(m.start).not.toHaveBeenCalled();expect(voiceInputLocked("panel")).toBe(false);expect(hook.error).toBe("");
});
