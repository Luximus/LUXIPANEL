import {afterEach, expect, it, vi} from "vitest";
import {act, createElement} from "react";
import {createRoot} from "react-dom/client";
const mocks = vi.hoisted(() => ({get: vi.fn()}));
vi.mock("@/lib/api-client", () => ({api: {get: mocks.get}}));
vi.mock("@/lib/startup-state", () => ({afterPrimaryReady: (run: () => void, delay: number) => {
  const timer = setTimeout(run, delay); return () => clearTimeout(timer);
}}));
import ServerRailLive from "./ServerRailLive";
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });
it("aborts old metrics and ignores their late result after changing servers", async () => {
  vi.useFakeTimers();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  let firstReply!: (value: unknown) => void;
  mocks.get.mockImplementationOnce(() => new Promise(resolve => { firstReply = resolve; }))
    .mockResolvedValue({ok: true, data: {cpu: {usagePercent: 22}}});
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => { root.render(createElement(ServerRailLive)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    const signal = mocks.get.mock.calls[0]![1].signal as AbortSignal;
    await act(async () => { window.dispatchEvent(new Event("luxipanel:target-changed")); });
    expect(signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(host.textContent).toContain("22%");
    await act(async () => { firstReply({ok: true, data: {cpu: {usagePercent: 99}}}); });
    expect(host.textContent).toContain("22%"); expect(host.textContent).not.toContain("99%");
    expect(mocks.get).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); }
});
