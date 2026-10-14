import { luxAssistantProxy } from "../../api/client";

export type HistoryMode = "commands" | "codex" | "claude";
export type TerminalPreferences = {
  fontSize: number;
  historyOrder: HistoryMode[];
  historyVisible: HistoryMode[];
};
type Response = { ok?: boolean; data?: Partial<TerminalPreferences>; error?: string };

export const HISTORY_MODES: HistoryMode[] = ["codex", "claude", "commands"];
export const DEFAULT_TERMINAL_PREFERENCES: TerminalPreferences = {
  fontSize: 13, historyOrder: [...HISTORY_MODES], historyVisible: [...HISTORY_MODES],
};

export function normalizeTerminalPreferences(input?: Partial<TerminalPreferences> | null): TerminalPreferences {
  const order = Array.isArray(input?.historyOrder)
    ? [...new Set(input.historyOrder.filter((id): id is HistoryMode => HISTORY_MODES.includes(id))) ]
    : [];
  for (const id of HISTORY_MODES) if (!order.includes(id)) order.push(id);
  const visible = Array.isArray(input?.historyVisible)
    ? [...new Set(input.historyVisible.filter((id): id is HistoryMode => HISTORY_MODES.includes(id))) ]
    : [];
  return {
    fontSize: Number.isInteger(input?.fontSize) && input!.fontSize! >= 11 && input!.fontSize! <= 20 ? input!.fontSize! : 13,
    historyOrder: order,
    historyVisible: visible.length ? visible : [...HISTORY_MODES],
  };
}

export async function getTerminalPreferences(panelId: string, token: string): Promise<TerminalPreferences | null> {
  const res = await luxAssistantProxy<Response>(panelId, token, "GET", "/api/terminal/preferences");
  return res?.data ? normalizeTerminalPreferences(res.data) : null;
}

export async function patchTerminalPreferences(panelId: string, token: string, patch: Partial<TerminalPreferences>): Promise<TerminalPreferences | null> {
  const res = await luxAssistantProxy<Response>(panelId, token, "PATCH", "/api/terminal/preferences", patch);
  return res?.data && res.ok !== false ? normalizeTerminalPreferences(res.data) : null;
}
