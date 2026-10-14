// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mailbox controller — IMAP operations (list folders, messages, read).
 */

import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { errMessage } from "../../../shared/utils/err-message.js";
import { parsePageQuery } from "../../../shared/http/pagination.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { runWithExecutor } from "../../../shared/executor/context.js";
import { eventBus, Events } from "../../../shared/events/index.js";
import { imapService } from "../services/index.js";
import { mailboxCredentialService } from "../services/mailbox-credential.service.js";
import { NotFoundError, ForbiddenError, ConflictError, AppError } from "../../../shared/errors/index.js";
// `requireOwnedMailAccount` (NO `requireMailAccount`): además de resolver la
// cuenta, comprueba que sea del usuario. El helper sin esa comprobación quedó
// fuera a propósito — resolver sin verificar propiedad era un IDOR.
import { requireOwnedMailAccount, requireStoredCredential } from "./mailbox-account.helpers.js";

const setCredentialSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

const folderRangeSchema = z.object({
  folder: z.string().min(1, "Folder is required"),
  dateFrom: z.string().min(1, "dateFrom is required"),
  dateTo: z.string().min(1, "dateTo is required"),
});

const copyRangeSchema = folderRangeSchema.extend({
  destinationAccountId: z.number().int().positive(),
  destinationFolder: z.string().min(1).optional(),
});

const cloneSchema = z.object({
  destinationAccountId: z.number().int().positive(),
});

const folderCreateSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(120, "Folder name is too long"),
  parentPath: z.string().min(1).optional(),
});

const folderRenameSchema = z.object({
  path: z.string().min(1, "Folder path is required"),
  name: z.string().min(1, "New folder name is required").max(120, "Folder name is too long"),
});

const folderDeleteSchema = z.object({
  path: z.string().min(1, "Folder path is required"),
});

const PROTECTED_SPECIAL_USE = new Set(["\\inbox", "\\sent", "\\trash"]);
const PROTECTED_FOLDER_NAMES = new Set(["inbox", "sent", "trash"]);

function parseDateOrThrow(raw: string, field: string): Date {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new ConflictError(`${field} is invalid`);
  }
  return value;
}

function parseOptionalDateQuery(value: unknown, field: string): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return parseDateOrThrow(value, field);
}

/** Reject an inverted date range. No-op when either bound is missing. */
function assertDateRange(from: Date | undefined, to: Date | undefined): void {
  if (from && to && from > to) {
    throw new ConflictError("dateFrom must be earlier than dateTo");
  }
}

function normalizeFolderKey(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function isProtectedFolder(folder: {
  path: string;
  name: string;
  specialUse?: string | null;
}): boolean {
  const special = normalizeFolderKey(folder.specialUse);
  if (PROTECTED_SPECIAL_USE.has(special)) return true;

  const name = normalizeFolderKey(folder.name);
  const path = normalizeFolderKey(folder.path);
  if (PROTECTED_FOLDER_NAMES.has(name)) return true;
  if (PROTECTED_FOLDER_NAMES.has(path)) return true;
  return false;
}

function formatBytes(bytes: number): string {
  const value = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (value >= 1024 ** 3) return `${(value / (1024 ** 3)).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / (1024 ** 2)).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} bytes`;
}

async function requireImapCapableAccount(accountId: number) {
  const account = await requireOwnedMailAccount(accountId);
  if (!account.enabled) throw new ForbiddenError("Account is disabled");
  if (account.loginMode === "suspend") {
    throw new ForbiddenError("Login is suspended for this account");
  }
  // May be null: the transports try the panel's master access first and raise
  // 409 (MAIL_PASSWORD_NOT_SET / MAIL_CREDENTIAL_INVALID) themselves when no
  // login works → the inbox UI shows the credential dialog.
  const passwordEncrypted = requireStoredCredential(account);
  return { ...account, passwordEncrypted };
}

type ImapFolder = Awaited<ReturnType<typeof imapService.listFolders>>[number];

/**
 * Resolve an IMAP folder by path, rejecting unknown (404) and protected (403)
 * folders. `action` is the Spanish verb used in the protection error message
 * ("renombrar" / "eliminar").
 */
async function requireUnprotectedFolder(
  account: { address: string; passwordEncrypted: string | null },
  path: string,
  action: string,
): Promise<ImapFolder> {
  const folders = await imapService.listFolders(account.address, account.passwordEncrypted);
  const folder = folders.find((item) => item.path === path);
  if (!folder) throw new NotFoundError("Folder");
  if (isProtectedFolder(folder)) {
    throw new ForbiddenError(`Esta carpeta está protegida y no se puede ${action}`);
  }
  return folder;
}

export const mailboxController = {
  /**
   * POST /api/mail/:accountId/credential — register the account's CURRENT
   * mailbox password (verified via an IMAP login) WITHOUT changing it. Lets
   * existing accounts enable the inbox by entering their current password
   * instead of resetting it (which would rewrite Dovecot's users file).
   */
  setCredential: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireOwnedMailAccount(accountId);
    if (!account.enabled) throw new ForbiddenError("Account is disabled");
    if (account.loginMode === "suspend") {
      throw new ForbiddenError("Login is suspended for this account");
    }
    const { password } = setCredentialSchema.parse(req.body);

    const result = await imapService.verifyLogin(account.address, password);
    if (!result.ok) {
      if (result.reason === "auth") {
        throw new AppError(
          "La contraseña actual del buzón es incorrecta.",
          401,
          "MAIL_CREDENTIAL_INVALID",
        );
      }
      throw new AppError(
        `No se pudo conectar al servidor IMAP para verificar la contraseña. ${result.detail}`,
        502,
        "MAIL_IMAP_UNREACHABLE",
      );
    }

    // Verified — store it encrypted (context executor, same as the rest).
    await mailboxCredentialService.setPassword(account.address, password);
    res.json({ ok: true });
  }),

  /** GET /api/mail/:accountId/folders — list IMAP folders. */
  listFolders: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);

    const folders = await imapService.listFolders(account.address, account.passwordEncrypted);
    res.json({ ok: true, data: folders });
  }),

  /** GET /api/mail/:accountId/messages?folder=INBOX&page=1 — list messages. */
  listMessages: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);

    const folder = String(req.query.folder || "INBOX");
    // `pageSize` is accepted as an alias of `limit`; the 100 cap matches what
    // `imap-fetch` enforces anyway (and used to be re-applied at the call site).
    const { page, limit: pageSize } = parsePageQuery(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
      aliases: ["pageSize"],
    });
    const search = typeof req.query.search === "string" ? req.query.search : "";
    const email = typeof req.query.email === "string" ? req.query.email : "";
    const dateFrom = parseOptionalDateQuery(req.query.dateFrom, "dateFrom");
    const dateTo = parseOptionalDateQuery(req.query.dateTo, "dateTo");
    const sortOrder = String(req.query.sort || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    assertDateRange(dateFrom, dateTo);

    const result = await imapService.listMessages(
      account.address,
      account.passwordEncrypted,
      folder,
      {
        page,
        pageSize,
        search,
        email,
        dateFrom,
        dateTo,
        sortOrder,
      },
    );

    res.json({ ok: true, ...result });
  }),

  /** GET /api/mail/:accountId/messages/:uid?folder=INBOX — fetch single message. */
  fetchMessage: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const uid = parseInt(String(req.params.uid), 10);
    const account = await requireImapCapableAccount(accountId);

    const folder = String(req.query.folder || "INBOX");

    const message = await imapService.fetchMessage(
      account.address,
      account.passwordEncrypted,
      folder,
      uid,
    );

    res.json({ ok: true, data: message });
  }),

  /** GET /api/mail/:accountId/disk-usage — mailbox-level usage summary. */
  diskUsage: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);

    const folders = await imapService.listFolderUsage(account.address, account.passwordEncrypted);
    const totalBytes = folders.reduce((acc, folder) => acc + folder.sizeBytes, 0);

    res.json({
      ok: true,
      data: {
        totalBytes,
        totalFormatted: formatBytes(totalBytes),
        folders: folders.map((folder) => ({
          ...folder,
          sizeFormatted: formatBytes(folder.sizeBytes),
        })),
      },
    });
  }),

  /** POST /api/mail/:accountId/disk-usage/delete-by-date */
  deleteByDate: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);
    const body = folderRangeSchema.parse(req.body);

    const dateFrom = parseDateOrThrow(body.dateFrom, "dateFrom");
    const dateTo = parseDateOrThrow(body.dateTo, "dateTo");
    assertDateRange(dateFrom, dateTo);

    const result = await imapService.deleteMessagesByDateRange(
      account.address,
      account.passwordEncrypted,
      body.folder,
      dateFrom,
      dateTo,
    );

    res.json({ ok: true, data: result });
  }),

  /** POST /api/mail/:accountId/disk-usage/copy-by-date */
  copyByDate: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const sourceAccount = await requireImapCapableAccount(accountId);
    const body = copyRangeSchema.parse({
      ...req.body,
      destinationAccountId: Number(req.body?.destinationAccountId),
    });

    const destinationAccount = await requireImapCapableAccount(body.destinationAccountId);
    const dateFrom = parseDateOrThrow(body.dateFrom, "dateFrom");
    const dateTo = parseDateOrThrow(body.dateTo, "dateTo");
    assertDateRange(dateFrom, dateTo);

    const result = await imapService.copyMessagesByDateRange(
      sourceAccount.address,
      sourceAccount.passwordEncrypted,
      body.folder,
      destinationAccount.address,
      destinationAccount.passwordEncrypted,
      body.destinationFolder || body.folder,
      dateFrom,
      dateTo,
    );

    res.json({ ok: true, data: result });
  }),

  /**
   * POST /api/mail/:accountId/clone — copy ALL folders and messages from this
   * account to another (existing) account. Message-ID dedup makes it safe to
   * re-run. The destination must already exist (the UI creates it first when
   * cloning to a "new" account).
   */
  clone: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const source = await requireImapCapableAccount(accountId);
    const body = cloneSchema.parse({
      ...req.body,
      destinationAccountId: Number(req.body?.destinationAccountId),
    });
    if (body.destinationAccountId === accountId) {
      throw new ConflictError("La cuenta destino debe ser distinta del origen");
    }
    const destination = await requireImapCapableAccount(body.destinationAccountId);

    // Heavy mailboxes take minutes to clone over IMAP → a synchronous response
    // hits the Cloudflare/proxy 524 timeout. Run it in the BACKGROUND and
    // report progress via notifications (event bus → notifications module).
    // We capture the per-request executor and re-establish it for the detached
    // task so the notification lands on the connected server's sidecar.
    const executor = getExecutor(req);
    const src = source.address;
    const dst = destination.address;
    eventBus.emit(Events.MAIL_CLONE_STARTED, { source: src, destination: dst });

    void runWithExecutor(executor, async () => {
      try {
        const result = await imapService.cloneMailbox(
          source.address,
          source.passwordEncrypted,
          destination.address,
          destination.passwordEncrypted,
        );
        const copied = (result?.folders ?? []).reduce((n, f) => n + (f.copied ?? 0), 0);
        eventBus.emit(Events.MAIL_CLONE_COMPLETED, { source: src, destination: dst, copied });
      } catch (err) {
        eventBus.emit(Events.MAIL_CLONE_FAILED, {
          source: src, destination: dst,
          error: errMessage(err),
        });
      }
    });

    res.status(202).json({ ok: true, data: { status: "started", source: src, destination: dst } });
  }),

  /** POST /api/mail/:accountId/folders — create folder. */
  createFolder: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);
    const body = folderCreateSchema.parse(req.body);

    const result = await imapService.createFolder(
      account.address,
      account.passwordEncrypted,
      body.name,
      body.parentPath,
    );

    res.json({ ok: true, data: result });
  }),

  /** PUT /api/mail/:accountId/folders — rename folder. */
  renameFolder: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);
    const body = folderRenameSchema.parse(req.body);

    await requireUnprotectedFolder(account, body.path, "renombrar");

    const result = await imapService.renameFolder(
      account.address,
      account.passwordEncrypted,
      body.path,
      body.name,
    );

    res.json({ ok: true, data: result });
  }),

  /** DELETE /api/mail/:accountId/folders?path=INBOX/Test — delete folder. */
  deleteFolder: asyncHandler(async (req: Request, res: Response) => {
    const accountId = parseInt(String(req.params.accountId), 10);
    const account = await requireImapCapableAccount(accountId);
    const query = folderDeleteSchema.parse({ path: req.query.path });

    await requireUnprotectedFolder(account, query.path, "eliminar");

    const result = await imapService.deleteFolder(
      account.address,
      account.passwordEncrypted,
      query.path,
    );

    res.json({ ok: true, data: result });
  }),
};
