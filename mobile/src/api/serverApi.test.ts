import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  callServerApi,
  downloadServerFile,
  invalidateServerCache,
  registerDirectServer,
  unregisterDirectServer,
  uploadServerFile,
  unwrap,
} from "./serverApi";
import { runServerMutation } from "../hooks/useServerApi";
import { resetAllStores } from "../lib/store-reset";

vi.mock("react-native", () => ({AppState:{currentState:"active",addEventListener:()=>({remove:()=>{}})}}));

const PANEL = "panel-1";
const TOKEN = "portal-token";
const fetchMock = vi.fn();
const panelResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  invalidateServerCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  registerDirectServer(PANEL, {
    baseUrl: "https://panel.example.com",
    jwt: "box-session",
    csrf: { name: "luxipanel_csrf", value: "csrf-value" },
    exp: 0,
  });
});

afterEach(() => {
  unregisterDirectServer(PANEL);
  vi.unstubAllGlobals();
});

describe("API directa por servidor", () => {
  it("descarta las sesiones transferidas a consolas al cerrar sesión de la cuenta", async () => {
    resetAllStores();
    expect(await callServerApi(PANEL, TOKEN, "GET", "/api/auth/ws-token")).toMatchObject({ ok: false, code: "DIRECT_AUTH_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("usa el origen y la sesión del box; deduplica lecturas del mismo servidor", async () => {
    fetchMock.mockResolvedValue(panelResponse({ ok: true, data: [{ id: "u1" }] }));
    const [a, b] = await Promise.all([
      callServerApi(PANEL, TOKEN, "GET", "/api/users"),
      callServerApi(PANEL, TOKEN, "GET", "/api/users"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://panel.example.com/api/users");
    expect(fetchMock.mock.calls[0]?.[1]?.headers.Authorization).toBe("Bearer box-session");
    expect(unwrap(a)).toEqual([{ id: "u1" }]);
    expect(a).toEqual(b);
  });

  it("no reutiliza datos de una sesión anterior del mismo panel", async () => {
    fetchMock.mockResolvedValueOnce(panelResponse({ ok: true, data: ["old"] }));
    await callServerApi(PANEL, TOKEN, "GET", "/api/users");
    registerDirectServer(PANEL, { baseUrl: "https://other.example.com", jwt: "new-session", csrf: null, exp: 0 });
    fetchMock.mockResolvedValueOnce(panelResponse({ ok: true, data: ["new"] }));
    expect(unwrap(await callServerApi(PANEL, TOKEN, "GET", "/api/users"))).toEqual(["new"]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://other.example.com/api/users");
  });

  it("falla cerrado si no hay conexión directa y nunca llama al gateway retirado", async () => {
    unregisterDirectServer(PANEL);
    const result = await callServerApi(PANEL, TOKEN, "GET", "/api/users");
    expect(result).toMatchObject({ ok: false, code: "DIRECT_AUTH_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(downloadServerFile(PANEL, TOKEN, "/api/files/download?path=a")).rejects.toThrow("connect_required");
    expect(await uploadServerFile(PANEL, TOKEN, "/api/files/upload?dest=/", { uri: "file:///a", name: "a" }))
      .toMatchObject({ ok: false, code: "DIRECT_AUTH_REQUIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("solicita reconexión cuando el box devuelve 401", async () => {
    fetchMock.mockResolvedValue(panelResponse({ ok: false, error: "expired" }, 401));
    expect(await callServerApi(PANEL, TOKEN, "GET", "/api/users"))
      .toMatchObject({ ok: false, code: "DIRECT_AUTH_REQUIRED" });
  });

  it("respeta un ok:false del panel aunque HTTP devuelva 200 y no cachea el fallo", async () => {
    fetchMock.mockResolvedValueOnce(panelResponse({ ok: false, code: "DENIED", error: "Permiso requerido" }));
    fetchMock.mockResolvedValueOnce(panelResponse({ ok: true, data: ["ready"] }));
    const denied = await callServerApi(PANEL, TOKEN, "GET", "/api/users");
    expect(denied).toMatchObject({ ok: false, code: "DENIED", error: "Permiso requerido" });
    expect(unwrap(denied)).toBeNull();
    expect(unwrap(await callServerApi(PANEL, TOKEN, "GET", "/api/users"))).toEqual(["ready"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("envía CSRF en mutaciones y no anuncia éxito ante error interno", async () => {
    fetchMock.mockResolvedValue(panelResponse({ ok: false, error: "No autorizado" }));
    const result = await runServerMutation(PANEL, TOKEN, () => callServerApi(PANEL, TOKEN, "POST", "/api/users", { name: "x" }));
    expect(result).toMatchObject({ ok: false, error: "No autorizado" });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    expect(headers["X-CSRF-Token"]).toBe("csrf-value");
    expect(headers.Cookie).toBe("luxipanel_csrf=csrf-value");
  });

  it("no anuncia éxito si el trabajo diferido falla", async () => {
    fetchMock.mockResolvedValueOnce(panelResponse({ ok: true, job: { id: "job-1", mode: "queued" } }));
    fetchMock.mockResolvedValueOnce(panelResponse({ ok: true, data: { state: "failed", error: "No aplicado" } }));
    const result = await runServerMutation(PANEL, TOKEN, () => callServerApi(PANEL, TOKEN, "POST", "/api/users", { name: "x" }));
    expect(result).toMatchObject({ ok: false, error: "No aplicado" });
  });
});

describe("renovación de sesión y respuestas de exportación", () => {
  const jwt = (nonce: string) => `header.${btoa(JSON.stringify({userId:1,username:"tester",kind:"admin",nonce}))}.signature`;
  it("conserva el resultado de una mutación que renovó su propio JWT", async () => {
    const fresh = {baseUrl:"https://panel.example.com",jwt:jwt("new"),exp:0,csrf:null};
    const relogin = vi.fn(async () => { registerDirectServer(PANEL, fresh); return fresh; });
    registerDirectServer(PANEL, {...fresh,jwt:jwt("old"),relogin});
    fetchMock.mockResolvedValueOnce(panelResponse({ok:false},401)).mockResolvedValueOnce(panelResponse({ok:true,data:{saved:true}}));
    expect(unwrap(await callServerApi(PANEL,TOKEN,"PUT","/api/files/preferences",{showHidden:true}))).toEqual({saved:true});
    expect(relogin).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${fresh.jwt}`);
  });
  it("descarta una respuesta pendiente si se cerró la sesión", async () => {
    let resolve!: (response: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(done => {resolve=done;}));
    const pending = callServerApi(PANEL,TOKEN,"PUT","/api/files/preferences",{showHidden:true});
    unregisterDirectServer(PANEL);
    resolve(panelResponse({ok:true,data:{saved:true}}));
    expect(await pending).toMatchObject({ok:false,code:"DIRECT_AUTH_REQUIRED"});
  });
  it("conserva SQL de exportación como texto", async () => {
    fetchMock.mockResolvedValue({ok:true,status:200,headers:{get:()=>"application/sql"},text:async()=>"CREATE TABLE example (id INTEGER);"});
    expect(unwrap(await callServerApi(PANEL,TOKEN,"GET","/api/databases/export?database=example"))).toBe("CREATE TABLE example (id INTEGER);");
  });
});
it("interrumpe una petición directa al superar el plazo de espera", async () => {
 vi.useFakeTimers();
 try {
  fetchMock.mockImplementationOnce((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener("abort",()=>reject(new Error("timeout")))));
  const response=callServerApi(PANEL,TOKEN,"GET","/api/slow",undefined,{timeoutMs:1000});
  await vi.advanceTimersByTimeAsync(1001);
  expect(await response).toMatchObject({ok:false,code:"PANEL_UNAVAILABLE",error:"timeout"});
 } finally {vi.useRealTimers();}
});
