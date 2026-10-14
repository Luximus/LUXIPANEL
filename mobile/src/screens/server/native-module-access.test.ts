import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchNativeModuleAccess, fetchNativeModuleCatalog, fetchNativeModuleMenu } from "./native-module-access";
import { callServerApi } from "../../api/serverApi";

vi.mock("../../api/serverApi", () => ({
  withFreshGateway: (fn: () => unknown) => fn(),
  callServerApi: vi.fn(),
  unwrap: (response: { data?: unknown }) => response.data ?? null,
}));
const api = vi.mocked(callServerApi);

beforeEach(() => api.mockReset());

describe("catálogo nativo autorizado", () => {
  it("incluye solo módulos habilitados y herramientas permitidas", async () => {
    api.mockResolvedValue({ ok: true, data: { modules: { assistant: true, terminal: false }, available: [
      { id: "firewall" }, { id: "codebase-graph" }, { id: "custom-module" },
    ] } });
    const ids = await fetchNativeModuleAccess("box-1");
    expect([...ids]).toEqual(["chat", "preferences", "modules", "settings", "server-alerts", "assistant", "firewall", "codebase-graph"]);
    expect(ids.has("terminal")).toBe(false);
    expect(ids.has("custom-module")).toBe(false);
  });

  it("falla cerrado cuando el servidor no devuelve un catálogo válido", async () => {
    api.mockResolvedValue({ ok: true, data: { available: null } });
    await expect(fetchNativeModuleAccess("box-1")).rejects.toThrow("The server response is invalid.");
  });

  it("conserva el orden del servidor y habilita Mapa con Mis módulos", async () => {
    api.mockResolvedValue({ ok: true, data: { modules: {}, available: [
      { id: "files", name: "Archivos" }, { id: "module-dev", name: "Mis módulos" }, { id: "users", name: "Usuarios" },
    ] } });
    const catalog = await fetchNativeModuleCatalog("box-1");
    expect(catalog.available.map((item) => item.id)).toEqual(["files", "module-dev", "users"]);
    expect(catalog.ids.has("project-map")).toBe(true);
  });
});

describe("catálogo del menú web", () => {
  const access = { modules: { assistant: true, terminal: true }, available: [{ id: "files" }, { id: "users" }] };

  it("consulta el orden y la visibilidad del servidor conectado sin quitar el acceso a herramientas ocultas", async () => {
    const sidebar = [{ id: "users" }, { id: "terminal", showInSidebar: false }, { id: "files" }];
    api.mockImplementation(async (_panel, _token, _method, path) => ({ ok: true, data: path === "/api/me/modules" ? access : sidebar }));
    const catalog = await fetchNativeModuleMenu("remote-context");
    expect(catalog.sidebar).toEqual(sidebar);
    expect(catalog.ids.has("terminal")).toBe(true);
    expect(api.mock.calls.map(call => call.slice(0, 4))).toEqual([
      ["remote-context", "", "GET", "/api/me/modules"],
      ["remote-context", "", "GET", "/api/modules/installed"],
    ]);
  });

  it("usa el catálogo de compatibilidad en su orden y descarta los módulos deshabilitados", async () => {
    api.mockImplementation(async (_panel, _token, _method, path) => {
      if (path === "/api/me/modules") return { ok: true, data: access };
      if (path === "/api/modules/installed") return { ok: false, status: 404 };
      return { ok: true, data: [{ id: "users", enabled: true }, { id: "files", enabled: false }, { id: "terminal", installed: true }] };
    });
    const catalog = await fetchNativeModuleMenu("box-1");
    expect(catalog.sidebar.map(module => module.id)).toEqual(["users", "terminal"]);
    expect(api).toHaveBeenCalledWith("box-1", "", "GET", "/api/admin/modules");
  });

  it("no inventa un orden cuando fallan ambas lecturas del menú", async () => {
    api.mockImplementation(async (_panel, _token, _method, path) => path === "/api/me/modules"
      ? { ok: true, data: access } : { ok: false, error: "Sin conexión" });
    await expect(fetchNativeModuleMenu("box-1")).rejects.toThrow("Sin conexión");
  });
});
