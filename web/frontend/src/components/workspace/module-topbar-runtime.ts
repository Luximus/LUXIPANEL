// SPDX-License-Identifier: AGPL-3.0-only
import { mountModuleTopbar } from "./module-topbar";

let cleanup: (() => void) | undefined;

function boot(): void {
  const drawer = document.getElementById("workspace-quick-drawer");
  if (!drawer || cleanup) return;
  if (!document.querySelector("link[data-module-topbar-style]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("./module-topbar-20261005-5.css", import.meta.url).href;
    link.dataset.moduleTopbarStyle = "";
    document.head.append(link);
  }
  drawer.dataset.moduleTopbarBooted = "true";
  const header = drawer.querySelector<HTMLElement>(".lxp-workspace-quick-header");
  if (!header) return;
  header.dataset.moduleTopbarRuntime = "";
  let tabs = header.querySelector<HTMLElement>("[data-module-header-tabs-slot]");
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.dataset.moduleHeaderTabsSlot = "";
    tabs.className = "lxp-workspace-header-tabs";
    header.querySelector("h2")?.after(tabs);
  }
  let actions = header.querySelector<HTMLElement>("[data-module-header-actions-slot]");
  if (!actions) {
    actions = document.createElement("div");
    actions.dataset.moduleHeaderActionsSlot = "";
    actions.className = "lxp-workspace-header-actions";
    header.querySelector<HTMLElement>(".ml-auto")?.prepend(actions);
  }
  let current: HTMLElement | null = null;
  let dispose: (() => void) | undefined;
  const sync = () => {
    const root = drawer.dataset.open === "true"
      ? drawer.querySelector<HTMLElement>(".lxp-internal-module:not([hidden])")
      : null;
    if (root === current) return;
    dispose?.();
    current = root;
    dispose = root ? mountModuleTopbar(root, drawer) : undefined;
  };
  const observer = new MutationObserver(sync);
  observer.observe(drawer, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-open", "hidden"] });
  sync();
  cleanup = () => {
    observer.disconnect();
    dispose?.();
    drawer.removeAttribute("data-module-topbar-booted");
    cleanup = undefined;
  };
}

function start(): void {
  boot();
  if (cleanup || !document.body) return;
  const pending = new MutationObserver(() => {
    boot();
    if (cleanup) pending.disconnect();
  });
  pending.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
document.addEventListener("astro:before-swap", () => cleanup?.());
document.addEventListener("astro:after-swap", start);
