import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../api/client", () => ({ luxAssistantProxy: api }));
import { getTerminalPreferences, normalizeTerminalPreferences, patchTerminalPreferences } from "./terminal-preferences";

it("normaliza preferencias inválidas y conserva el orden válido del servidor", () => {
  expect(normalizeTerminalPreferences({ fontSize: 30, historyOrder: ["codex", "codex", "commands"] as any, historyVisible: [] })).toEqual({
    fontSize: 13, historyOrder: ["codex", "commands", "claude"], historyVisible: ["codex", "claude", "commands"],
  });
});

it("carga y guarda preferencias del servidor conectado", async () => {
  api.mockResolvedValueOnce({ ok: true, data: { fontSize: 14, historyOrder: ["codex", "commands", "claude"], historyVisible: ["codex", "commands"] } });
  expect((await getTerminalPreferences("box", "token"))?.historyVisible).toEqual(["codex", "commands"]);
  api.mockResolvedValueOnce({ ok: true, data: { fontSize: 15, historyOrder: ["codex", "commands", "claude"], historyVisible: ["codex", "commands"] } });
  expect((await patchTerminalPreferences("box", "token", { fontSize: 15 }))?.fontSize).toBe(15);
  expect(api).toHaveBeenNthCalledWith(1, "box", "token", "GET", "/api/terminal/preferences");
  expect(api).toHaveBeenNthCalledWith(2, "box", "token", "PATCH", "/api/terminal/preferences", { fontSize: 15 });
});
