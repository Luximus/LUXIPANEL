import React,{act} from "react";
import {create,type ReactTestRenderer} from "react-test-renderer";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({voice:null as any,tasks:vi.fn(),reload:vi.fn(),permission:vi.fn(),answer:vi.fn(),cancel:vi.fn(),open:vi.fn()}));
vi.mock("react-native",()=>({View:"View",Text:"Text",Pressable:"Pressable",StyleSheet:{create:(x:any)=>x}}));
vi.mock("../../features/assistant/realtime-voice",()=>({useRealtimeVoiceState:()=>m.voice}));
vi.mock("../../features/assistant/chat-controller",()=>({chatController:{realtimeTasks:m.tasks,reloadMessages:m.reload,realtimePermission:m.permission,realtimeAnswer:m.answer,cancelRealtimeTask:m.cancel,openConversation:m.open}}));
vi.mock("./PermissionView",()=>({PermissionView:(props:any)=>React.createElement("PermissionView",props)}));
import {RealtimeActivity} from "./RealtimeActivity";
let root:ReactTestRenderer;
const props={panelId:"panel",conversationId:"chat",tokens:{},t:{}} as any;
beforeEach(()=>{vi.clearAllMocks();m.voice=null;m.tasks.mockResolvedValue({tasks:[]});m.permission.mockResolvedValue({ok:true});m.answer.mockResolvedValue({ok:true});});
afterEach(async()=>{await act(async()=>root?.unmount());});
it("renders nothing for an ordinary chat without voice work",async()=>{
 await act(async()=>{root=create(React.createElement(RealtimeActivity,props));});expect(root.toJSON()).toBeNull();
});
it("refreshes the regular history without rendering duplicate transcript text",async()=>{
 m.voice={panelId:"panel",conversationId:"chat",phase:"live",sessionId:"voice",events:[{seq:1,type:"transcript",text:"Only in history"}]};
 await act(async()=>{root=create(React.createElement(RealtimeActivity,props));});
 expect(m.reload).toHaveBeenCalledWith("panel");expect(root.toJSON()).toBeNull();
});
it("keeps persisted tasks and worker approval buttons after stopping voice",async()=>{
 m.tasks.mockResolvedValue({tasks:[{taskId:"task",title:"Revisar",state:"done",childConversationId:"worker"}]});
 m.voice={panelId:"panel",conversationId:"chat",phase:"idle",sessionId:"voice",events:[{seq:1,type:"permission_request",conversationId:"worker",event:{id:"req",title:"Permiso"}}]};
 await act(async()=>{root=create(React.createElement(RealtimeActivity,props));});
 expect(JSON.stringify(root.toJSON())).toContain("Revisar");expect(JSON.stringify(root.toJSON())).not.toContain("Voz en tiempo real");
 await act(async()=>root.root.findByType("PermissionView" as any).props.onDecide("allow"));
 expect(m.permission).toHaveBeenCalledWith("panel","worker","req","allow");
 expect(root.root.findAllByType("PermissionView" as any)).toHaveLength(0);
});
it("ignores late work and errors from another conversation",async()=>{
 let ready!:(x:any)=>void;m.tasks.mockImplementation((_p:string,id:string)=>id==="chat"?new Promise(r=>{ready=r;}):Promise.resolve({tasks:[]}));
 m.voice={panelId:"panel",conversationId:"chat",phase:"idle",error:"old",events:[{seq:1,type:"permission_request",conversationId:"worker",event:{id:"req"}}]};
 await act(async()=>{root=create(React.createElement(RealtimeActivity,props));});
 await act(async()=>root.update(React.createElement(RealtimeActivity,{...props,conversationId:"other"})));
 await act(async()=>ready({tasks:[{taskId:"late",title:"Old task",state:"done"}]}));
 expect(root.toJSON()).toBeNull();
});
