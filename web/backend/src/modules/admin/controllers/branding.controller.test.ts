// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { brandingController } from "./branding.controller.js";

describe("branding upload validation", () => {
  it("returns a localized validation error for a malformed encoded filename", async () => {
    const req = { header: () => "%ZZ" } as unknown as Request;
    const res = { locals: { locale: "fr" } } as Response;
    const next = vi.fn() as NextFunction;
    brandingController.upload(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(vi.mocked(next).mock.calls[0]?.[0]).toMatchObject({
      statusCode: 400,
      message: "Nom de fichier invalide",
    });
  });
});
