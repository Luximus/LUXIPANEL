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
    <div id="module" data-internal-module="terminal"><section><div data-terminal-toolbar><div id="tabs-container" role="tablist"><div role="tab" id="tab-1">Terminal 1</div></div><button id="btn-new-tab">+</button><button id="terminal-status">Connected</button><button id="btn-reconnect" class="hidden">Reconnect</button></div><div id="terminal-container"></div></section><button id="btn-new-snippet">Snippet</button></div></div>`;
  const drawer = document.querySelector<HTMLElement>("#drawer")!;
  const module = document.querySelector<HTMLElement>("#module")!;
  const row = module.querySelector<HTMLElement>("[data-terminal-toolbar]")!;
  const tabs = row.querySelector("#tabs-container")!;
  const create = vi.fn();
  row.querySelector("#btn-new-tab")!.addEventListener("click", create);
  const dispose = mountModuleTopbar(module, drawer);
  expect(drawer.querySelector("header [data-terminal-toolbar]")).toBe(row);
  expect(drawer.querySelectorAll("#terminal-status")).toHaveLength(1);
  drawer.querySelector<HTMLButtonElement>("header #btn-new-tab")!.click();
  expect(create).toHaveBeenCalledOnce();
  tabs.insertAdjacentHTML("beforeend", '<div role="tab" id="tab-2">Terminal 2</div>');
  module.querySelector("#btn-new-snippet")!.textContent = "New snippet";
  await vi.advanceTimersByTimeAsync(100);
  expect(drawer.querySelector("header #tab-2")).not.toBeNull();
  expect(drawer.querySelectorAll("header [data-module-header-proxy]")).toHaveLength(1);
  desktop = false;
  media.dispatchEvent(new Event("change"));
  expect(module.querySelector("[data-terminal-toolbar]")).toBe(row);
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
  dispose();
  expect(module.querySelector("section > [data-terminal-toolbar]")).toBe(row);
  expect(row.nextElementSibling?.id).toBe("terminal-container");
  expect(drawer.querySelector("header #terminal-status")).toBeNull();
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
