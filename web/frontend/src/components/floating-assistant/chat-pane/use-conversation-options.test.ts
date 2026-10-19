import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useConversationOptions } from "./use-conversation-options";
import { assistantConversationsApi } from "../assistant-api/conversations";
vi.mock("../assistant-api/conversations", () => ({ assistantConversationsApi: { get: vi.fn(), setOptions: vi.fn() } }));
vi.mock("../chat-ui-state", () => ({ chatUiState: { getConversationChoice: () => null } }));
let root: Root, value: ReturnType<typeof useConversationOptions>;
const restore = vi.fn();
const data: Record<string, any> = {
  a: { id: "a", provider: "codex", projectId: "pa", model: "ma", effort: "high", approvalMode: "plan" },
  b: { id: "b", provider: "codex", projectId: null, model: "mb", effort: "low", approvalMode: "manual" },
};
function View({ id, provider = "codex", effort = "" }: { id: string | null; provider?: string; effort?: "" | "low" | "high" | "xhigh" | "max" }) {
  value = useConversationOptions({ id, provider, active: true, defaultModel: "default", defaultEffort: effort, defaultApproval: "manual", onRestoreProvider: restore });
  return null;
}
const render = async (id: string | null, provider?: string) => { await act(async () => root.render(createElement(View, { id, provider }))); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.createElement("div"));
  vi.mocked(assistantConversationsApi.get).mockReset().mockImplementation(async id => ({ ...data[id] }));
  vi.mocked(assistantConversationsApi.setOptions).mockReset().mockImplementation(async (id, patch) => ({ ...data[id], ...patch }));
  restore.mockClear();
});
afterEach(async () => { await act(async () => root.unmount()); });
it("restores project, model, effort and approval independently on A→B→A", async () => {
  await render("a"); expect(value).toMatchObject({ selectedModel: "ma", selectedEffort: "High", approvalMode: "plan", meta: { projectId: "pa" } });
  await render("b"); expect(value).toMatchObject({ selectedModel: "mb", selectedEffort: "Low", approvalMode: "manual", meta: { projectId: null } });
  await render("a"); expect(value.approvalMode).toBe("plan");
  expect(assistantConversationsApi.setOptions).not.toHaveBeenCalled();
});
it("ignores late metadata from a previously opened conversation", async () => {
  let resolve!: (v: any) => void;
  vi.mocked(assistantConversationsApi.get).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await render("a"); expect(await value.beforeSend()).toBe(false);
  await render("b");
  await act(async () => resolve(data.a));
  expect(value.meta?.id).toBe("b"); expect(value.selectedModel).toBe("mb");
});
it("restores the provider before allowing a send", async () => {
  await render("a", "claude");
  expect(restore).toHaveBeenCalledWith("codex", "a"); expect(await value.beforeSend()).toBe(false);
});
it("an approval changes only the captured conversation, including while switching", async () => {
  let resolve!: (v: any) => void;
  vi.mocked(assistantConversationsApi.setOptions).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await render("a"); let saved!: Promise<boolean>;
  await act(async () => { saved = value.changeApproval("auto"); });
  await render("b"); await act(async () => { resolve({ ...data.a, approvalMode: "auto" }); await saved; });
  expect(value.approvalMode).toBe("manual"); expect(value.meta?.id).toBe("b");
  expect(assistantConversationsApi.setOptions).toHaveBeenCalledWith("a", { approvalMode: "auto" });
});
it("fails closed on a failed save and allows a deliberate retry", async () => {
  await render("a"); vi.mocked(assistantConversationsApi.setOptions).mockRejectedValueOnce(new Error("offline"));
  await act(async () => { expect(await value.changeApproval("auto")).toBe(false); });
  expect(value.error).toBeTruthy(); expect(await value.beforeSend()).toBe(false);
  await act(async () => { expect(await value.changeApproval("plan")).toBe(true); });
  expect(value.error).toBeNull();
});
it("new and legacy chats cannot inherit the preceding chat's approval or model", async () => {
  await render("a"); await render(null);
  expect(value).toMatchObject({ selectedModel: "default", selectedEffort: "Auto", approvalMode: "manual" });
  vi.mocked(assistantConversationsApi.get).mockResolvedValueOnce({ id: "old", provider: "codex" } as any);
  await render("old"); expect(value).toMatchObject({ selectedModel: "", selectedEffort: "Auto", approvalMode: "manual" });
});

it("uses the latest reasoning default for a new chat while preserving saved choices", async () => {
  await act(async () => root.render(createElement(View, { id: null, effort: "high" })));
  expect(value.selectedEffort).toBe("High");
  await act(async () => value.setSelectedEffort("Low"));
  expect(value.snapshot().effort).toBe("low");
  await act(async () => root.render(createElement(View, { id: "b", effort: "high" })));
  expect(value.selectedEffort).toBe("Low");
  await act(async () => root.render(createElement(View, { id: null, effort: "max" })));
  expect(value.selectedEffort).toBe("Max");
  await act(async () => value.setSelectedEffort("Low"));
  await act(async () => value.resetNew("default"));
  expect(value.snapshot().effort).toBe("max");
});
it("keeps legacy and explicitly automatic conversations automatic", async () => {
  for (const effort of [undefined, ""] as const) {
    vi.mocked(assistantConversationsApi.get).mockResolvedValueOnce({ id: "legacy", provider: "codex", effort } as any);
    await act(async () => root.render(createElement(View, { id: "legacy", effort: "high" })));
    expect(value.selectedEffort).toBe("Auto");
    await render(null);
  }
});

it("persists speed per chat and defaults legacy and new chats to normal", async () => {
  await render("a");
  await act(async () => { expect(await value.setSelectedSpeed("fast")).toBe(true); });
  expect(assistantConversationsApi.setOptions).toHaveBeenCalledWith("a", { speed: "fast" });
  expect(value.snapshot().speed).toBe("fast");
  await render("b"); expect(value.selectedSpeed).toBe("normal");
  vi.mocked(assistantConversationsApi.get).mockResolvedValueOnce({ ...data.a, speed: "fast" });
  await render("a"); expect(value.selectedSpeed).toBe("fast");
  await render(null); expect(value.selectedSpeed).toBe("normal");
});
