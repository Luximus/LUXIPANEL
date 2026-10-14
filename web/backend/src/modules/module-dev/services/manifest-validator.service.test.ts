import { describe, expect, it } from "vitest";
import { validateManifest } from "./manifest-validator.service.js";

/** Manifest mínimo VÁLIDO (sin campos AUTO) — base de los casos. */
function baseManifest(): Record<string, unknown> {
  return {
    id: "acme-cache",
    name: "Acme Cache",
    description: "Calienta la caché de nginx del servidor.",
    sdk: "^1.0.0",
    category: "infrastructure",
    icon: "tabler:flame",
    color: "amber",
    scope: "local",
    min_specs: { cpu: 1, ramMb: 128, diskMb: 50 },
    capabilities: ["server.exec"],
    chat: { version: 1, operations: [{ id: "ping", tool: "ping", kind: "read", permission: "acme-cache.read" }] },
    pricing: { model: "free", tokensPerMonth: 0 },
    entry: { backend: "backend/index.js" },
  };
}

function errorPaths(manifest: unknown): string[] {
  return validateManifest(manifest).errors.map((e) => e.path);
}

describe("validateManifest", () => {
  it("acepta un manifest completo válido sin errores ni warnings", () => {
    const result = validateManifest(baseManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rechaza una entrada que no es objeto", () => {
    for (const input of [null, "x", 42, ["a"]]) {
      const result = validateManifest(input);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.message).toContain("objeto");
    }
  });

  it("marca cada campo requerido ausente", () => {
    const m = baseManifest();
    delete m.pricing;
    delete m.entry;
    const paths = errorPaths(m);
    expect(paths).toContain("pricing");
    expect(paths).toContain("entry");
  });

  it("valida la regex del id", () => {
    for (const bad of ["Acme", "a", "ab", "-acme", "acme_cache", "x".repeat(45)]) {
      expect(errorPaths({ ...baseManifest(), id: bad })).toContain("id");
    }
    expect(errorPaths({ ...baseManifest(), id: "abc" })).not.toContain("id");
  });

  it("valida los enums category/color/scope y la regex del icon", () => {
    expect(errorPaths({ ...baseManifest(), category: "games" })).toContain("category");
    expect(errorPaths({ ...baseManifest(), color: "magenta" })).toContain("color");
    expect(errorPaths({ ...baseManifest(), scope: "panel" })).toContain("scope");
    expect(errorPaths({ ...baseManifest(), icon: "lucide:flame" })).toContain("icon");
  });

  it("valida límites de name/description y el rango sdk", () => {
    expect(errorPaths({ ...baseManifest(), name: "" })).toContain("name");
    expect(errorPaths({ ...baseManifest(), name: "x".repeat(49) })).toContain("name");
    expect(errorPaths({ ...baseManifest(), description: "x".repeat(161) })).toContain("description");
    expect(errorPaths({ ...baseManifest(), sdk: "lo-que-sea" })).toContain("sdk");
  });

  it("valida min_specs (mínimos del schema)", () => {
    const paths = errorPaths({ ...baseManifest(), min_specs: { cpu: 0, ramMb: 32, diskMb: 5 } });
    expect(paths).toContain("min_specs.cpu");
    expect(paths).toContain("min_specs.ramMb");
    expect(paths).toContain("min_specs.diskMb");
  });

  it("condicional: capability http exige http_allowlist con al menos 1 host", () => {
    const m = { ...baseManifest(), capabilities: ["http"] };
    expect(errorPaths(m)).toContain("http_allowlist");
    const ok = validateManifest({ ...m, http_allowlist: ["api.acme.com"] });
    expect(ok.valid).toBe(true);
    const badHost = validateManifest({ ...m, http_allowlist: ["http://api.acme.com"] });
    expect(badHost.valid).toBe(false);
  });

  it("condicional: server.sudo requiere server.exec o server.fs.write", () => {
    expect(errorPaths({ ...baseManifest(), capabilities: ["server.sudo"] })).toContain("capabilities");
    expect(
      validateManifest({ ...baseManifest(), capabilities: ["server.sudo", "server.fs.write"] }).valid,
    ).toBe(true);
  });

  it("condicional: pricing free exige tokensPerMonth = 0", () => {
    const m = { ...baseManifest(), pricing: { model: "free", tokensPerMonth: 10 } };
    expect(errorPaths(m)).toContain("pricing.tokensPerMonth");
    const sub = { ...baseManifest(), pricing: { model: "subscription", tokensPerMonth: 10 } };
    expect(validateManifest(sub).valid).toBe(true);
  });

  it("condicional: surface.sidebar/views exige entry.frontend", () => {
    const m = { ...baseManifest(), surface: { sidebar: ["acme-cache"] } };
    expect(errorPaths(m)).toContain("entry.frontend");
    const ok = validateManifest({
      ...m,
      entry: { backend: "backend/index.js", frontend: "frontend" },
    });
    expect(ok.valid).toBe(true);
  });

  it("capability fuera del set cerrado es error", () => {
    expect(errorPaths({ ...baseManifest(), capabilities: ["network.raw"] })).toContain(
      "capabilities[0]",
    );
  });

  it("warnings AUTO: version/os_compat/arch/path/commit presentes no invalidan pero avisan", () => {
    const result = validateManifest({
      ...baseManifest(),
      version: "1.2.3",
      os_compat: ["ubuntu>=22.04"],
      arch: ["x86_64"],
      path: "modules/acme-cache",
      commit: "a1b2c3d4e5f",
    });
    expect(result.valid).toBe(true);
    const warned = result.warnings.map((w) => w.path);
    for (const field of ["version", "os_compat", "arch", "path", "commit"]) {
      expect(warned).toContain(field);
    }
  });

  it("version presente pero no-semver es error además del warning AUTO", () => {
    const result = validateManifest({ ...baseManifest(), version: "v1" });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.path)).toContain("version");
    expect(result.warnings.map((w) => w.path)).toContain("version");
  });

  it("entry .ts genera warning (el loader importa JS en producción)", () => {
    const result = validateManifest({ ...baseManifest(), entry: { backend: "backend/index.ts" } });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.path === "entry.backend")).toBe(true);
  });

  it("entry.backend con '..' o segmentos '.'/vacíos es error (path traversal)", () => {
    for (const bad of [
      "backend/../../../../tmp/evil.js",
      "backend/../evil.js",
      "backend/a/../b.js",
      "backend/./index.js",
      "backend//index.js",
      "backend/a..b/../x.js",
    ]) {
      expect(errorPaths({ ...baseManifest(), entry: { backend: bad } })).toContain("entry.backend");
    }
    // Casos legítimos con subdirectorios siguen pasando.
    expect(
      errorPaths({ ...baseManifest(), entry: { backend: "backend/lib/util.mjs" } }),
    ).not.toContain("entry.backend");
  });

  it("entry.frontend con '..' es error (path traversal)", () => {
    const m = {
      ...baseManifest(),
      surface: { sidebar: ["acme-cache"] },
      entry: { backend: "backend/index.js", frontend: "frontend/../secrets" },
    };
    expect(errorPaths(m)).toContain("entry.frontend");
  });

  it("propiedades desconocidas en raíz son warning, no error", () => {
    const result = validateManifest({ ...baseManifest(), totallyUnknown: true });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.path === "totallyUnknown")).toBe(true);
  });

  it("valida tool_permissions y dependencies", () => {
    const paths = errorPaths({
      ...baseManifest(),
      tool_permissions: { "Bad-Suffix": "acme:warm", ping: "OK NO" },
      dependencies: ["dns", "NotASlug"],
    });
    expect(paths).toContain("tool_permissions.Bad-Suffix");
    expect(paths).toContain("tool_permissions.ping");
    expect(paths).toContain("dependencies[1]");
  });

  it("valida configFields (requeridos + tipo)", () => {
    const paths = errorPaths({
      ...baseManifest(),
      configFields: [{ key: "1bad", label: "", type: "textarea" }],
    });
    expect(paths).toContain("configFields[0].key");
    expect(paths).toContain("configFields[0].label");
    expect(paths).toContain("configFields[0].type");
    expect(paths).toContain("configFields[0].required");
  });
});
