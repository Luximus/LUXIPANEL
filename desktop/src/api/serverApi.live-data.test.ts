import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {callServerApi,registerDirectServer,unregisterDirectServer,unwrap} from "./serverApi";
const fetcher=vi.fn();
const target=(name:string)=>({baseUrl:`https://${name}.example`,jwt:`session-${name}`,csrf:null,exp:0});
const response=(id:string)=>({ok:true,status:200,json:async()=>({ok:true,data:[{id}],meta:{freshness:{version:id,state:"fresh"}}})});
beforeEach(()=>{vi.stubGlobal("fetch",fetcher);vi.stubGlobal("electronApi",undefined);fetcher.mockReset();registerDirectServer("A",target("a"));});
afterEach(()=>{unregisterDirectServer("A");unregisterDirectServer("B");vi.unstubAllGlobals();});
it("keeps a pending read of A valid when B connects",async()=>{
 let finish!:(value:any)=>void;fetcher.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 const pending=callServerApi("A","portal","GET","/api/users");await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 registerDirectServer("B",target("b"));finish(response("A"));
 expect(unwrap(await pending)).toEqual([{id:"A"}]);expect(fetcher).toHaveBeenCalledTimes(1);
});
it("re-registers the same credentials without discarding an active read",async()=>{
 let finish!:(value:any)=>void;fetcher.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 const pending=callServerApi("A","portal","GET","/api/users");await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 registerDirectServer("A",target("a"));finish(response("A"));
 expect(unwrap(await pending)).toEqual([{id:"A"}]);expect(fetcher).toHaveBeenCalledTimes(1);
});
it("a mutation on B does not cancel a read from A",async()=>{
 registerDirectServer("B",target("b"));let finish!:(value:any)=>void;
 fetcher.mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue(response("B"));
 const pending=callServerApi("A","portal","GET","/api/users");await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 expect((await callServerApi("B","portal","POST","/api/users",{name:"example"})).ok).toBe(true);
 finish(response("A"));expect(unwrap(await pending)).toEqual([{id:"A"}]);expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not deliver an old list when the credentials of A actually change",async()=>{
 let finish!:(value:any)=>void;fetcher.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 const pending=callServerApi("A","portal","GET","/api/users");await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 registerDirectServer("A",target("replacement"));finish(response("old"));
 const result=await pending;expect(result.ok).toBe(false);expect(result.data).toBeUndefined();expect(fetcher).toHaveBeenCalledTimes(1);
});

it("revalidates a concurrent mutation on A without claiming credentials were lost",async()=>{
 let finish!:(value:any)=>void;
 fetcher.mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue(response("new"));
 const pending=callServerApi("A","portal","GET","/api/users");await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 await callServerApi("A","portal","POST","/api/users",{name:"new"});finish(response("old"));
 expect(unwrap(await pending)).toEqual([{id:"new"}]);
});

it("invalidates a list read while an immediate mutation was still running",async()=>{
 let finish!:(value:any)=>void;let changed=false;
 fetcher.mockImplementation((_url,opts)=>opts.method==="POST" ? new Promise(resolve=>{finish=resolve;}) : Promise.resolve(response(changed?"new":"old")));
 const mutation=callServerApi("A","portal","POST","/api/users",{name:"new"});
 await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 expect(unwrap(await callServerApi("A","portal","GET","/api/users"))).toEqual([{id:"old"}]);
 changed=true;finish(response("applied"));await mutation;
 expect(unwrap(await callServerApi("A","portal","GET","/api/users"))).toEqual([{id:"new"}]);
});
