// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnView } from "./turn-view";
import type { ChatTurn } from "../chat-engine";

describe("assistant message container", () => {
  it("keeps console, modified files and final answer in one ordered surface", () => {
    const turn: ChatTurn = {
      role: "assistant",
      text: "Resumen final del cambio.",
      tools: [{
        id: "cli-1",
        name: "codex.cli",
        input: {},
        terminal: "⏺ Write src/App.tsx",
        result: { success: true, output: "Listo" },
      }],
      createdAt: Date.now(),
    };
    const html = renderToStaticMarkup(
      createElement(TurnView, {
        turn, provider: "codex", projectPath: "/tmp/project", onOpenFile: () => {},
        teamBoards: [createElement("section", { "data-testid": "team-task-board" }, "Equipo de trabajo")],
      }),
    );
    expect(html.match(/data-assistant-message=""/g)).toHaveLength(1);
    expect([...html.matchAll(/data-message-section="([^"]+)"/g)].map((match) => match[1]))
      .toEqual(["reasoning", "console", "files", "answer", "team"]);
    expect(html).toContain("src/App.tsx");
    expect(html).toContain("Resumen final del cambio.");
    expect(html).toContain("Equipo de trabajo");
  });

  it("keeps a plain user message as its own bubble", () => {
    const turn: ChatTurn = { role: "user", text: "Hola", tools: [] };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex" }));
    expect(html).not.toContain("data-assistant-message");
    expect(html).toContain("Hola");
  });

  it("renders streamed CLI narration in ThoughtLine while retaining the terminal", () => {
    const turn: ChatTurn = {
      role: "assistant", text: "", pending: true,
      tools: [{ id: "cli-2", name: "codex.cli", input: {}, terminal: "$ codex exec\r\n● Codex\r\nVoy a revisar el flujo.\r\n⏺ bash rg chat\r\n  ⎿ chat.tsx\r\nAhora ajustaré la vista.\r\n" }],
    };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex" }));
    expect(html).toContain("Voy a revisar el flujo.");
    expect(html).toContain("Ahora ajustaré la vista.");
    expect(html).toContain('data-message-section="console"');
    expect(html).toMatch(/<details(?![^>]*\bopen=)[^>]*><summary[^>]*>.*?Consola del servidor/s);
    expect(html).not.toContain("Consola del servidor</span></span>");
  });

  it("keeps the CLI console without repeating nested tool inputs and outputs", () => {
    const turn: ChatTurn = {
      role: "assistant", text: "Revisión terminada.",
      tools: [
        { id: "cli-1", name: "codex.cli", input: {}, terminal: "Voy a revisar los registros." },
        { id: "module-1", name: "module-dev.get_module_dev_logs", input: { query: { module: "chat" } }, result: { success: true, output: "sensitive-tool-output" } },
      ],
    };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex" }));
    expect(html).toContain("Consola del servidor");
    expect(html).toContain("Revisión terminada.");
    expect(html).not.toContain("module-dev.get_module_dev_logs");
    expect(html).not.toContain("sensitive-tool-output");
    expect(html).not.toContain('&quot;query&quot;');
  });

  it("shows an API answer without raw tool disclosures", () => {
    const turn: ChatTurn = {
      role: "assistant", text: "Consulta completada.",
      tools: [{ id: "module-1", name: "chat.read", input: { secret: "private-input" }, result: { success: true, output: "private-output" } }],
    };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "gemini" }));
    expect(html).toContain("Consulta completada.");
    expect(html).not.toContain('data-message-section="console"');
    expect(html).not.toContain("private-input");
    expect(html).not.toContain("private-output");
  });

  it("offers the complete saved plan while keeping the approval controls visible", () => {
    const turn: ChatTurn = {
      role: "assistant",
      text: "Resumen: Añadir control del PC con permisos y recuperación.\n\nPlan completo:\n1. Revisar el enlace entre app y Chatbox.\n2. Implementar controles y comprobarlos en Windows y Linux.",
      tools: [],
      askKind: "plan-approval",
      ask: [{ id: "plan", type: "single", text: "¿Apruebas este plan?", options: ["Aprobar plan", "Pedir cambios"] }],
    };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex", isLast: true, onAnswer: () => {} }));
    expect(html).toContain("Ver plan completo");
    expect(html).toContain("Implementar controles");
    expect(html).toContain("Aprobar plan");
    expect(html).not.toContain("Resumen:");
  });
});
