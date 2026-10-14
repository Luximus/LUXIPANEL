import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
vi.mock("../api/serverApi", () => ({ unwrap: (r: { data: unknown }) => r.data, withFreshGateway: (fn: () => unknown) => fn(), withJob: vi.fn() }));
vi.mock("react-native", () => ({AppState:{currentState:"active",addEventListener:()=>({remove:()=>{}})}}));
import { NativeModuleContext } from "../screens/main/native-module-visibility";
import { useServerResource } from "./useServerApi";
it("pauses hidden reads, retains loaded data and discards a pending hidden reply", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const load = vi.fn().mockResolvedValue({ ok: true, data: "ready" });
  let state!: ReturnType<typeof useServerResource<string>>;
  function Resource() { state = useServerResource<string>(load, ["server1"]); return null; }
  const view = (visible: boolean) => <NativeModuleContext.Provider value={{ key: "module", visible }}><Resource /></NativeModuleContext.Provider>;
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(view(false)); });
  expect(load).not.toHaveBeenCalled();
  await act(async () => { renderer.update(view(true)); });
  expect(state.data).toBe("ready"); expect(load).toHaveBeenCalledTimes(1);
  let finish!: (value: unknown) => void;
  load.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  let reloading!: Promise<void>;
  await act(async () => { reloading = state.reload(); });
  await act(async () => { renderer.update(view(false)); });
  await act(async () => { finish({ ok: true, data: "stale" }); await reloading; });
  expect(state.data).toBe("ready");
  await act(async () => { await state.reload(); });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => renderer.unmount());
});
