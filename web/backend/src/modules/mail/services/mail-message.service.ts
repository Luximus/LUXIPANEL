// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import nodemailer from "nodemailer";
import type { SendMailOptions } from "./smtp.service.js";

/** Build once so SMTP and the Sent/Drafts mailbox receive the same RFC822 message. */
export async function buildMailMessage(options: SendMailOptions): Promise<{ raw: Buffer; messageId: string }> {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  try {
    const result = await transport.sendMail({
      from: options.from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      references: options.references,
      attachments: options.attachments,
    });
    return { raw: result.message as Buffer, messageId: result.messageId };
  } finally {
    transport.close();
  }
}
