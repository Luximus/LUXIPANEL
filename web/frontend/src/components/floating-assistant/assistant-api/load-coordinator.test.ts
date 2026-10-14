import { afterEach, describe, expect, it, vi } from "vitest";
import { createLoadCoordinator } from "./load-coordinator";

vi.mock("@/lib/api-client", () => ({ resolveTargetScope: () => "test", scopeHeaders: () => ({}) }));
afterEach(() => vi.useRealTimers());

describe("assistant shared reads", () => {
  it("shares simultaneous requests and releases the cached result after its TTL", async () => {
    vi.useFakeTimers();
    const coordinator = createLoadCoordinator(() => "server-one", 2000);
    const load = vi.fn(async () => ["chat"]);
    expect(await Promise.all(Array.from({ length: 20 }, () => coordinator.read("history", ["", 200], load)))).toHaveLength(20);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2001);
    await coordinator.read("history", ["", 200], load);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not share across targets or query arguments", async () => {
    let target = "one";
    const coordinator = createLoadCoordinator(() => target);
    const load = vi.fn(async () => target);
    await coordinator.read("history", [0], load);
    await coordinator.read("history", [200], load);
    target = "two";
    expect(await coordinator.read("history", [0], load)).toBe("two");
    expect(load).toHaveBeenCalledTimes(3);
  });
  it.each(["target", "invalidate", "reset"])("discards an in-flight response after %s changes", async action => {
    let target = "one";
    const coordinator = createLoadCoordinator(() => target);
    let finish!: (value: string) => void;
    const pending = coordinator.read("history", [], () => new Promise<string>(resolve => { finish = resolve; }));
    await Promise.resolve();
    if (action === "target") target = "two";
    else coordinator[action as "reset" | "invalidate"]();
    finish("old");
    await expect(pending).rejects.toThrow("scope changed");
    expect(await coordinator.read("history", [], async () => "new")).toBe("new");
  });
  it("retries failed reads instead of caching their rejection", async () => {
    const coordinator = createLoadCoordinator(() => "one");
    await expect(coordinator.read("history", [], async () => { throw Error("offline"); })).rejects.toThrow("offline");
    expect(await coordinator.read("history", [], async () => "retry")).toBe("retry");
  });
  it("performs one deferred workspace repair and refreshes only its initiating caller", async () => {
    vi.useFakeTimers();
    const coordinator = createLoadCoordinator(() => "one");
    const repair = vi.fn(async () => {});
    const calls = Array.from({ length: 5 }, () => coordinator.repair(repair));
    expect(repair).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(await Promise.all(calls)).toEqual([true, false, false, false, false]);
    expect(await coordinator.repair(repair)).toBe(false);
    expect(repair).toHaveBeenCalledTimes(1);
  });
  it("does not start a repair after switching server during the delay", async () => {
    vi.useFakeTimers();
    let target = "one";
    const coordinator = createLoadCoordinator(() => target);
    const repair = vi.fn(async () => {});
    const pending = coordinator.repair(repair);
    target = "two";
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toBe(false);
    expect(repair).not.toHaveBeenCalled();
  });
});
