// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  extractAskRequest,
  stripAskBlock,
  normalizeAskRequest,
  buildPlanModeBlock,
  ASK_TOOL_PROMPT,
  ASK_PROTOCOL_PROMPT,
  PLAN_APPROVED_PROMPT,
} from "./ask-protocol.js";

const block = (json: string) => `<<<LXP_ASK>>>\n${json}\n<<<LXP_ASK_END>>>`;

describe("extractAskRequest", () => {
  it("returns null when there is no block", () => {
    expect(extractAskRequest("una respuesta normal")).toBeNull();
  });

  it("parses single / multi / text questions and normalizes ids", () => {
    const text =
      "He revisado el servidor.\n" +
      block(
        JSON.stringify({
          questions: [
            { type: "single", text: "¿Motor web?", options: ["nginx", "apache"] },
            { id: "mods", type: "multi", text: "Módulos", options: ["ssl", "cache"] },
            { type: "text", text: "Dominio" },
          ],
        }),
      );
    const req = extractAskRequest(text);
    expect(req).not.toBeNull();
    expect(req!.questions).toHaveLength(3);
    expect(req!.questions[0]).toMatchObject({ id: "q1", type: "single", options: ["nginx", "apache"] });
    expect(req!.questions[1]).toMatchObject({ id: "mods", type: "multi" });
    expect(req!.questions[2]).toMatchObject({ type: "text" });
    expect(req!.questions[2]!.options).toBeUndefined();
  });

  it("drops single/multi questions without options and defaults unknown type to single", () => {
    const req = extractAskRequest(
      block(JSON.stringify({ questions: [{ type: "single", text: "sin opciones" }, { type: "weird", text: "x", options: ["a"] }] })),
    );
    expect(req!.questions).toHaveLength(1);
    expect(req!.questions[0]).toMatchObject({ type: "single", text: "x" });
  });

  it("tolerates a code-fenced JSON payload", () => {
    const req = extractAskRequest(block('```json\n{"questions":[{"type":"text","text":"hola"}]}\n```'));
    expect(req!.questions[0]).toMatchObject({ type: "text", text: "hola" });
  });

  it("returns null for invalid JSON or empty question set", () => {
    expect(extractAskRequest(block("{not json"))).toBeNull();
    expect(extractAskRequest(block(JSON.stringify({ questions: [] })))).toBeNull();
  });

  it("caps at 4 questions", () => {
    const qs = Array.from({ length: 8 }, (_, i) => ({ type: "text", text: `q${i}` }));
    const req = extractAskRequest(block(JSON.stringify({ questions: qs })));
    expect(req!.questions).toHaveLength(4);
  });
});

describe("normalizeAskRequest", () => {
  it("returns null for non-objects / missing questions array", () => {
    expect(normalizeAskRequest(null)).toBeNull();
    expect(normalizeAskRequest("x")).toBeNull();
    expect(normalizeAskRequest({})).toBeNull();
    expect(normalizeAskRequest({ questions: "nope" })).toBeNull();
  });

  it("parses single / multi / text and normalizes ids", () => {
    const req = normalizeAskRequest({
      questions: [
        { type: "single", text: "¿Motor web?", options: ["nginx", "apache"] },
        { id: "mods", type: "multi", text: "Módulos", options: ["ssl", "cache"] },
        { type: "text", text: "Dominio" },
      ],
    });
    expect(req!.questions).toHaveLength(3);
    expect(req!.questions[0]).toMatchObject({ id: "q1", type: "single", options: ["nginx", "apache"] });
    expect(req!.questions[1]).toMatchObject({ id: "mods", type: "multi" });
    expect(req!.questions[2]).toMatchObject({ type: "text" });
    expect(req!.questions[2]!.options).toBeUndefined();
  });

  it("drops single/multi without options, defaults unknown type to single, caps to 4", () => {
    const req = normalizeAskRequest({
      questions: [
        { type: "single", text: "sin opciones" },
        { type: "weird", text: "x", options: ["a"] },
      ],
    });
    expect(req!.questions).toHaveLength(1);
    expect(req!.questions[0]).toMatchObject({ type: "single", text: "x" });

    const capped = normalizeAskRequest({
      questions: Array.from({ length: 9 }, (_, i) => ({ type: "text", text: `q${i}` })),
    });
    expect(capped!.questions).toHaveLength(4);
  });

  it("caps options at 12 and drops empty strings", () => {
    const opts = Array.from({ length: 20 }, (_, i) => `o${i}`);
    const req = normalizeAskRequest({ questions: [{ type: "single", text: "x", options: ["", "  ", ...opts] }] });
    expect(req!.questions[0]!.options).toHaveLength(12);
  });

  it("returns null when no question survives", () => {
    expect(normalizeAskRequest({ questions: [] })).toBeNull();
    expect(normalizeAskRequest({ questions: [{ type: "single", text: "x" }] })).toBeNull();
  });

  it("propagates kind plan-approval and keeps only the first single question", () => {
    const req = normalizeAskRequest({
      kind: "plan-approval",
      questions: [
        { type: "single", text: "¿Apruebas?", options: ["Aprobar plan", "Pedir cambios"] },
        { type: "text", text: "extra" },
      ],
    });
    expect(req).toMatchObject({ kind: "plan-approval" });
    expect(req!.questions).toHaveLength(1);
    expect(req!.questions[0]).toMatchObject({ type: "single", options: ["Aprobar plan", "Pedir cambios"] });
  });

  it("drops kind when invalid or when the first question is not a single with options", () => {
    const invalid = normalizeAskRequest({ kind: "whatever", questions: [{ type: "text", text: "x" }] });
    expect(invalid!.kind).toBeUndefined();

    const notSingle = normalizeAskRequest({ kind: "plan-approval", questions: [{ type: "text", text: "x" }] });
    expect(notSingle!.kind).toBeUndefined();
    expect(notSingle!.questions).toHaveLength(1);
  });
});

describe("ASK_TOOL_PROMPT", () => {
  it("teaches the lxp_ask tool and forbids the sentinel block in API mode", () => {
    expect(ASK_TOOL_PROMPT).toContain("lxp_ask");
    expect(ASK_TOOL_PROMPT).toContain("DETENTE");
  });
});

describe("ASK_PROTOCOL_PROMPT", () => {
  it("warns that the native headless tools do not exist and points to the sentinel", () => {
    expect(ASK_PROTOCOL_PROMPT).toContain("AskUserQuestion");
    expect(ASK_PROTOCOL_PROMPT).toContain("ExitPlanMode");
    expect(ASK_PROTOCOL_PROMPT).toContain("<<<LXP_ASK>>>");
    expect(ASK_PROTOCOL_PROMPT).toMatch(/NUNCA intentes llamarlas/);
  });
});

describe("buildPlanModeBlock", () => {
  it("CLI: approval goes through the LXP_ASK sentinel, never the native tools", () => {
    const cli = buildPlanModeBlock("cli");
    expect(cli).toContain("<<<LXP_ASK>>>");
    expect(cli).toContain('"kind":"plan-approval"');
    expect(cli).toContain("ExitPlanMode");
    expect(cli).toContain("Plan completo:");
    expect(cli).toContain("cómo lo comprobarías");
  });

  it("API: approval goes through lxp_ask, without sentinel markers", () => {
    const api = buildPlanModeBlock("api");
    expect(api).toContain("lxp_ask");
    expect(api).toContain('"kind":"plan-approval"');
    expect(api).not.toContain("<<<");
  });

  it("PLAN_APPROVED_PROMPT tells the agent to execute without re-asking", () => {
    expect(PLAN_APPROVED_PROMPT).toContain("PLAN APROBADO");
  });
});

describe("stripAskBlock", () => {
  it("removes the block, leaving the preamble", () => {
    const text = "Necesito que elijas:\n" + block('{"questions":[{"type":"text","text":"x"}]}');
    expect(stripAskBlock(text)).toBe("Necesito que elijas:");
  });

  it("is a no-op when there is no block", () => {
    expect(stripAskBlock("hola")).toBe("hola");
  });
});
