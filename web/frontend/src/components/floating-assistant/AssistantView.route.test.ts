// @vitest-environment happy-dom
import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AssistantView from "./AssistantView";
import { requestAssistant } from "@/lib/assistant-request";
import { workspaceState } from "./workspace-state";
import type { AssistantConfigState, AssistantProject } from "./assistant-api";
import InternalModuleHost from "../workspace/InternalModuleHost";
import type { SessionUser } from "@/lib/auth";

const m = vi.hoisted(() => ({ navigate: vi.fn(), config: vi.fn() }));
vi.mock("astro:transitions/client", () => ({ navigate: m.navigate }));
vi.mock("@/i18n/client", () => ({ getClientMessages: async () => ({ assistant: {}, components: {} }) }));
vi.mock("@/i18n", () => ({ getMessages: async () => ({}) }));
vi.mock("../workspace/module-registry", () => ({ MODULE_REGISTRY: {
  files: { route: "/panel/files", namespaces: [], load: () => new Promise(() => {}) },
} }));
vi.mock("./assistant-api", async original => ({
  ...await original<Record<string, unknown>>(), assistantApi: { getConfig: m.config },
}));
vi.mock("./ChatTab", () => ({ ChatTab: (props: { chatVisible: boolean; enabled: boolean; loading: boolean }) => createElement("div", {
  "data-chat": "", "data-visible": String(props.chatVisible), "data-enabled": String(props.enabled), "data-loading": String(props.loading),
}, createElement("textarea", { defaultValue: "Borrador del subproyecto" }), createElement("button", {
  "data-market-entry": "", onClick: () => requestAssistant({ kind: "navigate", tab: "market", origin: { module: "assistant", action: "market" } }),
}, "Market")) }));
vi.mock("./AgentMarket", () => ({ AgentMarket: (props: { projectId?: string; onBack?: () => void }) => createElement("section", {
  "data-market": "", "data-project": props.projectId,
}, createElement("button", { "data-back": "", onClick: props.onBack }, "Volver")) }));

const config = { enabled: true, providers: {} } as AssistantConfigState;
const project: AssistantProject = { id: "child", title: "Subproyecto", parentId: "root", provider: "codex", icon: "Folder", path: "/project/child", instructions: "" };
const user: SessionUser = { userId: 1, username: "test", displayName: "Test", kind: "admin", role: "admin", modules: [] };
const labels = { module: "Módulo", loadingModule: "Cargando", close: "Cerrar", settings: "Ajustes", retry: "Reintentar", unavailable: "No disponible" };
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  m.config.mockResolvedValue(config);
  m.navigate.mockImplementation(async (path: string) => {
    window.history.pushState({}, "", path);
    document.dispatchEvent(new Event("astro:page-load"));
  });
  window.history.replaceState({}, "", "/");
  workspaceState.setContext("codex", "cli", project);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  workspaceState.setContext("codex", "cli", null);
  window.history.replaceState({}, "", "/");
});
async function render(path = "/", withModules = false) {
  window.history.replaceState({}, "", path);
  await act(async () => root.render(createElement(Fragment, {},
    createElement(AssistantView, { locale: "es" }),
    withModules && createElement(InternalModuleHost, { locale: "es", user, labels }),
  )));
}
async function route(path: string, event: "popstate" | "astro:page-load") {
  await act(async () => {
    window.history.replaceState({}, "", path);
    if (event === "popstate") window.dispatchEvent(new PopStateEvent(event));
    else document.dispatchEvent(new Event(event));
  });
}
async function click(selector: string) {
  await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click());
}
it.each(["/assistant/market", "/panel/assistant/market"])("opens Market directly at %s with the current subproject", async path => {
  await render(path);
  expect(host.querySelector("[data-market]")?.getAttribute("data-project")).toBe("child");
  expect(host.querySelectorAll("[data-chat]")).toHaveLength(1);
  expect(host.querySelector("[data-chat]")?.getAttribute("data-visible")).toBe("false");
  expect(m.navigate).not.toHaveBeenCalled();
});
it("navigates from the existing entry and returns with the same chat and draft", async () => {
  await render();
  const chat = host.querySelector("[data-chat]");
  const draft = host.querySelector("textarea")!;
  draft.value = "Edición sin enviar";
  await click("[data-market-entry]");
  expect(window.location.pathname).toBe("/assistant/market");
  expect(m.navigate).toHaveBeenCalledTimes(1);
  expect(host.querySelector("[data-market]")?.getAttribute("data-project")).toBe("child");
  await click("[data-back]");
  expect(window.location.pathname).toBe("/");
  expect(host.querySelector("[data-market]")).toBeNull();
  expect(host.querySelector("[data-chat]")).toBe(chat);
  expect(draft.value).toBe("Edición sin enviar");
  expect(workspaceState.getSnapshot().project).toBe(project);
});
it("follows SPA and backward/forward routes without remounting the chat or pushing history", async () => {
  await render(); const chat = host.querySelector("[data-chat]");
  await route("/assistant/market", "astro:page-load");
  expect(host.querySelector("[data-market]")).not.toBeNull();
  await route("/", "popstate");
  expect(host.querySelector("[data-market]")).toBeNull();
  await route("/assistant/market", "popstate");
  expect(host.querySelector("[data-market]")).not.toBeNull();
  await route("/files", "astro:page-load");
  expect(host.querySelector("[data-market]")).toBeNull();
  expect(host.querySelector("[data-chat]")).toBe(chat);
  expect(m.navigate).not.toHaveBeenCalled();
});
it("keeps the assistant synchronized when internal modules change history without an Astro swap", async () => {
  await render("/assistant/market", true);
  const chat = host.querySelector("[data-chat]");
  await act(async () => { expect(window.__lxpInternalModules!.open("/panel/files")).toBe(true); });
  expect(window.location.pathname).toBe("/panel/files");
  expect(host.querySelector("[data-market]")).toBeNull();
  await act(async () => window.__lxpInternalModules!.close());
  expect(window.location.pathname).toBe("/panel");
  expect(host.querySelector("[data-chat]")).toBe(chat);
  expect(host.querySelector("[data-chat]")?.getAttribute("data-visible")).toBe("true");
  expect(m.navigate).not.toHaveBeenCalled();
});
it("coalesces duplicate bus deliveries while Astro navigation is pending", async () => {
  let finish!: () => void;
  m.navigate.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  await render();
  await click("[data-market-entry]");
  await click("[data-market-entry]");
  expect(m.navigate).toHaveBeenCalledTimes(1);
  await route("/assistant/market", "astro:page-load");
  await act(async () => finish());
  expect(host.querySelector("[data-market]")).not.toBeNull();
});
it("restores the current route when navigation fails", async () => {
  m.navigate.mockRejectedValueOnce(new Error("Navigation failed"));
  await render(); await click("[data-market-entry]");
  expect(window.location.pathname).toBe("/");
  expect(host.querySelector("[data-market]")).toBeNull();
  expect(host.querySelector("[data-chat]")?.getAttribute("data-visible")).toBe("true");
});
it("shows loading and the existing disabled state instead of a blank Market page", async () => {
  let finish!: (value: AssistantConfigState) => void;
  m.config.mockReturnValueOnce(new Promise<AssistantConfigState>(resolve => { finish = resolve; }));
  await render("/assistant/market");
  expect(host.querySelector("[data-chat]")?.getAttribute("data-loading")).toBe("true");
  expect(host.querySelector("[data-chat]")?.getAttribute("data-visible")).toBe("true");
  await act(async () => finish({ ...config, enabled: false }));
  expect(host.querySelector("[data-market]")).toBeNull();
  expect(host.querySelector("[data-chat]")?.getAttribute("data-visible")).toBe("true");
  expect(host.querySelector("[data-chat]")?.getAttribute("data-enabled")).toBe("false");
});
it("leaves Market on a target change and does not retain its previous project view", async () => {
  await render("/assistant/market");
  await act(async () => {
    workspaceState.setContext("codex", "cli", null);
    window.dispatchEvent(new Event("luxipanel:target-changed"));
  });
  expect(window.location.pathname).toBe("/");
  expect(host.querySelector("[data-market]")).toBeNull();
  expect(workspaceState.getSnapshot().project).toBeNull();
});
