// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared Zod schemas reused across modules.
 */

import { z } from "zod";

export { zodIssues, type ApiFieldIssue } from "./zod-issues.js";
export { pathOnlySchema } from "./path-schema.js";

/** Standard ID param. */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** Email address. */
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .min(3)
  .max(320)
  .toLowerCase()
  .trim();

/** Strong password: 8+ chars, at least one uppercase, lowercase, digit. */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one digit")
  // Defense against `chpasswd` stdin injection: a newline would let an
  // attacker inject a second `user:pass` line (e.g. `root:...`), and `:` is the
  // chpasswd field separator. Reject any control char and the colon outright.
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\r\n\t\f\v\x00:]+$/, "Password must not contain control characters or ':'");

/** Username: alphanumeric + dots/underscores, 3-64 chars. */
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(64, "Username too long")
  .regex(
    /^[a-zA-Z][a-zA-Z0-9._-]*$/,
    "Username must start with a letter and contain only letters, numbers, dots, underscores, or hyphens",
  )
  .trim();

/** Display name. */
export const displayNameSchema = z
  .string()
  .min(1, "Display name is required")
  .max(128, "Display name too long")
  .trim();

/** Domain name. */
export const domainSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    "Invalid domain name",
  )
  .toLowerCase()
  .trim();

/** Positive integer for quotas (MB). */
export const quotaSchema = z.coerce.number().int().min(0).max(102400).default(1024);
