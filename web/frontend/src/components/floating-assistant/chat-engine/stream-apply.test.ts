import { afterEach, expect, it } from "vitest";
import { applyEvent } from "./stream-apply";
import { chats } from "./state";

const key = "cli-tool-output-test";

afterEach(() => chats.delete(key));

it("keeps a module result in its tool disclosure until the CLI answer arrives", () => {
  chats.set(key, {
    provider: "claude",
    conversationId: key,
    streaming: true,
    turns: [{
      role: "assistant",
      text: "",
      pending: true,
      tools: [
        { id: "cli-1", name: "claude.cli", input: {} },
        { id: "browser-1", name: "browser.check", input: {} },
      ],
    }],
  });

  const ctx = { isCli: true, startedAt: Date.now() };
  const output = '{"httpStatus":200,"finalUrl":"https://example.test"}';
  applyEvent(key, { type: "tool_result", id: "browser-1", success: true, output }, ctx);
  expect(chats.get(key)?.turns[0]?.text).toBe("");
  expect(chats.get(key)?.turns[0]?.tools[1]?.result?.output).toBe(output);

  applyEvent(key, { type: "tool_result", id: "cli-1", success: true, output: "Página verificada." }, ctx);
  expect(chats.get(key)?.turns[0]?.text).toBe("Página verificada.");
});

it("records API tool boundaries without altering text or advancing on replay", () => {
  chats.set(key, { provider: "openai", conversationId: key, streaming: true,
    turns: [{ role: "assistant", text: "", pending: true, tools: [] }] });
  const ctx = { isCli: false, startedAt: Date.now() };
  const narration = "Reviso el archivo.\n\n";
  applyEvent(key, { type: "text", delta: narration }, ctx);
  const firstCall = { type: "tool_use" as const, id: "read-1", name: "files.read", input: { path: "sample.txt" } };
  applyEvent(key, firstCall, ctx);
  expect(chats.get(key)?.turns[0]?.apiTextOffset).toBe(narration.length);
  applyEvent(key, { type: "tool_result", id: "read-1", success: true, output: "Contenido original" }, ctx);
  const update = "Ahora verifico.\n\n";
  applyEvent(key, { type: "text", delta: update }, ctx);
  applyEvent(key, firstCall, ctx);
  expect(chats.get(key)?.turns[0]?.apiTextOffset).toBe(narration.length);
  const lastCall = { ...firstCall, id: "read-2" };
  applyEvent(key, lastCall, ctx);
  applyEvent(key, { type: "tool_result", id: "read-2", success: true, output: "Comprobación original" }, ctx);
  const answer = "Comprobación terminada.\n\nSegundo párrafo final.";
  applyEvent(key, { type: "text", delta: answer }, ctx);
  applyEvent(key, lastCall, ctx);
  applyEvent(key, { type: "done" }, ctx);
  const turn = chats.get(key)!.turns[0]!;
  expect(turn.text).toBe(narration + update + answer);
  expect(turn.text.slice(turn.apiTextOffset)).toBe(answer);
  expect(turn.tools).toHaveLength(2);
  expect(turn.tools.map(tool => tool.result?.output)).toEqual(["Contenido original", "Comprobación original"]);
  expect(turn.pending).toBe(false);
});

it("does not split plain API answers or CLI narration using API boundaries", () => {
  for (const isCli of [false, true]) {
    chats.set(key, { provider: "codex", conversationId: key, streaming: true,
      turns: [{ role: "assistant", text: "Texto conservado", pending: true, tools: [] }] });
    const ctx = { isCli, startedAt: Date.now() };
    if (isCli) applyEvent(key, { type: "tool_use", id: "cli", name: "codex.cli", input: {} }, ctx);
    applyEvent(key, { type: "done" }, ctx);
    expect(chats.get(key)?.turns[0]?.apiTextOffset).toBeUndefined();
    expect(chats.get(key)?.turns[0]?.text).toBe("Texto conservado");
  }
});
