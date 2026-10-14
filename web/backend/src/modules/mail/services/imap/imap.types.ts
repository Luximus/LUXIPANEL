// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared IMAP service types — address/message parsing shapes and the compact
 * authentication verdict surfaced to the AI assistant.
 */

export type MailAddress = {
  name?: string;
  address: string;
};

export type ParsedAddressValue = {
  name?: string | null;
  address?: string | null;
};

export type ParsedAddressObjectLike = {
  value?: ParsedAddressValue[] | null;
};

export type ParsedAttachmentLike = {
  filename?: string | null;
  contentType?: string | null;
  contentDisposition?: string | null;
  contentId?: string | null;
  cid?: string | null;
  size?: number;
  checksum?: string | null;
  content?: Buffer | null;
};

export type ParsedHeaderLine = {
  key?: string | null;
  line?: string | null;
};

export type ParsedMailLike = {
  subject?: string | null;
  date?: Date | null;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[] | string | null;
  from?: ParsedAddressObjectLike | null;
  to?: ParsedAddressObjectLike | null;
  cc?: ParsedAddressObjectLike | null;
  bcc?: ParsedAddressObjectLike | null;
  html?: string | Buffer | false | null;
  text?: string | null;
  textAsHtml?: string | null;
  attachments?: ParsedAttachmentLike[] | null;
  headerLines?: ParsedHeaderLine[] | null;
};

/**
 * Compact authentication verdict derived from the message headers. Lets the
 * AI assistant judge spoofing/phishing without re-parsing raw headers itself.
 */
export type MailAuthResults = {
  spf: string | null;
  dkim: string | null;
  dmarc: string | null;
  returnPath: string | null;
  /** True when a DKIM-Signature header is physically present. */
  dkimSigned: boolean;
  /** The raw Authentication-Results line(s), trimmed — for borderline cases. */
  authenticationResults: string | null;
};

export type ListMessagesOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  email?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortOrder?: "asc" | "desc";
};
