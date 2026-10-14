import {afterEach, beforeEach, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({get:vi.fn(), post:vi.fn(), invalidate:vi.fn(), versions:vi.fn()}));
vi.mock("./api-client", () => ({api:{get:mocks.get,post:mocks.post},resolveTargetScope:()=>"A"}));
vi.mock("./read-cache", () => ({browserReadCache:()=>({invalidate:mocks.invalidate})}));
vi.mock("./versioned-data", async original => ({...await original<typeof import("./versioned-data")>(),browserVersionedData:()=>({invalidate:mocks.versions})}));
import {watchModuleData} from "./live-data";
let hidden=false;
beforeEach(()=>{
  vi.useFakeTimers(); hidden=false; vi.spyOn(document,"hidden","get").mockImplementation(()=>hidden);
  document.body.innerHTML='<main id="list"><input value="unsaved draft"></main>';
  mocks.get.mockResolvedValue({ok:true,data:{versionedReads:true,resources:["users/system"]}});
});
afterEach(()=>{document.dispatchEvent(new Event("lxp:module:dispose"));vi.useRealTimers();vi.restoreAllMocks();vi.clearAllMocks();});
it("coalesces invalidations, preserves the form, and stops hidden/disposed work",async()=>{
  const root=document.getElementById("list")!, reload=vi.fn(async()=>{});
  const dispose=watchModuleData(["users/system"],reload,root);
  await vi.advanceTimersByTimeAsync(0);
  for(let n=0;n<30;n++) window.dispatchEvent(new CustomEvent("lxp:data:change",{detail:{resources:["users/system"]}}));
  await vi.advanceTimersByTimeAsync(251); expect(reload).toHaveBeenCalledTimes(1);
  expect(root.querySelector("input")?.value).toBe("unsaved draft");
  hidden=true;document.dispatchEvent(new Event("lxp:module:visibility"));
  await vi.advanceTimersByTimeAsync(60_000);expect(reload).toHaveBeenCalledTimes(1);
  hidden=false;document.dispatchEvent(new Event("lxp:module:visibility"));
  await vi.advanceTimersByTimeAsync(251);expect(reload).toHaveBeenCalledTimes(2);
  dispose();await vi.advanceTimersByTimeAsync(60_000);expect(reload).toHaveBeenCalledTimes(2);
  expect(document.querySelector("[data-live-data-status]")).toBeNull();
});
it("ignores unrelated collections and never refreshes the primary mail engine for an independently selected mail server",async()=>{
  const reload=vi.fn(async()=>{});
  sessionStorage.setItem("lxp:mail:server:v1:A","mail-B");
  mocks.get.mockResolvedValue({ok:true,data:{versionedReads:true,resources:["mail/accounts"]}});
  const dispose=watchModuleData(["mail/accounts"],reload,document.getElementById("list")!);
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new CustomEvent("lxp:data:change",{detail:{resources:["users/system"]}}));
  await vi.advanceTimersByTimeAsync(251);expect(reload).not.toHaveBeenCalled();
  document.querySelector<HTMLButtonElement>("[data-live-data-status] button")!.click();
  await vi.advanceTimersByTimeAsync(0);expect(mocks.post).not.toHaveBeenCalled();expect(reload).toHaveBeenCalledTimes(1);
  dispose();sessionStorage.clear();
});

it("coalesces overlapping resume notifications and stream invalidations",async()=>{
  const reload=vi.fn(async()=>{});
  watchModuleData(["users/system"],reload,document.getElementById("list")!);
  await vi.advanceTimersByTimeAsync(0);
  for(let n=0;n<3;n++) document.dispatchEvent(new Event("lxp:module:visibility"));
  window.dispatchEvent(new CustomEvent("lxp:data:change",{detail:{resources:["users/system"]}}));
  await vi.advanceTimersByTimeAsync(251);
  expect(reload).toHaveBeenCalledTimes(1);
});

const freshness=(resource:string,state:string,at=Date.now()/1000)=>window.dispatchEvent(new CustomEvent("lxp:data:freshness",{detail:{resource,ok:state!=="offline",freshness:{version:"v1",state,collectedAt:at,checkedAt:at}}}));
it("keeps a failed collection visible when another collection succeeds",async()=>{
 document.documentElement.lang="es";
 watchModuleData(["users/system","users/roles"],vi.fn(async()=>{}),document.getElementById("list")!);
 freshness("users/system","offline");freshness("users/roles","fresh");
 expect(document.querySelector('[role="status"]')?.textContent).toContain("Sin conexión");
 freshness("users/system","stale");freshness("users/roles","fresh");
 expect(document.querySelector('[role="status"]')?.textContent).toContain("Datos anteriores");
 freshness("users/system","fresh");
 expect(document.querySelector('[role="status"]')?.textContent).toContain("Actualizado");
});
it("a successful roles read cannot clear a failed users refresh",async()=>{
 document.documentElement.lang="es";
 watchModuleData(["users/system","users/roles"],vi.fn(async()=>{}),document.getElementById("list")!);
 freshness("users/system","fresh",Date.now()/1000-10);
 window.dispatchEvent(new CustomEvent("lxp:data:refresh-failed",{detail:{resource:"users/system"}}));
 freshness("users/roles","fresh",Date.now()/1000+1);
 expect(document.querySelector('[role="status"]')?.textContent).toContain("Datos anteriores");
 freshness("users/system","fresh",Date.now()/1000+1);
 expect(document.querySelector('[role="status"]')?.textContent).toContain("Actualizado");
});

it("ignores freshness from another target or the primary mail server",()=>{
 document.documentElement.lang="es";sessionStorage.setItem("lxp:mail:server:v1:A","mail-B");
 watchModuleData(["mail/accounts"],vi.fn(async()=>{}),document.getElementById("list")!);
 const emit=(targetScope:string,mailTarget:string,ok:boolean)=>window.dispatchEvent(new CustomEvent("lxp:data:freshness",{detail:{resource:"mail/accounts",targetScope,mailTarget,ok,freshness:{version:"v1",state:ok?"fresh":"offline",collectedAt:100}}}));
 emit("A","mail-B",true);expect(document.querySelector('[role="status"]')?.textContent).toContain("Actualizado");
 emit("A","",false);emit("C","mail-B",false);
 expect(document.querySelector('[role="status"]')?.textContent).toContain("Actualizado");
 sessionStorage.clear();
});
