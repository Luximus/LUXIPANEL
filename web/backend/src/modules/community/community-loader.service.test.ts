// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tests de CARACTERIZACIÓN del loader de módulos de comunidad.
 *
 * Fijan el comportamiento OBSERVABLE actual (no lo prescriben): descubrimiento
 * desde `installed/<id>/`, parseo tolerante a fallos de manifest/marker, la
 * clasificación fail-closed (preview vs aprobado) y el registro/desregistro en
 * los tres registros de instancia (agentCapabilityRegistry, communityCatalog,
 * communityPreviewRegistry).
 *
 * INVARIANTE DE SEGURIDAD que estos tests bloquean: un manifest o un marker
 * `.preview.json` con JSON malformado en disco NUNCA debe lanzar en el loader
 * (tumbaría el escaneo/boot) — el módulo se SALTA y el escaneo continúa.
 *
 * Los fixtures se materializan como directorios temporales DENTRO del
 * `installed/` real (única fuente del path, resuelta por
 * getCommunityInstalledDir) porque `reloadModule(id)`/`loadCommunityModules()`
 * solo miran ahí; se limpian en afterEach.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  loadModule,
  unloadModule,
  reloadModule,
  applyChange,
  loadCommunityModules,
} from "./community-loader.service.js";
import { agentCapabilityRegistry } from "../../shared/agent-capability/registry.js";
import { communityCatalog } from "../../shared/community-catalog.js";
import {
  communityPreviewRegistry,
  getCommunityInstalledDir,
  PREVIEW_MARKER_FILE,
} from "../../shared/community-preview/index.js";
import { defineModule, type ModuleManifest } from "../../shared/module-sdk/index.js";

const INSTALLED_DIR = getCommunityInstalledDir();

/** Ids de fixtures creados en installed/ (se borran en afterEach). */
const createdDirs: string[] = [];

function makeModuleDir(id: string): string {
  const dir = path.join(INSTALLED_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  createdDirs.push(dir);
  return dir;
}

function writeFileIn(dir: string, rel: string, content: string): void {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function cleanupModule(id: string): void {
  // Deja limpios los tres registros de instancia entre tests.
  agentCapabilityRegistry.unregister(id);
  communityCatalog.remove(id);
  communityPreviewRegistry.unregister(id);
}

const baseManifest = (id: string): ModuleManifest => ({
  id,
  name: `Test ${id}`,
  version: "1.0.0",
  capabilities: ["server.exec"],
  tool_permissions: { ping: `${id}.read` },
  chat: { version: 1, operations: [{ id: "ping", tool: "ping", kind: "read", permission: `${id}.read` }] },
});

afterEach(() => {
  for (const dir of createdDirs) {
    const id = path.basename(dir);
    cleanupModule(id);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
  createdDirs.length = 0;
});

describe("community-loader: loadModule / unloadModule (registros in-memory)", () => {
  const id = "zzchartest-inmem";
  beforeEach(() => cleanupModule(id));
  afterEach(() => cleanupModule(id));

  const factory = defineModule((m) => {
    m.tool("ping", {
      title: "Ping",
      description: "d",
      kind: "read",
      input: { type: "object" },
      async handler() {
        return { ok: true, output: {} };
      },
    });
  });

  it("un módulo APROBADO se registra en el registry Y aparece en el catálogo público", () => {
    loadModule(baseManifest(id), factory);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)?.moduleId).toBe(id);
    expect(communityCatalog.has(id)).toBe(true);
    expect(communityPreviewRegistry.get(id)).toBeUndefined();
  });

  it("un PREVIEW se registra en el registry y en el preview-registry, pero NUNCA en el catálogo público", () => {
    loadModule(baseManifest(id), factory, {
      moduleId: id,
      ownerUserId: "42",
      installedAt: "2026-01-01",
    });
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)?.moduleId).toBe(id);
    expect(communityCatalog.has(id)).toBe(false); // invisible en /panel/modules
    expect(communityPreviewRegistry.get(id)?.ownerUserId).toBe("42");
  });

  it("unloadModule limpia los tres registros", () => {
    loadModule(baseManifest(id), factory);
    unloadModule(id);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
    expect(communityCatalog.has(id)).toBe(false);
    expect(communityPreviewRegistry.get(id)).toBeUndefined();
  });

  it("tag premium cuando priceTokens > 0 (derivación manifestToDefinition)", () => {
    loadModule({ ...baseManifest(id), priceTokens: 500 } as ModuleManifest, factory);
    const def = communityCatalog.list().find((d) => d.id === id);
    expect(def?.tag).toBe("premium");
  });
});

describe("community-loader: reloadModule desde disco (parseo tolerante a fallos)", () => {
  it("id inexistente / sin manifest → devuelve false (no lanza)", async () => {
    await expect(reloadModule("zzchartest-absent")).resolves.toBe(false);
  });

  it("SEGURIDAD: manifest JSON corrupto → se SALTA (no lanza, no registra)", async () => {
    const id = "zzchartest-bad-manifest";
    const dir = makeModuleDir(id);
    writeFileIn(dir, "module.manifest.json", "{ this is not : valid json ]");

    // A rejected load reports failure without replacing the current generation.
    await expect(reloadModule(id)).resolves.toBe(false);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
    expect(communityCatalog.has(id)).toBe(false);
  });

  it("SEGURIDAD: marker .preview.json corrupto → se SALTA (fail-closed, no registra)", async () => {
    const id = "zzchartest-bad-marker";
    const dir = makeModuleDir(id);
    writeFileIn(dir, "module.manifest.json", JSON.stringify(baseManifest(id)));
    writeFileIn(dir, PREVIEW_MARKER_FILE, "}{ broken marker");

    await expect(reloadModule(id)).resolves.toBe(false);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
    expect(communityCatalog.has(id)).toBe(false);
    expect(communityPreviewRegistry.get(id)).toBeUndefined();
  });

  it("marker sin ownerUserId (ambiguo) → tratado como corrupto → se SALTA", async () => {
    const id = "zzchartest-marker-noowner";
    const dir = makeModuleDir(id);
    writeFileIn(dir, "module.manifest.json", JSON.stringify(baseManifest(id)));
    writeFileIn(dir, PREVIEW_MARKER_FILE, JSON.stringify({ moduleId: id })); // sin ownerUserId

    await expect(reloadModule(id)).resolves.toBe(false);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
  });

  it("PREVIEW válido (marker con ownerUserId) → NUNCA se importa en proceso (fail-closed), no registra ni publica", async () => {
    const id = "zzchartest-valid-preview";
    const dir = makeModuleDir(id);
    writeFileIn(dir, "module.manifest.json", JSON.stringify(baseManifest(id)));
    writeFileIn(
      dir,
      PREVIEW_MARKER_FILE,
      JSON.stringify({ moduleId: id, ownerUserId: "7", installedAt: "2026-01-01" }),
    );
    // Aunque hubiera un entry en disco, un preview jamás llega a import().
    writeFileIn(dir, "backend/index.js", "export default { __luxModule: true, setup(){} };");

    await expect(reloadModule(id)).resolves.toBe(false);
    // Invariante independiente del valor de MODULE_DEV_PREVIEW_ENABLED:
    // un preview NO se importa en proceso → no registra tools ni entra al catálogo.
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
    expect(communityCatalog.has(id)).toBe(false);
  });

  it("APROBADO con entry declarado que NO existe en disco → se SALTA con gracia (no lanza, no registra)", async () => {
    const id = "zzchartest-missing-entry";
    const dir = makeModuleDir(id);
    writeFileIn(
      dir,
      "module.manifest.json",
      JSON.stringify({ ...baseManifest(id), entry: { backend: "backend/index.js" } }),
    );
    // No escribimos backend/index.js a propósito.
    await expect(reloadModule(id)).resolves.toBe(false);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
  });

  it("APROBADO cuyo entry ESCAPA del dir del módulo (path traversal) → rechazado (no importa)", async () => {
    const id = "zzchartest-entry-escape";
    const dir = makeModuleDir(id);
    writeFileIn(
      dir,
      "module.manifest.json",
      JSON.stringify({ ...baseManifest(id), entry: { backend: "../../../../etc/passwd" } }),
    );
    await expect(reloadModule(id)).resolves.toBe(false);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
  });

  it("APROBADO válido (sin marker, entry real dentro del dir) → import() en proceso + registro + catálogo", async () => {
    const id = "zzchartest-approved-ok";
    const dir = makeModuleDir(id);
    writeFileIn(
      dir,
      "module.manifest.json",
      JSON.stringify({ ...baseManifest(id), entry: { backend: "backend/index.js" } }),
    );
    writeFileIn(
      dir,
      "backend/index.js",
      `export default {
         __luxModule: true,
         setup(m) {
           m.tool("ping", {
             title: "Ping", description: "d", kind: "read",
             input: { type: "object" },
             async handler() { return { ok: true, output: {} }; },
           });
         },
       };`,
    );

    await expect(reloadModule(id)).resolves.toBe(true);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)?.moduleId).toBe(id);
    expect(communityCatalog.has(id)).toBe(true);
  });
});

describe("community-loader: applyChange", () => {
  const id = "zzchartest-applychange";
  const factory = defineModule((m) => {
    m.tool("ping", {
      title: "Ping",
      description: "d",
      kind: "read",
      input: { type: "object" },
      async handler() {
        return { ok: true, output: {} };
      },
    });
  });
  afterEach(() => cleanupModule(id));

  it("action 'unload' desregistra un módulo cargado", async () => {
    loadModule(baseManifest(id), factory);
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeDefined();
    await applyChange({ moduleId: id, action: "unload" });
    expect(agentCapabilityRegistry.findTool(`${id}.ping`)).toBeUndefined();
  });

  it("action 'load' de un id sin vendorizar → no lanza (reloadModule=false internamente)", async () => {
    await expect(applyChange({ moduleId: "zzchartest-absent2", action: "load" })).resolves.toBeUndefined();
  });
});

describe("community-loader: loadCommunityModules (escaneo completo)", () => {
  it("escanea installed/ sin lanzar aunque haya módulos con entry .js ausente (dev)", async () => {
    // El árbol real (p.ej. codebase-graph, entry backend/index.js inexistente en
    // src/) debe saltarse con gracia — el escaneo completa siempre.
    await expect(loadCommunityModules()).resolves.toBeUndefined();
  });

  it("un manifest corrupto en installed/ NO tumba el escaneo del resto", async () => {
    const badId = "zzchartest-scan-bad";
    const goodId = "zzchartest-scan-good";
    const badDir = makeModuleDir(badId);
    const goodDir = makeModuleDir(goodId);
    writeFileIn(badDir, "module.manifest.json", "!!! not json");
    writeFileIn(
      goodDir,
      "module.manifest.json",
      JSON.stringify({ ...baseManifest(goodId), entry: { backend: "backend/index.js" } }),
    );
    writeFileIn(
      goodDir,
      "backend/index.js",
      `export default { __luxModule: true, setup(m){ m.tool("ping",{ title:"P", description:"d", kind:"read", input:{type:"object"}, async handler(){ return { ok:true, output:{} }; } }); } };`,
    );

    await expect(loadCommunityModules()).resolves.toBeUndefined();
    // El bueno se cargó pese al vecino corrupto.
    expect(agentCapabilityRegistry.findTool(`${goodId}.ping`)?.moduleId).toBe(goodId);
  });
});

describe("community hot replacement", () => {
  it("retains the previous version after rejecting an incomplete update", () => {
    const id = "zzchartest-atomic";
    const factory = defineModule(m => m.tool("ping", { title: "Ping", description: "d", kind: "read", input: { type: "object" }, handler: async () => ({ ok: true, output: "old" }) }));
    loadModule(baseManifest(id), factory);
    const old = agentCapabilityRegistry.get(id);
    try {
      expect(() => loadModule({ ...baseManifest(id), version: "2.0.0", chat: undefined }, factory)).toThrow("chat");
      expect(agentCapabilityRegistry.get(id)).toBe(old);
      expect(() => loadModule({ ...baseManifest(id), sdk: "^2.0.0" }, factory)).toThrow("incompatible");
      expect(agentCapabilityRegistry.get(id)).toBe(old);
    } finally { unloadModule(id); }
  });
  it("cannot unregister core capabilities through the community lifecycle", () => {
    agentCapabilityRegistry.register({ moduleId: "core-module", version: 1, tools: [] });
    unloadModule("core-module");
    expect(agentCapabilityRegistry.get("core-module")).toBeDefined();
    agentCapabilityRegistry.unregister("core-module");
  });
  it("does not resurrect a module unloaded while its import was pending", async () => {
    const id = "zzchartest-import-race", dir = makeModuleDir(id);
    writeFileIn(dir, "module.manifest.json", JSON.stringify(baseManifest(id)));
    writeFileIn(dir, "backend/index.js", `await new Promise(resolve => setTimeout(resolve, 30)); export default { __luxModule: true, setup(m){ m.tool("ping", { title: "Ping", description: "d", kind: "read", input: { type: "object" }, handler: async () => ({ ok:true, output:{} }) }); } };`);
    const pending = reloadModule(id);
    unloadModule(id);
    expect(await pending).toBe(false);
    expect(agentCapabilityRegistry.get(id)).toBeUndefined();
  });
});

it.each(["null", "7", "[]", '{"id":"zzchartest-null"}'])("isolates structurally invalid disk manifests: %s", async input => {
  const id = "zzchartest-null", dir = makeModuleDir(id);
  writeFileIn(dir, "module.manifest.json", input);
  await expect(reloadModule(id)).resolves.toBe(false);
  expect(agentCapabilityRegistry.get(id)).toBeUndefined();
});
