import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../assistant-api", () => ({ PROVIDER_META: {}, assistantConversationsApi: {} }));
vi.mock("../chat-engine/resume-poll", () => ({ startBackgroundPoll: vi.fn(), stopBackgroundPoll: vi.fn() }));
vi.mock("../i18n", () => ({ useAssistantI18n: () => ({ chatTab: {} }) }));
vi.mock("../ProviderIcon", () => ({ ProviderIcon: () => null }));
vi.mock("./helpers", () => ({ formatConvoDate: () => "" }));
import { ConvoRow } from "./ConvoRow";
import { chats, emit, backgroundActive, backgroundPending } from "../chat-engine/state";

const host = document.createElement("div");
let root: ReturnType<typeof createRoot>;
afterEach(async () => {
  if (root) await act(() => root.unmount());
  chats.clear(); backgroundActive.clear(); backgroundPending.clear(); vi.useRealTimers(); vi.unstubAllGlobals();
});
it("updates an already mounted row on engine events, including rapid queued turns", async () => {
  vi.useFakeTimers(); vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = createRoot(host);
  await act(() => root.render(React.createElement(ConvoRow, {
    c: { id: "row", title: "Chat" } as any, activeId: null,
    onOpen: () => {}, onDelete: () => {}, onRename: () => {}, onTogglePin: () => {},
  })));
  expect(host.querySelector(".animate-spin")).toBeNull();
  await act(() => { backgroundActive.set("row", { provider: null, cli: false }); backgroundPending.add("row"); emit(); });
  expect(host.querySelector(".animate-spin")).not.toBeNull();
  expect(host.querySelector('[aria-label="Aprobación pendiente"]')).not.toBeNull();
  await act(() => { chats.set("row", { turns: [{ role: "assistant", text: "Hecho" }], streaming: false } as any); backgroundActive.clear(); backgroundPending.clear(); emit(); });
  expect(host.querySelector(".animate-spin")).toBeNull();
  expect(host.querySelector('[aria-label="Tarea completada"]')).not.toBeNull();
  await act(() => { backgroundActive.set("row", { provider: null, cli: false }); emit(); });
  await act(() => { backgroundActive.clear(); emit(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(700); });
  expect(host.querySelector('[aria-label="Tarea completada"]')).toBeNull();
});

it("does not flash a success check after failure or an approval pause", async () => {
  vi.useFakeTimers(); vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  root = createRoot(host);
  await act(() => { backgroundActive.set("row", { provider: null, cli: true }); });
  await act(() => root.render(React.createElement(ConvoRow, {
    c: { id: "row", title: "Chat" } as any, activeId: null,
    onOpen: () => {}, onDelete: () => {}, onRename: () => {}, onTogglePin: () => {},
  })));
  await act(() => { chats.set("row", { streaming: false, turns: [{ role: "assistant", error: "timeout" }] } as any); backgroundActive.clear(); emit(); });
  expect(host.querySelector(".animate-spin")).toBeNull();
  expect(host.querySelector('[aria-label="Tarea completada"]')).toBeNull();
});
