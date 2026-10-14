// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail account sidecar — source-of-truth for per-account metadata that is
 * not natively persisted in Postfix/Dovecot (forwards, filters,
 * autoresponder, calendars/contacts ids, etc.). Stored on the remote target
 * as JSON file under the user's Maildir parent so it travels with the user
 * data and survives panel restarts. No DB.
 */

import path from "node:path";
import { mailConfig } from "../../../config/mail.js";
import type { Executor } from "../../../shared/executor/index.js";
import { quoteCmd } from "../../../shared/executor/index.js";
import { stageSecretFile } from "./staging.helpers.js";

export interface SidecarForward {
  id: number;
  destination: string;
  keepCopy: boolean;
  enabled: boolean;
}

export interface SidecarFilter {
  id: number;
  name: string;
  enabled: boolean;
  rules: unknown[];
  actions: unknown[];
}

export interface SidecarAutoresponder {
  enabled: boolean;
  charset: string;
  intervalHours: number;
  localPart: string;
  domain: string;
  fromName: string | null;
  subject: string;
  body: string;
  isHtml: boolean;
  startAt: string | null;
  stopAt: string | null;
}

export interface SidecarSignature {
  id: number;
  /** Display name of the sender identity shown in the "Sender" column. */
  senderName: string;
  /** Email of the sender identity this signature belongs to. */
  senderEmail: string;
  /** When true, the signature is tied to (auto-applied for) its sender. */
  linkToSender: boolean;
  /** Rich HTML body produced by the editor. */
  html: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountSettingsSidecar {
  incomingMode: "allow" | "suspend";
  outgoingMode: "allow" | "suspend" | "hold";
  loginMode: "allow" | "suspend";
  plusAddressingAutoFolder: boolean;
}

export interface AccountSidecar {
  forwards: SidecarForward[];
  filters: SidecarFilter[];
  autoresponder: SidecarAutoresponder | null;
  signatures: SidecarSignature[];
  settings: AccountSettingsSidecar | null;
}

export const EMPTY_SIDECAR: AccountSidecar = {
  forwards: [],
  filters: [],
  autoresponder: null,
  signatures: [],
  settings: null,
};

function sidecarPath(address: string): string {
  const [local, domain] = address.split("@");
  if (!local || !domain) {
    throw new Error(`Invalid address: ${address}`);
  }
  // Defense in depth: never let a crafted address escape the vmail tree with
  // path separators or "..". Controllers validate with emailSchema, but the
  // sidecar path also feeds `sudo cp`/`mkdir`, so guard here regardless.
  if (/[/\\]|\.\./.test(local) || /[/\\]|\.\./.test(domain) || address.includes("\0")) {
    throw new Error(`Invalid address: ${address}`);
  }
  const resolved = path.join(mailConfig.vmail.base, domain, local, "luxipanel-mail.json");
  const baseWithSep = path.join(mailConfig.vmail.base) + path.sep;
  if (!resolved.startsWith(baseWithSep)) {
    throw new Error(`Invalid address: ${address}`);
  }
  return resolved;
}

async function readRawFile(executor: Executor, filePath: string): Promise<string | null> {
  try {
    const data = await executor.readFile(filePath, "utf-8");
    const text = typeof data === "string" ? data : data.toString("utf-8");
    return text;
  } catch {
    try {
      const out = await executor.exec(quoteCmd("sudo", ["cat", filePath]));
      return out.stdout;
    } catch {
      return null;
    }
  }
}

async function writeRawFile(executor: Executor, filePath: string, content: string): Promise<void> {
  // Ensure parent dir exists; keep ownership matching vmail user so Dovecot can read.
  const dir = path.dirname(filePath);
  await executor.exec(quoteCmd("sudo", ["mkdir", "-p", dir]));
  try {
    await executor.writeFile(filePath, content, { encoding: "utf-8" });
  } catch {
    const tmp = await stageSecretFile(executor, "mail-sidecar", content);
    try {
      const copy = await executor.exec(quoteCmd("sudo", ["cp", tmp, filePath]));
      if (copy.exitCode !== 0) {
        throw new Error(`sudo cp -> ${filePath} failed: ${(copy.stderr || copy.stdout || "").trim() || "exit " + copy.exitCode}`);
      }
    } finally {
      await executor.exec(quoteCmd("rm", ["-f", tmp])).catch(() => undefined);
    }
  }
  await executor.exec(quoteCmd("sudo", ["chown", `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`, filePath]));
  await executor.exec(quoteCmd("sudo", ["chmod", "640", filePath]));
}

export const accountSidecarService = {
  async read(executor: Executor, address: string): Promise<AccountSidecar> {
    const filePath = sidecarPath(address);
    const raw = await readRawFile(executor, filePath);
    if (!raw || !raw.trim()) return { ...EMPTY_SIDECAR };
    try {
      const parsed = JSON.parse(raw) as Partial<AccountSidecar>;
      return {
        forwards: Array.isArray(parsed.forwards) ? parsed.forwards : [],
        filters: Array.isArray(parsed.filters) ? parsed.filters : [],
        autoresponder: parsed.autoresponder ?? null,
        signatures: Array.isArray(parsed.signatures) ? parsed.signatures : [],
        settings: parsed.settings ?? null,
      };
    } catch {
      return { ...EMPTY_SIDECAR };
    }
  },

  async write(executor: Executor, address: string, sidecar: AccountSidecar): Promise<void> {
    const filePath = sidecarPath(address);
    await writeRawFile(executor, filePath, JSON.stringify(sidecar, null, 2));
  },

  async update(
    executor: Executor,
    address: string,
    mutator: (current: AccountSidecar) => AccountSidecar,
  ): Promise<AccountSidecar> {
    const current = await this.read(executor, address);
    const next = mutator(current);
    await this.write(executor, address, next);
    return next;
  },
};
