// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "New conversation" picker — direct message (Linux user), a real Linux group
 * chat, or an ad-hoc group. Reads /api/chat/directory (getent passwd/group +
 * who presence).
 */
import { useEffect, useMemo, useState } from "react";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { ModalShell } from "@/components/ui/ModalShell";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { useChatI18n, formatChatMessage } from "./i18n";
import { initials } from "./format";
import { messengerApi, type Directory, type DirectoryGroup, type DirectoryUser } from "./messenger-api";

type Tab = "direct" | "group" | "custom";
const TAB_ORDER: readonly Tab[] = ["direct", "group", "custom"];

export function NewChatDialog({
  onClose,
  onCreate,
  directory,
}: {
  onClose: () => void;
  /** Shared directory loaded once by ChatModule (skips the extra fetch). */
  directory?: Directory;
  onCreate: (payload: { kind: "dm"; username: string } | { kind: "linux-group"; group: string } | { kind: "group"; title: string; members: string[] }) => void;
}) {
  const t = useChatI18n();
  const [tab, setTab] = useState<Tab>("direct");
  const tabDirection = useViewDirection(tab, TAB_ORDER);
  const [users, setUsers] = useState<DirectoryUser[]>(directory?.users ?? []);
  const [groups, setGroups] = useState<DirectoryGroup[]>(directory?.groups ?? []);
  const [loading, setLoading] = useState(!directory);
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    // The parent usually hands the directory down; only fetch when it did not.
    if (directory) {
      setUsers(directory.users);
      setGroups(directory.groups);
      setLoading(false);
      return;
    }
    let alive = true;
    void messengerApi.directory().then((d) => {
      if (!alive) return;
      setUsers(d.users);
      setGroups(d.groups);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [directory]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    // Bloque B: usernames are never rendered, so they are not searchable.
    return users.filter((u) => (u.displayName || "").toLowerCase().includes(q));
  }, [users, query]);

  function toggle(username: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }

  return (
    <ModalShell onClose={onClose} cardClassName="overflow-hidden">
        <ModalNavbar title={t.newChat.title} onClose={onClose} closeLabel={t.close} />

        <div className="flex gap-1 border-b border-border px-2 pt-2">
          {(["direct", "group", "custom"] as Tab[]).map((tk) => (
            <button
              key={tk}
              type="button"
              onClick={() => setTab(tk)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium border-b-2 transition-colors duration-200 ease-out ${
                tab === tk ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tk === "direct" ? t.newChat.tabDirect : tk === "group" ? t.newChat.tabGroup : t.newChat.tabCustom}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {/* Cambio de pestaña con la transición de vista del panel (motion.css). */}
          <ViewTransition viewKey={loading ? "loading" : tab} direction={tabDirection}>
          {loading ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              <i className="ti ti-loader-2 animate-spin" /> {t.loading}
            </p>
          ) : tab === "direct" ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{t.newChat.directHint}</p>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              {filteredUsers.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t.newChat.noUsers}</p>
              ) : (
                <ul className="flex flex-col">
                  {filteredUsers.map((u) => (
                    <li key={u.username}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                        onClick={() => onCreate({ kind: "dm", username: u.username })}
                      >
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                          {initials(u.displayName || t.unknownUser)}
                          {u.online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{u.displayName || t.unknownUser}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {u.status?.trim() ? `${u.status.trim()} · ` : ""}
                            {u.online ? t.online : t.offline}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : tab === "group" ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{t.newChat.groupHint}</p>
              {groups.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t.newChat.noGroups}</p>
              ) : (
                <ul className="flex flex-col">
                  {groups.map((g) => (
                    <li key={g.name}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                        onClick={() => onCreate({ kind: "linux-group", group: g.name })}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <i className="ti ti-users" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{g.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {formatChatMessage(t.membersCount, { count: g.members.length })}
                          </span>
                        </span>
                        <i className="ti ti-arrow-right text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.newChat.customName}</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={t.newChat.customNamePlaceholder}
                className="mb-3 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.newChat.customMembers}</label>
              {users.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">{t.newChat.noUsers}</p>
              ) : (
                <ul className="flex max-h-52 flex-col overflow-y-auto rounded-md border border-border">
                  {users.map((u) => (
                    <li key={u.username}>
                      <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent">
                        <input type="checkbox" checked={picked.has(u.username)} onChange={() => toggle(u.username)} />
                        <span className="min-w-0 flex-1 truncate">{u.displayName || t.unknownUser}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {u.online ? t.online : t.offline}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          </ViewTransition>
        </div>

        {tab === "custom" && (
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button type="button" className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent" onClick={onClose}>
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={!groupName.trim() || picked.size === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={() => onCreate({ kind: "group", title: groupName.trim(), members: Array.from(picked) })}
            >
              {t.newChat.create}
            </button>
          </div>
        )}
    </ModalShell>
  );
}
