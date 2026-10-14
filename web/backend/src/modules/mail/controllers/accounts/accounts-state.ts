// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Account desired-state application. Renders the Dovecot/Postfix map entries
 * from an account list and applies them on the connected server — through the
 * per-server write-behind queue on remote targets, or synchronously via the
 * localExecutor on the "local" target. No command runs on the panel host.
 */

import path from "node:path";
import type { Executor } from "../../../../shared/executor/index.js";
import { mailConfig } from "../../../../config/mail.js";
import { dovecotService, postfixService } from "../../services/index.js";
import { renderDovecotUsersContent } from "../../services/dovecot.service.js";
import {
  renderPostfixMailboxContent,
  renderPostfixDomainsContent,
} from "../../services/postfix.service.js";
import {
  submitMutation,
  type MutationStep,
} from "../../../../shared/remote-cache/submit-mutation.js";
import { CACHE_KEYS } from "../../../../shared/cache/cacheable-modules.js";
import { FILE_MODES } from "../../../../shared/system/index.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import {
  encodeDovecotHash,
  normalizeIncomingMode,
  normalizeLoginMode,
  type ServerAccount,
} from "../accounts.helpers.js";
import { type AccountSettingsSidecar } from "../../services/account-sidecar.service.js";

const log = createModuleLogger("accounts-ctrl");

function isIncomingEnabled(account: {
  enabled: boolean;
  incomingMode?: string | null;
}): boolean {
  return account.enabled && normalizeIncomingMode(account.incomingMode) === "allow";
}

function isLoginEnabled(account: {
  enabled: boolean;
  loginMode?: string | null;
}): boolean {
  return account.enabled && normalizeLoginMode(account.loginMode) === "allow";
}

function buildDovecotEntries(accounts: Array<{
  address: string;
  passwordHash: string;
  quotaMb: number;
  enabled: boolean;
  loginMode?: string | null;
}>): Array<{ address: string; passwordHash: string; quotaMb: number }> {
  return accounts.map((a) => ({
    address: a.address,
    // Disabling preserves the real hash behind a non-matching marker so the
    // account can be re-enabled later without resetting the password.
    passwordHash: encodeDovecotHash(a.passwordHash, isLoginEnabled(a)),
    quotaMb: a.quotaMb,
  }));
}

function buildPostfixMailboxEntries(accounts: Array<{
  address: string;
  domain: string;
  enabled: boolean;
  incomingMode?: string | null;
}>): Array<{ address: string; domain: string }> {
  return accounts
    .filter((a) => isIncomingEnabled(a))
    .map((a) => ({ address: a.address, domain: a.domain }));
}

export function toSidecarSettings(account: Pick<ServerAccount, "incomingMode" | "outgoingMode" | "loginMode" | "plusAddressingAutoFolder">): AccountSettingsSidecar {
  return {
    incomingMode: normalizeIncomingMode(account.incomingMode),
    outgoingMode: account.outgoingMode === "suspend" || account.outgoingMode === "hold" ? account.outgoingMode : "allow",
    loginMode: normalizeLoginMode(account.loginMode),
    plusAddressingAutoFolder: account.plusAddressingAutoFolder !== false,
  };
}

export async function renameMaildirIfNeeded(
  executor: Executor,
  oldAddress: string,
  newAddress: string,
): Promise<void> {
  if (oldAddress === newAddress) return;

  const [oldLocal, oldDomain] = oldAddress.split("@");
  const [newLocal, newDomain] = newAddress.split("@");
  if (!oldLocal || !oldDomain || !newLocal || !newDomain) return;
  if (oldLocal === newLocal && oldDomain === newDomain) return;

  const oldMaildir = path.join(mailConfig.vmail.base, oldDomain, oldLocal);
  const newMaildir = path.join(mailConfig.vmail.base, newDomain, newLocal);

  try {
    await executor.rename(oldMaildir, newMaildir);
    return;
  } catch (err) {
    log.warn({ err, oldMaildir, newMaildir, target: executor.target.id }, "Could not rename maildir, ensuring destination maildir");
  }

  await dovecotService.ensureMaildirWithExecutor(newAddress, executor);
}

/**
 * Project the desired account list into the three artefacts BOTH apply paths
 * need: Dovecot user rows, Postfix mailbox rows and the domain set.
 *
 * The write-behind builder and the synchronous applier had this same 15-line
 * mapping each; a field added to one and not the other would have made the
 * queued recipe and the sync fallback write DIFFERENT files.
 */
function projectAccountState(list: ServerAccount[]) {
  return {
    dovecotEntries: buildDovecotEntries(
      list.map((a) => ({
        address: a.address,
        passwordHash: a.passwordHash,
        quotaMb: a.quotaMb,
        enabled: a.enabled,
        loginMode: a.loginMode,
      })),
    ),
    postfixEntries: buildPostfixMailboxEntries(
      list.map((a) => ({
        address: a.address,
        domain: a.domain,
        enabled: a.enabled,
        incomingMode: a.incomingMode,
      })),
    ),
    domains: [...new Set(list.map((a) => a.domain))],
  };
}

/**
 * Build the write-behind recipe (steps) that reproduces `applyServerAccountState`'s
 * REMOTE branch exactly: regenerate /etc/dovecot/users + /etc/postfix/vmailbox
 * (+postmap) + virtual_domains, ensure the affected maildir(s), reload both
 * services. Reuses the SAME content renderers as the legacy path so the
 * on-disk format can't diverge. `ensureMaildirFor` lists the address(es) whose
 * maildir must exist (new/renamed account); existing maildirs are untouched.
 */
function buildApplyAccountStateSteps(
  list: ServerAccount[],
  ensureMaildirFor: string[],
): MutationStep[] {
  const { dovecotEntries, postfixEntries, domains } = projectAccountState(list);

  const vmailbox = mailConfig.postfix.vmailbox;
  const domainFile = mailConfig.postfix.virtualDomains;
  const uidGid = `${mailConfig.vmail.uid}:${mailConfig.vmail.gid}`;

  const steps: MutationStep[] = [
    {
      type: "writeFile",
      path: mailConfig.dovecot.usersFile,
      content: renderDovecotUsersContent(dovecotEntries),
      // Hashes inside — group-readable for the dovecot group only.
      mode: FILE_MODES.OWNER_READABLE_STR,
      root: true,
      owner: `root:${mailConfig.dovecot.group}`,
    },
    {
      type: "writeFile",
      path: vmailbox,
      content: renderPostfixMailboxContent(postfixEntries),
      // Postfix maps stay world-readable on purpose: the postmap'd .db
      // inherits these perms and is opened by the unprivileged postfix
      // daemons — 0640 root:root would break delivery. No secrets inside.
      mode: FILE_MODES.WORLD_READABLE_STR,
      root: true,
    },
    { type: "sh", argv: ["postmap", vmailbox], sudo: true },
    {
      type: "writeFile",
      path: domainFile,
      content: renderPostfixDomainsContent(domains),
      mode: FILE_MODES.WORLD_READABLE_STR,
      root: true,
    },
  ];

  for (const address of ensureMaildirFor) {
    const [local, domain] = address.split("@");
    if (!local || !domain) continue;
    const maildir = path.join(mailConfig.vmail.base, domain, local);
    steps.push({ type: "sh", argv: ["mkdir", "-p", path.join(maildir, "Maildir")], sudo: true });
    steps.push({ type: "sh", argv: ["chown", "-R", uidGid, maildir], sudo: true });
  }

  steps.push({ type: "sh", argv: ["systemctl", "reload", "dovecot"], sudo: true });
  steps.push({ type: "sh", argv: ["systemctl", "reload", "postfix"], sudo: true });
  return steps;
}

/**
 * Apply the desired account list, routing through the per-server write-behind
 * queue on remote targets (the slow part — file writes + service reloads —
 * runs on-box without SSH latency between steps). On the "local" target the
 * same work runs synchronously through the localExecutor (no queue, and no
 * direct child_process on the panel host). `submitMutation`
 * itself falls back to synchronous SSH if the queue is disabled/unprovisioned,
 * and throws if a step fails within the wait window — so callers get the same
 * error semantics as before.
 */
export async function applyAccountState(
  executor: Executor,
  list: ServerAccount[],
  op: "create" | "update" | "delete",
  ensureMaildirFor: string[],
): Promise<{ id: string; mode: string } | null> {
  if (executor.target.id === "local") {
    await applyServerAccountState(executor, list);
    return null;
  }
  const steps = buildApplyAccountStateSteps(list, ensureMaildirFor);
  const result = await submitMutation(executor, {
    module: CACHE_KEYS.mail.accounts.module,
    collection: CACHE_KEYS.mail.accounts.collection,
    op,
    steps,
    refresh: [["mail", "accounts"]],
  });
  // Surface the job so the client can poll /api/jobs/:id and reload its
  // DataTable only once the read cache is fresh (the worker re-runs the
  // collector before signalling done). When `applied`, the cache is already
  // fresh and the client can reload immediately.
  return { id: result.jobId, mode: result.mode };
}

/** Apply the desired account list to Postfix + Dovecot files on the target
 *  server. Runs entirely through the executor (localExecutor for the panel's
 *  own box) — no command ever executes on the panel host directly. */
async function applyServerAccountState(executor: Executor, list: ServerAccount[]): Promise<void> {
  const { dovecotEntries, postfixEntries, domains } = projectAccountState(list);

  await dovecotService.regenerateUsersFileWithExecutor(dovecotEntries, executor);
  await postfixService.regenerateMailboxMapWithExecutor(postfixEntries, executor);
  await postfixService.regenerateDomainMapWithExecutor(domains, executor);
  for (const a of list) await dovecotService.ensureMaildirWithExecutor(a.address, executor);
  await dovecotService.reloadWithExecutor(executor);
  await postfixService.reloadWithExecutor(executor);
}
