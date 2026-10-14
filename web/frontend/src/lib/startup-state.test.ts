import {afterEach,expect,it,vi} from "vitest";
import {afterPrimaryReady,historyReady,startupSeed} from "./startup-state";
afterEach(()=>{document.body.innerHTML="";sessionStorage.clear();vi.useRealTimers();});
function seed(target="one") {document.body.innerHTML=`<script id="lxp-ui-bootstrap" type="application/json">${JSON.stringify({version:1,targetId:target,user:{userId:1,username:"alice"},modules:[],preferences:{},assistant:{}})}</script><a id="messenger-link" data-me="alice"></a>`;}
it("never reuses a seed after a target switch, logout, identity mismatch or expiration",()=>{
 vi.useFakeTimers();seed();expect(startupSeed()?.targetId).toBe("one");sessionStorage.setItem("panel-active-target-scope","two");expect(startupSeed()).toBeNull();sessionStorage.clear();
 window.dispatchEvent(new Event("luxipanel:logout"));expect(startupSeed()).toBeNull();seed();expect(startupSeed()).not.toBeNull();
 document.getElementById("messenger-link")!.setAttribute("data-me","bob");expect(startupSeed()).toBeNull();
 seed();expect(startupSeed()).not.toBeNull();vi.advanceTimersByTime(20_001);expect(startupSeed()).toBeNull();
});
it("runs counters before peripheral metrics, after history, and supports cancellation",()=>{
 vi.useFakeTimers();seed();const order:string[]=[];
 const cancel=afterPrimaryReady(()=>order.push("cancelled"));afterPrimaryReady(()=>order.push("counter"));afterPrimaryReady(()=>order.push("metrics"),1500);cancel();
 vi.advanceTimersByTime(100);expect(order).toEqual([]);historyReady();vi.advanceTimersByTime(500);expect(order).toEqual(["counter"]);vi.advanceTimersByTime(1000);expect(order).toEqual(["counter","metrics"]);
});

it("preserves ready history across SPA swaps only for the same persisted workspace and scope", () => {
 vi.useFakeTimers(); seed();
 const workspace=document.createElement("div");workspace.id="persistent-assistant-workspace";document.body.append(workspace);
 historyReady();
 const first=document.getElementById("lxp-ui-bootstrap")!;
 first.replaceWith(first.cloneNode(true));
 const ready=vi.fn();afterPrimaryReady(ready);vi.advanceTimersByTime(500);expect(ready).toHaveBeenCalledTimes(1);
 // A different workspace must wait for its own history, even on the same target.
 workspace.replaceWith(workspace.cloneNode(true));
 const second=document.getElementById("lxp-ui-bootstrap")!;second.replaceWith(second.cloneNode(true));
 const next=vi.fn();const cancel=afterPrimaryReady(next);vi.advanceTimersByTime(500);expect(next).not.toHaveBeenCalled();cancel();
 historyReady();window.dispatchEvent(new Event("luxipanel:session-started"));
 const third=document.getElementById("lxp-ui-bootstrap")!;third.replaceWith(third.cloneNode(true));
 const fresh=vi.fn();const stop=afterPrimaryReady(fresh);vi.advanceTimersByTime(500);expect(fresh).not.toHaveBeenCalled();stop();
});
