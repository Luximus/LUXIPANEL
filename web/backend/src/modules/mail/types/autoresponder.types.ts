// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Autoresponder typed payload used for sieve script generation.
 */

export type MailAutoresponderDefinition = {
  enabled: boolean;
  charset: string;
  intervalHours: number;
  localPart: string;
  domain: string;
  fromName?: string | null;
  subject: string;
  body: string;
  isHtml: boolean;
  startAt?: Date | null;
  stopAt?: Date | null;
};
