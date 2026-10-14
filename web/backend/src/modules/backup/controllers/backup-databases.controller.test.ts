// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: vi.fn(() => ({ target: { id: "server-a" } })) }));
vi.mock("../../databases/services/databases.service.js", () => ({
  databasesService: { detectEngines: vi.fn(), listDatabases: vi.fn() },
}));

import { backupDatabasesController } from "./backup-databases.controller.js";
import { databasesService } from "../../databases/services/databases.service.js";

function invoke(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const res = { json: vi.fn((value: unknown) => resolve(value)) } as unknown as Response;
    backupDatabasesController.list({} as Request, res, ((error?: unknown) => reject(error)) as NextFunction);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(databasesService.detectEngines).mockResolvedValue([
    { type: "mysql", label: "MySQL / MariaDB", installed: true, running: true, version: "8.0" },
    { type: "postgresql", label: "PostgreSQL", installed: true, running: true, version: "16" },
  ]);
});

describe("backup database picker", () => {
  it("returns only names from the connected target", async () => {
    vi.mocked(databasesService.listDatabases).mockImplementation(async (_executor, engine) =>
      engine === "mysql"
        ? [{ name: "shop", type: "mysql", tables: 3 }]
        : [{ name: "reports", type: "postgresql", tables: 9 }]);
    const result = await invoke();
    expect(result).toMatchObject({
      ok: true,
      data: [
        { type: "mysql", databases: ["shop"], error: false },
        { type: "postgresql", databases: ["reports"], error: false },
      ],
    });
  });

  it("keeps a working engine visible when the other engine fails", async () => {
    vi.mocked(databasesService.listDatabases).mockImplementation(async (_executor, engine) => {
      if (engine === "postgresql") throw new Error("socket unavailable");
      return [{ name: "shop", type: "mysql" }];
    });
    const result = await invoke();
    expect(result).toMatchObject({
      ok: true,
      data: [
        { type: "mysql", databases: ["shop"], error: false },
        { type: "postgresql", databases: [], error: true },
      ],
    });
  });
});
