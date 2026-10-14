import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/i18n-client.js", () => ({ getClientMessages: async () => ({ panelLayout: {
  nav: { files: "Archivos", monitor: "Monitor", firewall: "Firewall", assistant: "Agentes IA" },
  groups: { modules: "Módulos" }, commandSub: {}, actions: {},
} }) }));
vi.mock("/scripts/extracted/lib/native-bridge.js", () => ({
  notifyNativeTheme() {}, notifyNativeLanguage() {}, isAppWebView: () => false,
}));
vi.mock("/scripts/extracted/lib/module-icons.generated.js", () => ({ MODULE_ICON_SVGS: {} }));
vi.mock("/scripts/extracted/lib/logout.js", () => ({ bindLogout() {} }));
vi.mock("@/lib/api-client", () => ({
  resolvePanelApiPath: (path: string) => path, scopeHeaders: () => ({}), getCsrfToken: () => "",
  resolveTargetScope: () => "local", readTargetUiPrefs: () => null, writeTargetUiPrefs() {},
  fetchUiPreferences: async () => null, putUiPreferences() {}, CSRF_HEADER_NAME: "X-CSRF-Token",
}));

import initScript from "./PanelLayout-define-vars-script1";

beforeEach(() => {
  document.body.innerHTML = `<div data-workspace-shell>
    <aside id="sidebar"><nav><div id="nav-modules-group"><div></div></div></nav><a href="/modules" data-tool>Módulos</a></aside>
    <aside id="sidebar-mobile"><nav><div id="nav-modules-group"><div></div></div></nav></aside>
  </div>`;
  Object.assign(window, { __lxp_panel_init_done: true, __lxp_panel_runtime_version: "20261002-sidebar-load", __lxp_cmd_items: undefined });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, data: [
    { id: "files" }, { id: "monitor" }, { id: "firewall", showInSidebar: false },
  ] }))));
});

afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

const init = (permissions = ["files", "monitor"]) => initScript({
  locale: "es", canLoadInstalledModules: true, canAccessSettings: false, sidebarPermissions: permissions,
});

it("loads desktop and mobile modules on the first workspace render, honoring visibility", async () => {
  await init();
  await vi.waitFor(() => expect(document.querySelectorAll('#sidebar a[data-module="files"]')).toHaveLength(1));
  expect(document.querySelectorAll('#sidebar-mobile a[data-module="files"]')).toHaveLength(1);
  expect(document.querySelectorAll('a[data-module="firewall"],a[data-module="assistant"]')).toHaveLength(0);
  expect(document.querySelector('#sidebar [data-tool]')?.textContent).toBe("Módulos");
});

it("refreshes both module menus without duplicating links", async () => {
  await init();
  await vi.waitFor(() => expect(document.querySelectorAll('a[data-module="files"]')).toHaveLength(2));
  await init();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(document.querySelectorAll('a[data-module="files"]')).toHaveLength(2);
});

it("keeps modules outside the user's sidebar permissions hidden", async () => {
  await init(["files"]);
  await vi.waitFor(() => expect(document.querySelectorAll('a[data-module="files"]')).toHaveLength(2));
  expect(document.querySelectorAll('a[data-module="monitor"]')).toHaveLength(0);
});
