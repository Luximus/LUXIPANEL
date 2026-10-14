import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { messages } = vi.hoisted(() => ({ messages: vi.fn() }));
vi.mock("@/i18n/client", () => ({ getClientMessages: messages }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const translatedErrors = {
  errors: {
    networkError: {
      serverError: "Error del servidor {status}",
      invalidResponse: "Respuesta inválida",
      connectionFailed: "Sin conexión",
      targetScopeChanged: "Servidor cambiado",
      bridgeSessionRequired: "Reconecta el servidor",
    },
    error400: { description: "Solicitud inválida" },
    error401: { description: "Sesión vencida" },
    error403: { description: "Acceso denegado" },
    error404: { description: "No encontrado" },
    error500: { title: "Error interno" },
    error503: { title: "Servicio no disponible" },
  },
};

let locale: ReturnType<typeof deferred<typeof translatedErrors>>;
const fetchMock = vi.fn<typeof fetch>();
const previousLanguage = document.documentElement.lang;

beforeEach(() => {
  vi.resetModules();
  locale = deferred<typeof translatedErrors>();
  messages.mockReset().mockReturnValue(locale.promise);
  fetchMock.mockReset().mockResolvedValue(new Response('{"ok":true,"data":["ready"]}'));
  vi.stubGlobal("fetch", fetchMock);
  document.body.innerHTML = "";
  document.documentElement.lang = "es";
  document.cookie = "luxipanel_csrf=qa-csrf; path=/";
  sessionStorage.clear();
  delete (window as unknown as Record<symbol, unknown>)[Symbol.for("luxipanel.read-cache.v2")];
});

afterEach(async () => {
  locale.resolve(translatedErrors);
  await locale.promise.catch(() => undefined);
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.cookie = "luxipanel_csrf=; max-age=0; path=/";
  document.documentElement.lang = previousLanguage;
});

describe("API requests while error translations download", () => {
  it.each([undefined, new AbortController().signal])("rejects late uncached reads after a session changes on the same server (signal: %s)", async (signal) => {
    const {api} = await import("./api-client");
    const response = deferred<Response>(); fetchMock.mockReturnValue(response.promise);
    const pending = api.get("/api/files/list", {signal});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("luxipanel:session-started"));
    response.resolve(new Response('{"ok":true,"data":["previous-session"]}'));
    const result = await pending;
    expect(result).toMatchObject({ok: false, code: "TARGET_SCOPE_CHANGED", status: 409});
    expect(result.data).toBeUndefined();
  });

  it("returns a scoped failure instead of rejecting when a queued uncached read is cancelled", async () => {
    const {api} = await import("./api-client");
    const response = deferred<Response>();
    fetchMock.mockImplementation(() => response.promise.then(value => value.clone()));
    const running = Array.from({length: 4}, () => api.get("/api/files/list"));
    const queued = api.get("/api/files/preferences");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    window.dispatchEvent(new Event("luxipanel:target-changed"));
    await expect(queued).resolves.toMatchObject({ok: false, code: "TARGET_SCOPE_CHANGED"});
    response.resolve(new Response('{"ok":true,"data":[]}')); await Promise.all(running);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("refreshes a pending history after restoring a chat marks it reviewed, sharing the retry", async () => {
    const { api } = await import("./api-client");
    const oldHistory = deferred<Response>();
    const newHistory = deferred<Response>();
    let reads = 0;
    fetchMock.mockImplementation((_path, options) => options?.method === "POST"
      ? Promise.resolve(new Response('{"ok":true}'))
      : ++reads === 1 ? oldHistory.promise : newHistory.promise);
    const path = "/api/ai/conversations?limit=15";
    const pending = [api.get(path), api.get(path)];
    await vi.waitFor(() => expect(reads).toBe(1));
    await api.post("/api/ai/conversations/chat/reviewed", {});
    oldHistory.resolve(new Response('{"ok":true,"data":["old-history"]}'));
    await vi.waitFor(() => expect(reads).toBe(2));
    newHistory.resolve(new Response('{"ok":true,"data":["updated-history"]}'));
    expect(await Promise.all(pending)).toEqual([
      expect.objectContaining({ ok: true, data: ["updated-history"] }),
      expect.objectContaining({ ok: true, data: ["updated-history"] }),
    ]);
    expect(reads).toBe(2);
  });

  it("discards a cached history when the actual server changes without retrying it", async () => {
    const { api } = await import("./api-client");
    const history = deferred<Response>();
    sessionStorage.setItem("panel-active-target-scope", "server-a");
    fetchMock.mockReturnValue(history.promise);
    const pending = api.get("/api/ai/conversations?limit=15");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    sessionStorage.setItem("panel-active-target-scope", "server-b");
    history.resolve(new Response('{"ok":true,"data":["old-server"]}'));
    locale.resolve(translatedErrors);
    expect(await pending).toMatchObject({ ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns successful module data before error translations are ready", async () => {
    const { api } = await import("./api-client");
    const result = await api.get("/api/files/list");
    expect(result).toMatchObject({ ok: true, data: ["ready"] });
    expect(messages).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/files/list", expect.objectContaining({ credentials: "include", cache: "no-store" }));
  });

  it("starts concurrent reads together and shares the translation download", async () => {
    const { api } = await import("./api-client");
    fetchMock.mockImplementation(async () => new Response('{"ok":true,"data":[]}'));
    await Promise.all([api.get("/api/files/allowed-bases"), api.get("/api/files/preferences")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(messages).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["HTTP failure", 401, '{"ok":false,"code":"SERVER_ERROR:401"}', "Sesión vencida"],
    ["gateway HTML", 503, "<html>Service unavailable</html>", "Servicio no disponible"],
    ["invalid success body", 200, "<html>Unexpected HTML</html>", "Respuesta inválida"],
    ["semantic failure", 200, '{"ok":false,"code":"BRIDGE_SESSION_REQUIRED"}', "Reconecta el servidor"],
  ])("keeps %s localized even when the response arrives first", async (_name, status, body, expected) => {
    const { api } = await import("./api-client");
    fetchMock.mockResolvedValue(new Response(body, { status }));
    let settled = false;
    const pending = api.get("/api/files/list").then(result => { settled = true; return result; });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(messages).toHaveBeenCalledTimes(1));
    expect(settled).toBe(false);
    locale.resolve(translatedErrors);
    expect(await pending).toMatchObject({ ok: false, error: expected, status });
  });

  it("keeps transport failures localized", async () => {
    const { api } = await import("./api-client");
    fetchMock.mockRejectedValue(new Error("offline"));
    const pending = api.get("/api/files/list");
    locale.resolve(translatedErrors);
    expect(await pending).toMatchObject({ ok: false, error: "Sin conexión", status: 0 });
  });

  it("captures target and bridge before translations settle and rejects a stale reply", async () => {
    const { api } = await import("./api-client");
    const response = deferred<Response>();
    sessionStorage.setItem("panel-active-target-scope", "server-a");
    sessionStorage.setItem("panel-active-bridge-session", "bridge-a");
    fetchMock.mockReturnValue(response.promise);
    const pending = api.patch("/api/files/preferences", { showHidden: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/files/preferences", expect.objectContaining({
      headers: { "X-Bridge-Session-Id": "bridge-a", "X-CSRF-Token": "qa-csrf", "Content-Type": "application/json" },
      body: '{"showHidden":true}',
    }));
    sessionStorage.setItem("panel-active-target-scope", "server-b");
    response.resolve(new Response('{"ok":true,"data":["old-server"]}'));
    locale.resolve(translatedErrors);
    expect(await pending).toMatchObject({ ok: false, code: "TARGET_SCOPE_CHANGED", error: "Servidor cambiado", status: 409 });
  });

  it("allows a successful upload while translations are still pending", async () => {
    const { uploadFile } = await import("./api-client");
    expect(await uploadFile("/api/files/upload", new File(["text"], "note.txt"))).toMatchObject({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/files/upload", expect.objectContaining({
      headers: expect.objectContaining({ "X-CSRF-Token": "qa-csrf", "X-Filename": "note.txt" }),
    }));
  });

  it("drops an old server's failure if the target changes while translations download", async () => {
    const { api } = await import("./api-client");
    const consumed = deferred<void>();
    sessionStorage.setItem("panel-active-target-scope", "server-a");
    const response = new Response('', { status: 401 });
    vi.spyOn(response, "text").mockImplementation(async () => {
      consumed.resolve();
      return '{"ok":false,"code":"SERVER_ERROR:401","data":["old-server"]}';
    });
    fetchMock.mockResolvedValue(response);
    const pending = api.get("/api/files/list");
    await consumed.promise;
    await Promise.resolve();
    sessionStorage.setItem("panel-active-target-scope", "server-b");
    locale.resolve(translatedErrors);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, code: "TARGET_SCOPE_CHANGED", status: 409 });
    expect(result.data).toBeUndefined();
  });

  it("still localizes an upload failure", async () => {
    const { uploadFile } = await import("./api-client");
    fetchMock.mockResolvedValue(new Response('{"ok":false,"code":"SERVER_ERROR:403"}', { status: 403 }));
    const pending = uploadFile("/api/files/upload", new File(["text"], "note.txt"));
    locale.resolve(translatedErrors);
    expect(await pending).toMatchObject({ ok: false, error: "Acceso denegado", status: 403 });
  });

  it("keeps readable fallback failures if the translations are unavailable", async () => {
    const { api } = await import("./api-client");
    fetchMock.mockRejectedValue(new Error("offline"));
    const pending = api.get("/api/files/list");
    locale.reject(new Error("translation download failed"));
    expect(await pending).toMatchObject({ ok: false, error: "Could not connect to the server. Check your connection and try again.", status: 0 });
  });
  it("reports list freshness again when reopening uses a cached response", async () => {
    const {api}=await import("./api-client");
    fetchMock.mockImplementation(async()=>new Response(JSON.stringify({ok:true,data:[{id:1}],meta:{freshness:{version:"cached-reopen",state:"fresh",collectedAt:100,checkedAt:101}}})));
    const event=vi.fn();window.addEventListener("lxp:data:freshness",event);
    try {
      await api.get("/api/users");event.mockClear();
      await api.get("/api/users");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(event).toHaveBeenCalledTimes(1);
      expect((event.mock.calls[0][0] as CustomEvent).detail).toMatchObject({resource:"users/system",ok:true,freshness:{version:"cached-reopen"}});
    } finally {window.removeEventListener("lxp:data:freshness",event);}
  });

});
