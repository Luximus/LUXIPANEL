import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {chatEngine} from "../chat-engine";
import {chats} from "./state";
import {assistantConversationsApi,teamApi} from "../assistant-api";
beforeEach(()=>{chats.clear();vi.spyOn(teamApi,"getConversationSnapshot").mockResolvedValue(null);});
afterEach(()=>vi.restoreAllMocks());
it("updates regular turns while preserving tasks and earlier loaded history",async()=>{
 const old={role:"user" as const,text:"Earlier",createdAt:1000,tools:[]};
 const saved={role:"user" as const,text:"Hello",createdAt:2000,tools:[]};
 const teamTasks={task:{id:"task",status:"running"}} as any;
 chats.set("chat",{provider:"codex",conversationId:"chat",turns:[old,saved],streaming:false,teamTasks});
 vi.spyOn(assistantConversationsApi,"messages").mockResolvedValue({items:[{role:"user",content:"Hello",ts:new Date(2000).toISOString()},{role:"assistant",content:"Hi",ts:new Date(3000).toISOString()}]} as any);
 await chatEngine.refreshVoiceHistory("chat","chat");
 expect(chats.get("chat")?.turns.map(t=>t.text)).toEqual(["Earlier","Hello","Hi"]);
 expect(chats.get("chat")?.teamTasks).toEqual(teamTasks);
});
it("does not overwrite a new stream or a replaced chat with a late response",async()=>{
 chatEngine.seed("chat","codex","chat",[]);
 let ready!:(x:any)=>void;vi.spyOn(assistantConversationsApi,"messages").mockReturnValue(new Promise(r=>{ready=r;}));
 const pending=chatEngine.refreshVoiceHistory("chat","chat");
 chats.set("chat",{provider:"codex",conversationId:"chat",turns:[{role:"assistant",text:"Streaming",tools:[]}],streaming:true});
 ready({items:[{role:"assistant",content:"Old reply"}]});await pending;
 expect(chats.get("chat")?.turns[0].text).toBe("Streaming");
});
