// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { readFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";
import type { AgentTool } from "../../../shared/agent-capability/types.js";
import { env } from "../../../config/env.js";

export const LUXISOFT_CHAT_LIST_TOOL = "luxisoft.chats.list";
export const LUXISOFT_CHAT_READ_TOOL = "luxisoft.chats.read";
const PROJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_ENV_FILE = "/var/www/luxisoft/backend/.env";
let poolPromise: Promise<Pool> | null = null;

function luxisoftEnvFile(): string {
  return path.resolve(env.LUXISOFT_CHAT_DATABASE_ENV_FILE || DEFAULT_ENV_FILE);
}

/** Ensure the CLI runs inside the local Luxisoft source/workspace tree. */
export function isLuxisoftWorkspacePath(projectPath: string | undefined | null): boolean {
  if (!projectPath) return false;
  const root = path.resolve(path.dirname(luxisoftEnvFile()), "..");
  const candidate = path.resolve(projectPath);
  return candidate === root || candidate.startsWith(root + path.sep);
}

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const rawEnv = await readFile(luxisoftEnvFile(), "utf8");
      const parsed = dotenv.parse(rawEnv);
      const connectionString = parsed.DATABASE_URL;
      if (!connectionString) throw new Error("LUXISOFT_DATABASE_URL_MISSING");
      const url = new URL(connectionString);
      if (!new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname)) {
        throw new Error("LUXISOFT_DATABASE_MUST_BE_LOCAL");
      }
      return new Pool({
        connectionString,
        max: 2,
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 2_000,
        application_name: "luxipanel-local-chat-reader",
      });
    })().catch(error => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

async function readonly<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '5s'");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type ProjectIdentity = { projectId: string; userId: string; projectName: string };

function parseReference(value: unknown): { projectId: string; url: string } | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || !["luxisoft.com", "www.luxisoft.com"].includes(url.hostname.toLowerCase())) return null;
  const projectId = url.searchParams.get("project")?.trim() ?? "";
  return PROJECT_UUID.test(projectId) ? { projectId, url: url.origin + url.pathname } : null;
}

async function resolveProject(projectId: string, ownerEmail: string): Promise<ProjectIdentity | null> {
  return readonly(async client => {
    const result = await client.query<{ project_id: string; user_id: string; project_name: string }>(
      `SELECT ap.id AS project_id, u.id AS user_id, ap.name AS project_name
       FROM account_projects ap
       JOIN store_accounts a ON a.id = ap.account_id
       JOIN store_users u ON lower(u.email) = lower($2)
       WHERE ap.id = $1::uuid
         AND ap.deleted_at IS NULL
         AND ap.archived_at IS NULL
         AND (a.owner_user_id = u.id OR EXISTS (
           SELECT 1 FROM store_account_memberships m
           WHERE m.account_id = a.id AND m.user_id = u.id
         ))
       LIMIT 1`,
      [projectId, ownerEmail],
    );
    const row = result.rows[0];
    return row ? { projectId: row.project_id, userId: row.user_id, projectName: row.project_name } : null;
  });
}

function inputText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function listChats(args: Record<string, unknown>) {
  const reference = parseReference(args.projectUrl);
  const ownerEmail = inputText(args.ownerEmail, 254).toLowerCase();
  if (!reference || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return { ok: false, output: "Indica el enlace de proyecto de Luxisoft y el correo de su propietario." };
  }
  const project = await resolveProject(reference.projectId, ownerEmail);
  if (!project) return { ok: false, output: "Ese proyecto no está asociado a ese usuario." };
  const q = inputText(args.q, 200);
  const limit = Math.max(1, Math.min(25, Number.isInteger(args.limit) ? Number(args.limit) : 10));
  const result = await readonly(client => client.query<{
    id: string; title: string | null; last_message_at: Date | null; message_count: number; preview: string | null;
  }>(
    `SELECT c.id, c.title, c.last_message_at,
       (SELECT count(*)::int FROM store_assistant_messages m WHERE m.conversation_id = c.id) AS message_count,
       (SELECT left(m.content, 400) FROM store_assistant_messages m
        WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.seq DESC LIMIT 1) AS preview
     FROM store_assistant_conversations c
     WHERE c.project_id = $1::uuid AND c.user_id = $2::uuid
       AND ($3::text = '' OR coalesce(c.title, '') ILIKE '%' || $3 || '%'
         OR EXISTS (SELECT 1 FROM store_assistant_messages q
           WHERE q.conversation_id = c.id AND q.role = 'user' AND q.content ILIKE '%' || $3 || '%'))
     ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
     LIMIT $4`,
    [project.projectId, project.userId, q, limit],
  ));
  return { ok: true, output: { project: project.projectName, chats: result.rows } };
}

async function readChat(args: Record<string, unknown>) {
  const reference = parseReference(args.projectUrl);
  const ownerEmail = inputText(args.ownerEmail, 254).toLowerCase();
  const conversationId = inputText(args.conversationId, 80);
  if (!reference || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) || !PROJECT_UUID.test(conversationId)) {
    return { ok: false, output: "Indica un enlace de proyecto válido, el correo de su propietario y el ID exacto del chat." };
  }
  const project = await resolveProject(reference.projectId, ownerEmail);
  if (!project) return { ok: false, output: "Ese proyecto no está asociado a ese usuario." };
  const limit = Math.max(1, Math.min(40, Number.isInteger(args.limit) ? Number(args.limit) : 20));
  const offset = Math.max(0, Math.min(5000, Number.isInteger(args.offset) ? Number(args.offset) : 0));
  const result = await readonly(client => client.query<{
    role: string; content: string; created_at: Date; blocks: unknown;
  }>(
    `SELECT m.role, left(m.content, 4000) AS content, m.created_at, m.blocks
     FROM store_assistant_messages m
     JOIN store_assistant_conversations c ON c.id = m.conversation_id
     WHERE c.id = $1::uuid AND c.project_id = $2::uuid AND c.user_id = $3::uuid
       AND m.role IN ('user', 'assistant')
     ORDER BY m.seq ASC
     OFFSET $4 LIMIT $5`,
    [conversationId, project.projectId, project.userId, offset, limit],
  ));
  if (!result.rowCount) return { ok: false, output: "No existe ese chat dentro del proyecto y usuario indicados." };
  const messages = result.rows.map(row => {
    const blocks = Array.isArray(row.blocks) ? row.blocks as Array<Record<string, unknown>> : [];
    const attachments = blocks.flatMap(block => {
      if (block.type !== "attachments" || !Array.isArray(block.items)) return [];
      return block.items.flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const file = item as Record<string, unknown>;
        if (typeof file.mediaObjectId !== "string" || typeof file.filename !== "string" || typeof file.contentType !== "string") return [];
        return [{
          mediaObjectId: file.mediaObjectId.slice(0, 80),
          filename: file.filename.slice(0, 160),
          contentType: file.contentType.slice(0, 120),
          kind: typeof file.kind === "string" ? file.kind.slice(0, 40) : "file",
          size: typeof file.size === "number" && Number.isFinite(file.size) ? Math.max(0, file.size) : undefined,
        }];
      });
    });
    return { role: row.role, content: row.content, created_at: row.created_at, ...(attachments.length ? { attachments } : {}) };
  });
  return { ok: true, output: { project: project.projectName, conversationId, messages } };
}

export function buildLuxisoftChatTools(scope: { projectPath: string; projectOwnerId?: number | null; userId?: number }): AgentTool[] {
  if (!isLuxisoftWorkspacePath(scope.projectPath) || scope.userId == null || scope.projectOwnerId !== scope.userId) return [];
  const runSafely = async (run: (args: Record<string, unknown>) => Promise<{ ok: boolean; output: unknown }>, value: unknown) => {
    try { return await run((value ?? {}) as Record<string, unknown>); }
    catch { return { ok: false, output: "No se pudo consultar el historial local de Luxisoft. El acceso al código del workspace es independiente." }; }
  };
  return [
    {
      name: LUXISOFT_CHAT_LIST_TOOL,
      title: "Consultar chats del proyecto Luxisoft",
      description: "Busca conversaciones del proyecto Luxisoft enlazado. Usa el enlace exacto de luxisoft.com y el correo del propietario. Consulta local, de solo lectura; solo devuelve conversaciones de ese usuario y proyecto.",
      kind: "read", dangerous: false,
      inputSchema: { type: "object", properties: {
        projectUrl: { type: "string", maxLength: 2048 }, ownerEmail: { type: "string", maxLength: 254 },
        q: { type: "string", maxLength: 200 }, limit: { type: "integer", minimum: 1, maximum: 25 },
      }, required: ["projectUrl", "ownerEmail"], additionalProperties: false },
      handler: value => runSafely(listChats, value),
    },
    {
      name: LUXISOFT_CHAT_READ_TOOL,
      title: "Leer chat del proyecto Luxisoft",
      description: "Lee mensajes de un chat del mismo proyecto Luxisoft después de localizar su ID con luxisoft.chats.list. El historial no se modifica y no se consultan otros proyectos ni usuarios.",
      kind: "read", dangerous: false,
      inputSchema: { type: "object", properties: {
        projectUrl: { type: "string", maxLength: 2048 }, ownerEmail: { type: "string", maxLength: 254 },
        conversationId: { type: "string", maxLength: 80 }, limit: { type: "integer", minimum: 1, maximum: 40 },
        offset: { type: "integer", minimum: 0 },
      }, required: ["projectUrl", "ownerEmail", "conversationId"], additionalProperties: false },
      handler: value => runSafely(readChat, value),
    },
  ];
}
