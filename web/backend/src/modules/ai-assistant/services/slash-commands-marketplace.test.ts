import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketplaceLink } from "../../../shared/marketplace-link/index.js";

// ── Mocks (SIEMPRE antes de importar el módulo bajo prueba) ────────────────

const cfg = {
  enabled: true,
  activeProvider: "claude" as const,
  providers: {
    claude: { mode: "api" as const, api: { apiKey: "k", model: "claude-sonnet-4-6" } },
    codex: { mode: "api" as const },
    gemini: { mode: "api" as const },
    deepseek: { mode: "api" as const },
    minimax: { mode: "api" as const },
  },
};

vi.mock("../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: {
    load: vi.fn(async () => cfg),
    patch: vi.fn(async () => cfg),
    save: vi.fn(async () => cfg),
  },
}));

const project = {
  current: {
    id: "p1",
    title: "Cache Warmer",
    icon: "folder",
    path: "/srv/projects/acme",
    instructions: "",
    provider: "claude",
  } as Record<string, unknown> | null,
};

vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: {
    get: vi.fn(async () => project.current),
  },
}));

const link = { current: null as MarketplaceLink | null };
const upsertMock = vi.fn(async (_e: unknown, l: Record<string, unknown>) => ({ id: "l1", ...l }));

vi.mock("../../../shared/marketplace-link/index.js", () => ({
  MODULE_ID_RE: /^[a-z][a-z0-9-]{2,38}$/,
  marketplaceLinkRepository: {
    getByProjectId: vi.fn(async () => link.current),
    getByModuleId: vi.fn(async () => null),
    list: vi.fn(async () => []),
    upsert: (...args: unknown[]) => upsertMock(args[0], args[1] as Record<string, unknown>),
    removeByProjectId: vi.fn(async () => true),
  },
}));

import { slashCommandsService } from "./slash-commands.service.js";

const LINK: MarketplaceLink = {
  id: "l1",
  projectId: "p1",
  moduleId: "acme-cache-warmer",
  projectPath: "/srv/projects/acme",
  provider: "claude",
};

describe("slashCommandsService — /mod", () => {
  beforeEach(() => {
    link.current = null;
    project.current = {
      id: "p1",
      title: "Cache Warmer",
      icon: "folder",
      path: "/srv/projects/acme",
      instructions: "",
      provider: "claude",
    };
    upsertMock.mockClear();
  });

  it("/help incluye la línea de /mod", async () => {
    const res = await slashCommandsService.handle("/help", {});
    expect(res.handled).toBe(true);
    expect(res.text).toContain("/mod");
  });

  it("/mod y /mod ayuda muestran la ayuda del ciclo", async () => {
    for (const msg of ["/mod", "/mod ayuda"]) {
      const res = await slashCommandsService.handle(msg, {});
      expect(res.handled).toBe(true);
      expect(res.text).toContain("vincular");
      expect(res.text).toContain("despublicar");
    }
  });

  describe("/mod vincular", () => {
    it("sin proyecto activo → error claro", async () => {
      const res = await slashCommandsService.handle("/mod vincular acme-cache-warmer", {});
      expect(res.handled).toBe(true);
      expect(res.text).toContain("proyecto");
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("slug inválido → error de validación", async () => {
      const res = await slashCommandsService.handle("/mod vincular Bad_Slug", { projectId: "p1" });
      expect(res.handled).toBe(true);
      expect(res.text).toContain("Slug inválido");
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("sin slug → uso", async () => {
      const res = await slashCommandsService.handle("/mod vincular", { projectId: "p1" });
      expect(res.handled).toBe(true);
      expect(res.text).toContain("Uso:");
    });

    it("proyecto sin path absoluto → error", async () => {
      project.current = { ...project.current!, path: "" };
      const res = await slashCommandsService.handle("/mod vincular acme-cache-warmer", { projectId: "p1" });
      expect(res.handled).toBe(true);
      expect(res.text).toContain("directorio de trabajo");
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it("happy path → upsert del vínculo con path/provider del proyecto", async () => {
      const res = await slashCommandsService.handle("/mod vincular acme-cache-warmer", { projectId: "p1" });
      expect(res.handled).toBe(true);
      expect(res.text).toContain("vinculado");
      expect(upsertMock).toHaveBeenCalledTimes(1);
      expect(upsertMock.mock.calls[0]?.[1]).toEqual({
        projectId: "p1",
        moduleId: "acme-cache-warmer",
        projectPath: "/srv/projects/acme",
        provider: "claude",
      });
    });

    it("upsert lanza (slug reclamado por otro proyecto) → error visible", async () => {
      upsertMock.mockRejectedValueOnce(new Error("ya está vinculado a otro proyecto"));
      const res = await slashCommandsService.handle("/mod vincular acme-cache-warmer", { projectId: "p1" });
      expect(res.handled).toBe(true);
      expect(res.text).toContain("No se pudo vincular");
      expect(res.text).toContain("ya está vinculado");
    });
  });

  describe("verbos del ciclo → rewrite (no handled)", () => {
    it("/mod estado con vínculo → list_modules + module_status del slug", async () => {
      link.current = LINK;
      const res = await slashCommandsService.handle("/mod estado", { projectId: "p1" });
      expect(res.handled).toBe(false);
      expect(res.rewrite).toContain("module-dev.list_modules");
      expect(res.rewrite).toContain("module-dev.module_status");
      expect(res.rewrite).toContain("acme-cache-warmer");
    });

    it("/mod estado sin vínculo → solo list_modules", async () => {
      const res = await slashCommandsService.handle("/mod estado", { projectId: "p1" });
      expect(res.handled).toBe(false);
      expect(res.rewrite).toContain("module-dev.list_modules");
      expect(res.rewrite).not.toContain("module-dev.module_status");
    });

    it("/mod enviar sin prUrl → uso (handled)", async () => {
      link.current = LINK;
      const res = await slashCommandsService.handle("/mod enviar", { projectId: "p1" });
      expect(res.handled).toBe(true);
      expect(res.text).toContain("prUrl");
    });

    it("/mod enviar <prUrl> → submit_module con moduleId y prUrl", async () => {
      link.current = LINK;
      const res = await slashCommandsService.handle(
        "/mod enviar https://github.com/Luxisoft/LUXIPANEL/pull/42",
        { projectId: "p1" },
      );
      expect(res.handled).toBe(false);
      expect(res.rewrite).toContain("module-dev.submit_module");
      expect(res.rewrite).toContain('"moduleId":"acme-cache-warmer"');
      expect(res.rewrite).toContain("https://github.com/Luxisoft/LUXIPANEL/pull/42");
    });

    it("/mod reenviar <prUrl> → resubmit_module", async () => {
      link.current = LINK;
      const res = await slashCommandsService.handle(
        "/mod reenviar https://github.com/Luxisoft/LUXIPANEL/pull/43",
        { projectId: "p1" },
      );
      expect(res.handled).toBe(false);
      expect(res.rewrite).toContain("module-dev.resubmit_module");
    });

    it("/mod enviar sin vínculo → pide /mod vincular primero (gate IA)", async () => {
      const res = await slashCommandsService.handle(
        "/mod enviar https://github.com/Luxisoft/LUXIPANEL/pull/42",
        { projectId: "p1" },
      );
      expect(res.handled).toBe(true);
      expect(res.text).toContain("/mod vincular");
    });

    it("/mod probar → run_tests con projectId", async () => {
      link.current = LINK;
      const res = await slashCommandsService.handle("/mod probar", { projectId: "p1" });
      expect(res.handled).toBe(false);
      expect(res.rewrite).toContain("module-dev.run_tests");
      expect(res.rewrite).toContain('"projectId":"p1"');
    });

    it("/mod preview → preview_install con projectId", async () => {
      link.current = LINK;
      const res = await slashCommandsService.handle("/mod preview", { projectId: "p1" });
      expect(res.handled).toBe(false);
      expect(res.rewrite).toContain("module-dev.preview_install");
      expect(res.rewrite).toContain('"projectId":"p1"');
    });

    it("/mod despublicar → unpublish_module; /mod republicar → republish_module", async () => {
      link.current = LINK;
      const unpublish = await slashCommandsService.handle("/mod despublicar", { projectId: "p1" });
      expect(unpublish.handled).toBe(false);
      expect(unpublish.rewrite).toContain("module-dev.unpublish_module");
      const republish = await slashCommandsService.handle("/mod republicar", { projectId: "p1" });
      expect(republish.handled).toBe(false);
      expect(republish.rewrite).toContain("module-dev.republish_module");
    });

    it("/mod probar sin proyecto activo → error (handled)", async () => {
      const res = await slashCommandsService.handle("/mod probar", {});
      expect(res.handled).toBe(true);
      expect(res.text).toContain("proyecto");
    });
  });

  it("/mod <desconocido> → ayuda con aviso", async () => {
    const res = await slashCommandsService.handle("/mod zzz", { projectId: "p1" });
    expect(res.handled).toBe(true);
    expect(res.text).toContain("Subcomando desconocido");
  });
});
