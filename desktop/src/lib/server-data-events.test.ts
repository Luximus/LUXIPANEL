import {afterEach, beforeEach, expect, it, vi} from "vitest";
const mocks=vi.hoisted(()=>({api:vi.fn(),invalidate:vi.fn(),freshness:vi.fn(),sessionListeners:new Set<()=>void>(),target:{baseUrl:"https://fixture.invalid",jwt:"private-session"}}));
vi.mock("../api/serverApi",()=>({callServerApi:mocks.api, getDirect:()=>mocks.target, subscribeDirectSessions:(listener:()=>void)=>{mocks.sessionListeners.add(listener);return()=>mocks.sessionListeners.delete(listener);},invalidateServerData:mocks.invalidate,unwrap:(r:any)=>r.data?.data}));
vi.mock("./native-live-read",()=>({reportFreshness:mocks.freshness}));
import {listenServerData,refreshServerData} from "./server-data-events";
class Socket {
 static all:Socket[]=[];readyState=0;onopen?:()=>void;onmessage?:(event:any)=>void;onclose?:(event:any)=>void;onerror?:()=>void;
 send=vi.fn();close=vi.fn(()=>{this.readyState=3;this.onclose?.({code:1000});});
 url:string;constructor(url:string){this.url=url;Socket.all.push(this);}
}
const releases:(()=>void)[]=[];
beforeEach(()=>{
 vi.useFakeTimers();vi.stubGlobal("WebSocket",Socket);Socket.all=[];mocks.target={baseUrl:"https://fixture.invalid",jwt:"private-session"};
 mocks.api.mockImplementation(async(_server,_token,_method,path)=>({ok:true,data:{data:path==="/api/auth/ws-token"?{token:"short-lived-ticket"}:{events:true,resources:["users/system","nginx/sites"]}}}));
});
afterEach(()=>{releases.splice(0).forEach(release=>release());vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
it("shares one channel, uses a short-lived ticket, filters and coalesces changes, and releases it",async()=>{
 const users=vi.fn(),nginx=vi.fn();
 releases.push(listenServerData("A",["users/system"],users),listenServerData("A",["nginx/sites"],nginx));
 await vi.advanceTimersByTimeAsync(0);expect(Socket.all).toHaveLength(1);
 const socket=Socket.all[0]!;expect(socket.url).toContain("short-lived-ticket");expect(socket.url).not.toContain("private-session");
 socket.readyState=1;socket.onopen?.();await vi.advanceTimersByTimeAsync(301);users.mockClear();nginx.mockClear();mocks.invalidate.mockClear();
 for(let n=0;n<30;n++)socket.onmessage?.({data:JSON.stringify({type:"data:invalidate",resources:["users/system"],cursor:"2-0"})});
 await vi.advanceTimersByTimeAsync(251);expect(users).toHaveBeenCalledTimes(1);expect(nginx).not.toHaveBeenCalled();
 expect(mocks.invalidate).toHaveBeenCalledWith("A",["users/system"]);
 releases.splice(0).forEach(fn=>fn());expect(socket.close).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(60_000);expect(Socket.all).toHaveLength(1);expect(users).toHaveBeenCalledTimes(1);
});
it("falls back to ordinary revalidation on an older server",async()=>{
 const reload=vi.fn();releases.push(listenServerData("B",["users/system"],reload));
 mocks.api.mockResolvedValue({ok:true,data:{data:{}}});
 await vi.advanceTimersByTimeAsync(0);expect(await refreshServerData("B",["users/system"])).toBe(true);
 expect(reload).toHaveBeenCalled();
});

it("does not race reconciliation against a pending reconnect",async()=>{
 releases.push(listenServerData("retry",["users/system"],vi.fn()));
 await vi.advanceTimersByTimeAsync(0);
 const first=Socket.all[0]!;first.readyState=1;first.onopen?.();
 await vi.advanceTimersByTimeAsync(29_500);first.close();
 await vi.advanceTimersByTimeAsync(1_001);
 expect(Socket.all).toHaveLength(2);
});
it("shares a slow connection attempt and accepts the same session registered again",async()=>{
 let resolve!:(reply:any)=>void;
 mocks.api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 releases.push(listenServerData("slow",["users/system"],vi.fn()));
 await vi.advanceTimersByTimeAsync(30_001);
 expect(mocks.api.mock.calls.filter(call=>call[3]==="/api/ui/data/capabilities")).toHaveLength(1);
 mocks.target={...mocks.target};mocks.sessionListeners.forEach(fn=>fn());
 resolve({ok:true,data:{data:{events:true,resources:["users/system"]}}});
 await vi.advanceTimersByTimeAsync(0);expect(Socket.all).toHaveLength(1);
});
it("cancels a manual refresh when its view closes while capabilities are pending",async()=>{
 const release=listenServerData("closed",["users/system"],vi.fn());releases.push(release);
 await vi.advanceTimersByTimeAsync(0);
 let resolve!:(reply:any)=>void;
 mocks.api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 const result=refreshServerData("closed",["users/system"]);release();
 resolve({ok:true,data:{data:{versionedReads:true,resources:["users/system"]}}});
 expect(await result).toBe(false);
 expect(mocks.api.mock.calls.some(call=>call[2]==="POST")).toBe(false);
});
it("discards an old refresh after a different session replaces it",async()=>{
 releases.push(listenServerData("rotated",["users/system"],vi.fn()));
 await vi.advanceTimersByTimeAsync(0);
 let resolve!:(reply:any)=>void;
 mocks.api.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 const result=refreshServerData("rotated",["users/system"]);
 mocks.target={...mocks.target,jwt:"new-session"};mocks.sessionListeners.forEach(fn=>fn());
 resolve({ok:true,data:{data:{versionedReads:true,resources:["users/system"]}}});
 expect(await result).toBe(false);
 expect(mocks.api.mock.calls.some(call=>call[2]==="POST")).toBe(false);
});

it("ignores an old job failure after session rotation and resumes the new channel",async()=>{
 const reload=vi.fn();releases.push(listenServerData("job-rotate",["users/system"],reload));
 await vi.advanceTimersByTimeAsync(0);
 let resolve!:(reply:any)=>void;
 mocks.api.mockImplementation(async(_server,_token,method,path)=>{
  if(path==="/api/jobs/old")return new Promise(r=>{resolve=r;});
  if(method==="POST")return {ok:true,data:{data:{job:{id:"old"}}}};
  if(path==="/api/auth/ws-token")return {ok:true,data:{data:{token:"ticket"}}};
  return {ok:true,data:{data:{versionedReads:true,events:true,resources:["users/system"]}}};
 });
 const result=refreshServerData("job-rotate",["users/system"]);await vi.advanceTimersByTimeAsync(0);
 mocks.target={...mocks.target,jwt:"new-session"};mocks.sessionListeners.forEach(fn=>fn());
 resolve({ok:true,data:{data:{state:"failed"}}});expect(await result).toBe(false);
 expect(mocks.freshness.mock.calls.some(call=>call[2].state==="stale")).toBe(false);
 await vi.advanceTimersByTimeAsync(0);expect(Socket.all).toHaveLength(2);expect(Socket.all[0]!.close).toHaveBeenCalledTimes(1);
});
it("does not reconnect a revoked session until its credentials change",async()=>{
 releases.push(listenServerData("revoked",["users/system"],vi.fn()));
 await vi.advanceTimersByTimeAsync(0);
 const socket=Socket.all[0]!;socket.readyState=3;socket.onclose?.({code:4001});
 await vi.advanceTimersByTimeAsync(60_001);expect(Socket.all).toHaveLength(1);
 mocks.target={...mocks.target,jwt:"renewed"};mocks.sessionListeners.forEach(fn=>fn());
 await vi.advanceTimersByTimeAsync(0);expect(Socket.all).toHaveLength(2);
});
it("releasing an old view twice cannot remove the channel of its replacement",async()=>{
 const old=listenServerData("replaced",["users/system"],vi.fn());
 await vi.advanceTimersByTimeAsync(0);old();
 releases.push(listenServerData("replaced",["users/system"],vi.fn()));
 await vi.advanceTimersByTimeAsync(0);old();
 releases.push(listenServerData("replaced",["nginx/sites"],vi.fn()));
 await vi.advanceTimersByTimeAsync(0);expect(Socket.all).toHaveLength(2);
});
