import {act,renderHook} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({visible:true,listen:vi.fn(),release:vi.fn(),notify:()=>{}}));
vi.mock("./server-data-events",()=>({listenServerData:mocks.listen}));
vi.mock("../screens/server/module-visibility",()=>({useNativeModuleVisible:()=>mocks.visible}));
import {useLiveModuleData} from "./use-live-module-data";
async function mount(reload:()=>Promise<unknown>) {
 const view=renderHook(()=>useLiveModuleData("A",["users/system"],reload));
 return {update:()=>act(async()=>view.rerender()),unmount:()=>act(async()=>view.unmount())};
}
let unmount:(()=>Promise<void>)|undefined;
beforeEach(()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;vi.useFakeTimers();mocks.visible=true;
 mocks.listen.mockImplementation((_server,_resources,notify)=>{mocks.notify=notify;return mocks.release;});
});
afterEach(async()=>{await unmount?.();unmount=undefined;vi.useRealTimers();vi.clearAllMocks();});
it("does not reload twice when stream reconciliation arrives before the initial timer",async()=>{
 const reload=vi.fn(async()=>{});const view=await mount(reload);unmount=view.unmount;
 await act(async()=>{await vi.advanceTimersByTimeAsync(250);mocks.notify();});
 await act(async()=>{await vi.advanceTimersByTimeAsync(100);});
 expect(reload).toHaveBeenCalledTimes(1);
});
it("coalesces events during a slow read and stops callbacks after hiding the view",async()=>{
 let finish!:()=>void;
 const reload=vi.fn().mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;})).mockResolvedValue(undefined);
 const view=await mount(reload);unmount=view.unmount;
 await act(async()=>{await vi.advanceTimersByTimeAsync(301);mocks.notify();mocks.notify();});
 expect(reload).toHaveBeenCalledTimes(1);
 await act(async()=>{finish();});expect(reload).toHaveBeenCalledTimes(2);
 mocks.visible=false;await view.update();
 await act(async()=>{mocks.notify();await vi.advanceTimersByTimeAsync(60_000);});
 expect(reload).toHaveBeenCalledTimes(2);expect(mocks.release).toHaveBeenCalledTimes(1);
});
