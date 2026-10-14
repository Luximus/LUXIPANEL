// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Characterization tests for the sudo credential controller (A6 [T]).
 *
 * Pins the wire contract other clients depend on:
 *   GET    /api/sudo/status      → { ok, data: { stored } }
 *   POST   /api/sudo/credential  → validate via a real `sudo … true` probe,
 *                                   store ONLY on success, return { stored:true }
 *   DELETE /api/sudo/credential  → clear, return { ok:true }
 *
 * Security invariants pinned here: the plaintext password is never echoed back
 * to the client, and an invalid password surfaces a typed ValidationError
 * (never a 500 / never the raw secret).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const hasStoredSudoPassword = vi.fn();
const storeSudoPassword = vi.fn();
const clearSudoPassword = vi.fn();
const sudoShell = vi.fn();
const invalidateSudoPasswordCache = vi.fn();

vi.mock("../../../shared/system/index.js", () => ({
  hasStoredSudoPassword: (...a: unknown[]) => hasStoredSudoPassword(...a),
  storeSudoPassword: (...a: unknown[]) => storeSudoPassword(...a),
  clearSudoPassword: (...a: unknown[]) => clearSudoPassword(...a),
  sudoShell: (...a: unknown[]) => sudoShell(...a),
  invalidateSudoPasswordCache: (...a: unknown[]) => invalidateSudoPasswordCache(...a),
  SUDO_PASSWORD_INVALID: "SUDO_PASSWORD_INVALID",
}));

const fakeExecutor = { target: { id: "srv-1", name: "srv-1" } };
vi.mock("../../../shared/executor/index.js", () => ({
  getExecutor: () => fakeExecutor,
}));

import { sudoController } from "./sudo.controller.js";
import { ValidationError } from "../../../shared/errors/index.js";

/** Invoke an asyncHandler-wrapped controller and flush its microtasks. */
async function invoke(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  body: unknown = {},
) {
  const json = vi.fn();
  const res = { json } as unknown as Response;
  const next = vi.fn();
  handler({ body } as Request, res, next as NextFunction);
  await new Promise((r) => setImmediate(r));
  return { json, next };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/sudo/status", () => {
  it("reports stored=true when a credential exists", async () => {
    hasStoredSudoPassword.mockResolvedValue(true);
    const { json, next } = await invoke(sudoController.status);
    expect(json).toHaveBeenCalledWith({ ok: true, data: { stored: true } });
    expect(next).not.toHaveBeenCalled();
  });

  it("reports stored=false when none exists", async () => {
    hasStoredSudoPassword.mockResolvedValue(false);
    const { json } = await invoke(sudoController.status);
    expect(json).toHaveBeenCalledWith({ ok: true, data: { stored: false } });
  });
});

describe("POST /api/sudo/credential", () => {
  it("stores the password after a successful probe and never echoes it back", async () => {
    sudoShell.mockResolvedValue({ ok: true, exitCode: 0, output: "" });
    const { json, next } = await invoke(sudoController.set, { password: "hunter2" });

    expect(sudoShell).toHaveBeenCalledOnce();
    expect(storeSudoPassword).toHaveBeenCalledWith(fakeExecutor, "hunter2");
    expect(invalidateSudoPasswordCache).toHaveBeenCalledWith("srv-1");
    expect(json).toHaveBeenCalledWith({ ok: true, data: { stored: true } });
    // The response body must NOT contain the plaintext.
    expect(JSON.stringify(json.mock.calls[0]![0])).not.toContain("hunter2");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an invalid password with a typed ValidationError (no store)", async () => {
    sudoShell.mockResolvedValue({
      ok: false,
      exitCode: 1,
      output: "Contraseña sudo inválida.",
      code: "SUDO_PASSWORD_INVALID",
    });
    const { json, next } = await invoke(sudoController.set, { password: "wrong" });

    expect(storeSudoPassword).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]![0]).toBeInstanceOf(ValidationError);
    expect((next.mock.calls[0]![0] as Error).message).toMatch(/inválida/i);
  });

  it("surfaces a non-invalid probe failure as a ValidationError", async () => {
    sudoShell.mockResolvedValue({ ok: false, exitCode: 1, output: "sudo: not found" });
    const { next } = await invoke(sudoController.set, { password: "x" });
    expect(storeSudoPassword).not.toHaveBeenCalled();
    expect(next.mock.calls[0]![0]).toBeInstanceOf(ValidationError);
  });

  it("rejects a body with no password (schema) before touching sudo", async () => {
    const { next } = await invoke(sudoController.set, {});
    expect(sudoShell).not.toHaveBeenCalled();
    expect(storeSudoPassword).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]![0]).toBeInstanceOf(Error);
  });
});

describe("DELETE /api/sudo/credential", () => {
  it("clears the credential and invalidates the cache", async () => {
    clearSudoPassword.mockResolvedValue(undefined);
    const { json, next } = await invoke(sudoController.clear);
    expect(clearSudoPassword).toHaveBeenCalledWith(fakeExecutor);
    expect(invalidateSudoPasswordCache).toHaveBeenCalledWith("srv-1");
    expect(json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });
});
