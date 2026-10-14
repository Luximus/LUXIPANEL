import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireObsidianAdmin } from "./admin.middleware.js";

describe("Obsidian administration", () => {
  it("rejects non-admin sessions and permits administrators", () => {
    const next = vi.fn();
    requireObsidianAdmin({} as Request, { locals: { user: { kind: "user" } } } as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: "ForbiddenError" }));
    next.mockClear();
    requireObsidianAdmin({} as Request, { locals: { user: { kind: "admin" } } } as Response, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });
});
