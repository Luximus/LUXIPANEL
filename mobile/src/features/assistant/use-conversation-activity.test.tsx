import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ read: vi.fn(), state: null as null | ((state: string) => void) }));
vi.mock("../../api/client", () => ({ luxAssistantProxy: mock.read }));
vi.mock("react-native", () => ({ AppState: { currentState: "active", addEventListener: (_event: string, fn: (state: string) => void) => { mock.state = fn; return { remove: vi.fn() }; } } }));
vi.mock("./attachments", () => ({ deleteLocalFile: vi.fn() }));
import { useConversationActivity } from "./use-conversation-activity";
import { chatStore } from "./chat-store";
import { resetAllStores } from "../../lib/store-reset";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
let value: ReturnType<typeof useConversationActivity>;
function Probe({ panel = "box", visible = true, activeId = "current" }: { panel?: string; visible?: boolean; activeId?: string }) {
  value = useConversationActivity(panel, "token", activeId, visible); return null;
}
beforeEach(() => { vi.useFakeTimers(); mock.read.mockReset(); mock.read.mockResolvedValue({ runs: [] }); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); resetAllStores(); vi.useRealTimers(); });
const mount = async () => { await act(async () => { tree = create(<Probe />); }); };

it("updates running, approval and unseen states without reloading the history", async () => {
  mock.read.mockResolvedValue({ runs: [{ id: "other", pendingPermission: true }] });
  await mount();
  expect(value.liveIds.has("other")).toBe(true);
  expect(value.decorate({ id: "other" } as any).needsApproval).toBe(true);
  mock.read.mockResolvedValue({ runs: [{ id: "other", pendingPermission: false }] });
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(value.decorate({ id: "other", needsApproval: true } as any).needsApproval).toBe(false);
  mock.read.mockResolvedValue({ runs: [] });
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(value.liveIds.has("other")).toBe(false);
  expect(value.decorate({ id: "other" } as any).unreviewed).toBe(true);
});
it("uses local stream transitions immediately and ignores an older in-flight response", async () => {
  await mount();
  await act(async () => {
    chatStore.patchSession("box", { conversationId: "current" });
    chatStore.setBusy("box", true, 1);
  });
  expect(value.liveIds.has("current")).toBe(true);
  let resolve!: (value: unknown) => void;
  mock.read.mockImplementation(() => new Promise(r => { resolve = r; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  await act(async () => chatStore.setBusy("box", false, null));
  expect(value.liveIds.has("current")).toBe(false);
  await act(async () => resolve({ runs: [{ id: "current", pendingPermission: true }] }));
  expect(value.liveIds.has("current")).toBe(false);
  expect(value.decorate({ id: "current", unreviewed: true } as any)).toMatchObject({ needsApproval: false, unreviewed: false });
});
it("retains indicators on network errors and pauses/resumes with app visibility", async () => {
  mock.read.mockResolvedValue({ runs: [{ id: "other" }] }); await mount();
  mock.read.mockResolvedValue(null);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(value.liveIds.has("other")).toBe(true);
  await act(async () => mock.state?.("background"));
  const calls = mock.read.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(mock.read).toHaveBeenCalledTimes(calls);
  mock.read.mockResolvedValue({ runs: [] });
  await act(async () => mock.state?.("active"));
  expect(value.liveIds.has("other")).toBe(false);
});
it("does not overlap reads or apply a response to another server", async () => {
  let resolve!: (value: unknown) => void;
  mock.read.mockImplementationOnce(() => new Promise(r => { resolve = r; })); await mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(mock.read).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<Probe panel="other-box" />));
  await act(async () => resolve({ runs: [{ id: "old-server" }] }));
  expect(value.liveIds.size).toBe(0);
});
it("lets the server settle a chat after navigating away during its stream", async () => {
  await mount();
  await act(async () => {
    chatStore.patchSession("box", { conversationId: "old" });
    chatStore.setBusy("box", true, 1);
  });
  expect(value.liveIds.has("old")).toBe(true);
  await act(async () => {
    chatStore.patchSession("box", { conversationId: "new" });
    chatStore.setBusy("box", false, null);
  });
  mock.read.mockResolvedValue({ runs: [] });
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(value.liveIds.has("old")).toBe(false);
});
