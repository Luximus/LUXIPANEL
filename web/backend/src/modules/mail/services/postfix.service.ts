// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Postfix service — manages virtual mailbox maps.
 *
 * Migrated from the original backend/src/postfix.ts.
 */

import { mailConfig } from "../../../config/mail.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { FILE_MODES } from "../../../shared/system/file-modes.js";
import { execChecked, writeRootOwnedFile } from "./staging.helpers.js";

const log = createModuleLogger("postfix");

/**
 * Write a Postfix map file that normally lives in a root-owned directory
 * (`/etc/postfix`) — SFTP fast path, staged `sudo cp` fallback (see
 * `staging.helpers#writeRootOwnedFile`).
 *
 * 0644 world-readable ON PURPOSE: the postmap'd `.db` inherits these perms and
 * is opened by the UNPRIVILEGED postfix daemons (cleanup/trivial-rewrite run as
 * `postfix`, not root) — 0640 root:root would break delivery. The map holds
 * addresses/domains only, no secrets. The staged temp file is still 0600, so
 * routing rows are never exposed in the window before the copy.
 */
async function writePostfixFile(executor: Executor, dest: string, content: string): Promise<void> {
  await writeRootOwnedFile(
    executor,
    "postfix",
    dest,
    content,
    FILE_MODES.WORLD_READABLE,
    FILE_MODES.WORLD_READABLE_STR,
  );
}

function getCatchallMapPath(): string {
  return mailConfig.postfix.virtual;
}

function getRoutingTransportMapPath(): string {
  return mailConfig.postfix.transport;
}

function getRoutingRelayDomainsMapPath(): string {
  return mailConfig.postfix.relayDomains;
}

type CatchallRule =
  | { domain: string; mode: "forward"; destinations: string[] }
  | { domain: string; mode: "fail"; message: string };

type RoutingRule = {
  domain: string;
  mode: "auto_remote" | "local" | "backup" | "remote";
};

function escapeVirtualValue(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function buildCatchallMapContent(entries: CatchallRule[]): string {
  const lines = entries
    .filter((entry) => entry.domain)
    .map((entry) => {
      if (entry.mode === "forward") {
        return `@${entry.domain}  ${entry.destinations.join(", ")}`;
      }
      return `@${entry.domain}  :fail: ${escapeVirtualValue(entry.message || "No Such User Here")}`;
    });
  return `${lines.join("\n")}\n`;
}

function buildRoutingMapContent(entries: RoutingRule[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (!entry.domain) continue;
    if (entry.mode === "local") continue;
    // Non-local routing: delegate delivery to remote SMTP according to MX.
    lines.push(`${entry.domain}  smtp:`);
  }
  return `${lines.join("\n")}\n`;
}

function buildRelayDomainsContent(entries: RoutingRule[]): string {
  const lines = entries
    .filter((entry) => entry.domain && entry.mode === "backup")
    .map((entry) => entry.domain);
  return `${lines.join("\n")}\n`;
}

/**
 * Given the current postconf value and a required map spec, return the new
 * value to write, or `null` if the spec is already present (no change needed).
 */
function computeNextMapSpec(current: string, mapSpec: string): string | null {
  const hasMap = current.split(",").map((value) => value.trim()).includes(mapSpec);
  if (hasMap) return null;
  return current ? `${mapSpec}, ${current}` : mapSpec;
}

async function ensurePostconfMapWithExecutor(executor: Executor, param: string, mapSpec: string): Promise<void> {
  let current = "";
  try {
    const out = await executor.exec(quoteCmd("sudo", ["postconf", "-h", param]));
    current = out.stdout.trim();
  } catch {
    current = "";
  }

  const next = computeNextMapSpec(current, mapSpec);
  if (next === null) return;

  await executor.exec(quoteCmd("sudo", ["postconf", "-e", `${param} = ${next}`]));
}

/**
 * Render the exact `/etc/postfix/vmailbox` and `virtual_domains` contents.
 * Single source of truth for the formats — shared by the legacy regenerate
 * paths and the write-behind steps builder so they can't drift apart.
 */
export function renderPostfixMailboxContent(
  entries: Array<{ address: string; domain: string }>,
): string {
  const lines = entries.map((e) => {
    const [local, domain] = e.address.split("@");
    return `${e.address}  ${domain}/${local}/Maildir/`;
  });
  return `${lines.join("\n")}\n`;
}

export function renderPostfixDomainsContent(domains: string[]): string {
  return `${domains.join("\n")}\n`;
}

export const postfixService = {
  async regenerateMailboxMapWithExecutor(entries: Array<{ address: string; domain: string }>, executor: Executor): Promise<void> {
    await writePostfixFile(executor, mailConfig.postfix.vmailbox, renderPostfixMailboxContent(entries));
    await execChecked(executor, quoteCmd("sudo", ["postmap", mailConfig.postfix.vmailbox]), "postmap vmailbox");
    log.info({ count: entries.length, target: executor.target.id }, "Regenerated Postfix vmailbox map via executor");
  },

  async regenerateDomainMapWithExecutor(domains: string[], executor: Executor): Promise<void> {
    const domainFile = mailConfig.postfix.virtualDomains;
    await writePostfixFile(executor, domainFile, renderPostfixDomainsContent(domains));
    log.info({ count: domains.length, target: executor.target.id }, "Regenerated Postfix virtual_domains via executor");
  },

  async regenerateCatchallMapWithExecutor(
    entries: CatchallRule[],
    executor: Executor,
  ): Promise<void> {
    const catchallMap = getCatchallMapPath();
    const content = buildCatchallMapContent(entries);
    await writePostfixFile(executor, catchallMap, content);
    await execChecked(executor, quoteCmd("sudo", ["postmap", catchallMap]), "postmap catchall");
    log.info({ count: entries.length, target: executor.target.id }, "Regenerated Postfix catch-all virtual map via executor");
  },

  /**
   * Regenerate operational routing maps by domain and ensure Postfix uses them.
   */
  async regenerateRoutingMapsWithExecutor(entries: RoutingRule[], executor: Executor): Promise<void> {
    const transportMap = getRoutingTransportMapPath();
    const relayDomainsMap = getRoutingRelayDomainsMapPath();
    const transportContent = buildRoutingMapContent(entries);
    const relayDomainsContent = buildRelayDomainsContent(entries);

    await writePostfixFile(executor, transportMap, transportContent);
    await writePostfixFile(executor, relayDomainsMap, relayDomainsContent);
    await execChecked(executor, quoteCmd("sudo", ["postmap", transportMap]), "postmap transport");
    await execChecked(executor, quoteCmd("sudo", ["postmap", relayDomainsMap]), "postmap relay_domains");

    const transportSpec = `hash:${transportMap}`;
    const relaySpec = `hash:${relayDomainsMap}`;
    await ensurePostconfMapWithExecutor(executor, "transport_maps", transportSpec);
    await ensurePostconfMapWithExecutor(executor, "relay_domains", relaySpec);

    log.info({ count: entries.length, target: executor.target.id }, "Regenerated Postfix routing maps via executor");
  },

  /** Reload Postfix service (on the connected server, via executor). */
  async reloadWithExecutor(executor: Executor): Promise<void> {
    await execChecked(executor, quoteCmd("sudo", ["systemctl", "reload", "postfix"]), "systemctl reload postfix");
    log.info({ target: executor.target.id }, "Postfix reloaded via executor");
  },
};
