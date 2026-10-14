// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { assistantStatsApi } from "./stats";
import { browserReadCache } from "@/lib/read-cache";
const state=vi.hoisted(()=>({scope:"server-a",get:vi.fn()}));
vi.mock("@/lib/api-client",()=>({api:{get:state.get},unwrap:vi.fn(),resolveTargetScope:()=>state.scope,scopeHeaders:()=>({"X-Bridge-Session-Id":"bridge","X-CSRF-Token":"csrf"})}));
afterEach(()=>{browserReadCache().clear();vi.useRealTimers();});
it("shares unavailable readings for 60 seconds, refreshes explicitly and separates servers",async()=>{
 vi.useFakeTimers();state.get.mockResolvedValue({ok:true,data:{ok:true,quota:null}});
 await Promise.all(Array.from({length:10},()=>assistantStatsApi.cliQuota("claude")));
 await assistantStatsApi.cliQuota("claude");expect(state.get).toHaveBeenCalledTimes(1);
 await assistantStatsApi.cliQuota("claude",true);expect(state.get).toHaveBeenCalledTimes(2);
 state.scope="server-b";await assistantStatsApi.cliQuota("claude");expect(state.get).toHaveBeenCalledTimes(3);
 vi.advanceTimersByTime(60_001);await assistantStatsApi.cliQuota("claude");expect(state.get).toHaveBeenCalledTimes(4);
 window.dispatchEvent(new Event("luxipanel:logout"));await assistantStatsApi.cliQuota("claude");expect(state.get).toHaveBeenCalledTimes(5);
});
