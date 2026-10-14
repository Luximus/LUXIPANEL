// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IMAP folder operations — list/create/rename/delete mailboxes and compute
 * per-folder message-count + disk-usage summaries.
 */

import type { FetchMessageObject } from "imapflow";
import { mailConfig } from "../../../../config/mail.js";
import { AppError } from "../../../../shared/errors/errors.js";
import { withImap, extractErrorMessage } from "./imap-connection.js";
import { isSelectableMailbox } from "./imap-parse.js";

/** List IMAP folders for an account. */
export async function listFolders(
  address: string,
  encryptedPassword: string | null,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const mailboxes = await client.list({
      statusQuery: {
        messages: true,
        unseen: true,
      },
    });
    return mailboxes.map((m) => ({
      path: m.path,
      name: m.name,
      delimiter: m.delimiter,
      specialUse: m.specialUse || null,
      flags: Array.from(m.flags || []),
      messageCount: Number(m.status?.messages ?? 0),
      unseen: Number(m.status?.unseen ?? 0),
    }));
  });
}

/** Create folder in mailbox. */
export async function createFolder(
  address: string,
  encryptedPassword: string | null,
  folderName: string,
  parentPath?: string,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const name = folderName.trim();
    if (!name) throw new AppError("Folder name is required", 400, "MAIL_FOLDER_NAME_REQUIRED");

    const targetPath = parentPath?.trim()
      ? [parentPath.trim(), name]
      : [name];

    const result = await client.mailboxCreate(targetPath);
    return {
      path: result.path,
      created: Boolean(result.created),
    };
  });
}

/** Rename folder preserving its parent path. */
export async function renameFolder(
  address: string,
  encryptedPassword: string | null,
  currentPath: string,
  newName: string,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const path = currentPath.trim();
    const name = newName.trim();
    if (!path) throw new AppError("Folder path is required", 400, "MAIL_FOLDER_PATH_REQUIRED");
    if (!name) throw new AppError("New folder name is required", 400, "MAIL_FOLDER_NAME_REQUIRED");

    const folders = await client.list();
    const folder = folders.find((item) => item.path === path);
    if (!folder) {
      throw new AppError("Folder not found", 404, "MAIL_FOLDER_NOT_FOUND");
    }

    const parts = folder.path.split(folder.delimiter);
    parts[parts.length - 1] = name;
    const nextPath = parts.join(folder.delimiter);
    const result = await client.mailboxRename(folder.path, nextPath);
    return { path: result.path, newPath: result.newPath };
  });
}

/** Delete folder from mailbox. */
export async function deleteFolder(
  address: string,
  encryptedPassword: string | null,
  folderPath: string,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const path = folderPath.trim();
    if (!path) throw new AppError("Folder path is required", 400, "MAIL_FOLDER_PATH_REQUIRED");

    const mailboxes = await client.list();
    const target = mailboxes.find((item) => item.path === path);
    if (!target) {
      throw new AppError("Folder not found", 404, "MAIL_FOLDER_NOT_FOUND");
    }

    const descendantPrefix = `${target.path}${target.delimiter}`;
    const descendants = mailboxes
      .filter((item) => item.path.startsWith(descendantPrefix))
      .sort((a, b) => b.path.length - a.path.length);

    const purgeMailbox = async (mailboxPath: string) => {
      const lock = await client.getMailboxLock(mailboxPath);
      try {
        const exists = Number((client.mailbox as { exists?: number } | undefined)?.exists ?? 0);
        if (exists > 0) {
          await client.messageDelete("1:*");
        }
      } finally {
        lock.release();
      }
    };

    try {
      for (const child of descendants) {
        await purgeMailbox(child.path);
        await client.mailboxDelete(child.path);
      }

      await purgeMailbox(target.path);
      const result = await client.mailboxDelete(target.path);
      return { path: result.path };
    } catch (err) {
      throw new AppError(
        `No se pudo eliminar la carpeta "${path}": ${extractErrorMessage(err)}`,
        409,
        "MAIL_FOLDER_DELETE_FAILED",
      );
    }
  });
}

/** List mailbox folders with message counts and disk usage. */
export async function listFolderUsage(
  address: string,
  encryptedPassword: string | null,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const mailboxes = await client.list();
    const results: Array<{
      path: string;
      name: string;
      messageCount: number;
      sizeBytes: number;
    }> = [];

    for (const mailbox of mailboxes) {
      if (!isSelectableMailbox(mailbox.flags)) continue;

      const lock = await client.getMailboxLock(mailbox.path);
      try {
        const exists = Number((client.mailbox as { exists?: number } | undefined)?.exists ?? 0);
        let sizeBytes = 0;

        if (exists > 0) {
          for await (const message of client.fetch("1:*", { uid: true, size: true })) {
            const m = message as FetchMessageObject;
            sizeBytes += Number(m.size ?? 0);
          }
        }

        results.push({
          path: mailbox.path,
          name: mailbox.name,
          messageCount: exists,
          sizeBytes,
        });
      } finally {
        lock.release();
      }
    }

    return results.sort((a, b) => b.sizeBytes - a.sizeBytes);
  });
}
