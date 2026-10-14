// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail server integration configuration.
 */

import { env } from "./env.js";

export const mailConfig = {
  dovecot: {
    usersFile: env.DOVECOT_USERS_FILE,
    group: env.DOVECOT_GROUP,
  },

  vmail: {
    base: env.VMAIL_BASE,
    uid: env.VMAIL_UID,
    gid: env.VMAIL_GID,
  },

  sievec: env.SIEVEC_BIN,

  postfix: {
    // `vmailbox` is the authoritative Postfix map path; the sibling map paths
    // below are derived from it by basename-substitution (the same
    // `.replace("vmailbox", …)` the services historically applied inline), so
    // an env override of POSTFIX_VMAILBOX keeps every map alongside it.
    vmailbox: env.POSTFIX_VMAILBOX,
    virtual: env.POSTFIX_VMAILBOX.replace("vmailbox", "virtual"),
    virtualDomains: env.POSTFIX_VMAILBOX.replace("vmailbox", "virtual_domains"),
    transport: env.POSTFIX_VMAILBOX.replace("vmailbox", "transport_luxipanel"),
    relayDomains: env.POSTFIX_VMAILBOX.replace("vmailbox", "relay_domains_luxipanel"),
  },

  encryptionKey: env.MAIL_ENCRYPTION_KEY,

  imap: {
    host: env.MAIL_IMAP_HOST,
    port: env.MAIL_IMAP_PORT,
    fallbackHosts: env.MAIL_IMAP_FALLBACK_HOSTS,
  },

  smtp: {
    host: env.MAIL_SMTP_HOST,
    port: env.MAIL_SMTP_PORT,
  },
} as const;
