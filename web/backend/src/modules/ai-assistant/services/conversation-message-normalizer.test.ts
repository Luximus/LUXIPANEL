// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { normalizeConversationMessage, normalizeConversationMessages } from "./conversation-message-normalizer.js";

describe("conversation message normalizer", () => {
  it("repairs split CLI rows whose content still contains the full transcript", () => {
    const input = {
      role: "assistant",
      provider: "codex",
      cli: true,
      content: "2026-07-01T02:14:31Z ERROR rmcp...\nVoy a revisar el flujo.\n⏺ bash /bin/bash -lc \"echo hi\"\n  ⎿ hi\nRespuesta final limpia.\n\nSegundo párrafo.",
      cliLog: "$ codex exec -m gpt-5.6-terra\r\nReading additional input from stdin...\r\n● Codex\r\n2026-07-01T02:14:31Z ERROR rmcp...\r\nVoy a revisar el flujo.\r\n⏺ bash /bin/bash -lc \"echo hi\"\r\n  ⎿ hi\r\nRespuesta final limpia.\r\n\r\nSegundo párrafo.\r\n",
      ts: "2026-07-01T02:14:31.000Z",
    };

    const out = normalizeConversationMessage(input);
    expect(out.content).toBe("Respuesta final limpia.\n\nSegundo párrafo.");
    expect(out.cliLog).toContain("$ codex exec -m gpt-5.6-terra");
    expect(out.cliLog).toContain("⏺ bash /bin/bash -lc \"echo hi\"");
  });

  it("keeps translated user-facing text when it is already clean", () => {
    const input = {
      role: "assistant",
      provider: "claude",
      cli: true,
      content: "$ claude -p\nReading additional input from stdin...\n● Claude Code\nRespuesta limpia.\n",
      textTranslated: "Respuesta limpia.",
      ts: "2026-07-01T02:14:31.000Z",
    };

    const out = normalizeConversationMessage(input);
    expect(out.content).toBe("Respuesta limpia.");
  });

  it("strips MCP transport noise from the clean answer but keeps it in cliLog", () => {
    const noise =
      '2026-07-01T16:19:47.629193Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer realm=\\"luxipanel-mcp\\"" })';
    const input = {
      role: "assistant",
      provider: "codex",
      cli: true,
      content: `${noise}\nRespuesta final limpia.`,
      cliLog: `$ codex exec\n● Codex\n${noise}\nRespuesta final limpia.\n`,
      ts: "2026-07-01T16:19:47.000Z",
    };

    const out = normalizeConversationMessage(input);
    expect(out.content).toBe("Respuesta final limpia.");
    expect(out.cliLog).toContain("ERROR rmcp::transport::worker");
  });

  it("strips MCP transport noise from a contaminated translated text", () => {
    const input = {
      role: "assistant",
      provider: "codex",
      cli: true,
      content: "$ codex exec\nRespuesta.",
      textTranslated:
        "2026-07-01T02:14:31.466264Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed\nRespuesta.",
      ts: "2026-07-01T02:14:31.000Z",
    };

    const out = normalizeConversationMessage(input);
    expect(out.content).toBe("Respuesta.");
  });

  it("reports changed when a batch row is repaired", () => {
    const { changed, messages } = normalizeConversationMessages([
      {
        role: "assistant",
        provider: "codex",
        cli: true,
        content: "⏺ bash -lc \"echo hi\"\n  ⎿ hi\nArreglado.",
      },
    ]);
    expect(changed).toBe(true);
    expect(messages[0]?.content).toBe("Arreglado.");
  });

  it("never dumps the whole log when the run ended mid-tool: falls back to the last narrative block", () => {
    const log = [
      "$ claude -p …",
      "Voy a coordinar el cambio de logo.",
      "⏺ Bash ls -la /tmp",
      "  ⎿ total 32 drwx------",
      "Las tres tareas están corriendo en paralelo. Espero resultados.",
      "⏺ mcp__luxipanel-servers__team__collect {\"waitSeconds\":58}",
      "  ⎿ {   \"results\": [] }",
      "⏺ mcp__luxipanel-servers__team__collect {\"waitSeconds\":58}",
    ].join("\n");
    const out = normalizeConversationMessage({ role: "assistant", cli: true, content: log, cliLog: log, ts: "" } as never);
    expect(out.content).toBe("Las tres tareas están corriendo en paralelo. Espero resultados.");
    expect(out.cliLog).toContain("team__collect");
  });

  it("returns an empty answer (not the log) when there is no narrative at all", () => {
    const log = "$ claude -p …\n⏺ Bash ls\n  ⎿ a b c\n⏺ Bash pwd";
    const out = normalizeConversationMessage({ role: "assistant", cli: true, content: log, ts: "" } as never);
    expect(out.content).toBe("");
    expect(out.cliLog).toContain("⏺ Bash pwd");
  });
});

it("preserves the final answer when the separate log stops at earlier progress", () => {
  const out = normalizeConversationMessage({ role: "assistant", cli: true, content: "Publicado y verificado.", cliLog: "$ codex\nEstoy revisando.\n⏺ bash build", ts: "" });
  expect(out.content).toBe("Publicado y verificado.");
});
it("preserves an empty failed answer instead of promoting progress", () => {
  const out = normalizeConversationMessage({ role: "assistant", cli: true, content: "", cliLog: "$ codex\nEstoy revisando.", error: "timeout", ts: "" });
  expect(out.content).toBe("");
  expect(out.error).toBe("timeout");
});
