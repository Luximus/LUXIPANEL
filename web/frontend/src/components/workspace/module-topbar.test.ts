import { afterEach, expect, it, vi } from "vitest";
import { mountModuleTopbar } from "./module-topbar";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

it("moves live terminal controls into the header and restores them for mobile and teardown", async () => {
  vi.useFakeTimers();
  const media = window.matchMedia("(min-width: 1025px)");
  let desktop = true;
  Object.defineProperty(media, "matches", { get: () => desktop });
  vi.spyOn(window, "matchMedia").mockReturnValue(media);
  document.body.innerHTML = `<div id="drawer"><header><div data-module-header-tabs-slot></div><div data-module-header-actions-slot></div></header>
    <div id="module" data-internal-module="terminal"><section><div data-terminal-toolbar><div id="tabs-container" role="tablist"><div role="tab" id="tab-1">Terminal 1</div></div><button id="btn-new-tab">+</button><button id="terminal-status">Connected</button><button id="btn-reconnect" class="hidden">Reconnect</button></div><div id="terminal-container"></div></section><aside><div data-terminal-sidebar-tabs><button data-terminal-sidebar-tab="snippets" class="text-primary">Fragmentos</button><button data-terminal-sidebar-tab="history">Historial</button></div><button id="btn-new-snippet">Snippet</button></aside></div></div>`;
  const drawer = document.querySelector<HTMLElement>("#drawer")!;
  const module = document.querySelector<HTMLElement>("#module")!;
  const row = module.querySelector<HTMLElement>("[data-terminal-toolbar]")!;
  const tabs = row.querySelector("#tabs-container")!;
  const create = vi.fn();
  row.querySelector("#btn-new-tab")!.addEventListener("click", create);
  const sidebar = module.querySelector<HTMLElement>("[data-terminal-sidebar-tabs]")!;
  sidebar.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      sidebar.querySelectorAll("button").forEach((tab) => tab.classList.toggle("text-primary", tab === button));
    });
  });
  const dispose = mountModuleTopbar(module, drawer);
  expect(drawer.querySelector("header [data-terminal-toolbar]")).toBe(row);
  expect(drawer.querySelectorAll("#terminal-status")).toHaveLength(1);
  drawer.querySelector<HTMLButtonElement>("header #btn-new-tab")!.click();
  expect(create).toHaveBeenCalledOnce();
  expect(sidebar.hasAttribute("data-module-topbar-source")).toBe(true);
  const headerTabs = () => [...drawer.querySelectorAll<HTMLButtonElement>('.lxp-terminal-header-sidebar-tabs button')];
  expect(headerTabs().map((tab) => tab.textContent)).toEqual(["Fragmentos", "Historial"]);
  headerTabs()[0].focus();
  headerTabs()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await vi.advanceTimersByTimeAsync(100);
  expect(headerTabs()[1].getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(headerTabs()[1]);
  const newTab = row.querySelector<HTMLButtonElement>("#btn-new-tab")!;
  newTab.focus();
  tabs.insertAdjacentHTML("beforeend", '<div role="tab" id="tab-2">Terminal 2</div>');
  module.querySelector("#btn-new-snippet")!.textContent = "New snippet";
  await vi.advanceTimersByTimeAsync(100);
  expect(drawer.querySelector("header #tab-2")).not.toBeNull();
  expect(drawer.querySelectorAll("header [data-module-header-proxy]")).toHaveLength(3);
  expect(document.activeElement).toBe(newTab);
  desktop = false;
  media.dispatchEvent(new Event("change"));
  expect(module.querySelector("[data-terminal-toolbar]")).toBe(row);
  expect(sidebar.hasAttribute("data-module-topbar-source")).toBe(false);
  expect(headerTabs()).toHaveLength(0);
  const mobileHome = document.createComment("mobile-home");
  row.before(mobileHome);
  const mobileRail = document.createElement("aside");
  module.append(mobileRail);
  mobileRail.append(row);
  row.classList.add("lxp-terminal-tabs-controls");
  desktop = true;
  media.dispatchEvent(new Event("change"));
  expect(drawer.querySelector("header [data-terminal-toolbar]")).toBeNull();
  mobileHome.replaceWith(row);
  row.classList.remove("lxp-terminal-tabs-controls");
  mobileRail.remove();
  await vi.advanceTimersByTimeAsync(100);
  expect(drawer.querySelector("header [data-terminal-toolbar]")).toBe(row);
  expect(headerTabs()[1].getAttribute("aria-selected")).toBe("true");
  dispose();
  expect(module.querySelector("section > [data-terminal-toolbar]")).toBe(row);
  expect(row.nextElementSibling?.id).toBe("terminal-container");
  expect(drawer.querySelector("header #terminal-status")).toBeNull();
  expect(sidebar.hasAttribute("data-module-topbar-source")).toBe(false);
});

it("shows the Users tabs and actions in the header while keeping original handlers and IDs", async () => {
  vi.useFakeTimers();
  document.body.innerHTML = `<div id="drawer"><header><h2>Usuarios</h2><div data-module-header-tabs-slot></div><div data-module-header-actions-slot></div></header>
    <div id="module" data-internal-module="users"><div id="row"><div><button id="tab-users" class="tab-btn border-primary">Usuarios <span id="tab-users-count">10</span></button><button id="tab-roles" class="tab-btn">Grupos</button></div>
    <div><button id="btn-new-user" class="bg-primary">Nuevo usuario</button><button id="btn-hosting-plans">Planes de hosting</button><button id="btn-new-role" style="display:none">Nuevo grupo</button></div></div></div></div>`;
  const drawer = document.querySelector<HTMLElement>("#drawer")!;
  const module = document.querySelector<HTMLElement>("#module")!;
  const onUser = vi.fn();
  module.querySelector("#btn-new-user")!.addEventListener("click", onUser);
  const dispose = mountModuleTopbar(module, drawer);
  expect(drawer.querySelectorAll("[data-module-header-tabs-slot] button")).toHaveLength(2);
  expect(drawer.querySelectorAll("[data-module-header-actions-slot] button")).toHaveLength(2);
  expect(document.querySelectorAll("#tab-users-count")).toHaveLength(1);
  expect(module.querySelector("#row")?.hasAttribute("data-module-topbar-source-row")).toBe(true);
  drawer.querySelector<HTMLButtonElement>("[data-module-header-actions-slot] button")!.click();
  expect(onUser).toHaveBeenCalledOnce();

  const role = module.querySelector<HTMLButtonElement>("#btn-new-role")!;
  role.style.display = "inline-flex";
  await vi.advanceTimersByTimeAsync(100);
  expect(drawer.querySelectorAll("[data-module-header-actions-slot] button")).toHaveLength(3);
  dispose();
  expect(drawer.querySelector("[data-module-header-tabs-slot] button")).toBeNull();
  expect(module.querySelector("[data-module-topbar-source]")).toBeNull();
});

it("uses visible module tabs and excludes settings dialog tabs", () => {
  document.body.innerHTML = `<div id="drawer"><header><div data-module-header-tabs-slot></div><div data-module-header-actions-slot></div></header>
    <div id="module" data-internal-module="webhooks"><div data-view-settings-modal><dialog><div><button role="tab">Ajuste A</button><button role="tab">Ajuste B</button></div></dialog></div>
    <div><button data-tab="receive">Recibir</button><button data-tab="webhooks">Webhooks</button></div><section><button id="btn-new-gateway">Nuevo webhook</button></section></div></div>`;
  const drawer = document.querySelector<HTMLElement>("#drawer")!;
  const dispose = mountModuleTopbar(document.querySelector<HTMLElement>("#module")!, drawer);
  expect([...drawer.querySelectorAll("[data-module-header-tabs-slot] button")].map((button) => button.textContent)).toEqual(["Recibir", "Webhooks"]);
  expect(drawer.querySelector("[data-module-header-actions-slot] button")?.textContent).toBe("Nuevo webhook");
  dispose();
});
