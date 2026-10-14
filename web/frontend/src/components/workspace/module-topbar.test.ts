import { afterEach, expect, it, vi } from "vitest";
import { mountModuleTopbar } from "./module-topbar";

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
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
