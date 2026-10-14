// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../servers/index.js", () => ({
  targetsRepository: { get: vi.fn() },
  userMayUseTarget: vi.fn(),
}));
vi.mock("../services/panel-pairing.service.js", () => ({ pairPanelTarget: vi.fn() }));
vi.mock("../../../shared/http/panel-origin.js", () => ({ panelOriginFromRequest: () => "https://panel.example" }));

import { targetsRepository, userMayUseTarget } from "../../servers/index.js";
import { pairPanelTarget } from "../services/panel-pairing.service.js";
import { panelPairingController } from "./panel-pairing.controller.js";

describe("panel pairing responses", () => {
  it("returns a translated error without exposing raw SSH diagnostics", async () => {
    vi.mocked(targetsRepository.get).mockResolvedValue({ id: "server-1", hasLuxipanel: true } as Awaited<ReturnType<typeof targetsRepository.get>>);
    vi.mocked(userMayUseTarget).mockReturnValue(true);
    vi.mocked(pairPanelTarget).mockResolvedValue({ ok: false, verified: false, code: "writeFailed", error: "SSH secret=private-value" });
    const req = { params: { id: "server-1" } } as unknown as Request;
    const res = {
      locals: { locale: "fr", user: { kind: "admin", userId: 1 } },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    panelPairingController.pair(req, res, next);
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: "Impossible d’enregistrer l’identifiant sur le serveur cible",
    });
  });
});
