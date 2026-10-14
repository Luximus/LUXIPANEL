// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Databases — AI agent capability.
 *
 * Read tools for discovery/inspection plus a guarded query tool. Every tool
 * name is prefixed `databases.` (the registry throws otherwise). Handlers run
 * inside the assistant request scope; the target executor is implicit via
 * `requireExecutor()`.
 */

import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { databasesService } from "./services/databases.service.js";
import { databaseExecutor } from "./services/scoped-executor.js";
import { assertDatabaseAccess, databaseNameAllowed } from "./services/tenant-database-scope.js";
import { engineTypeSchema, identifierSchema, type EngineType } from "./models/index.js";
import { getContextUser } from "../../shared/executor/context.js";
import { isHostingSession } from "../../shared/tenant/tenant-scope.js";
import { ForbiddenError } from "../../shared/errors/index.js";

export const databasesAgentCapability: AgentCapability = {
  moduleId: "databases",
  version: 1,
  tools: [
    {
      name: "databases.list_engines",
      title: "Detectar motores de base de datos",
      description:
        "Detect which database engines (MySQL/MariaDB, PostgreSQL) are installed and running on the target server, with their versions.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = databaseExecutor(requireExecutor());
        const engines = await databasesService.detectEngines(executor);
        return { ok: true, output: engines };
      },
    },
    {
      name: "databases.list_databases",
      title: "Listar bases de datos",
      description:
        "List the databases available for a given engine on the target server. Pass engine='mysql' or engine='postgresql'.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          engine: { type: "string", enum: ["mysql", "postgresql"], description: "Engine family" },
        },
        required: ["engine"],
      },
      handler: async (input) => {
        const executor = databaseExecutor(requireExecutor());
        const engine = parseEngine(input);
        const databases = await databasesService.listDatabases(executor, engine);
        const allowed = await databaseNameAllowed(executor);
        return { ok: true, output: databases.filter((database) => allowed(database.name)) };
      },
    },
    {
      name: "databases.list_tables",
      title: "Listar tablas",
      description: "List the tables in a database, with approximate row counts and on-disk size.",
      kind: "read",
      inputSchema: {
        type: "object",
        properties: {
          engine: { type: "string", enum: ["mysql", "postgresql"] },
          database: { type: "string", description: "Database/schema name" },
        },
        required: ["engine", "database"],
      },
      handler: async (input) => {
        const executor = databaseExecutor(requireExecutor());
        const engine = parseEngine(input);
        const database = identifierSchema.parse((input as Record<string, unknown>).database);
        await assertDatabaseAccess(executor, database);
        const tables = await databasesService.listTables(executor, engine, database);
        return { ok: true, output: tables };
      },
    },
    {
      name: "databases.run_query",
      title: "Ejecutar consulta SQL",
      description:
        "Run a SQL statement against a database and return the result set. Read statements (SELECT/SHOW/EXPLAIN) run freely; mutating/DDL statements require allowWrite=true.",
      kind: "action",
      dangerous: true,
      inputSchema: {
        type: "object",
        properties: {
          engine: { type: "string", enum: ["mysql", "postgresql"] },
          database: { type: "string", description: "Optional default database for the statement" },
          sql: { type: "string", description: "The SQL statement to execute" },
          allowWrite: {
            type: "boolean",
            description: "Set true to permit INSERT/UPDATE/DELETE/DDL. Defaults to false.",
          },
        },
        required: ["engine", "sql"],
      },
      handler: async (input) => {
        if (isHostingSession(getContextUser())) {
          throw new ForbiddenError("La consola SQL no está disponible para cuentas de hosting");
        }
        const executor = databaseExecutor(requireExecutor());
        const obj = input as Record<string, unknown>;
        const engine = parseEngine(input);
        const sql = String(obj.sql ?? "");
        const database = obj.database ? identifierSchema.parse(obj.database) : null;
        const allowWrite = obj.allowWrite === true;
        const result = await databasesService.runQuery(executor, engine, sql, database, {
          limit: 200,
          allowWrite,
        });
        return { ok: true, output: result };
      },
    },
  ],
  suggestedPrompts: [
    "¿Qué motores de base de datos hay instalados en el servidor?",
    "Lista las bases de datos MySQL y cuántas tablas tiene cada una",
    "Muéstrame las primeras filas de la tabla users",
  ],
};

function parseEngine(input: unknown): EngineType {
  return engineTypeSchema.parse((input as Record<string, unknown>)?.engine);
}
