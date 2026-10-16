// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useSyncExternalStore } from "react";
import { scopedPreferenceKey } from "@/lib/scoped-preferences";
import type { AssistantProject } from "./assistant-api";

const listeners = new Set<() => void>();
const scopeEvents = ["luxipanel:target-changed", "luxipanel:session-started", "luxipanel:session-ended", "luxipanel:logout", "astro:page-load"];
const notify = () => listeners.forEach(listener => listener());

function scopeKey(): string {
  try { return scopedPreferenceKey("assistant", "chat-projects"); }
  catch { return ""; }
}

function readHidden(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
  } catch { return []; }
}

const getSnapshot = () => JSON.stringify([scopeKey(), readHidden(scopeKey())]);
const getServerSnapshot = () => '["",[]]';

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", notify);
    for (const event of scopeEvents) window.addEventListener(event, notify);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("storage", notify);
      for (const event of scopeEvents) window.removeEventListener(event, notify);
    }
  };
}

/** Only filters picker options: never removes projects, history or the active context. */
export function visibleChatProjects(projects: AssistantProject[], hiddenIds: string[], selectedRootId?: string | null) {
  const hidden = new Set(hiddenIds);
  return projects.filter(project => !project.parentId && (!hidden.has(project.id) || project.id === selectedRootId));
}

export function useChatProjectVisibility() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [scope, hiddenIds] = JSON.parse(snapshot) as [string, string[]];
  return {
    scope,
    hiddenIds,
    setVisible(ids: string[], visible: boolean): boolean {
      // Do not apply an old view's click to a newly connected server/user.
      if (!scope || scope !== scopeKey()) return false;
      const hidden = new Set(readHidden(scope));
      for (const id of ids) {
        if (visible) hidden.delete(id);
        else hidden.add(id);
      }
      try { localStorage.setItem(scope, JSON.stringify([...hidden])); }
      catch { return false; }
      notify();
      return true;
    },
  };
}
