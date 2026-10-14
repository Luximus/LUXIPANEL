import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/firebase", () => ({
  signInWithGoogle: vi.fn(), signInWithApple: vi.fn(), signInWithGithub: vi.fn(), signInWithMicrosoft: vi.fn(),
}));
vi.mock("./webauthn", () => ({ startAuthentication: vi.fn() }));

import { loginWithGoogleFirebase } from "./portal-auth";

afterEach(() => { vi.unstubAllGlobals(); });

describe("acceso OAuth en navegador del sistema", () => {
  it("canjea un código de un solo uso sin incluir tokens en el deep link", async () => {
    let counter = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => { bytes.fill(++counter); return bytes; },
      subtle: { digest: async () => new Uint8Array(32).fill(7).buffer },
    });
    let onLink: ((url: string) => void) | undefined;
    const openExternal = vi.fn().mockResolvedValue(true);
    const request = vi.fn().mockResolvedValue({ ok: true, status: 200, data: { ok: true, sessionToken: "jwt", refreshToken: "refresh", customer: { id: "c1", email: "u@example.com" } } });
    vi.stubGlobal("electronApi", { onDeeplink: (cb: (url: string) => void) => { onLink = cb; return () => { onLink = undefined; }; }, openExternal, request });
    const pending = loginWithGoogleFirebase();
    await vi.waitFor(() => expect(openExternal).toHaveBeenCalledOnce());
    const opened = new URL(openExternal.mock.calls[0][0]);
    expect(opened.pathname).toBe("/desktop-auth");
    expect(opened.searchParams.get("challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(opened.search).not.toContain("jwt");
    onLink?.(`luxipanel://auth?state=${opened.searchParams.get("state")}&code=${"c".repeat(43)}`);
    expect((await pending).sessionToken).toBe("jwt");
    const body = JSON.parse(request.mock.calls[0][0].body as string) as { code: string; verifier: string; state: string };
    expect(body.code).toBe("c".repeat(43));
    expect(body.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.state).toBe(opened.searchParams.get("state"));
    expect(onLink).toBeUndefined();
  });
});
