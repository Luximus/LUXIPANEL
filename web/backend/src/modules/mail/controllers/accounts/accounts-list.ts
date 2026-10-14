// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Live account-list builder + the `MailAccountListItem` row shape. Reproduces
 * the heavy SSH work the on-box collector precomputes, producing the SAME row
 * shape the cached engine blob emits so the cache and this cold-miss fallback
 * are interchangeable.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { readAccountsFromServer, fnv1aId } from "../accounts.helpers.js";
import { roundToTwo, type ForwardEntry } from "./accounts.util.js";
import { readForwardsFromServer } from "./accounts-forwards.reader.js";
import { getAllMailboxUsageMap, getMaildirQuotaLimitsMap, type MailboxUsage } from "./accounts-usage.helpers.js";

/** Final shape of every row both the cache and the live loader return — the
 *  controller's response items[] is exactly this. Mirrors the engine output. */
export interface MailAccountListItem {
  usedMb: number | null;
  usedPercent: number | null;
  id: number;
  address: string;
  domain: string;
  displayName: string | null;
  quotaMb: number;
  enabled: boolean;
  incomingMode: "allow" | "suspend";
  outgoingMode: "allow" | "suspend" | "hold";
  loginMode: "allow" | "suspend";
  plusAddressingAutoFolder: boolean;
  forwards: ForwardEntry[];
  forwardCount: number;
  createdAt: string | null;
}

/** Cold-miss / forceLive path: reproduce the heavy SSH work and produce
 *  the SAME `MailAccountListItem[]` shape the engine emits, so the cached
 *  blob and the fallback are interchangeable. */
export async function buildAccountItemsLive(executor: Executor, includeUsage = true, onUsage?: (usage: MailboxUsage) => void): Promise<MailAccountListItem[]> {
  const serverAccounts = await readAccountsFromServer(executor);
  if (serverAccounts.length === 0) return [];
  const [forwardsByAddress, usage, quotaLimits] = await Promise.all([
    readForwardsFromServer(executor),
    includeUsage ? getAllMailboxUsageMap(executor, serverAccounts.map((a) => a.address))
      : Promise.resolve({ available: false, map: new Map<string, number>() }),
    getMaildirQuotaLimitsMap(executor),
  ]);
  if (includeUsage) onUsage?.(usage);
  const usageKnown = usage.available;
  return serverAccounts.map((a) => {
    const accountForwards = forwardsByAddress.get(a.address) ?? [];
    const usedMb = usageKnown
      ? roundToTwo((usage.map.get(a.address.toLowerCase()) ?? 0) / (1024 * 1024))
      : null;
    const quotaMb = quotaLimits.get(a.address.toLowerCase()) ?? a.quotaMb;
    return {
      usedMb,
      usedPercent: usageKnown && quotaMb > 0 && usedMb !== null
        ? roundToTwo((usedMb / quotaMb) * 100)
        : null,
      id: fnv1aId(a.address),
      address: a.address,
      domain: a.domain,
      displayName: null,
      quotaMb,
      enabled: a.enabled,
      incomingMode: a.incomingMode,
      outgoingMode: a.outgoingMode,
      loginMode: a.loginMode,
      plusAddressingAutoFolder: a.plusAddressingAutoFolder,
      forwards: accountForwards,
      forwardCount: accountForwards.length,
      createdAt: null,
    };
  });
}
