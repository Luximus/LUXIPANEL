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
