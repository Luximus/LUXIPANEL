// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { mailConfig } from "../../../../config/mail.js";
import { AppError } from "../../../../shared/errors/index.js";
import { withImap } from "./imap-connection.js";

export async function appendSpecialMessage(
  address: string,
  encryptedPassword: string | null,
  kind: "drafts" | "sent",
  raw: Buffer,
): Promise<{ folder: string; uid: number | null }> {
  return withImap(address, encryptedPassword, mailConfig.imap.host, mailConfig.imap.port, async (client) => {
    const specialUse = kind === "drafts" ? "\\Drafts" : "\\Sent";
    const fallback = kind === "drafts" ? "Drafts" : "Sent";
    const mailboxes = await client.list();
    const existing = mailboxes.find((mailbox) => mailbox.specialUse === specialUse)
      ?? mailboxes.find((mailbox) => mailbox.path.toLowerCase() === fallback.toLowerCase());
    const folder = existing?.path ?? fallback;
    if (!existing) await client.mailboxCreate(folder);
    const result = await client.append(folder, raw, kind === "drafts" ? ["\\Draft"] : []);
    if (!result) throw new AppError("No se pudo guardar el mensaje en IMAP", 502, "MAIL_APPEND_FAILED");
    return { folder, uid: result.uid ?? null };
  });
}
