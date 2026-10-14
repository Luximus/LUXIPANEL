// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { readStoredString, writeStoredString } from "@/lib/prefs-store";
import type { CliEntry } from "../cli-registry";
import type { TerminalMessages } from "../i18n";
import type { SidebarTab } from "./types";

export const SIDEBAR_TABS: SidebarTab[] = ["snippets", "history"];

export function sidebarTabLabel(messages: TerminalMessages, tab: SidebarTab): string {
  switch (tab) {
    case "snippets":
      return messages.sidebar.tabSnippets;
    case "history":
      return messages.sidebar.tabHistory;
  }
}

export const SIDEBAR_TAB_ICONS: Record<SidebarTab, string> = {
  snippets: "ti-code",
  history: "ti-history",
};

export const STORAGE_KEY_SIDEBAR_TAB = "lxp.terminal.sidebar.tab";

// Lectura/escritura cruda de localStorage: reexport del helper compartido (F-18).
export const readString = readStoredString;
export const writeString = writeStoredString;

// Cierra el teclado virtual (móvil): el teclado aparece porque el textarea
// oculto de xterm (`.xterm-helper-textarea`) tiene el foco. Hacerle blur lo
// repliega. Lo usamos al desplegar el panel lateral derecho para que éste quede
// por encima sin la barra de teclas auxiliares ni el teclado del sistema.
export function dismissMobileKeyboard() {
  if (typeof document === "undefined") return;
  const active = document.activeElement as HTMLElement | null;
  if (active && typeof active.blur === "function") active.blur();
}

export function injectIntoActiveTerminal(command: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("lxp-terminal:inject-command", {
      detail: { command, run: true },
    }),
  );
}

// CLIs cuyo historial de conversaciones está soportado por el backend.
// Fuente única: el label map, la unión `HistoryMode` y las order-options
// se derivan de aquí.
export const HISTORY_CLIS = [
  { id: "codex", label: "Codex" },
  { id: "claude", label: "Claude" },
] as const;

export type HistoryCli = (typeof HISTORY_CLIS)[number]["id"];

export const HISTORY_MODE_KEYS = ["commands", ...HISTORY_CLIS.map((c) => c.id)] as const;

export type HistoryMode = (typeof HISTORY_MODE_KEYS)[number];

export const HISTORY_CLI_LABELS: Record<string, string> = Object.fromEntries(
  HISTORY_CLIS.map((c) => [c.id, c.label]),
);

export function permute<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const sub of permute(rest)) {
      result.push([items[i], ...sub]);
    }
  }
  return result;
}

export function buildHistoryOrderOptions(
  _installed: CliEntry[],
  consoleLabel: string,
): Array<{ value: string; label: string }> {
  // History files remain readable after a CLI is uninstalled. Match the three
  // persistent history modes instead of varying option values with PATH probes.
  const ids = [...HISTORY_CLIS.map((entry) => entry.id), "commands"];
  const labels: Record<string, string> = { commands: consoleLabel, ...HISTORY_CLI_LABELS };
  return permute(ids).map((order) => ({
    value: order.join(","),
    label: order.map((id) => labels[id] ?? id).join(" > "),
  }));
}
