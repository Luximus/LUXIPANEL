// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IMAP message operations — list/fetch messages (with server-side HTML
 * sanitization + auth verdicts) and single/batch move, delete and flag actions.
 */

import type {
  FetchMessageObject,
  SearchObject,
} from "imapflow";
import { sanitizeEmailHtml } from "../mail-html-sanitizer.js";
import { mailConfig } from "../../../../config/mail.js";
import type { ListMessagesOptions, MailAddress, MailAuthResults } from "./imap.types.js";
import { withImap } from "./imap-connection.js";
import { isPgpMime } from "../pgp.service.js";
import {
  addOneDay,
  envelopeValue,
  firstAddress,
  hasAttachmentsFromBodyStructure,
  makePreview,
  normalizeDateIso,
  normalizeEnvelopeAddressList,
  normalizeEnvelopeMessage,
  normalizeParsedAddressList,
  normalizeSortOrder,
  parseAuthResults,
  parseMessageSource,
  stripHtml,
  uidListToRange,
} from "./imap-parse.js";

/** List messages in a folder. */
export async function listMessages(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  options: ListMessagesOptions = {},
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const page = Math.max(1, Number(options.page || 1));
      const pageSize = Math.max(1, Math.min(Number(options.pageSize || 50), 100));
      const search = (options.search || "").trim();
      const email = (options.email || "").trim();
      const sortOrder = normalizeSortOrder(options.sortOrder);
      const hasFilters = Boolean(search || email || options.dateFrom || options.dateTo);

      let targetUids: number[] = [];
      if (hasFilters) {
        const query: SearchObject = { all: true };
        if (search) query.text = search;
        if (options.dateFrom) query.since = options.dateFrom;
        if (options.dateTo) query.before = addOneDay(options.dateTo);
        if (email) {
          query.or = [
            { from: email },
            { to: email },
            { cc: email },
            { bcc: email },
          ];
        }

        const searchResult = await client.search(query, { uid: true });
        targetUids = Array.isArray(searchResult) ? searchResult : [];
      } else {
        const totalMessages = Number((client.mailbox as { exists?: number } | undefined)?.exists ?? 0);
        if (totalMessages > 0) {
          for await (const msg of client.fetch("1:*", { uid: true })) {
            const m = msg as FetchMessageObject;
            targetUids.push(m.uid);
          }
        }
      }

      targetUids.sort((a, b) => a - b);
      if (sortOrder === "desc") targetUids.reverse();

      const total = targetUids.length;
      if (total === 0) {
        return { messages: [] as Array<ReturnType<typeof normalizeEnvelopeMessage>>, total, page, pageSize };
      }

      const startIndex = Math.max(0, (page - 1) * pageSize);
      const endIndex = startIndex + pageSize;
      const pagedUids = targetUids.slice(startIndex, endIndex);
      if (pagedUids.length === 0) {
        return { messages: [] as Array<ReturnType<typeof normalizeEnvelopeMessage>>, total, page, pageSize };
      }

      const messagesByUid = new Map<number, ReturnType<typeof normalizeEnvelopeMessage>>();
      for await (const msg of client.fetch(pagedUids, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        uid: true,
      }, { uid: true })) {
        const m = msg as FetchMessageObject;
        const flags = Array.from(m.flags || []);
        messagesByUid.set(m.uid, normalizeEnvelopeMessage(m.uid, m.seq, flags, m.envelope, m.bodyStructure));
      }

      const messages = pagedUids
        .map((uid) => messagesByUid.get(uid))
        .filter((message): message is ReturnType<typeof normalizeEnvelopeMessage> => Boolean(message));

      return { messages, total, page, pageSize };
    } finally {
      lock.release();
    }
  });
}

/** Fetch a single message with full body. */
export async function fetchMessage(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uid: number,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
) {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const result = await client.fetchOne(String(uid), {
        envelope: true,
        bodyStructure: true,
        source: true,
        flags: true,
        uid: true,
      }, { uid: true });

      if (!result) {
        return {
          uid,
          flags: [] as string[],
          seen: false,
          from: null as MailAddress | null,
          to: null as MailAddress[] | null,
          cc: null as MailAddress[] | null,
          bcc: null as MailAddress[] | null,
          subject: "",
          date: null as string | null,
          preview: "",
          text: "",
          html: "",
          attachments: [] as Array<{
            filename: string;
            contentType: string | null;
            contentDisposition: string | null;
            contentId: string | null;
            cid: string | null;
            size: number;
            checksum: string | null;
          }>,
          hasAttachments: false,
          messageId: null as string | null,
          inReplyTo: null as string | null,
          references: [] as string[],
          auth: {
            spf: null,
            dkim: null,
            dmarc: null,
            returnPath: null,
            dkimSigned: false,
            authenticationResults: null,
          } as MailAuthResults,
        };
      }

      const m = result as FetchMessageObject;
      const flags = Array.from(m.flags || []);
      const source = m.source ? m.source.toString("utf-8") : "";
      const encrypted = isPgpMime(source);

      // Mark the message as read when it's opened (standard webmail behavior).
      // The mailbox lock holds the folder open read-write, so this is reliable;
      // it's still best-effort so a flag-write failure never breaks viewing.
      if (!flags.includes("\\Seen")) {
        try {
          await client.messageFlagsAdd(String(m.uid), ["\\Seen"], { uid: true });
          flags.push("\\Seen");
        } catch {
          // ignore — keep showing the message even if the flag write failed
        }
      }

      const parsedMail = await parseMessageSource(source);

      const envelopeFrom = normalizeEnvelopeAddressList(m.envelope?.from);
      const envelopeTo = normalizeEnvelopeAddressList(m.envelope?.to);
      const envelopeCc = normalizeEnvelopeAddressList(m.envelope?.cc);
      const envelopeBcc = normalizeEnvelopeAddressList(m.envelope?.bcc);

      const parsedFrom = normalizeParsedAddressList(parsedMail?.from);
      const parsedTo = normalizeParsedAddressList(parsedMail?.to);
      const parsedCc = normalizeParsedAddressList(parsedMail?.cc);
      const parsedBcc = normalizeParsedAddressList(parsedMail?.bcc);

      const fromList = parsedFrom || envelopeFrom;
      const toList = parsedTo || envelopeTo;
      const ccList = parsedCc || envelopeCc;
      const bccList = parsedBcc || envelopeBcc;

      const rawHtml = parsedMail?.html;
      const unsafeHtml = typeof rawHtml === "string"
        ? rawHtml
        : Buffer.isBuffer(rawHtml)
          ? rawHtml.toString("utf-8")
          : "";
      // XSS: mailparser hands back the attacker-controlled body verbatim —
      // sanitize server-side before it leaves the API (the frontend's iframe
      // sandbox remains as defense-in-depth, not as the only barrier).
      const html = sanitizeEmailHtml(unsafeHtml);
      const text = (parsedMail?.text || "").trim();
      const preview = makePreview(text || stripHtml(html));

      const attachments = (parsedMail?.attachments || []).map((attachment) => ({
        filename: attachment.filename || "adjunto",
        contentType: attachment.contentType || null,
        contentDisposition: attachment.contentDisposition || null,
        contentId: attachment.contentId || null,
        cid: attachment.cid || null,
        size: Number(attachment.size || 0),
        checksum: attachment.checksum || null,
      }));

      return {
        uid: m.uid,
        flags,
        seen: flags.includes("\\Seen"),
        from: firstAddress(fromList),
        to: toList,
        cc: ccList,
        bcc: bccList,
        subject: envelopeValue(parsedMail?.subject || m.envelope?.subject),
        date: normalizeDateIso(parsedMail?.date) || normalizeDateIso(m.envelope?.date),
        preview: encrypted ? "Mensaje cifrado con OpenPGP" : preview,
        text: encrypted ? "" : text,
        html: encrypted ? "" : html || sanitizeEmailHtml(parsedMail?.textAsHtml || ""),
        attachments: encrypted ? [] : attachments,
        hasAttachments: encrypted ? false : attachments.length > 0 || hasAttachmentsFromBodyStructure(m.bodyStructure),
        encrypted,
        messageId: parsedMail?.messageId || m.envelope?.messageId || null,
        inReplyTo: parsedMail?.inReplyTo || m.envelope?.inReplyTo || null,
        references: Array.isArray(parsedMail?.references)
          ? parsedMail.references.filter((item): item is string => typeof item === "string")
          : typeof parsedMail?.references === "string" && parsedMail.references.trim()
            ? parsedMail.references.split(/\s+/).filter((item) => Boolean(item))
            : [],
        auth: parseAuthResults(parsedMail?.headerLines),
      };
    } finally {
      lock.release();
    }
  });
}

/** Fetch the raw RFC822 source of a single message (for download / show original). */
export async function fetchRawMessage(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uid: number,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<string> {
  return (await fetchRawMessageBytes(address, encryptedPassword, folder, uid, host, port)).toString("utf-8");
}

/** Preserve 8-bit MIME payloads for attachment downloads and cryptography. */
export async function fetchRawMessageBytes(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uid: number,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<Buffer> {
  return withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      const result = await client.fetchOne(String(uid), { source: true, uid: true }, { uid: true });
      if (!result || !result.source) return Buffer.alloc(0);
      return result.source;
    } finally {
      lock.release();
    }
  });
}

/** Move a message (by UID) from one folder to another. */
export async function moveMessage(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uid: number,
  destFolder: string,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<void> {
  await withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove(String(uid), destFolder, { uid: true });
    } finally {
      lock.release();
    }
  });
}

/** Permanently delete a message (by UID) — marks \Deleted then expunges. */
export async function deleteMessage(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uid: number,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<void> {
  await withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true });
      await client.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  });
}

/** Set or clear a flag (e.g. \Seen, \Flagged, \Answered) on a message by UID. */
export async function setFlag(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uid: number,
  flag: string,
  set: boolean,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<void> {
  await withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      if (set) {
        await client.messageFlagsAdd(String(uid), [flag], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), [flag], { uid: true });
      }
    } finally {
      lock.release();
    }
  });
}

/** Move a batch of messages (by UID list) to another folder in one connection. */
export async function moveMessages(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uids: number[],
  destFolder: string,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<{ moved: number }> {
  const range = uidListToRange(uids);
  if (!range) return { moved: 0 };
  await withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove(range, destFolder, { uid: true });
    } finally {
      lock.release();
    }
  });
  return { moved: uids.length };
}

/** Permanently delete a batch of messages (by UID list) — \Deleted + expunge. */
export async function deleteMessages(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uids: number[],
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<{ deleted: number }> {
  const range = uidListToRange(uids);
  if (!range) return { deleted: 0 };
  await withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageFlagsAdd(range, ["\\Deleted"], { uid: true });
      await client.messageDelete(range, { uid: true });
    } finally {
      lock.release();
    }
  });
  return { deleted: uids.length };
}

/** Set or clear a flag on a batch of messages (by UID list) in one connection. */
export async function setFlagMany(
  address: string,
  encryptedPassword: string | null,
  folder: string,
  uids: number[],
  flag: string,
  set: boolean,
  host = mailConfig.imap.host,
  port = mailConfig.imap.port,
): Promise<{ updated: number }> {
  const range = uidListToRange(uids);
  if (!range) return { updated: 0 };
  await withImap(address, encryptedPassword, host, port, async (client) => {
    const lock = await client.getMailboxLock(folder);
    try {
      if (set) {
        await client.messageFlagsAdd(range, [flag], { uid: true });
      } else {
        await client.messageFlagsRemove(range, [flag], { uid: true });
      }
    } finally {
      lock.release();
    }
  });
  return { updated: uids.length };
}
