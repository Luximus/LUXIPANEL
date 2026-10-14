// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Role types — defines permission groups for panel users.
 */

export interface Role {
  id: number;
  name: string;
  description: string | null;
  /** JSON array of module slugs: ["mail","users","admin","tools"] */
  modules: string[];
  /** Structured authorization matrix for UI/API/file/terminal controls. */
  permissions: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewRole {
  id?: number;
  name: string;
  description?: string | null;
  /** JSON array of module slugs: ["mail","users","admin","tools"] */
  modules?: string[];
  /** Structured authorization matrix for UI/API/file/terminal controls. */
  permissions?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}
