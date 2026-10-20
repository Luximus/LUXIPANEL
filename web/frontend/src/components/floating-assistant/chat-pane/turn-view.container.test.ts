// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnView } from "./turn-view";
import type { ChatTurn } from "../chat-engine";
import type { AssistantAgent } from "../assistant-api";

describe("assistant message container", () => {
  it("retains files and failed tool output from earlier phases without duplicating the bubble", () => {
    const first: ChatTurn = { role: "assistant", text: "", tools: [
      { id: "first", name: "codex.cli", input: {}, terminal: "⏺ Write src/first.tsx\n⏺ Write src/shared.tsx",
        result: { success: false, output: "Error recuperado de la primera fase" } },
    ] };
    const turn: ChatTurn = { role: "assistant", text: "Respuesta final", tools: [
      { id: "last", name: "codex.cli", input: {}, terminal: "⏺ Write src/shared.tsx\n⏺ Write src/last.tsx", result: { success: true, output: "Respuesta final" } },
    ] };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, executionPhases: [first], provider: "codex", projectPath: "/tmp/project", onOpenFile: () => {} }));
    expect(html.match(/data-assistant-message=""/g)).toHaveLength(1);
    expect(html).toContain("Error recuperado de la primera fase");
    expect(html).toContain("first.tsx");
    expect(html).toContain("last.tsx");
    expect(html.match(/title="[^\"]*src\/shared\.tsx[^\"]*"/g)).toHaveLength(1);
  });
  it.each([null, { id: "worker", name: "Sofía", providerId: "claude" } as AssistantAgent])("keeps a reloaded CLI failure visible with team details inside the console in general and agent chats: %j", (agent) => {
    const turn: ChatTurn = {
      role: "assistant", text: "", cli: true, tools: [],
      cliHistoryLog: "Revisando la solicitud\nOAuth session expired",
      error: "El proveedor rechazó la autenticación del asistente.",
    };
    const html = renderToStaticMarkup(createElement(TurnView, {
      turn, provider: "claude", agent,
      teamBoards: [createElement("section", { key: "team" }, "Tareas del equipo")],
    }));
    expect(html).toContain("OAuth session expired");
    expect(html).toContain("El proveedor rechazó la autenticación");
    expect(html).toContain("Tareas del equipo");
    expect(html.indexOf('data-message-section="console"')).toBeLessThan(html.indexOf('data-message-section="answer"'));
    expect(html.indexOf('data-message-section="team"')).toBeLessThan(html.indexOf('data-message-section="answer"'));
  });
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
      .toEqual(["reasoning", "console", "team", "files", "answer"]);
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
    expect(html).not.toContain("cursor-zoom-in");
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

  it("keeps API tool activity available alongside the answer", () => {
    const turn: ChatTurn = {
      role: "assistant", text: "Consulta completada.",
      tools: [{ id: "module-1", name: "chat.read", input: { secret: "private-input" }, result: { success: true, output: "private-output" } }],
    };
    const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "gemini" }));
    expect(html).toContain("Consulta completada.");
    expect(html).toContain('data-message-section="console"');
    expect(html).toContain("chat.read");
    expect(html).toContain("private-output");
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
    expect(html).not.toContain("Ver plan completo");
    expect(html).not.toContain("data-compact-answer");
    expect(html).toContain("Implementar controles");
    expect(html).toContain("Aprobar plan");
    expect(html).toContain("Resumen:");
  });
});

it("keeps a user recording above two collapsed text details without repeating a text bubble", () => {
  const turn: ChatTurn = { role: "user", text: "Transcripción original", raw: "Forwarded text", tools: [], attachments: [{ name: "audio.webm", mimeType: "audio/webm", url: "data:audio/webm;base64,YXVkaW8=", voice: { transcript: "Transcripción original" } }] };
  const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex" }));
  expect(html).toContain("data-user-voice-message");
  expect(html.match(/Transcripción original/g)).toHaveLength(1);
  expect(html.match(/Forwarded text/g)).toHaveLength(1);
  expect(html.indexOf("data-voice-recording")).toBeLessThan(html.indexOf("data-voice-transcript"));
  expect(html.indexOf("data-voice-transcript")).toBeLessThan(html.indexOf("data-voice-forwarded"));
  expect(html).not.toContain("<details open");
});


it("keeps a standalone generated notice readable inside standard execution details", () => {
  const turn: ChatTurn = { role: "user", text: "Mateo: revisión terminada, cambios listos para Marin.", auto: true, tools: [] };
  const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex" }));
  expect(html).toContain("data-team-notice");
  expect(html).toContain("<summary");
  expect(html).toContain("Mateo: revisión terminada");
  expect(html).toContain("Ver historial");
  expect(html).not.toContain("<details open");
  expect(html).not.toContain("data-assistant-message");
});

it("retains the completed CLI output as a fallback answer without API activity", () => {
  const turn: ChatTurn = { role: "assistant", text: "", tools: [
    { id: "cli", name: "codex.cli", input: {}, terminal: "Registro conservado", result: { success: true, output: "Respuesta final de respaldo" } },
  ] };
  const html = renderToStaticMarkup(createElement(TurnView, { turn, provider: "codex" }));
  expect(html).toContain("Respuesta final de respaldo");
  expect(html).toContain('data-message-section="answer"');
  expect(html).toContain("Consola del servidor");
  expect(html).not.toContain("data-entry-id");
  expect(html).not.toContain('data-execution-source="API"');
});
