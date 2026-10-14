// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentCapabilityRegistry } from "../../../shared/agent-capability/index.js";
import type { AgentCapability } from "../../../shared/agent-capability/index.js";

// Mock the access repo so we can drive defaults vs overrides without I/O.
const access: { current: Record<string, { enabled?: boolean; tools?: Record<string, { enabled?: boolean; requireConfirm?: boolean }> }> } = { current: {} };
vi.mock("../repositories/assistant-module-access.repository.js", () => ({
  assistantModuleAccessRepository: {
    load: async () => access.current,
    setModule: async () => access.current,
    setTool: async () => access.current,
    save: async () => access.current,
  },
}));

// Drive module activation (enable-map) without I/O. `enabled` is the panel
// enable-map (core-catalog ids). "files" is the only governed module the tests
// touch — it starts enabled so the existing expectations hold.
const activation = {
  enabled: { files: true } as Record<string, boolean>,
};
vi.mock("../../../shared/module-state/index.js", () => ({
  getModuleCatalog: () => [], getModuleEnabledMap: async () => activation.enabled,
}));

import { assistantModulesService } from "./assistant-modules.service.js";
import { communityPreviewRegistry } from "../../../shared/community-preview/index.js";
import type { SessionUser } from "../../../shared/types/index.js";

/** A non-admin user with an explicit per-group permission matrix. */
function mkUser(opts: { sidebar: string[]; actions: string[] }): SessionUser {
  return {
    userId: 1,
    username: "u",
    displayName: "U",
    role: "g",
    modules: opts.sidebar,
    kind: "user",
    permissions: {
      sidebar: opts.sidebar,
      views: opts.sidebar.map((item) => `panel.${item}`),
      actions: opts.actions,
      fileAccess: { allowAll: true, allowPaths: [], denyPaths: [], readOnlyPaths: [], defaultPath: null },
      commandPolicy: { allowAll: false, groups: [], allowCommands: [], denyCommands: [] },
    },
  } as SessionUser;
}

/** A files capability whose tools declare real `files.*` action permissions. */
function mkFilesCap(): AgentCapability {
  return {
    moduleId: "files",
    version: 1,
    tools: [
      {
        name: "files.read",
        title: "Read",
        description: "Reads.",
        kind: "read",
        permission: "files.read",
        inputSchema: { type: "object" },
        handler: async () => ({ ok: true, output: "" }),
      },
      {
        name: "files.write",
        title: "Write",
        description: "Writes.",
        kind: "action",
        permission: "files.write",
        inputSchema: { type: "object" },
        handler: async () => ({ ok: true, output: "" }),
      },
    ],
  };
}

function mkCap(): AgentCapability {
  return {
    moduleId: "fooz",
    version: 1,
    tools: [
      {
        name: "fooz.read",
        title: "Read",
        description: "Reads.",
        kind: "read",
        inputSchema: { type: "object" },
        handler: async () => ({ ok: true, output: "" }),
      },
      {
        name: "fooz.bang",
        title: "Bang",
        description: "Destroys.",
        kind: "action",
        inputSchema: { type: "object" },
        handler: async () => ({ ok: true, output: "" }),
      },
    ],
  };
}

describe("assistantModulesService", () => {
  beforeEach(() => {
    agentCapabilityRegistry._resetForTest();
    communityPreviewRegistry._resetForTest();
    agentCapabilityRegistry.register(mkCap());
    access.current = {};
    activation.enabled = { files: true };
  });
  afterEach(() => {
    agentCapabilityRegistry._resetForTest();
    communityPreviewRegistry._resetForTest();
  });

  it("defaults: module enabled, read tool enabled w/o confirm, action tool enabled w/ confirm", async () => {
    const [mod] = await assistantModulesService.describe(null);
    expect(mod?.enabled).toBe(true);
    const read = mod?.tools.find((t) => t.name === "fooz.read");
    const bang = mod?.tools.find((t) => t.name === "fooz.bang");
    expect(read?.enabled).toBe(true);
    expect(read?.requireConfirm).toBe(false);
    expect(bang?.enabled).toBe(true);
    expect(bang?.requireConfirm).toBe(true);
  });

  it("sidecar override disables a tool", async () => {
    access.current = { fooz: { tools: { "fooz.read": { enabled: false } } } };
    const allowed = await assistantModulesService.allowedTools(null);
    expect(allowed.map((t) => t.name).sort()).toEqual(["fooz.bang"]);
  });

  it("sidecar override disables the whole module", async () => {
    access.current = { fooz: { enabled: false } };
    const allowed = await assistantModulesService.allowedTools(null);
    expect(allowed).toEqual([]);
  });

  it("non-admin: a permissioned tool is exposed only when the group grants that action", async () => {
    agentCapabilityRegistry._resetForTest();
    agentCapabilityRegistry.register(mkFilesCap());
    // Group can read files but not write them.
    const reader = mkUser({ sidebar: ["files"], actions: ["files.read"] });
    const allowed = await assistantModulesService.allowedTools(null, reader);
    expect(allowed.map((t) => t.name).sort()).toEqual(["files.read"]);
  });

  it("non-admin: a `files.*` wildcard grants every files tool", async () => {
    agentCapabilityRegistry._resetForTest();
    agentCapabilityRegistry.register(mkFilesCap());
    const power = mkUser({ sidebar: ["files"], actions: ["files.*"] });
    const allowed = await assistantModulesService.allowedTools(null, power);
    expect(allowed.map((t) => t.name).sort()).toEqual(["files.read", "files.write"]);
  });

  it("non-admin: no sidebar access to the module → no tools at all", async () => {
    agentCapabilityRegistry._resetForTest();
    agentCapabilityRegistry.register(mkFilesCap());
    const outsider = mkUser({ sidebar: [], actions: ["files.read", "files.write"] });
    const allowed = await assistantModulesService.allowedTools(null, outsider);
    expect(allowed).toEqual([]);
  });

  describe("filtrado por módulo activo (habilitado ∩ entitlement)", () => {
    beforeEach(() => {
      agentCapabilityRegistry._resetForTest();
      agentCapabilityRegistry.register(mkFilesCap());
    });

    it("un módulo del catálogo DESHABILITADO no aparece ni expone tools", async () => {
      activation.enabled = { files: false };
      expect((await assistantModulesService.describe(null)).map((m) => m.moduleId)).not.toContain("files");
      expect(await assistantModulesService.allowedTools(null)).toEqual([]);
    });

    it("módulo activo → aparece y expone sus tools (admin)", async () => {
      const allowed = await assistantModulesService.allowedTools(null);
      expect(allowed.map((t) => t.name).sort()).toEqual(["files.read", "files.write"]);
    });

    it("capability NO gobernada por el enable-map (interna/community) nunca se filtra", async () => {
      // `fooz` no está en el enable-map → conserva su gating propio, sigue visible.
      agentCapabilityRegistry.register(mkCap());
      activation.enabled = {}; // ni siquiera "files" gobernado ahora
      const ids = (await assistantModulesService.describe(null)).map((m) => m.moduleId);
      expect(ids).toContain("fooz");
      // "files" ya no está gobernado tampoco (enable-map vacío) → bypass, visible.
      expect(ids).toContain("files");
    });
  });

  it("toolNeedsConfirm honors override", async () => {
    expect(await assistantModulesService.toolNeedsConfirm("fooz.read", null)).toBe(false);
    expect(await assistantModulesService.toolNeedsConfirm("fooz.bang", null)).toBe(true);
    access.current = { fooz: { tools: { "fooz.bang": { requireConfirm: false } } } };
    expect(await assistantModulesService.toolNeedsConfirm("fooz.bang", null)).toBe(false);
  });

  describe("previews del marketplace (solo-dev)", () => {
    /** Capability de un módulo preview (Modo B) registrado por el loader. */
    function mkPreviewCap(): AgentCapability {
      return {
        moduleId: "prevmod",
        version: 1,
        tools: [
          {
            name: "prevmod.status",
            title: "Status",
            description: "Status.",
            kind: "read",
            inputSchema: { type: "object" },
            handler: async () => ({ ok: true, output: "" }),
          },
        ],
        dataPanels: [
          {
            name: "prevmod.snap",
            title: "Snap",
            description: "Snapshot.",
            collect: async () => ({}),
          },
        ],
      };
    }

    function mkAdmin(userId: number): SessionUser {
      return {
        userId,
        username: `u${userId}`,
        displayName: `U${userId}`,
        role: "admin",
        modules: [],
        kind: "admin",
      } as SessionUser;
    }

    beforeEach(() => {
      agentCapabilityRegistry.register(mkPreviewCap());
      communityPreviewRegistry.register({
        moduleId: "prevmod",
        ownerUserId: "7",
        installedAt: new Date().toISOString(),
      });
    });

    it("el dueño (String(userId) === ownerUserId) ve sus tools", async () => {
      const allowed = await assistantModulesService.allowedTools(null, mkAdmin(7));
      expect(allowed.map((t) => t.name)).toContain("prevmod.status");
    });

    it("otro admin NO ve el preview (solo el owner)", async () => {
      const allowed = await assistantModulesService.allowedTools(null, mkAdmin(1));
      expect(allowed.map((t) => t.name)).not.toContain("prevmod.status");
      // El resto de capabilities no se ve afectado.
      expect(allowed.map((t) => t.name)).toContain("fooz.read");
    });

    it("sin usuario en contexto → oculto (fail-closed)", async () => {
      const allowed = await assistantModulesService.allowedTools(null);
      expect(allowed.map((t) => t.name)).not.toContain("prevmod.status");
    });

    it("describe() solo lo lista para el dueño", async () => {
      const forOwner = await assistantModulesService.describe(null, mkAdmin(7));
      expect(forOwner.map((m) => m.moduleId)).toContain("prevmod");
      const forOther = await assistantModulesService.describe(null, mkAdmin(1));
      expect(forOther.map((m) => m.moduleId)).not.toContain("prevmod");
      const forNobody = await assistantModulesService.describe(null);
      expect(forNobody.map((m) => m.moduleId)).not.toContain("prevmod");
    });

    it("un módulo no-preview con el mismo nombre vuelve a verse al desregistrar", async () => {
      communityPreviewRegistry.unregister("prevmod");
      const allowed = await assistantModulesService.allowedTools(null, mkAdmin(1));
      expect(allowed.map((t) => t.name)).toContain("prevmod.status");
    });
  });
});
