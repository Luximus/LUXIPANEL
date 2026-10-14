/**
 * Panel outbound-mail configuration — which identity the PANEL itself uses to
 * send system emails (cron reports, approvals, tests). Two modes:
 *
 * - "account":  send through an existing panel mailbox (its stored SMTP
 *               credential) against the module's SMTP host (MAIL_SMTP_HOST).
 * - "external": send through an arbitrary external SMTP server (host/port/
 *               user/password) — for panels whose mail does NOT live on this
 *               server. The password is stored AES-256-GCM encrypted with
 *               MAIL_ENCRYPTION_KEY (same scheme as mailbox credentials).
 *
 * Sidecar (per target): `${LUXIPANEL_CONFIG_DIR}/mail/outbound.json`
 * (single document under the fixed id "default").
 */

import { makeKvStore } from "../../../shared/data-store/make-kv-store.js";
import type { Executor } from "../../../shared/executor/index.js";

export interface MailOutboundExternal {
  host: string;
  port: number;
  /** Force TLS-on-connect; defaults to port === 465. */
  secure?: boolean;
  user: string;
  passwordEncrypted: string;
  fromAddress: string;
  fromName?: string;
}

export interface MailOutboundConfig {
  mode: "disabled" | "account" | "external";
  /** mode=account: address of the default sending mailbox. */
  accountAddress?: string;
  external?: MailOutboundExternal;
}

const MODULE = "mail";
const COLLECTION = "outbound";
const DOC_ID = "default";

const store = makeKvStore<MailOutboundConfig>({
  module: MODULE,
  collection: COLLECTION,
  idStrategy: "uuid",
});

export const mailOutboundRepository = {
  async get(executor?: Executor | null): Promise<MailOutboundConfig> {
    const rec = await store(executor).get(DOC_ID);
    return rec ?? { mode: "disabled" };
  },

  async save(data: MailOutboundConfig, executor?: Executor | null): Promise<MailOutboundConfig> {
    await store(executor).set(DOC_ID, data);
    return data;
  },
};
