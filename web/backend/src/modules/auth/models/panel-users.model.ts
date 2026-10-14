// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Panel user types — users who can log into the panel.
 */

export const PANEL_AUTH_PROVIDERS = ["system", "local"] as const;
export type PanelAuthProvider = (typeof PANEL_AUTH_PROVIDERS)[number];

export interface PanelUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  passwordHash: string;
  authProvider: PanelAuthProvider;
  systemUid: number | null;
  systemGid: number | null;
  homeDir: string | null;
  shell: string | null;
  managedBySystem: boolean;
  syncedAt: Date | null;
  /**
   * Vestigial — kept for one release for back-compat. Permissions are now
   * derived from the user's real Linux group memberships (`groups` below),
   * not from a single role. Stops being written for permission purposes.
   */
  roleId: number | null;
  /** Override modules — if set, takes precedence over group-derived modules. */
  modules: string | null;
  /**
   * Real Linux supplementary group NAMES the user belongs to (`id -nG`),
   * captured at login/sync. Source of truth for group-union permission
   * resolution in `buildTokenPayload` (no SSH at token-build time).
   */
  groups: string[] | null;
  enabled: boolean;
  phoneE164: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPanelUser {
  id?: number;
  username: string;
  email?: string | null;
  displayName?: string | null;
  passwordHash: string;
  authProvider?: PanelAuthProvider;
  systemUid?: number | null;
  systemGid?: number | null;
  homeDir?: string | null;
  shell?: string | null;
  managedBySystem?: boolean;
  syncedAt?: Date | null;
  roleId?: number | null;
  modules?: string | null;
  groups?: string[] | null;
  enabled?: boolean;
  phoneE164?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
