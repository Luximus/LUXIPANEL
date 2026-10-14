import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChatNavbar, type ChatNavbarProps } from "./ChatNavbar";

let root: Root;
let props: ChatNavbarProps;
beforeEach(() => {
  document.body.innerHTML = '<header data-assistant-topbar><span id="workspace-chat-navbar-controls"></span></header><div id="test-root"></div>';
  root = createRoot(document.getElementById("test-root")!);
  props = { project: { key: "project", label: "Proyecto", value: "loose", options: [{ key: "loose", name: "Chats sueltos" }, { key: "root", name: "LUXIPANEL" }], onChange: vi.fn() }, terminalAvailable: true, terminalLabel: "Terminal", multimediaLabel: "Multimedia", onTerminal: vi.fn(), onMultimedia: vi.fn() };
});
afterEach(async () => { await act(async () => root.unmount()); document.body.replaceChildren(); });
const trigger = () => document.querySelector<HTMLButtonElement>('[data-picker="project"]')!;
const key = async (value: string) => act(async () => trigger().dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));

it("portals the controls into the navbar and routes keyboard project selection", async () => {
  await act(async () => root.render(createElement(ChatNavbar, props)));
  expect(document.querySelector("#workspace-chat-navbar-controls")?.contains(trigger())).toBe(true);
  await key("ArrowDown");
  expect(document.querySelectorAll('[role="option"]')).toHaveLength(2);
  await key("End");
  await key("Enter");
  expect(props.project.onChange).toHaveBeenCalledWith("root");
  expect(document.querySelector('[data-navbar-project-menu]')).toBeNull();
  await act(async () => document.querySelector<HTMLButtonElement>('[data-search-target="chat-navbar-terminal"]')!.click());
  await act(async () => document.querySelector<HTMLButtonElement>('[data-search-target="chat-navbar-multimedia"]')!.click());
  expect(props.onTerminal).toHaveBeenCalledOnce();
  expect(props.onMultimedia).toHaveBeenCalledOnce();
});

it("keeps project editing reachable and hides Terminal when unavailable", async () => {
  const edit = vi.fn();
  props.project.action = { label: "Editar LUXIPANEL", onSelect: edit };
  await act(async () => root.render(createElement(ChatNavbar, { ...props, terminalAvailable: false })));
  expect(document.querySelector('[data-search-target="chat-navbar-terminal"]')).toBeNull();
  await act(async () => trigger().click());
  await key("Tab");
  expect(document.activeElement?.textContent).toBe("Editar LUXIPANEL");
  await act(async () => (document.activeElement as HTMLButtonElement).click());
  expect(edit).toHaveBeenCalledOnce();
});

it("closes the menu and moves controls to the current navbar after a SPA swap", async () => {
  await act(async () => root.render(createElement(ChatNavbar, props)));
  await act(async () => trigger().click());
  const previous = document.querySelector("header")!;
  const next = document.createElement("header");
  next.setAttribute("data-assistant-topbar", "");
  next.innerHTML = '<span id="workspace-chat-navbar-controls"></span>';
  await act(async () => { previous.replaceWith(next); document.dispatchEvent(new Event("astro:after-swap")); });
  expect(next.contains(trigger())).toBe(true);
  expect(previous.querySelector('[data-picker="project"]')).toBeNull();
  expect(document.querySelector('[data-navbar-project-menu]')).toBeNull();
});

it("keeps the same portal when its Astro host moves above the mobile input", async () => {
  await act(async () => root.render(createElement(ChatNavbar, props)));
  const host = document.getElementById("workspace-chat-navbar-controls")!;
  const composer = document.createElement("div");
  document.body.append(composer);
  composer.append(host);
  await act(async () => document.dispatchEvent(new Event("astro:page-load")));
  expect(composer.contains(trigger())).toBe(true);
  expect(document.querySelectorAll('[data-picker="project"]')).toHaveLength(1);
  await act(async () => trigger().click());
  await key("End");
  await key("Enter");
  expect(props.project.onChange).toHaveBeenCalledWith("root");
});
