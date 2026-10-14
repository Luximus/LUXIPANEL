import { describe, it, expect } from "vitest";
import type { Panel } from "../../types/models";
import {
  getWindowTitle,
  maskIp,
  getPanelHost,
  panelHostLabel,
  getPanelSubdomainLabel,
  getPanelDisplayName,
  getLicenseState,
  getSshState,
  detectPanelProvider,
} from "./utils";

// Fixture mínima: solo los campos que tocan las funciones puras bajo prueba.
function panel(overrides: Partial<Panel> = {}): Panel {
  return overrides as Panel;
}

describe("getWindowTitle", () => {
  it("muestra el subdominio estático en vista ssh", () => {
    expect(getWindowTitle("ssh", "mipanel")).toBe("LUXIPANEL - mipanel");
  });
  it("cae a LUXIPANEL si no hay label en ssh", () => {
    expect(getWindowTitle("ssh", "")).toBe("LUXIPANEL");
  });
  it("cae a LUXIPANEL en cualquier otra vista", () => {
    expect(getWindowTitle("dashboard", "mipanel")).toBe("LUXIPANEL");
  });
});

describe("maskIp", () => {
  it("devuelve - para null", () => {
    expect(maskIp(null)).toBe("-");
  });
  it("enmascara los octetos centrales de una IPv4", () => {
    expect(maskIp("192.168.1.50")).toBe("192.xxx.xxx.50");
  });
  it("devuelve el valor tal cual si no tiene 4 octetos", () => {
    expect(maskIp("no-ip")).toBe("no-ip");
    expect(maskIp("10.0.0")).toBe("10.0.0");
  });
});

describe("getPanelHost", () => {
  it("usa SOLO customDomain (managedDomain retirado se ignora)", () => {
    expect(getPanelHost(panel({ managedDomain: "a.example.com", customDomain: "b.com" }))).toBe("b.com");
    expect(getPanelHost(panel({ managedDomain: "a.example.com" }))).toBe("-");
  });
  it("devuelve la URL completa tal cual (esquema/puerto preservados)", () => {
    expect(getPanelHost(panel({ customDomain: "https://panel.midominio.com:8443" }))).toBe("https://panel.midominio.com:8443");
  });
  it("devuelve - sin URL configurada", () => {
    expect(getPanelHost(panel())).toBe("-");
    expect(getPanelHost(panel({ customDomain: "  " }))).toBe("-");
  });
});

describe("panelHostLabel", () => {
  it("extrae el host (con puerto no estándar) de una URL completa", () => {
    expect(panelHostLabel("https://panel.midominio.com:8443/ruta")).toBe("panel.midominio.com:8443");
    expect(panelHostLabel("http://1.2.3.4:8080")).toBe("1.2.3.4:8080");
  });
  it("acepta hosts pelados (default https)", () => {
    expect(panelHostLabel("panel.midominio.com")).toBe("panel.midominio.com");
  });
  it("devuelve el valor tal cual si está vacío o es -", () => {
    expect(panelHostLabel("-")).toBe("-");
    expect(panelHostLabel("")).toBe("-");
  });
});

describe("getPanelSubdomainLabel", () => {
  it("extrae el primer label del host", () => {
    expect(getPanelSubdomainLabel("backend.midominio.com")).toBe("backend");
  });
  it("acepta URLs completas", () => {
    expect(getPanelSubdomainLabel("https://panel.midominio.com:8443")).toBe("panel");
  });
  it("muestra las IP completas (no su primer octeto)", () => {
    expect(getPanelSubdomainLabel("1.2.3.4:8443")).toBe("1.2.3.4:8443");
  });
  it("devuelve el host tal cual si está vacío o es -", () => {
    expect(getPanelSubdomainLabel("-")).toBe("-");
    expect(getPanelSubdomainLabel("")).toBe("");
  });
});

describe("getPanelDisplayName", () => {
  it("usa licenseName si existe", () => {
    expect(getPanelDisplayName(panel({ licenseName: "Mi Panel" }))).toBe("Mi Panel");
  });
  it("cae a licenseKey", () => {
    expect(getPanelDisplayName(panel({ licenseKey: "KEY-123" }))).toBe("KEY-123");
  });
  it("cae a la etiqueta corta del host de la URL de acceso", () => {
    expect(getPanelDisplayName(panel({ customDomain: "https://backend.midominio.com" }))).toBe("backend");
  });
});

describe("getLicenseState", () => {
  it("respeta licenseState explícito", () => {
    expect(getLicenseState(panel({ licenseState: "custom" }))).toBe("custom");
  });
  it("activo en grace_period y active", () => {
    expect(getLicenseState(panel({ status: "active" }))).toBe("license_active");
    expect(getLicenseState(panel({ status: "grace_period" }))).toBe("license_active");
  });
  it("inactivo en estados duros", () => {
    expect(getLicenseState(panel({ status: "suspended" }))).toBe("license_inactive");
  });
});

describe("getSshState", () => {
  it("respeta sshState explícito", () => {
    expect(getSshState(panel({ sshState: "x" }))).toBe("x");
  });
  it("deriva de sshSaveCredentials", () => {
    expect(getSshState(panel({ sshSaveCredentials: true }))).toBe("ssh_active");
    expect(getSshState(panel({ sshSaveCredentials: false }))).toBe("ssh_inactive");
  });
});

describe("detectPanelProvider", () => {
  it("detecta proveedor cloud por categoría", () => {
    const r = detectPanelProvider(panel({ category: "google cloud" }));
    expect(r.provider).toBe("provider_cloud");
    expect(r.providerLabel).toBe("Google Cloud");
  });
  it("detecta proveedor por primera línea de notas (<Nombre> VPS)", () => {
    const r = detectPanelProvider(panel({ notes: "Hetzner Cloud VPS\notra linea" }));
    expect(r.provider).toBe("provider_cloud");
    expect(r.providerLabel).toBe("Hetzner Cloud");
  });
  it("sin coincidencia => provider_direct", () => {
    const r = detectPanelProvider(panel({ category: "loquesea" }));
    expect(r.provider).toBe("provider_direct");
  });
});
