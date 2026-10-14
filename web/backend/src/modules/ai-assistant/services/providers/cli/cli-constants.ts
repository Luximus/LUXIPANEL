// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared constants for the CLI provider path (single source of truth).
 */

/**
 * TTL for the per-target "MiniMax wrapper env is authenticated" cache, in
 * milliseconds (= 10 minutes). Shared by the CLI MiniMax wrapper and the
 * MiniMax CLI voice provider so both re-verify auth on the same cadence.
 */
export const MINIMAX_AUTH_TTL_MS = 10 * 60 * 1000;
