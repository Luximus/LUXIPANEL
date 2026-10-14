// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Chat directory — who/what you can talk to, read straight from the OS of the
 * CONNECTED server (never the panel host):
 *
 *   • Human users   →  `getent passwd`   (UID >= 1000, real login shell)
 *   • Online state   →  `who`            (active login sessions)
 *   • Group chats    →  `getent group`   (real OS groups + their members)
 *
 * This is the "aprovechar lo que Linux ofrece" core: participants and groups
 * are genuine system entities, not panel-invented records.
 */

import type { Executor } from "../../../shared/executor/index.js";
import { quoteCmd } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type {
  ChatDirectoryGroup,
  ChatDirectoryMember,
  ChatDirectoryUser,
} from "../models/chat.model.js";
import { profilesRepository } from "../repositories/profiles.repository.js";
import { MIN_REAL_UID } from "../../../shared/system/users.js";
import { NON_LOGIN_SHELLS } from "../../../shared/system/shells.js";

const log = createModuleLogger("chat-directory");

interface PasswdRow {
  username: string;
  uid: number;
  gid: number;
  displayName: string;
  shell: string;
}

/** First comma-separated GECOS field, trimmed; falls back to the username. */
function gecosName(gecos: string, username: string): string {
  const first = (gecos.split(",")[0] ?? "").trim();
  return first || username;
}

function parsePasswd(stdout: string): PasswdRow[] {
  const rows: PasswdRow[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const [username, , uidRaw, gidRaw, gecos, , shell] = line.split(":");
    const uid = Number.parseInt(uidRaw ?? "", 10);
    const gid = Number.parseInt(gidRaw ?? "", 10);
    if (!username || !Number.isFinite(uid) || !Number.isFinite(gid)) continue;
    rows.push({ username, uid, gid, displayName: gecosName(gecos ?? "", username), shell: shell ?? "" });
  }
  return rows;
}

/** Set of usernames with at least one active login session (`who`). */
async function onlineUsers(executor: Executor): Promise<Set<string>> {
  try {
    const out = await executor.exec("who", { timeoutMs: 8_000 });
    const set = new Set<string>();
    for (const line of (out.stdout ?? "").split("\n")) {
      const user = line.trim().split(/\s+/)[0];
      if (user) set.add(user);
    }
    return set;
  } catch (err) {
    log.warn({ err }, "who failed — presence unavailable");
    return new Set();
  }
}

// ── Display-name cache (Block B: never show a raw username in the UI) ───────
// `getent passwd` over SSH on every message/list would be a per-message round
// trip. Names change rarely, so a 60 s per-target memo is plenty and the reads
// are FAIL-OPEN: on error we return an empty map and callers fall back to the
// username (degraded label, never a broken screen).
const DISPLAY_NAMES_TTL_MS = 60_000;
const displayNamesCache = new Map<string, { at: number; names: Map<string, string> }>();

function displayCacheKey(executor: Executor): string {
  return executor.target?.id ?? "local";
}

/** The set of usernames that share at least one OS group (primary OR
 *  supplementary) with `username` — the caller included. Used as the privacy
 *  gate for non-admins: you may only see / start chats with people you already
 *  share a group with, coherent with the group-as-role model the panel uses
 *  everywhere else (`listGroupsForUser`, role permissions). */
async function usersSharingGroupWith(executor: Executor, username: string): Promise<Set<string>> {
  const [groupOut, idOut, passwd] = await Promise.all([
    executor.exec("getent group", { timeoutMs: 10_000 }),
    executor.exec(quoteCmd("id", ["-nG", username]), { timeoutMs: 8_000 }),
    executor.exec("getent passwd", { timeoutMs: 10_000 }),
  ]);

  const myGroups = new Set(
    (idOut.stdout ?? "").trim().split(/\s+/).map((g) => g.trim()).filter(Boolean),
  );
  const visible = new Set<string>([username]);
  const myGroupGids = new Set<number>();

  // Supplementary membership: every human listed in one of my groups.
  for (const line of (groupOut.stdout ?? "").split("\n")) {
    if (!line.trim()) continue;
    const [name, , gidRaw, membersRaw] = line.split(":");
    if (!name || !myGroups.has(name)) continue;
    const gid = Number.parseInt(gidRaw ?? "", 10);
    if (Number.isFinite(gid)) myGroupGids.add(gid);
    for (const m of (membersRaw ?? "").split(",").map((x) => x.trim()).filter(Boolean)) {
      visible.add(m);
    }
  }

  // Primary-group peers: humans whose primary gid is one of my groups' gids
  // (getent group only lists SUPPLEMENTARY members, so primary peers are added
  // here from passwd).
  for (const r of parsePasswd(passwd.stdout ?? "")) {
    if (myGroupGids.has(r.gid)) visible.add(r.username);
  }

  return visible;
}

export const directoryService = {
  /**
   * `username → display name (GECOS)` for the connected server.
   *
   * ONLY `getent passwd` (no `who`, no group probing) so it is the cheapest
   * possible decoration source, memoised 60 s per target. Fail-open: an empty
   * map on any error — the caller then falls back to the username.
   */
  async displayNames(executor: Executor): Promise<Map<string, string>> {
    const key = displayCacheKey(executor);
    const hit = displayNamesCache.get(key);
    if (hit && Date.now() - hit.at < DISPLAY_NAMES_TTL_MS) return hit.names;
    try {
      const passwd = await executor.exec("getent passwd", { timeoutMs: 10_000 });
      const names = new Map<string, string>();
      for (const row of parsePasswd(passwd.stdout ?? "")) names.set(row.username, row.displayName);
      displayNamesCache.set(key, { at: Date.now(), names });
      return names;
    } catch (err) {
      log.warn({ err }, "getent passwd failed — display names unavailable");
      return new Map();
    }
  },

  /** Test seam: drop the memoised display names (all targets or just one). */
  invalidateDisplayNames(targetId?: string): void {
    if (targetId) displayNamesCache.delete(targetId);
    else displayNamesCache.clear();
  },

  /**
   * Human users of the connected server, with live presence.
   *
   * Privacy gate: when `viewer` is a NON-admin, the list is restricted to users
   * that share at least one OS group with them (deny-by-default) — a plain
   * authenticated user must NOT be able to enumerate every `/etc/passwd`
   * account on the server. Admins (and internal callers that pass no `viewer`)
   * get the full human list.
   */
  async listUsers(
    executor: Executor,
    viewer?: { username: string; isAdmin: boolean },
  ): Promise<ChatDirectoryUser[]> {
    const [passwd, online, profiles] = await Promise.all([
      executor.exec("getent passwd", { timeoutMs: 10_000 }),
      onlineUsers(executor),
      profilesRepository.listAll(executor),
    ]);
    let rows = parsePasswd(passwd.stdout ?? "").filter(
      (r) => r.uid >= MIN_REAL_UID && r.username !== "nobody" && !NON_LOGIN_SHELLS.has(r.shell),
    );
    if (viewer && !viewer.isAdmin) {
      const visible = await usersSharingGroupWith(executor, viewer.username);
      rows = rows.filter((r) => visible.has(r.username));
    }
    return rows
      .map((r) => {
        const profile = profiles.get(r.username);
        return {
          username: r.username,
          displayName: r.displayName,
          // Presence opt-out (`showOnline: false`) hides the user from everyone.
          online: profile?.showOnline === false ? false : online.has(r.username),
          status: profile?.statusMessage ?? null,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },

  /** A quick username → online lookup (used to annotate conversation lists). */
  async presence(executor: Executor): Promise<Set<string>> {
    return onlineUsers(executor);
  },

  /**
   * Real OS groups the given user belongs to, with their human members. A group
   * is offered as a chat when it has at least one human member besides the
   * caller (so we don't surface noise like the user's private primary group).
   */
  async listGroupsForUser(executor: Executor, username: string): Promise<ChatDirectoryGroup[]> {
    const [groupOut, idOut, passwd, online, profiles] = await Promise.all([
      executor.exec("getent group", { timeoutMs: 10_000 }),
      executor.exec(quoteCmd("id", ["-nG", username]), { timeoutMs: 8_000 }),
      executor.exec("getent passwd", { timeoutMs: 10_000 }),
      onlineUsers(executor),
      profilesRepository.listAll(executor),
    ]);

    const myGroups = new Set(
      (idOut.stdout ?? "").trim().split(/\s+/).map((g) => g.trim()).filter(Boolean),
    );
    // username → display name for every human account, so a group row can be
    // rendered WITHOUT a second passwd round trip and without printing logins.
    const humans = new Map<string, string>();
    for (const r of parsePasswd(passwd.stdout ?? "")) {
      if (r.uid >= MIN_REAL_UID && r.username !== "nobody") humans.set(r.username, r.displayName);
    }

    const toMember = (member: string): ChatDirectoryMember => {
      const profile = profiles.get(member);
      return {
        username: member,
        displayName: humans.get(member) ?? member,
        online: profile?.showOnline === false ? false : online.has(member),
        status: profile?.statusMessage ?? null,
      };
    };

    const groups: ChatDirectoryGroup[] = [];
    for (const line of (groupOut.stdout ?? "").split("\n")) {
      if (!line.trim()) continue;
      const [name, , , membersRaw] = line.split(":");
      if (!name || !myGroups.has(name)) continue;
      const usernames = (membersRaw ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m && humans.has(m));
      // Need at least one OTHER human in the group for it to be a useful chat.
      if (usernames.filter((m) => m !== username).length === 0) continue;
      const members = Array.from(new Set([...usernames, username]))
        .map(toMember)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      groups.push({ name, members });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Live members of one OS group (humans only); [] if the group is gone. */
  async groupMembers(executor: Executor, groupName: string): Promise<string[]> {
    try {
      const [groupOut, passwd] = await Promise.all([
        executor.exec(quoteCmd("getent", ["group", groupName]), { timeoutMs: 8_000 }),
        executor.exec("getent passwd", { timeoutMs: 10_000 }),
      ]);
      const humans = new Set(
        parsePasswd(passwd.stdout ?? "")
          .filter((r) => r.uid >= MIN_REAL_UID && r.username !== "nobody")
          .map((r) => r.username),
      );
      const line = (groupOut.stdout ?? "").trim();
      if (!line) return [];
      const membersRaw = line.split(":")[3] ?? "";
      return membersRaw
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m && humans.has(m));
    } catch (err) {
      log.warn({ err, groupName }, "getent group failed");
      return [];
    }
  },
};
