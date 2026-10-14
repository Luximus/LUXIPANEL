// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: () => ({}) }));
vi.mock("../../../shared/logger/index.js", () => ({ createModuleLogger: () => ({ warn: vi.fn() }) }));
vi.mock("../repositories/assistant-config.repository.js", () => ({
  assistantConfigRepository: { load: vi.fn().mockResolvedValue({ providers: { claude: { mode: "api", api: { apiKey: "test" } } } }) },
}));
vi.mock("../repositories/project-map.repository.js", () => ({
  projectMapRepository: { listUnder: vi.fn().mockResolvedValue([]), save: vi.fn() },
}));
vi.mock("../services/project-map/project-map.service.js", () => ({
  projectMapService: { generate: vi.fn().mockRejectedValue(new Error("La IA no devolvió un mapa válido (no es JSON). Prueba con otro proveedor. secret=private-value")) },
}));

import { projectMapController } from "./project-map.controller.js";
import { projectMapService } from "../services/project-map/project-map.service.js";

function response(locale: string): Response {
  return { locals: { locale }, json: vi.fn(), status: vi.fn().mockReturnThis() } as unknown as Response;
}

describe("project map response localization", () => {
  it("returns generation failures in the polling locale without leaking diagnostics", async () => {
    const generateRes = response("es");
    projectMapController.generate({ body: { path: "/srv/app", providerId: "claude" } } as Request, generateRes, vi.fn() as NextFunction);
    await vi.waitFor(() => expect(generateRes.json).toHaveBeenCalled());
    expect(projectMapService.generate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ language: "Spanish", locale: "es" }));
    const jobId = vi.mocked(generateRes.json).mock.calls[0]?.[0]?.jobId as string;
    const statusRes = response("fr");
    projectMapController.status({ query: { jobId } } as unknown as Request, statusRes, vi.fn() as NextFunction);
    await vi.waitFor(() => expect(statusRes.json).toHaveBeenCalled());
    expect(statusRes.json).toHaveBeenCalledWith({
      ok: true,
      state: "error",
      error: "L’IA n’a pas renvoyé de carte valide. Essayez un autre fournisseur.",
    });
    expect(JSON.stringify(vi.mocked(statusRes.json).mock.calls)).not.toContain("private-value");
  });
});
