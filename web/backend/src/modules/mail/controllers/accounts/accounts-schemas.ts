// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Zod schemas + request parsing helpers for the accounts controller
 * (create/update account bodies, list query, address resolution).
 */

import { z } from "zod";
import { emailSchema, quotaSchema } from "../../../../shared/validators/index.js";
import { ConflictError } from "../../../../shared/errors/index.js";
import { mailDomainSchema } from "../_shared/normalize-domain.js";
import {
  INCOMING_MODES,
  LOCAL_PART_REGEX,
  LOGIN_MODES,
  OUTGOING_MODES,
  normalize,
  normalizeAddress,
} from "./accounts.util.js";

export const createAccountSchema = z.object({
  address: emailSchema.optional(),
  localPart: z.string().trim().min(1).max(64).regex(LOCAL_PART_REGEX, "Invalid local part").optional(),
  domain: mailDomainSchema.optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  quotaMb: quotaSchema,
  displayName: z.string().max(128).optional(),
  enabled: z.boolean().default(true),
  incomingMode: z.enum(INCOMING_MODES).default("allow"),
  outgoingMode: z.enum(OUTGOING_MODES).default("allow"),
  loginMode: z.enum(LOGIN_MODES).default("allow"),
  plusAddressingAutoFolder: z.boolean().default(true),
  forwards: z.array(z.object({
    destination: emailSchema,
    keepCopy: z.boolean().default(true),
  })).default([]),
}).superRefine((data, ctx) => {
  const hasAddress = typeof data.address === "string" && data.address.length > 0;
  const hasSplitAddress = typeof data.localPart === "string" && data.localPart.length > 0
    && typeof data.domain === "string" && data.domain.length > 0;

  if (!hasAddress && !hasSplitAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide address or localPart+domain",
      path: ["address"],
    });
  }
});

export const updateAccountSchema = z.object({
  password: z.string().min(6).optional(),
  quotaMb: quotaSchema.optional(),
  displayName: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  incomingMode: z.enum(INCOMING_MODES).optional(),
  outgoingMode: z.enum(OUTGOING_MODES).optional(),
  loginMode: z.enum(LOGIN_MODES).optional(),
  plusAddressingAutoFolder: z.boolean().optional(),
  localPart: z.string().trim().min(1).max(64).regex(LOCAL_PART_REGEX, "Invalid local part").optional(),
});

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

export const listAccountsQuerySchema = z.object({
  catalog: z.enum(["1", "0"]).optional(),
  sortBy: z.enum(["address", "domain", "enabled", "usedPercent"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  domain: z.string().trim().optional(),
  enabled: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  includeUsage: z.preprocess(parseBooleanQuery, z.boolean().optional()),
});

export function resolveAddressFromCreateBody(body: z.infer<typeof createAccountSchema>): { address: string; local: string; domain: string } {
  if (body.address) {
    const normalized = normalizeAddress(body.address);
    if (!normalized) {
      throw new ConflictError("Invalid email address format");
    }
    const [localFromAddress, domainFromAddress] = normalized.split("@");
    if (!localFromAddress || !domainFromAddress) {
      throw new ConflictError("Invalid email address format");
    }
    return { address: normalized, local: localFromAddress, domain: domainFromAddress };
  }

  const local = normalize(body.localPart ?? "");
  const domain = normalize(body.domain ?? "");
  if (!local || !domain) {
    throw new ConflictError("Invalid email address format");
  }
  return { address: `${local}@${domain}`, local, domain };
}
