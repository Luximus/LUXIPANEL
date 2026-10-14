// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IMAP bulk mailbox operations — date-range delete/copy and whole-mailbox
 * cloning (Message-ID dedup makes the clone idempotent).
 */

import type { FetchMessageObject } from "imapflow";
import { mailConfig } from "../../../../config/mail.js";
import { withImap } from "./imap-connection.js";
import { addOneDay, isSelectableMailbox, normalizeDate, uidListToRange } from "./imap-parse.js";

/** Delete messages in a folder by date range (inclusive). */
export async function deleteMessagesByDateRange(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  dateFrom: Date,
  dateTo: Date,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<{ matched: number; deleted: number }> {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const searchResult = await client.search(
        { since: dateFrom, before: addOneDay(dateTo) },
        { uid: true },
      );
      const uids = Array.isArray(searchResult) ? searchResult : [];
      if (!uids.length) return { matched: 0, deleted: 0 };

      const range = uidListToRange(uids);
      if (!range) return { matched: uids.length, deleted: 0 };
      await client.messageDelete(range, { uid: true });
      return { matched: uids.length, deleted: uids.length };
    } finally {
      lock.release();
    }
  });
}

/** Copy messages by date range from one account/folder to another. */
export async function copyMessagesByDateRange(
  sourceAddress: string,
  sourceEncryptedPassword: string | null,
  sourceFolder: string,
  destinationAddress: string,
  destinationEncryptedPassword: string | null,
  destinationFolder: string,
  dateFrom: Date,
  dateTo: Date,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<{ matched: number; copied: number }> {
  return withImap(sourceAddress, sourceEncryptedPassword, host, port, async (sourceClient) => {
    return withImap(destinationAddress, destinationEncryptedPassword, host, port, async (destinationClient) => {
      try {
        await destinationClient.mailboxCreate(destinationFolder);
      } catch {
        // Folder may already exist.
      }

      const sourceLock = await sourceClient.getMailboxLock(sourceFolder);
      try {
        const searchResult = await sourceClient.search(
          { since: dateFrom, before: addOneDay(dateTo) },
          { uid: true },
        );
        const uids = Array.isArray(searchResult) ? searchResult : [];
        if (!uids.length) return { matched: 0, copied: 0 };

        let copied = 0;
        for (const uid of uids) {
          const msg = await sourceClient.fetchOne(
            String(uid),
            { source: true, flags: true, internalDate: true, uid: true },
            { uid: true },
          );
          const parsed = msg as FetchMessageObject | null;
          if (!parsed?.source) continue;

          await destinationClient.append(
            destinationFolder,
            parsed.source,
            Array.from(parsed.flags ?? []),
            normalizeDate(parsed.internalDate),
          );
          copied++;
        }

        return { matched: uids.length, copied };
      } finally {
        sourceLock.release();
      }
    });
  });
}

/**
 * Clone an ENTIRE mailbox: copy every selectable folder and all its messages
 * from source → destination. Idempotent per message via Message-ID dedup
 * (a message whose Message-ID already exists in the destination folder is
 * skipped), so re-running won't duplicate. Folders are created on the
 * destination as needed (parents first).
 */
export async function cloneMailbox(
  sourceAddress: string,
  sourceEncryptedPassword: string | null,
  destinationAddress: string,
  destinationEncryptedPassword: string | null,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<{
  folders: Array<{ folder: string; matched: number; copied: number; skipped: number }>;
  totalCopied: number;
  totalSkipped: number;
}> {
  return withImap(sourceAddress, sourceEncryptedPassword, host, port, async (sourceClient) => {
    return withImap(destinationAddress, destinationEncryptedPassword, host, port, async (destClient) => {
      const mailboxes = await sourceClient.list();
      const selectable = mailboxes
        .filter((m) => isSelectableMailbox(m.flags))
        // Parents before children so nested paths can be created.
        .sort((a, b) => a.path.split(a.delimiter).length - b.path.split(b.delimiter).length);

      const folders: Array<{ folder: string; matched: number; copied: number; skipped: number }> = [];
      let totalCopied = 0;
      let totalSkipped = 0;

      for (const mailbox of selectable) {
        try {
          await destClient.mailboxCreate(mailbox.path);
        } catch {
          // Folder already exists on the destination — fine.
        }

        // Snapshot the destination folder's Message-IDs for dedup.
        const destIds = new Set<string>();
        const destLock = await destClient.getMailboxLock(mailbox.path);
        try {
          const exists = Number((destClient.mailbox as { exists?: number } | undefined)?.exists ?? 0);
          if (exists > 0) {
            for await (const msg of destClient.fetch("1:*", { uid: true, envelope: true })) {
              const id = (msg as FetchMessageObject).envelope?.messageId;
              if (id) destIds.add(id);
            }
          }
        } finally {
          destLock.release();
        }

        let matched = 0;
        let copied = 0;
        let skipped = 0;
        const srcLock = await sourceClient.getMailboxLock(mailbox.path);
        try {
          const searchResult = await sourceClient.search({ all: true }, { uid: true });
          const uids = Array.isArray(searchResult) ? searchResult : [];
          matched = uids.length;
          for (const uid of uids) {
            const msg = await sourceClient.fetchOne(
              String(uid),
              { source: true, flags: true, internalDate: true, envelope: true, uid: true },
              { uid: true },
            );
            const parsed = msg as FetchMessageObject | null;
            if (!parsed?.source) continue;
            const messageId = parsed.envelope?.messageId;
            if (messageId && destIds.has(messageId)) {
              skipped++;
              continue;
            }
            await destClient.append(
              mailbox.path,
              parsed.source,
              Array.from(parsed.flags ?? []),
              normalizeDate(parsed.internalDate),
            );
            if (messageId) destIds.add(messageId);
            copied++;
          }
        } finally {
          srcLock.release();
        }

        folders.push({ folder: mailbox.path, matched, copied, skipped });
        totalCopied += copied;
        totalSkipped += skipped;
      }

      return { folders, totalCopied, totalSkipped };
    });
  });
}
