// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared constants for the AI Assistant module (single source of truth).
 */

/**
 * TTL for a cached provider/agent availability probe, in milliseconds
 * (= 10 minutes). Shared by the browser-agent capability probe and the
 * graph-index availability cache so both re-check on the same cadence.
 */
export const AVAILABILITY_TTL_MS = 10 * 60 * 1000;
