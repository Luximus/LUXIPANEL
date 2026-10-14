import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { lightTokens } from "../../theme/colors";

const mocks = vi.hoisted(() => ({
  list: vi.fn(async () => ({ ok: true, status: 200, data: { ok: true, data: [{ id: "n1", source: "ai", severity: "info", title: "Tarea completa", message: "Lista", read: false, createdAt: "2026-10-05T12:00:00Z" }], unread: 1 } })),
  markRead: vi.fn(async () => ({ ok: true, status: 200 })),
  readAll: vi.fn(async () => ({ ok: true, status: 200 })),
  search: vi.fn(async () => ({ items: [{ id: "c1", title: "Servidor de prueba" }] })),
}));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", ScrollView: "ScrollView", TextInput: "TextInput", ActivityIndicator: "Spinner" }));
vi.mock("lucide-react-native", () => Object.fromEntries(["Bell", "CheckCheck", "Search", "X"].map(name => [name, "Icon"])));
vi.mock("../../components/ui/PanelText", () => ({ PanelText: "Text" }));
vi.mock("../../api/serverApi", () => ({ serverNotificationsApi: { list: mocks.list, markRead: mocks.markRead, readAll: mocks.readAll } }));
vi.mock("../../api/client", () => ({ luxAssistantProxy: mocks.search }));
vi.mock("./WorkspaceCommunity", () => ({ WorkspaceCommunity: "Community" }));
import { WorkspaceNotifications, WorkspaceSearch } from "./WorkspaceTopPanels";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.clearAllMocks(); });
const props = { panelId: "server", token: "session", language: "es", colors: lightTokens, onClose: vi.fn() };

it("shows the actual notification inbox and marks its rows read on the selected server", async () => {
  const onCount = vi.fn(), onOpen = vi.fn();
  await act(async () => { tree = create(<WorkspaceNotifications {...props} onCount={onCount} onOpen={onOpen}/>); });
  expect(mocks.list).toHaveBeenCalledWith("server", "session", "?pageSize=50");
  expect(onCount).toHaveBeenCalledWith(1);
  const row = tree!.root.findAllByType("Pressable" as any).find(node => node.findAllByType("Text" as any).some(text => text.children.includes("Tarea completa")))!;
  await act(async () => row.props.onPress());
  expect(mocks.markRead).toHaveBeenCalledWith("server", "session", "n1");
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
  expect(onCount).toHaveBeenLastCalledWith(0);
});

it("searches native modules and conversation history rather than opening the history drawer", async () => {
  const onModule = vi.fn(), onConversation = vi.fn();
  await act(async () => { tree = create(<WorkspaceSearch {...props} modules={[{ id: "files", label: "Archivos", kind: "module", moduleId: "files" }]} onModule={onModule} onConversation={onConversation}/>); });
  const input = tree!.root.findByType("TextInput" as any);
  await act(async () => input.props.onChangeText("Archivos"));
  const moduleRow = tree!.root.findAllByType("Pressable" as any).find(node => node.findAllByType("Text" as any).some(text => text.children.includes("Archivos")))!;
  await act(async () => moduleRow.props.onPress());
  expect(onModule).toHaveBeenCalledWith("files", undefined);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
  expect(mocks.search).toHaveBeenCalledWith("server", "session", "GET", expect.stringContaining("q=Archivos"));
  const conversation = tree!.root.findAllByType("Pressable" as any).find(node => node.findAllByType("Text" as any).some(text => text.children.includes("Servidor de prueba")))!;
  await act(async () => conversation.props.onPress());
  expect(onConversation).toHaveBeenCalledWith("c1");
});
