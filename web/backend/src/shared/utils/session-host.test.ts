import { describe, expect, it } from "vitest";
import { resolveSessionPanelHost } from "./session-host.js";

describe("resolveSessionPanelHost", () => {
  it("prefiere SIEMPRE el targetHost del token (claim thost de LP)", () => {
    expect(
      resolveSessionPanelHost(
        { targetHost: "Acme.LuxiPanel.com", targetId: "panel:otro" },
        "spoofed.luxipanel.com",
      ),
    ).toBe("acme.luxipanel.com");
  });

  it("direct-SSH: acepta el host del header SOLO si su primer label es el subdominio de la sesión", () => {
    const user = { targetId: "panel:acme", targetName: "acme" };
    expect(resolveSessionPanelHost(user, "acme.luxipanel.com")).toBe("acme.luxipanel.com");
    expect(resolveSessionPanelHost(user, "ACME.luxipanel.com:443")).toBe("acme.luxipanel.com");
    // Header de otro tenant (token reproducido contra el host de la víctima) → descartado.
    expect(resolveSessionPanelHost(user, "victima.luxipanel.com")).toBeUndefined();
    expect(resolveSessionPanelHost(user, "evil.com")).toBeUndefined();
    expect(resolveSessionPanelHost(user, undefined)).toBeUndefined();
    expect(resolveSessionPanelHost(user, "")).toBeUndefined();
  });

  it("sin targetHost y sin sesión direct (targetId no panel:*) → undefined", () => {
    expect(
      resolveSessionPanelHost({ targetId: "8f2c1d", targetName: "srv-1" }, "acme.luxipanel.com"),
    ).toBeUndefined();
    expect(resolveSessionPanelHost(undefined, "acme.luxipanel.com")).toBeUndefined();
    expect(resolveSessionPanelHost(null, "acme.luxipanel.com")).toBeUndefined();
  });

  it("subdominio 'local' o vacío nunca resuelve (sesión sin panel)", () => {
    expect(
      resolveSessionPanelHost({ targetId: "panel:local" }, "local.luxipanel.com"),
    ).toBeUndefined();
    expect(resolveSessionPanelHost({ targetId: "panel:" }, "a.luxipanel.com")).toBeUndefined();
  });

  it("hosts malformados no resuelven (función pura, jamás lanza)", () => {
    const user = { targetId: "panel:acme" };
    for (const bad of ["acme", "acme.com", "acme..luxipanel..com.", "a cme.luxipanel.com", "acme.luxipanel.com/evil"]) {
      expect(() => resolveSessionPanelHost(user, bad)).not.toThrow();
    }
    expect(resolveSessionPanelHost(user, "acme.com")).toBeUndefined();
  });
});
