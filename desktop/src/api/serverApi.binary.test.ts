import { afterEach, describe, expect, it, vi } from "vitest";
import { callServerApi, downloadServerFile, registerDirectServer, unregisterDirectServer, uploadServerFile } from "./serverApi";

afterEach(() => { unregisterDirectServer("test-box"); vi.unstubAllGlobals(); });

describe("transferencia binaria directa", () => {
  it("pasa bytes por el proceso principal y conserva CSRF sin fetch del renderer", async () => {
    const downloadBinary = vi.fn().mockResolvedValue({ ok: true, status: 200, bytes: new Uint8Array([0, 255, 10]) });
    const uploadBinary = vi.fn().mockResolvedValue({ ok: true, status: 201, data: { ok: true } });
    vi.stubGlobal("electronApi", { downloadBinary, uploadBinary });
    registerDirectServer("test-box", { baseUrl: "https://box.example", jwt: "jwt", csrf: { name: "luxipanel_csrf", value: "csrf" }, exp: 0 });

    const blob = await downloadServerFile("test-box", "", "/api/files/download?path=%2Fa");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0, 255, 10]);
    expect(downloadBinary).toHaveBeenCalledWith({ url: "https://box.example/api/files/download?path=%2Fa", headers: { Authorization: "Bearer jwt", "x-client-platform": "desktop" } });

    const result = await uploadServerFile("test-box", "", "/api/files/upload?dest=%2Fa", new Blob([new Uint8Array([1, 2, 3])]));
    expect(result.ok).toBe(true);
    expect(uploadBinary.mock.calls[0][0].headers).toMatchObject({ "X-CSRF-Token": "csrf", Cookie: "luxipanel_csrf=csrf" });
    expect([...uploadBinary.mock.calls[0][0].bytes]).toEqual([1, 2, 3]);
  });

  it("propaga un rechazo del panel aunque HTTP responda 200", async () => {
    vi.stubGlobal("electronApi", { request: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: false, error: "Sin permiso" } }) });
    registerDirectServer("test-box", { baseUrl: "https://box.example", jwt: "jwt", csrf: null, exp: 0 });
    const result = await callServerApi("test-box", "", "GET", "/api/modules/installed");
    expect(result).toMatchObject({ ok: false, error: "Sin permiso" });
  });
});
