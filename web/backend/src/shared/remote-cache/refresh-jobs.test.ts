import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks=vi.hoisted(()=>({get:vi.fn(),set:vi.fn(),allowed:vi.fn(),flags:vi.fn(),schedule:vi.fn(),read:vi.fn(),forget:vi.fn()}));
vi.mock("../redis/index.js",()=>({getRedis:()=>({get:mocks.get,set:mocks.set})}));
vi.mock("./live-resources.js",()=>({canReadResource:mocks.allowed}));
vi.mock("./live-config.js",()=>({cacheIdentity:(e:unknown)=>e,liveFeatures:mocks.flags}));
vi.mock("./schedule.js",()=>({cacheScheduleEntry:mocks.schedule}));
vi.mock("./versioned-read.js",()=>({readVersioned:mocks.read,forgetVersioned:mocks.forget}));
import {enqueueRefresh,refreshJobStatus} from "./refresh-jobs.js";
const user={userId:7,username:"alice",kind:"admin"} as never;
const settle=()=>new Promise(resolve=>setImmediate(resolve));
beforeEach(()=>{vi.resetAllMocks();mocks.allowed.mockResolvedValue(true);mocks.flags.mockResolvedValue({versionedReads:true});mocks.schedule.mockResolvedValue({enabled:true});mocks.set.mockResolvedValue("OK");mocks.read.mockResolvedValue({meta:{collectedAt:Date.now()/1000}});});
describe("scoped refresh jobs",()=>{
 it("coalesces concurrent requests and waits for the new view before reporting success",async()=>{
  let finish!:(value:any)=>void;const executor={target:{id:"A"},exec:vi.fn(()=>new Promise(resolve=>{finish=resolve;}))};
  const jobs=await Promise.all(Array.from({length:30},()=>enqueueRefresh(executor as never,user,"users/system")));
  expect(new Set(jobs.map(job=>job?.jobId)).size).toBe(1);expect(executor.exec).toHaveBeenCalledTimes(1);
  expect(mocks.set.mock.calls.some(call=>JSON.parse(call[1]).viewReady)).toBe(false);
  finish({exitCode:0});await settle();
  expect(JSON.parse(mocks.set.mock.calls.at(-1)![1])).toMatchObject({state:"done",viewReady:true,resource:"users/system"});
 });
 it("denies forbidden and disabled resources before executing anything",async()=>{
  const executor={target:{id:"A"},exec:vi.fn()};mocks.allowed.mockResolvedValue(false);
  expect(await enqueueRefresh(executor as never,user,"../../passwd")).toBeNull();
  mocks.allowed.mockResolvedValue(true);mocks.schedule.mockResolvedValue({enabled:false});
  expect(await enqueueRefresh(executor as never,user,"users/system")).toBeNull();expect(executor.exec).not.toHaveBeenCalled();
 });
 it("reports failed refreshes without claiming that the view is ready",async()=>{
  const executor={target:{id:"A"},exec:vi.fn().mockResolvedValue({exitCode:1})};
  await enqueueRefresh(executor as never,user,"users/system");await settle();
  expect(JSON.parse(mocks.set.mock.calls.at(-1)![1])).toMatchObject({state:"failed",viewReady:false});expect(executor.exec).toHaveBeenCalledTimes(1);
 });
 it("does not hand a non-existent queued job to concurrent callers after storage failure",async()=>{
  let reject!:(error:Error)=>void;mocks.set.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;}));
  const executor={target:{id:"A"},exec:vi.fn()};
  const first=enqueueRefresh(executor as never,user,"users/system");const rejected=expect(first).rejects.toThrow("offline");await settle();
  const second=enqueueRefresh(executor as never,user,"users/system");await settle();reject(new Error("offline"));
  await rejected;expect(await second).toBeNull();expect(executor.exec).not.toHaveBeenCalled();
 });
 it("isolates status by owner and target and terminates interrupted jobs",async()=>{
  const executor={target:{id:"A"}};mocks.get.mockResolvedValue(JSON.stringify({resource:"users/system",state:"processing",ts:Date.now()/1000-181,viewReady:false}));
  expect(await refreshJobStatus(executor as never,user,"job")).toMatchObject({state:"failed",error:"REFRESH_INTERRUPTED"});
  await refreshJobStatus({target:{id:"B"}} as never,user,"job");
  await refreshJobStatus(executor as never,{userId:8,username:"bob"} as never,"job");
  expect(new Set(mocks.get.mock.calls.map(call=>call[0])).size).toBe(3);
  mocks.allowed.mockResolvedValue(false);expect(await refreshJobStatus(executor as never,user,"job")).toBeNull();
 });
});

it("does not mark a stale snapshot as ready even when its timestamp is recent",async()=>{
 const executor={target:{id:"A"},exec:vi.fn().mockResolvedValue({exitCode:0})};
 mocks.read.mockResolvedValue({meta:{collectedAt:Date.now()/1000,state:"stale"}});
 await enqueueRefresh(executor as never,user,"users/system");await settle();
 expect(JSON.parse(mocks.set.mock.calls.at(-1)![1])).toMatchObject({state:"failed",viewReady:false});
});
