// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail — AI agent capability.
 *
 * Two groups of tools:
 *  - Domain discovery (read-only): `mail.list_domains`.
 *  - Inbox depuration: read tools to inspect a folder (`mail.list_messages`,
 *    `mail.fetch_message`) plus action tools to act on a batch of UIDs
 *    (`mail.move_messages`, `mail.delete_messages`, `mail.flag_messages`).
 *
 * Depuration is QUARANTINE-FIRST by design: the assistant should move
 * suspicious mail to a review folder (default "Revisar-IA") via
 * `mail.move_messages` (non-destructive, reversible). `mail.delete_messages`
 * is `dangerous=true` — it starts disabled / requireConfirm in the sidecar and
 * is only the path once the user has reviewed the quarantine.
 *
 * Spam/malware judgement combines the signals the tools surface:
 *  1. Header authentication (SPF/DKIM/DMARC + Return-Path) from `fetch_message`.
 *  2. The model's own heuristics over sender / subject / attachment types.
 */

import { z } from "zod";
import type { AgentCapability } from "../../shared/agent-capability/index.js";
import { requireExecutor } from "../../shared/agent-capability/index.js";
import { serverDomainsService } from "../nginx/services/server-domains.service.js";
import { imapService } from "./services/index.js";
import { requireMailAccount, requireStoredCredential } from "./controllers/mailbox-account.helpers.js";

const DEFAULT_QUARANTINE_FOLDER = "Revisar-IA";
const MESSAGE_TEXT_CAP = 4000;

/** Resolve an IMAP-capable account in the current request scope. */
async function resolveAccount(accountId: number): Promise<{ address: string; passwordEncrypted: string | null }> {
  const account = await requireMailAccount(accountId);
  if (!account.enabled) {
    throw new Error(`La cuenta ${account.address} está deshabilitada`);
  }
  const passwordEncrypted = requireStoredCredential(account);
  return { address: account.address, passwordEncrypted };
}

function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n…(truncado, ${value.length - max} caracteres más)`;
}

/** Read a trimmed string param, falling back when missing/blank/non-string. */
function getStringParam(obj: Record<string, unknown>, key: string, fallback: string): string {
  const value = obj[key];
  return (typeof value === "string" && value.trim()) || fallback;
}

/** Sanitize a UID list input into a deduped array of positive integers. */
function parseUidList(input: unknown): number[] {
  const arr = z.array(z.number().int().positive()).min(1).parse(input);
  return Array.from(new Set(arr));
}

const accountIdSchema = z.number().int().positive();

export const mailAgentCapability: AgentCapability = {
  moduleId: "mail",
  version: 1,
  tools: [
    {
      name: "mail.list_domains",
      title: "Dominios disponibles",
      description:
        "List the domains discovered on this target (from nginx/apache/caddy configs) " +
        "that can be configured for mail. Returns name, vendor, and inferred root path.",
      kind: "read",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const executor = requireExecutor();
        const domains = await serverDomainsService.list(executor);
        return { ok: true, output: domains };
      },
    },
    {
      name: "mail.list_messages",
      title: "Listar mensajes del buzón",
      description:
        "List messages in a mailbox folder (paginated). Returns compact metadata per " +
        "message: uid, from, subject, date, seen, flags, hasAttachments and a short " +
        "preview. Use this to triage a folder in batches before acting. Page through " +
        "with `page` until fewer than `limit` messages come back.",
      kind: "read",
      permission: "mail",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "number", description: "Mail account id (fnv1aId of the address)" },
          folder: { type: "string", description: "IMAP folder path. Default INBOX." },
          page: { type: "number", description: "1-based page. Default 1." },
          limit: { type: "number", description: "Page size, max 100. Default 50." },
        },
        required: ["accountId"],
      },
      handler: async (input) => {
        const obj = (input ?? {}) as Record<string, unknown>;
        const accountId = accountIdSchema.parse(Number(obj.accountId));
        const folder = getStringParam(obj, "folder", "INBOX");
        const page = Math.max(1, Number(obj.page ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(obj.limit ?? 50) || 50));
        const { address, passwordEncrypted } = await resolveAccount(accountId);

        const result = await imapService.listMessages(address, passwordEncrypted, folder, { page, pageSize: limit });
        return {
          ok: true,
          output: {
            folder,
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            messages: result.messages.map((m) => ({
              uid: m.uid,
              from: m.from,
              subject: m.subject,
              date: m.date,
              seen: m.seen,
              flags: m.flags,
              hasAttachments: m.hasAttachments,
            })),
          },
        };
      },
    },
    {
      name: "mail.fetch_message",
      title: "Leer mensaje completo",
      description:
        "Fetch one message by UID. Returns sender/recipients, subject, date, body " +
        "(plain text, truncated), attachment list, AND header authentication results " +
        "(spf/dkim/dmarc verdicts + Return-Path). Use the auth verdicts to detect " +
        "spoofing/phishing and the body to judge borderline cases.",
      kind: "read",
      permission: "mail",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "number", description: "Mail account id" },
          uid: { type: "number", description: "Message UID" },
          folder: { type: "string", description: "IMAP folder path. Default INBOX." },
        },
        required: ["accountId", "uid"],
      },
      handler: async (input) => {
        const obj = (input ?? {}) as Record<string, unknown>;
        const accountId = accountIdSchema.parse(Number(obj.accountId));
        const uid = z.number().int().positive().parse(Number(obj.uid));
        const folder = getStringParam(obj, "folder", "INBOX");
        const { address, passwordEncrypted } = await resolveAccount(accountId);

        const m = await imapService.fetchMessage(address, passwordEncrypted, folder, uid);
        return {
          ok: true,
          output: {
            uid: m.uid,
            from: m.from,
            to: m.to,
            cc: m.cc,
            subject: m.subject,
            date: m.date,
            seen: m.seen,
            flags: m.flags,
            auth: m.auth,
            hasAttachments: m.hasAttachments,
            attachments: m.attachments.map((a) => ({
              filename: a.filename,
              contentType: a.contentType,
              size: a.size,
            })),
            text: clampText(m.text || m.preview || "", MESSAGE_TEXT_CAP),
          },
        };
      },
    },
    {
      name: "mail.move_messages",
      title: "Mover mensajes a cuarentena",
      description:
        "Move a batch of messages (by UID list) from a folder to another folder — the " +
        "quarantine-first action for depuration. The destination folder is created if " +
        "it does not exist. Default destination is 'Revisar-IA'. This is REVERSIBLE: " +
        "prefer it over deleting.",
      kind: "action",
      dangerous: false,
      permission: "mail",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "number", description: "Mail account id" },
          uids: { type: "array", items: { type: "number" }, description: "UIDs to move" },
          folder: { type: "string", description: "Source folder. Default INBOX." },
          destFolder: { type: "string", description: "Destination folder. Default 'Revisar-IA'." },
        },
        required: ["accountId", "uids"],
      },
      handler: async (input) => {
        const obj = (input ?? {}) as Record<string, unknown>;
        const accountId = accountIdSchema.parse(Number(obj.accountId));
        const uids = parseUidList(obj.uids);
        const folder = getStringParam(obj, "folder", "INBOX");
        const destFolder = getStringParam(obj, "destFolder", DEFAULT_QUARANTINE_FOLDER);
        const { address, passwordEncrypted } = await resolveAccount(accountId);

        try {
          await imapService.createFolder(address, passwordEncrypted, destFolder);
        } catch {
          // Folder likely already exists — fine.
        }
        const result = await imapService.moveMessages(address, passwordEncrypted, folder, uids, destFolder);
        return { ok: true, output: { movedTo: destFolder, ...result } };
      },
    },
    {
      name: "mail.flag_messages",
      title: "Marcar mensajes",
      description:
        "Set or clear an IMAP flag on a batch of messages (by UID list). Common flags: " +
        "\\Seen (read), \\Flagged (starred). Use \\Flagged to mark for the user's review " +
        "without moving anything.",
      kind: "action",
      dangerous: false,
      permission: "mail",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "number", description: "Mail account id" },
          uids: { type: "array", items: { type: "number" }, description: "UIDs to flag" },
          folder: { type: "string", description: "Folder. Default INBOX." },
          flag: { type: "string", description: "IMAP flag, e.g. \\Seen or \\Flagged. Default \\Flagged." },
          set: { type: "boolean", description: "true to add the flag, false to remove. Default true." },
        },
        required: ["accountId", "uids"],
      },
      handler: async (input) => {
        const obj = (input ?? {}) as Record<string, unknown>;
        const accountId = accountIdSchema.parse(Number(obj.accountId));
        const uids = parseUidList(obj.uids);
        const folder = getStringParam(obj, "folder", "INBOX");
        const flag = getStringParam(obj, "flag", "\\Flagged");
        const set = obj.set === undefined ? true : Boolean(obj.set);
        const { address, passwordEncrypted } = await resolveAccount(accountId);

        const result = await imapService.setFlagMany(address, passwordEncrypted, folder, uids, flag, set);
        return { ok: true, output: { flag, set, ...result } };
      },
    },
    {
      name: "mail.delete_messages",
      title: "Eliminar mensajes (permanente)",
      description:
        "PERMANENTLY delete a batch of messages (by UID list) — marks \\Deleted and " +
        "expunges. IRREVERSIBLE. Only use after the user has reviewed the quarantine " +
        "folder; for normal depuration prefer mail.move_messages.",
      kind: "action",
      dangerous: true,
      permission: "mail",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "number", description: "Mail account id" },
          uids: { type: "array", items: { type: "number" }, description: "UIDs to delete" },
          folder: { type: "string", description: "Folder. Default INBOX." },
        },
        required: ["accountId", "uids"],
      },
      handler: async (input) => {
        const obj = (input ?? {}) as Record<string, unknown>;
        const accountId = accountIdSchema.parse(Number(obj.accountId));
        const uids = parseUidList(obj.uids);
        const folder = getStringParam(obj, "folder", "INBOX");
        const { address, passwordEncrypted } = await resolveAccount(accountId);

        const result = await imapService.deleteMessages(address, passwordEncrypted, folder, uids);
        return { ok: true, output: result };
      },
    },
  ],
  suggestedPrompts: [
    "Depura mi bandeja de entrada: revisa la cuenta y mueve spam y phishing a la carpeta Revisar-IA.",
    "Revisa los correos con adjuntos sospechosos de la bandeja de entrada y pon en cuarentena los dudosos.",
    "Revisa la autenticación (SPF/DKIM/DMARC) de los últimos correos y márcame los sospechosos de suplantación.",
  ],
};
