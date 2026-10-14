// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

import { domainSchema } from "../../../../shared/validators/index.js";

/** Normalize a mail domain: trim, lowercase, strip leading `@`. */
export function normalizeMailDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

/**
 * The ONE "domain" validator of the mail module (accounts, default address,
 * domain routing, domain forwards, archive).
 *
 * Each of those controllers used to carry its own `DOMAIN_REGEX =
 * /^[a-zA-Z0-9.-]+$/`, which accepts `...`, `-a-` and a bare `.` — strings that
 * end up in Postfix/Dovecot map files. This aliases the canonical
 * `shared/validators#domainSchema` (real DNS-label grammar, 3..253 chars,
 * lowercased) so the public API has ONE definition of "valid domain".
 */
export const mailDomainSchema = domainSchema;
