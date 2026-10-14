// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import {
  createCodexStreamTransformer,
  parseCodexFinalAnswer,
  parseCodexUsage,
  createGeminiStreamTransformer,
  parseGeminiFinalAnswer,
  parseGeminiUsage,
} from "./cli-stream-format.js";

// A representative `codex exec --json` log (one JSON object per line), including
// the stderr banner lines codex interleaves on a non-TTY run.
const CODEX_LOG = [
  "Reading additional input from stdin...",
  '{"type":"thread.started","thread_id":"019ee199-8398-7be0-8c67-01ea9fe80e5e"}',
  '{"type":"turn.started"}',
  '{"type":"item.started","item":{"id":"item_0","type":"command_execution","command":"/bin/bash -lc \'echo hi\'","status":"in_progress"}}',
  '{"type":"item.completed","item":{"id":"item_0","type":"command_execution","command":"/bin/bash -lc \'echo hi\'","aggregated_output":"hi\\n","exit_code":0,"status":"completed"}}',
  '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"It printed hi."}}',
  '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":400,"output_tokens":20,"reasoning_output_tokens":5}}',
].join("\n") + "\n";

describe("codex stream format", () => {
  it("transforms the JSON stream into readable terminal lines (chunk-agnostic)", () => {
    // Feed in awkward 13-char chunks to prove the line buffering is robust.
    const tf = createCodexStreamTransformer();
    let out = "";
    for (let i = 0; i < CODEX_LOG.length; i += 13) out += tf(CODEX_LOG.slice(i, i + 13));
    // ANSI-strip for assertions.
    // eslint-disable-next-line no-control-regex
    const plain = out.replace(/\[[0-9;?]*[ -/]*[@-~]/g, "");
    expect(plain).toContain("● Codex");
    expect(plain).toContain("⏺ bash");
    expect(plain).toContain("echo hi");
    expect(plain).toContain("⎿ hi");
    expect(plain).toContain("It printed hi.");
    // Non-JSON banner lines are kept (dimmed), never crash the parser.
    expect(plain).toContain("Reading additional input");
    // turn.* control events produce no visible text.
    expect(plain).not.toContain("turn.completed");
  });

  it("extracts the last agent_message as the clean final answer", () => {
    expect(parseCodexFinalAnswer(CODEX_LOG)).toBe("It printed hi.");
  });

  it("returns the latest agent_message when several are emitted", () => {
    const log =
      CODEX_LOG +
      '{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"Final word."}}\n';
    expect(parseCodexFinalAnswer(log)).toBe("Final word.");
  });

  it("parses real usage, folding cache reads to 0.1x and counting reasoning as output", () => {
    // input: (1000-400) + round(400*0.1) = 600 + 40 = 640; output: 20 + 5 = 25
    expect(parseCodexUsage(CODEX_LOG)).toEqual({ inputTokens: 640, outputTokens: 25 });
  });

  it("returns null usage when no turn.completed is present", () => {
    expect(parseCodexUsage('{"type":"thread.started","thread_id":"x"}\n')).toBeNull();
  });

  it("never throws on malformed / empty input", () => {
    expect(() => createCodexStreamTransformer()("not json\n{bad\n")).not.toThrow();
    expect(parseCodexFinalAnswer("")).toBe("");
    expect(parseCodexUsage("garbage\n")).toBeNull();
  });
});

// A representative `gemini -o stream-json` log (from the CLI's StreamJsonFormatter).
const GEMINI_LOG = [
  '{"type":"init","timestamp":"2026-06-19T20:00:00.000Z"}',
  '{"type":"message","role":"user","content":"run echo hi"}',
  '{"type":"tool_use","tool_name":"run_shell_command","tool_id":"t1","parameters":{"command":"echo hi"}}',
  '{"type":"tool_result","tool_id":"t1","status":"success","output":"hi\\n"}',
  '{"type":"message","role":"assistant","content":"It printed hi."}',
  '{"type":"result","status":"success","stats":{"input_tokens":1000,"output_tokens":20,"cached":400,"total_tokens":1020}}',
].join("\n") + "\n";

describe("gemini stream format", () => {
  it("transforms the stream-json into readable terminal lines (chunk-agnostic)", () => {
    const tf = createGeminiStreamTransformer();
    let out = "";
    for (let i = 0; i < GEMINI_LOG.length; i += 17) out += tf(GEMINI_LOG.slice(i, i + 17));
    // eslint-disable-next-line no-control-regex
    const plain = out.replace(/\[[0-9;?]*[ -/]*[@-~]/g, "");
    expect(plain).toContain("● Gemini");
    expect(plain).toContain("⏺ run_shell_command");
    expect(plain).toContain("echo hi");
    expect(plain).toContain("⎿ hi");
    expect(plain).toContain("It printed hi.");
    // The echoed user message must NOT be shown as model output.
    expect(plain).not.toContain("run echo hi");
  });

  it("extracts the assistant message(s) as the clean final answer", () => {
    expect(parseGeminiFinalAnswer(GEMINI_LOG)).toBe("It printed hi.");
    // Multiple assistant chunks concatenate.
    const log =
      '{"type":"message","role":"assistant","content":"Part one. "}\n' +
      '{"type":"message","role":"assistant","content":"Part two."}\n';
    expect(parseGeminiFinalAnswer(log)).toBe("Part one. Part two.");
  });

  it("parses usage from result stats, folding cache reads to 0.1x", () => {
    // input: (1000-400) + round(400*0.1) = 640; output: 20
    expect(parseGeminiUsage(GEMINI_LOG)).toEqual({ inputTokens: 640, outputTokens: 20 });
  });

  it("returns null usage when no result event is present", () => {
    expect(parseGeminiUsage('{"type":"message","role":"assistant","content":"hi"}\n')).toBeNull();
  });

  it("never throws on malformed / empty input", () => {
    expect(() => createGeminiStreamTransformer()("not json\n{bad\n")).not.toThrow();
    expect(parseGeminiFinalAnswer("")).toBe("");
    expect(parseGeminiUsage("garbage\n")).toBeNull();
  });
});

describe("Codex final phases", () => {
  const item = (phase: string, text: string) => JSON.stringify({ type: "item.completed", item: { type: "agent_message", phase, text } });
  it("never promotes commentary to a final answer", () => {
    expect(parseCodexFinalAnswer(item("commentary", "Estoy trabajando"))).toBe("");
  });
  it("retains the confirmed final instead of later commentary", () => {
    expect(parseCodexFinalAnswer([item("final_answer", "Hecho"), item("commentary", "diagnóstico")].join("\n"))).toBe("Hecho");
  });
  it("rejects a failed turn even if an answer was emitted", () => {
    expect(parseCodexFinalAnswer(item("final_answer", "Hecho") + '\n{"type":"turn.failed"}')).toBe("");
  });
});
