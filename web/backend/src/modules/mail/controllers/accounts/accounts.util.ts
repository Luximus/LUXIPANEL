// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared primitives for the accounts controller split — validation constants,
 * account-mode types, and small address/number normalizers used across the
 * schema, state, forwards-reader and list helper modules.
 */

export const LOCAL_PART_REGEX = /^[a-zA-Z0-9._%+-]+$/;
// The domain validator lives in `../_shared/normalize-domain.js`
// (`mailDomainSchema`, an alias of the canonical `shared/validators#domainSchema`).
// The old local `DOMAIN_REGEX = /^[a-zA-Z0-9.-]+$/` accepted `...`/`-a-`/`.`.
export const INCOMING_MODES = ["allow", "suspend"] as const;
export const OUTGOING_MODES = ["allow", "suspend", "hold"] as const;
export const LOGIN_MODES = ["allow", "suspend"] as const;

export type IncomingMode = (typeof INCOMING_MODES)[number];
export type LoginMode = (typeof LOGIN_MODES)[number];

export type ForwardEntry = { id: number; destination: string; keepCopy: boolean };

export function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeAddress(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return null;
  return `${local}@${domain}`;
}

export function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}
