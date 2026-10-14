// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * OTP request types — one-time password requests (WhatsApp / preview).
 */

export interface OtpRequest {
  requestId: string;
  userId: number;
  phoneE164: string;
  codeHash: string;
  /** "whatsapp" | "preview" */
  deliveryMode: string;
  deliveryId: string | null;
  previewCode: string | null;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface NewOtpRequest {
  requestId: string;
  userId: number;
  phoneE164: string;
  codeHash: string;
  /** "whatsapp" | "preview" */
  deliveryMode: string;
  deliveryId?: string | null;
  previewCode?: string | null;
  createdAt?: Date;
  expiresAt: Date;
  consumedAt?: Date | null;
}
