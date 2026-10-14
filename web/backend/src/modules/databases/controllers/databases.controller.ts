// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Databases controller — engine discovery, schema browsing and the SQL
 * console. Every handler resolves the per-request executor via getExecutor()
 * so all work lands on the connected server.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { getContextUser } from "../../../shared/executor/context.js";
import { databasesService } from "../services/databases.service.js";
import { databaseExecutor } from "../services/scoped-executor.js";
import { assertDatabaseAccess, databaseNameAllowed, tenantDatabaseQuota, withTenantDatabaseCreationLock } from "../services/tenant-database-scope.js";
import {
  isHostingSession,
  getTenantEnvelope,
  tenantDbPrefix,
  assertWithinDatabaseQuota,
} from "../../../shared/tenant/tenant-scope.js";
import { ConflictError, ForbiddenError } from "../../../shared/errors/index.js";
import { recordActivity } from "../../../shared/worklog/worklog-recorder.service.js";
import {
  deleteRecordSchema,
  createDatabaseSchema,
  exportDatabaseSchema,
  installEngineSchema,
  insertRecordSchema,
  listDatabasesQuerySchema,
  listTablesQuerySchema,
  rowsQuerySchema,
  runQuerySchema,
  tableParamsSchema,
  updateRecordSchema,
} from "../models/index.js";

function assertAdminDatabaseOperation(): void {
  if (isHostingSession(getContextUser())) {
    throw new ForbiddenError("Esta operación requiere un administrador del servidor");
  }
}

export const databasesController = {
  createDatabase: asyncHandler(async (req: Request, res: Response) => {
    const { engine, name } = createDatabaseSchema.parse(req.body);
    const user = getContextUser();
    const tenant = isHostingSession(user) ? getTenantEnvelope(user!) : null;
    const executor = databaseExecutor(getExecutor(req));
    const create = async () => {
      const allowed = await databaseNameAllowed(executor);
      if (tenant && !allowed(name)) {
        throw new ForbiddenError(`El nombre debe empezar por ${tenantDbPrefix(tenant)} y no pertenecer a otra cuenta`);
      }
      const existing = await databasesService.listDatabases(executor, engine);
      if (existing.some((item) => item.name === name)) throw new ConflictError("La base de datos ya existe");
      if (tenant) {
        const otherEngine = engine === "mysql" ? "postgresql" : "mysql";
        const detected = await databasesService.detectEngines(executor);
        const other = detected.some((item) => item.type === otherEngine && item.running)
          ? await databasesService.listDatabases(executor, otherEngine) : [];
        const count = [...existing, ...other].filter((item) => allowed(item.name)).length;
        const quota = await tenantDatabaseQuota(executor, tenant.owner);
        assertWithinDatabaseQuota({ ...tenant, maxDatabases: quota }, count);
      }
      await databasesService.createDatabase(executor, engine, name);
    };
    if (tenant) await withTenantDatabaseCreationLock(`${executor.target.id}:${tenant.owner}`, create);
    else await create();
    void recordActivity({ module: "databases", action: "create_database", category: "database", detail: name, linuxUsername: tenant?.owner });
    res.status(201).json({ ok: true, data: { name, engine } });
  }),
  /** GET /api/databases/engines — detect installed/running engines. */
  engines: asyncHandler(async (req: Request, res: Response) => {
    const executor = databaseExecutor(getExecutor(req));
    const engines = await databasesService.detectEngines(executor);
    res.json({ ok: true, data: engines });
  }),

  /** GET /api/databases/list?engine= — list databases for an engine. */
  databases: asyncHandler(async (req: Request, res: Response) => {
    const { engine } = listDatabasesQuerySchema.parse(req.query);
    const executor = databaseExecutor(getExecutor(req));
    const databases = await databasesService.listDatabases(executor, engine);
    const allowed = await databaseNameAllowed(executor);
    res.json({ ok: true, data: databases.filter((database) => allowed(database.name)) });
  }),

  /** GET /api/databases/tables?engine=&database= — list tables in a database. */
  tables: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database } = listTablesQuerySchema.parse(req.query);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const tables = await databasesService.listTables(executor, engine, database);
    res.json({ ok: true, data: tables });
  }),

  /** GET /api/databases/columns?engine=&database=&table= — table structure. */
  columns: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, table } = tableParamsSchema.parse(req.query);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const columns = await databasesService.listColumns(executor, engine, database, table);
    res.json({ ok: true, data: columns });
  }),

  /** GET /api/databases/rows?engine=&database=&table=&limit=&offset= — browse rows. */
  rows: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, table, limit, offset, sortBy, sortDir } = rowsQuerySchema.parse(req.query);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const result = await databasesService.listRows(executor, engine, database, table, limit, offset, sortBy, sortDir);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/databases/query — run an arbitrary statement (SQL console). */
  query: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, sql, limit, allowWrite } = runQuerySchema.parse(req.body);
    assertAdminDatabaseOperation();
    const executor = databaseExecutor(getExecutor(req));

    const result = await databasesService.runQuery(executor, engine, sql, database ?? null, {
      limit,
      allowWrite,
    });
    res.json({ ok: true, data: result });
  }),

  /** POST /api/databases/records — insert a record. */
  insertRecord: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, table, values } = insertRecordSchema.parse(req.body);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const result = await databasesService.insertRecord(executor, engine, database, table, values);
    res.json({ ok: true, data: result });
  }),

  /** PATCH /api/databases/records — update a record (primary-key scoped). */
  updateRecord: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, table, values, where } = updateRecordSchema.parse(req.body);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const result = await databasesService.updateRecord(executor, engine, database, table, values, where);
    res.json({ ok: true, data: result });
  }),

  /** DELETE /api/databases/records — delete a record (primary-key scoped). */
  deleteRecord: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, table, where } = deleteRecordSchema.parse(req.body);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const result = await databasesService.deleteRecord(executor, engine, database, table, where);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/databases/export — dump a database (subset/structure optional). */
  export: asyncHandler(async (req: Request, res: Response) => {
    const { engine, database, tables, includeData } = exportDatabaseSchema.parse(req.body);
    const executor = databaseExecutor(getExecutor(req));
    await assertDatabaseAccess(executor, database);
    const dump = await databasesService.exportDatabase(
      executor,
      engine,
      database,
      tables ?? [],
      includeData,
    );
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `${database}-${stamp}.sql`;
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(dump);
  }),

  /** POST /api/databases/install — install a database engine on the target. */
  install: asyncHandler(async (req: Request, res: Response) => {
    const { engine, sudoPassword } = installEngineSchema.parse(req.body);
    assertAdminDatabaseOperation();
    const executor = databaseExecutor(getExecutor(req));
    const result = await databasesService.installEngine(executor, engine, sudoPassword);
    // Surface code/output inside `data` so the shared install-modal/withSudo
    // helper drives the sudo prompt and the live log.
    res.json({
      ok: result.ok,
      code: result.code,
      data: { code: result.code, output: result.output, manager: result.manager },
    });
  }),
};
