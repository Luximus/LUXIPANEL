// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Stub the logger so this test doesn't pull in config/env (which can
// process.exit on missing secrets) and so we can assert log calls.
const logWarn = vi.fn();
const logError = vi.fn();
vi.mock("../logger/index.js", () => ({
  logger: { warn: (...a: unknown[]) => logWarn(...a), error: (...a: unknown[]) => logError(...a) },
}));

import { errorHandler, mapErrorToResponse } from "./error-handler.js";
import { AppError, ValidationError } from "./errors.js";
import { ZodError } from "zod";

function makeRes() {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(function (this: typeof res, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: typeof res, payload: unknown) {
      this.body = payload;
      return this;
    }),
  };
  return res;
}

const req = { method: "GET", originalUrl: "/api/files/dir-size" } as unknown as Request;

describe("errorHandler", () => {
  beforeEach(() => {
    logWarn.mockClear();
    logError.mockClear();
  });

  it("does not respond and delegates via next(err) when headers were already sent", () => {
    const res = makeRes();
    res.headersSent = true;
    const next = vi.fn() as unknown as NextFunction;
    const err = new AppError("boom", 500, "SOME_CODE");

    errorHandler(err, req, res as unknown as Response, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(err);
    expect(logWarn).toHaveBeenCalledTimes(1);
  });

  it("returns a typed operational error response normally", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    const err = new ValidationError("bad input", [{ field: "path", message: "required" }]);

    errorHandler(err, req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(err.statusCode);
    expect(res.body).toMatchObject({ ok: false, error: "bad input", code: err.code });
    expect((res.body as { details?: unknown }).details).toEqual([
      { field: "path", message: "required" },
    ]);
  });

  it("masks unexpected (non-operational) errors as a 500 and responds once", () => {
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    errorHandler(new Error("kaboom"), req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
  });

  it("uses the locale cookie for errors raised before cookie-parser", () => {
    const res = makeRes();
    const earlyReq = { method: "POST", originalUrl: "/api/files/upload", headers: { cookie: "lxp-locale=es" } } as unknown as Request;
    errorHandler({ type: "entity.too.large" }, earlyReq, res as unknown as Response, vi.fn());
    expect(res.body).toMatchObject({ code: "PAYLOAD_TOO_LARGE", error: "El contenido enviado es demasiado grande" });
  });
});

describe("mapErrorToResponse", () => {
  it("maps a ZodError to a 400 ValidationError-shaped payload", () => {
    const zodErr = new ZodError([
      { code: "invalid_type", expected: "string", received: "undefined", path: ["email"], message: "required" },
    ]);
    const mapped = mapErrorToResponse(zodErr);
    expect(mapped.statusCode).toBe(400);
    expect(mapped.body.ok).toBe(false);
    expect(mapped.body.code).toBe("VALIDATION_ERROR");
    expect(mapped.body.details).toEqual([{ field: "email", message: "This field is required" }]);
    expect(mapped.logLevel).toBe("warn");
  });

  it("maps an operational 4xx to warn + body with code", () => {
    const err = new AppError("nope", 404, "NOT_FOUND");
    const mapped = mapErrorToResponse(err);
    expect(mapped.statusCode).toBe(404);
    expect(mapped.logLevel).toBe("warn");
    expect(mapped.body).toMatchObject({ ok: false, error: "nope", code: "NOT_FOUND" });
  });

  it("localizes shared errors and Zod field issues without changing their codes", () => {
    const error = mapErrorToResponse(new AppError("Access denied", 403, "FORBIDDEN"), "fr");
    expect(error.body).toMatchObject({ code: "FORBIDDEN", error: "Accès refusé" });

    const zod = mapErrorToResponse(new ZodError([
      { code: "invalid_type", expected: "string", received: "undefined", path: ["name"], message: "Required" },
    ]), "es");
    expect(zod.body).toMatchObject({ code: "VALIDATION_ERROR", error: "name: Este campo es obligatorio" });
    expect(zod.body.details).toEqual([{ field: "name", message: "Este campo es obligatorio" }]);

    const english = mapErrorToResponse(new ZodError([
      { code: "invalid_type", expected: "string", received: "undefined", path: ["name"], message: "Campo obligatorio" },
    ]), "en");
    expect(english.body.error).toBe("name: This field is required");
    expect(mapErrorToResponse(new ValidationError("Invalid body"), "ja").body.error).toBe("入力内容の検証に失敗しました");
    const expo = mapErrorToResponse(new AppError("No hay un access token de Expo configurado.", 409, "EXPO_TOKEN_MISSING"), "en");
    expect(expo.body).toMatchObject({ code: "EXPO_TOKEN_MISSING", error: "No Expo access token is configured. Save one in the module settings." });
  });

  it("maps an operational 5xx to error log level", () => {
    const err = new AppError("kaput", 502, "BAD_GATEWAY");
    const mapped = mapErrorToResponse(err);
    expect(mapped.statusCode).toBe(502);
    expect(mapped.logLevel).toBe("error");
  });

  it("masks unknown errors in production as INTERNAL_ERROR 500", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const mapped = mapErrorToResponse(new Error("leaky"));
      expect(mapped.statusCode).toBe(500);
      expect(mapped.body.error).toBe("Internal server error");
      expect(mapped.body.code).toBe("INTERNAL_ERROR");
      expect(mapped.logLevel).toBe("error");
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
