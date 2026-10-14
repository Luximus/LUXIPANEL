import { afterEach, describe, expect, it, vi } from "vitest";
import { redeemPanelHandoff } from "./directAuth";

afterEach(() => { vi.unstubAllGlobals(); });

describe("redeemPanelHandoff", () => {
  it("canjea el ticket una vez mediante POST y mantiene el ticket fuera del URL", async () => {
    const requestWithCookies = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, data: {}, cookies: "luxipanel_csrf=csrf123; Path=/" })
      .mockResolvedValueOnce({ ok: true, status: 200, data: "<html />", cookies: "luxipanel_session=jwt123; HttpOnly; Path=/" });
    vi.stubGlobal("electronApi", { requestWithCookies });

    const result = await redeemPanelHandoff("https://box.example/api/auth/sso/handoff?ticket=secret-ticket");
    expect(result).toEqual({ baseUrl: "https://box.example", session: { jwt: "jwt123", csrf: { name: "luxipanel_csrf", value: "csrf123" }, exp: 0 } });
    expect(requestWithCookies).toHaveBeenCalledTimes(2);
    expect(requestWithCookies.mock.calls[1][0]).toMatchObject({
      url: "https://box.example/api/auth/sso/handoff",
      method: "POST",
      headers: { "X-CSRF-Token": "csrf123", Cookie: "luxipanel_csrf=csrf123" },
      body: JSON.stringify({ ticket: "secret-ticket" }),
    });
  });

  it("rechaza rutas inesperadas y tickets ya consumidos", async () => {
    const requestWithCookies = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, data: {}, cookies: "" })
      .mockResolvedValueOnce({ ok: true, status: 200, data: "login", cookies: "" });
    vi.stubGlobal("electronApi", { requestWithCookies });
    expect(await redeemPanelHandoff("https://box.example/login?ticket=x")).toBeNull();
    expect(await redeemPanelHandoff("https://box.example/api/auth/sso/handoff?ticket=x")).toBeNull();
    expect(requestWithCookies).toHaveBeenCalledTimes(2);
  });
});
