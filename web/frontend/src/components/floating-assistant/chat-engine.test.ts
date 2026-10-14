// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { historyTurn } from "./chat-engine";
import { extractCliProgress } from "./chat-engine/cli-lanes";
import type { ConversationMessage } from "./assistant-api";

describe("CLI progress for ThoughtLine", () => {
  it("shows agent narration in order while keeping commands and their output out", () => {
    const log = "$ codex exec -m gpt-6.1-sol\r\n● Codex\r\nVoy a revisar la vista.\r\n⏺ bash /bin/bash -lc 'rg promptbar'\r\n  ⎿ promptbar.tsx\r\nAhora ajustaré el componente.\r\n⏺ bash apply_patch\r\n  ⎿ Done\r\nRespuesta final.";
    expect(extractCliProgress(log)).toEqual(["Voy a revisar la vista.", "Ahora ajustaré el componente.", "Respuesta final."]);
    expect(extractCliProgress(log, "Respuesta final.")).toEqual(["Voy a revisar la vista.", "Ahora ajustaré el componente."]);
  });

  it("handles ANSI styling and lane tokens without exposing them as progress", () => {
    const log = "\0{\"l\":\"main\"}\0\u001b[2m● Claude Code\u001b[0m\r\nRevisaré los permisos.\r\n\u001b[36m⏺ Bash\u001b[0m ls\r\n  ⎿ files\r\n";
    expect(extractCliProgress(log)).toEqual(["Revisaré los permisos."]);
  });

  it("keeps each summary point on its own line and removes the duplicated final answer", () => {
    const log = "● Codex\r\n1. Revisé el resumen.\r\n2. Corregí los saltos de línea.\r\n⏺ bash pnpm test\r\n  ⎿ ok\r\nPrimera mejora.\r\nSegunda mejora.";
    expect(extractCliProgress(log)).toEqual([
      "1. Revisé el resumen.\n2. Corregí los saltos de línea.",
      "Primera mejora.\nSegunda mejora.",
    ]);
    expect(extractCliProgress(log, "Primera mejora. Segunda mejora.")).toEqual([
      "1. Revisé el resumen.\n2. Corregí los saltos de línea.",
    ]);
  });
});

describe("historyTurn", () => {
  it("derives the clean final answer when split CLI history still has transcript in content", () => {
    const turn = historyTurn({
      role: "assistant",
      provider: "codex",
      cli: true,
      content: "2026-07-01T02:14:31Z ERROR rmcp...\nVoy a revisar el flujo.\n⏺ bash /bin/bash -lc \"echo hi\"\n  ⎿ hi\nRespuesta final limpia.\n\nSegundo párrafo.",
      cliLog: "$ codex exec -m gpt-5.6-terra\r\nReading additional input from stdin...\r\n● Codex\r\n2026-07-01T02:14:31Z ERROR rmcp...\r\nVoy a revisar el flujo.\r\n⏺ bash /bin/bash -lc \"echo hi\"\r\n  ⎿ hi\r\nRespuesta final limpia.\r\n\r\nSegundo párrafo.\r\n",
    } as ConversationMessage);

    expect(turn.text).toBe("Respuesta final limpia.\n\nSegundo párrafo.");
    expect(turn.cliHistoryLog).toContain("$ codex exec -m gpt-5.6-terra");
  });

  it("falls back to the last narrative block (never the whole log) when the run ended mid-tool", () => {
    const log = "$ claude -p …\nVoy a coordinar.\n⏺ Bash ls\n  ⎿ x\nCarolina ya commiteó la marca v3. Sigo esperando.\n⏺ mcp__team__collect {\"waitSeconds\":58}\n  ⎿ { \"results\": [] }\n⏺ mcp__team__collect {\"waitSeconds\":58}";
    const turn = historyTurn({ role: "assistant", provider: "claude", cli: true, content: log, cliLog: log } as ConversationMessage);
    expect(turn.text).toBe("Carolina ya commiteó la marca v3. Sigo esperando.");
    expect(turn.cliHistoryLog).toContain("team__collect");
  });

  it("yields an empty answer when the log has no narrative at all", () => {
    const log = "$ claude -p …\n⏺ Bash ls\n  ⎿ x\n⏺ Bash pwd";
    const turn = historyTurn({ role: "assistant", provider: "claude", cli: true, content: log } as ConversationMessage);
    expect(turn.text).toBe("");
  });
});
