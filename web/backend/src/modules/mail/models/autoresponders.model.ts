// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Autoresponder types — one autoresponder configuration per mail account.
 */

export interface Autoresponder {
  id: number;
  accountId: number;
  enabled: boolean;
  charset: string;
  intervalHours: number;
  localPart: string;
  domain: string;
  fromName: string | null;
  subject: string;
  body: string;
  isHtml: boolean;
  startAt: Date | null;
  stopAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAutoresponder {
  id?: number;
  accountId: number;
  enabled?: boolean;
  charset?: string;
  intervalHours?: number;
  localPart: string;
  domain: string;
  fromName?: string | null;
  subject: string;
  body: string;
  isHtml?: boolean;
  startAt?: Date | null;
  stopAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
