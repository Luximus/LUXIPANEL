// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ read: vi.fn(), mutate: vi.fn(), invalidate: vi.fn() }));
vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
  View: "View", Text: "Text", Pressable: "Pressable", TextInput: "TextInput", ActivityIndicator: "Spinner",
  ScrollView: "ScrollView", RefreshControl: "RefreshControl", StyleSheet: { create: (styles: object) => styles },
  useWindowDimensions: () => ({ width: 360, height: 780 }),
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
vi.mock("lucide-react-native", () => Object.fromEntries([
  "Folder", "MoreHorizontal", "Search", "MessageSquare", "Trash2", "Clock3", "Pencil", "Pin", "PinOff", "MoreVertical",
].map((name) => [name, name])));
vi.mock("../../../api/client", () => ({ luxAssistantProxy: api.read, luxAssistantProxyOk: api.mutate }));
vi.mock("../../../api/client/assistant", () => ({ invalidateAssistantReads: api.invalidate }));
vi.mock("../../../lib/session-state", () => ({ loadSessionState: () => ({ language: "es" }) }));
vi.mock("../../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../../hooks/useInlineEditCancel", () => ({ useInlineEditCancel: () => undefined }));
vi.mock("../../../features/assistant/hooks", () => ({ useAssistantSession: () => ({ provider: "claude" }) }));
vi.mock("../../../screens/main/native-module-context", () => ({ NativeModuleContext: React.createContext({ insideWorkspace: true }) }));
vi.mock("../../ProviderIcon", () => ({ PROVIDER_META: {}, ProviderIcon: "ProviderIcon" }));
vi.mock("../../ui/Skeleton", () => ({ Skeleton: "Skeleton" }));
vi.mock("../../ui/ConfirmationModal", () => ({ ConfirmationModal: (props: any) => props.visible ? React.createElement("Dialog", { ...props, onClose: props.onCancel },
  React.createElement("Text", {}, props.message), props.children,
  React.createElement("Pressable", { disabled: props.submitting, onPress: props.onCancel }, React.createElement("Text", {}, props.cancelLabel)),
  React.createElement("Pressable", { disabled: props.submitting, onPress: props.onConfirm }, React.createElement("Text", {}, props.confirmLabel)),
) : null }));
vi.mock("../../ui/FormSheet", () => ({ FormSheet: (props: any) => props.visible ? React.createElement("Actions", props, props.children) : null }));
vi.mock("./PulseDot", () => ({ PulseDot: "PulseDot" }));
vi.mock("./ScopeTabs", () => ({ ScopeTabs: "ScopeTabs" }));
vi.mock("./AgentThreadedConvos", () => ({ AgentThreadedConvos: "AgentThreadedConvos" }));
vi.mock("./ProjectTreeConvos", () => ({
  ProjectGroupHeaderRN: "ProjectGroupHeader",
  ProjectTreeConvos: (props: any) => <>{props.entries.filter((entry: any) => entry.kind === "chat").map((entry: any) =>
    <ConvoRow key={entry.convo.id} {...props} c={entry.convo} isLive={false} />)}</>,
}));

import { getMessages } from "../../../i18n";
import { getThemeTokens } from "../../../theme/colors";
import { ConvoRow } from "./ConvoRow";
import { ConversationsDrawer } from "./ConversationsDrawer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer;
let rows: Array<{ id: string; title: string; updatedAt: string }>;
let scope = 0;
const onDeleted = vi.fn(), onOpen = vi.fn();
const t = { ...getMessages("es").assistantChat, ...getMessages("es").assistantDrawer } as any;
beforeEach(() => {
  vi.useFakeTimers();
  rows = [{ id: "thread", title: "Configurar servidor", updatedAt: "2026-10-11" }, { id: "other", title: "Otro chat", updatedAt: "2026-10-10" }];
  api.read.mockImplementation(async (_panel, _token, _method, path: string) => {
    if (!path.startsWith("/api/ai/conversations?")) return {};
    const query = new URLSearchParams(path.split("?")[1]);
    const offset = Number(query.get("offset")), limit = Number(query.get("limit"));
    return { items: rows.slice(offset, offset + limit), total: rows.length, hasMore: offset + limit < rows.length, summary: { projects: {}, agents: {} } };
  });
  api.mutate.mockResolvedValue(true);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.useRealTimers();
  vi.clearAllMocks();
});
async function mount() {
  await act(async () => { tree = create(<ConversationsDrawer workspace fill panelId={`delete-test-${++scope}`} token="test"
    t={t} tokens={getThemeTokens(true)} activeId="thread" onOpen={onOpen} onNew={() => undefined} onDeleted={onDeleted} />); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
}
const dialog = () => tree.root.findByType("Dialog" as any);
const button = (label: string) => tree.root.findAllByType("Pressable" as any).find((node) => node.findAllByType("Text" as any).some((text) => text.children.includes(label)))!;
const visibleTitles = () => tree.root.findAllByType("Text" as any).flatMap((node) => node.children);
async function requestDelete() {
  const event = { stopPropagation: vi.fn() };
  await act(async () => tree.root.findAllByType("Pressable" as any).find((node) => node.props.accessibilityLabel === "Más opciones")!.props.onPress(event));
  expect(event.stopPropagation).toHaveBeenCalledOnce();
  const actions = tree.root.findByType("Actions" as any);
  let parent = actions.parent;
  while (parent) { expect(parent.type).not.toBe("Pressable"); parent = parent.parent; }
  await act(async () => button(t.deleteConv).props.onPress());
  expect(onOpen).not.toHaveBeenCalled();
  expect(tree.root.findAllByType("Actions" as any)).toHaveLength(1);
}

it("confirms in the app dialog and cancels without deleting or opening the chat", async () => {
  await mount();
  await requestDelete();
  expect(dialog().props.title).toBe("Borrar conversación");
  expect(visibleTitles()).toContain(t.deleteConvDescription);
  expect(api.mutate).not.toHaveBeenCalled();
  await act(async () => button("Cancelar").props.onPress());
  expect(tree.root.findAllByType("Dialog" as any)).toHaveLength(0);
  expect(visibleTitles()).toContain("Configurar servidor");
  expect(tree.root.findAllByType("Actions" as any)).toHaveLength(1);
  expect(api.mutate).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
});

it("shows pending approval while a conversation is still running", async () => {
  await act(async () => { tree = create(<ConvoRow c={{ id: "waiting", title: "Esperando", needsApproval: true } as any}
    activeId={null} isLive t={t} tokens={getThemeTokens(true)} onOpen={onOpen} onDelete={() => {}}
    onRename={() => {}} onTogglePin={() => {}} />); });
  expect(tree.root.findAllByType("Spinner" as any)).toHaveLength(1);
  expect(tree.root.findAllByType("PulseDot" as any)).toHaveLength(1);
});

it("waits for the server, prevents double deletion and refreshes the open list", async () => {
  let finish!: (ok: boolean) => void;
  api.mutate.mockReturnValueOnce(new Promise<boolean>((resolve) => { finish = resolve; }));
  await mount();
  await requestDelete();
  const confirm = button("Eliminar").props.onPress;
  await act(async () => { void confirm(); void confirm(); });
  expect(api.mutate).toHaveBeenCalledTimes(1);
  expect(api.mutate).toHaveBeenCalledWith(expect.any(String), "test", "DELETE", "/api/ai/conversations/thread");
  expect(button("Cancelar").props.disabled).toBe(true);
  expect(visibleTitles()).toContain(t.deletingConv);
  expect(onDeleted).not.toHaveBeenCalled();
  await act(async () => dialog().props.onClose());
  expect(tree.root.findAllByType("Dialog" as any)).toHaveLength(1);
  rows = [rows[1], { id: "new", title: "Chat actualizado", updatedAt: "2026-10-12" }];
  await act(async () => finish(true));
  expect(onDeleted).toHaveBeenCalledExactlyOnceWith("thread");
  expect(api.invalidate).toHaveBeenCalled();
  expect(tree.root.findAllByType("Dialog" as any)).toHaveLength(0);
  expect(visibleTitles()).not.toContain("Configurar servidor");
  expect(visibleTitles()).toContain("Otro chat");
  expect(visibleTitles()).toContain("Chat actualizado");
});

it.each([false, "reject"])("keeps the chat and offers retry when deletion fails (%s)", async (failure) => {
  if (failure === "reject") api.mutate.mockRejectedValueOnce(new Error("offline"));
  else api.mutate.mockResolvedValueOnce(false);
  await mount();
  await requestDelete();
  await act(async () => button("Eliminar").props.onPress());
  expect(visibleTitles()).toContain(t.deleteConvError);
  expect(visibleTitles()).toContain("Configurar servidor");
  expect(onDeleted).not.toHaveBeenCalled();
  expect(button("Cancelar").props.disabled).toBeFalsy();
  await act(async () => button("Eliminar").props.onPress());
  expect(onDeleted).toHaveBeenCalledExactlyOnceWith("thread");
  // Even a stale GET must not resurrect the confirmed deletion.
  expect(visibleTitles()).not.toContain("Configurar servidor");
});

it("preserves already loaded conversations when refreshing after deletion", async () => {
  rows = Array.from({ length: 35 }, (_, i) => ({ id: `chat-${i}`, title: `Chat ${i}`, updatedAt: "2026-10-11" }));
  await mount();
  const scroll = tree.root.findAllByType("ScrollView" as any).find((node) => node.props.onScroll)!;
  await act(async () => scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 100 }, layoutMeasurement: { height: 600 }, contentSize: { height: 700 } } }));
  expect(visibleTitles()).toContain("Chat 29");
  await requestDelete();
  rows = rows.filter((row) => row.id !== "chat-0");
  await act(async () => button("Eliminar").props.onPress());
  expect(visibleTitles()).not.toContain("Chat 0");
  expect(visibleTitles()).toContain("Chat 29");
  expect(tree.root.findAllByType("ScrollView" as any).find((node) => node.props.onScroll)).toBe(scroll);
});
