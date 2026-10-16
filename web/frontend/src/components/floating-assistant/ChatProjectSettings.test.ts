// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatProjectSettings } from "./ChatProjectSettings";
import { useChatProjectVisibility, visibleChatProjects } from "./chat-project-visibility";
import { assistantProjectsApi, type AssistantProject } from "./assistant-api";
import { scopedPreferenceKey } from "@/lib/scoped-preferences";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const projects = [
  { id: "a", title: "Panel", path: "/var/www/panel" },
  { id: "b", title: "Tienda", path: "/var/www/tienda" },
  { id: "child", title: "Backend", path: "/var/www/panel/backend", parentId: "a" },
] as AssistantProject[];
let root: Root;
let host: HTMLDivElement;

function Picker({ selectedRootId }: { selectedRootId?: string }) {
  const { hiddenIds } = useChatProjectVisibility();
  return createElement("select", { "aria-label": "Chat projects" },
    createElement("option", { value: "loose" }, "Chats sueltos"),
    ...visibleChatProjects(projects, hiddenIds, selectedRootId).map(project =>
      createElement("option", { key: project.id, value: project.id }, project.title)));
}
async function render(selectedRootId?: string) {
  await act(async () => root.render(createElement("div", null,
    createElement(ChatProjectSettings), createElement(Picker, { selectedRootId }))));
}
const button = (text: string) => Array.from(host.querySelectorAll("button")).find(item => item.textContent?.includes(text))!;
const options = () => Array.from(host.querySelectorAll("option")).map(option => option.value);
const key = () => scopedPreferenceKey("assistant", "chat-projects");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '<a id="messenger-link" data-me="user-a"></a><div id="sidebar-server-switcher" data-current-target-id="server-a"></div>';
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.spyOn(assistantProjectsApi, "list").mockResolvedValue(projects);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it("loads on expansion and updates open pickers immediately, preserving the choice after remount", async () => {
  await render();
  expect(assistantProjectsApi.list).not.toHaveBeenCalled();
  expect(options()).toEqual(["loose", "a", "b"]);
  await act(async () => button("Proyectos en el chat").click());
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
  await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect(options()).toEqual(["loose", "b"]);
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual(["a"]);
  await act(async () => root.unmount());
  root = createRoot(host);
  await render();
  expect(options()).toEqual(["loose", "b"]);
});

it("handles all/none and keeps the active project reachable without changing the stored preference", async () => {
  await render("a");
  await act(async () => button("Proyectos en el chat").click());
  await act(async () => button("Ocultar todos").click());
  expect(options()).toEqual(["loose", "a"]);
  expect(JSON.parse(localStorage.getItem(key())!)).toEqual(["a", "b"]);
  await render();
  expect(options()).toEqual(["loose"]);
  await act(async () => button("Mostrar todos").click());
  expect(options()).toEqual(["loose", "a", "b"]);
});

it("isolates preferences by user and server and reloads the project catalog on a target change", async () => {
  await render();
  await act(async () => button("Proyectos en el chat").click());
  await act(async () => button("Ocultar todos").click());
  const originalKey = key();
  await act(async () => {
    document.querySelector("#sidebar-server-switcher")!.setAttribute("data-current-target-id", "server-b");
    window.dispatchEvent(new Event("luxipanel:target-changed"));
  });
  expect(options()).toEqual(["loose", "a", "b"]);
  expect(assistantProjectsApi.list).toHaveBeenCalledTimes(2);
  await act(async () => {
    document.querySelector("#sidebar-server-switcher")!.setAttribute("data-current-target-id", "server-a");
    document.querySelector("#messenger-link")!.setAttribute("data-me", "user-b");
    window.dispatchEvent(new Event("luxipanel:session-started"));
  });
  expect(options()).toEqual(["loose", "a", "b"]);
  expect(JSON.parse(localStorage.getItem(originalKey)!)).toEqual(["a", "b"]);
});

it("shows a recoverable catalog error and does not confuse it with an empty project list", async () => {
  vi.mocked(assistantProjectsApi.list).mockRejectedValueOnce(new Error("offline"));
  await render();
  await act(async () => button("Proyectos en el chat").click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("No se pudieron cargar");
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  await act(async () => button("Reintentar").click());
  expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
});

it("ignores malformed preferences and responds to changes from another tab", async () => {
  localStorage.setItem(key(), "null");
  await render();
  expect(options()).toEqual(["loose", "a", "b"]);
  await act(async () => {
    localStorage.setItem(key(), JSON.stringify(["a", "a", null, 42]));
    window.dispatchEvent(new Event("storage"));
  });
  expect(options()).toEqual(["loose", "b"]);
});

it("discards a late catalog response from a previous server", async () => {
  let resolveOld!: (value: AssistantProject[]) => void;
  vi.mocked(assistantProjectsApi.list).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await render();
  await act(async () => button("Proyectos en el chat").click());
  vi.mocked(assistantProjectsApi.list).mockResolvedValue([{ id: "new", title: "Servidor nuevo", path: "/srv/new" }] as AssistantProject[]);
  await act(async () => {
    document.querySelector("#sidebar-server-switcher")!.setAttribute("data-current-target-id", "server-b");
    window.dispatchEvent(new Event("luxipanel:target-changed"));
  });
  await act(async () => resolveOld(projects));
  expect(host.querySelector('input[type="checkbox"]')?.parentElement?.textContent).toContain("Servidor nuevo");
  expect(host.textContent).not.toContain("/var/www/panel");
});
