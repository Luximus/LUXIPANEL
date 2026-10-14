import { describe, expect, it, beforeEach, vi } from "vitest";
vi.mock("../../auth/services/live-authorization.service.js", () => ({ resolveLiveAuthorization: async (user: unknown) => user }));

// vi.mock SIEMPRE antes de importar el módulo bajo prueba.
const { getContextExecutorMock, getByProjectIdMock } = vi.hoisted(() => ({
  getContextExecutorMock: vi.fn(),
  getByProjectIdMock: vi.fn(),
}));

vi.mock("../../../config/env.js", async (original) => ({
  env: {
    ...(await original<typeof import("../../../config/env.js")>()).env,
    NODE_ENV: "test",
    LOG_LEVEL: "error", // el logger compartido lee env.LOG_LEVEL al importar
    MODULE_DEV_TEST_TIMEOUT_MS: 180_000,
    MODULE_DEV_TEST_MAX_OUTPUT_KB: 256,
    MODULE_DEV_PREVIEW_ENABLED: true, // los tests del gate lo apagan a mano
    MODULE_DEV_PREVIEW_MAX_FILES: 200,
    MODULE_DEV_PREVIEW_MAX_TOTAL_MB: 10,
    COOKIE_LEGACY_DOMAINS: "",
  },
}));

vi.mock("../../../shared/executor/context.js", () => ({
  getContextExecutor: getContextExecutorMock,
  getContextUser: () => null,
}));

vi.mock("../../../shared/marketplace-link/index.js", () => ({
  marketplaceLinkRepository: { getByProjectId: getByProjectIdMock },
  MODULE_ID_RE: /^[a-z][a-z0-9-]{2,38}$/,
}));

vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: vi.fn(() => ({ get: vi.fn(async () => null) })),
}));

// El runtime de sandbox arranca NO disponible (fail-closed): el dispatch del
// preview NO ejecuta código en proceso. Los tests lo mantienen no disponible.
const { sandboxAvailableMock } = vi.hoisted(() => ({ sandboxAvailableMock: vi.fn(() => false) }));
vi.mock("../../../shared/preview-sandbox/runtime.js", () => ({
  previewSandboxRuntime: {
    init: vi.fn(),
    isAvailable: sandboxAvailableMock,
    describe: () => "preview sandbox unavailable (test)",
    dispatch: vi.fn(async () => {
      throw new Error("preview sandbox runtime unavailable (test)");
    }),
  },
}));

const {
  previewService,
  isExcludedRel,
  assertSafeRel,
  selectPreviewFiles,
  MAX_FILE_BYTES,
} = await import("./preview.service.js");
const { ValidationError, ForbiddenError, NotFoundError } = await import(
  "../../../shared/errors/index.js"
);
const { communityPreviewRegistry } = await import("../../../shared/community-preview/index.js");
const { agentCapabilityRegistry } = await import(
  "../../../shared/agent-capability/registry.js"
);
const { eventBus } = await import("../../../shared/events/index.js");

import type { SessionUser } from "../../../shared/types/index.js";

function user(userId: number): SessionUser {
  return {
    userId,
    username: `dev${userId}`,
    displayName: "Dev",
    role: "admin",
    modules: [],
    kind: "admin",
  };
}

const CAPS = { maxFiles: 5, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: 1024 * 1024 };

beforeEach(() => {
  getContextExecutorMock.mockReset();
  getByProjectIdMock.mockReset();
  communityPreviewRegistry._resetForTest();
  agentCapabilityRegistry._resetForTest();
  eventBus.removeAllListeners();
});

describe("filtro de exclusión y path-guard", () => {
  it("excluye node_modules/.git/dist/.cache en cualquier nivel", () => {
    expect(isExcludedRel("node_modules/a.js")).toBe(true);
    expect(isExcludedRel("backend/node_modules/a.js")).toBe(true);
    expect(isExcludedRel(".git/config")).toBe(true);
    expect(isExcludedRel("frontend/dist/app.js")).toBe(true);
    expect(isExcludedRel("x/.cache/y")).toBe(true);
    expect(isExcludedRel("backend/index.js")).toBe(false);
    expect(isExcludedRel("distribuidor/index.js")).toBe(false); // no es el segmento "dist"
  });

  it("assertSafeRel rechaza traversal, absolutos, backslash y segmentos vacíos", () => {
    for (const bad of ["../x", "a/../b", "/etc/passwd", "a\\b", "a//b", "", "a/\0b"]) {
      expect(() => assertSafeRel(bad)).toThrow(ValidationError);
    }
    expect(() => assertSafeRel("backend/index.js")).not.toThrow();
    expect(() => assertSafeRel(".claude/rules/marketplace.md")).not.toThrow();
  });
});

describe("selectPreviewFiles (caps de tamaño)", () => {
  it("filtra exclusiones y el marker, y suma bytes", () => {
    const { files, totalBytes } = selectPreviewFiles(
      [
        { rel: "backend/index.js", size: 100 },
        { rel: "node_modules/x.js", size: 999_999 },
        { rel: ".preview.json", size: 10 },
        { rel: "module.manifest.json", size: 50 },
      ],
      CAPS,
    );
    expect(files.map((f) => f.rel)).toEqual(["backend/index.js", "module.manifest.json"]);
    expect(totalBytes).toBe(150);
  });

  it("lanza ValidationError si un archivo supera el cap por archivo", () => {
    expect(() =>
      selectPreviewFiles([{ rel: "big.bin", size: MAX_FILE_BYTES + 1 }], CAPS),
    ).toThrow(ValidationError);
  });

  it("lanza ValidationError si hay más archivos que el cap", () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({ rel: `f${i}.js`, size: 1 }));
    expect(() => selectPreviewFiles(entries, CAPS)).toThrow(ValidationError);
  });

  it("lanza ValidationError si el total supera el cap", () => {
    const entries = [
      { rel: "a.js", size: 700_000 },
      { rel: "b.js", size: 700_000 },
    ];
    expect(() => selectPreviewFiles(entries, CAPS)).toThrow(ValidationError);
  });

  it("propaga el path-guard sobre cada rel", () => {
    expect(() => selectPreviewFiles([{ rel: "../fuera.js", size: 1 }], CAPS)).toThrow(
      ValidationError,
    );
  });
});

describe("dispatchPreviewTool (owner-gated + fail-closed sin runtime aislado)", () => {
  function registerPreview(ownerUserId: string) {
    // Solo METADATOS del preview: el loader NUNCA importa el código del preview
    // en proceso, así que jamás hay un handler in-process registrado. El meta
    // es lo único que existe (para que el owner lo vea/desinstale).
    communityPreviewRegistry.register({
      moduleId: "demo-mod",
      ownerUserId,
      installedAt: new Date().toISOString(),
    });
  }

  it("con el runtime aislado NO disponible, el owner recibe Forbidden (fail-closed, sin ejecución en proceso)", async () => {
    sandboxAvailableMock.mockReturnValue(false);
    registerPreview("7");
    await expect(
      previewService.dispatchPreviewTool("demo-mod", "ping", { a: 1 }, user(7)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("aunque el runtime estuviera 'disponible', no se ejecuta código en proceso vía el registry", async () => {
    // Defensa: incluso si alguien registrara un handler in-process para el id,
    // el dispatch debe ir por previewSandboxRuntime.dispatch (mockeado para
    // lanzar), NUNCA por agentCapabilityRegistry.findTool().handler.
    sandboxAvailableMock.mockReturnValue(true);
    registerPreview("7");
    agentCapabilityRegistry.register({
      moduleId: "demo-mod",
      version: 1,
      tools: [
        {
          name: "demo-mod.ping",
          title: "Ping",
          description: "ping",
          kind: "read",
          inputSchema: { type: "object" },
          // Si ESTO corriera, el test fallaría por la aserción de abajo.
          handler: async () => ({ ok: true, output: { ranInProcess: true } }),
        },
      ],
    });
    await expect(
      previewService.dispatchPreviewTool("demo-mod", "ping", {}, user(7)),
    ).rejects.toThrow(/sandbox runtime unavailable/);
    sandboxAvailableMock.mockReturnValue(false);
  });

  it("otro usuario (incluso admin) recibe Forbidden antes de tocar el runtime", async () => {
    registerPreview("7");
    await expect(
      previewService.dispatchPreviewTool("demo-mod", "ping", {}, user(8)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("preview inexistente → NotFound", async () => {
    await expect(
      previewService.dispatchPreviewTool("demo-mod", "ping", {}, user(7)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("moduleId con formato inválido se rechaza tipado (anti-traversal)", async () => {
    await expect(
      previewService.dispatchPreviewTool("../evil", "ping", {}, user(7)),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("install — kill-switch MODULE_DEV_PREVIEW_ENABLED", () => {
  it("con el flag apagado lanza Forbidden ANTES de tocar executor/target", async () => {
    const { env } = await import("../../../config/env.js");
    (env as { MODULE_DEV_PREVIEW_ENABLED: boolean }).MODULE_DEV_PREVIEW_ENABLED = false;
    try {
      await expect(previewService.install("proj-1", user(7))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      // Fail-closed temprano: ni siquiera se resolvió el executor del target.
      expect(getContextExecutorMock).not.toHaveBeenCalled();
    } finally {
      (env as { MODULE_DEV_PREVIEW_ENABLED: boolean }).MODULE_DEV_PREVIEW_ENABLED = true;
    }
  });
});

describe("uninstall (guardas)", () => {
  it("preview no instalado → NotFound", async () => {
    await expect(previewService.uninstall("demo-mod", user(7))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("registro presente pero owner distinto → Forbidden", async () => {
    communityPreviewRegistry.register({
      moduleId: "demo-mod",
      ownerUserId: "7",
      installedAt: new Date().toISOString(),
    });
    await expect(previewService.uninstall("demo-mod", user(9))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
