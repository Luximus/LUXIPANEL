import { describe, expect, it } from "vitest";
import { resolveAgentRunModel, resolveAgentRunProvider } from "./assistant-config.types.js";

describe("agent run provider selection", () => {
  it("routes a selected Codex model to Codex in a Claude agent chat", () => {
    expect(resolveAgentRunProvider("codex", "gpt-6-sol", "claude")).toBe("codex");
  });

  it("routes an explicit provider even with the automatic model", () => {
    expect(resolveAgentRunProvider("codex", undefined, "claude")).toBe("codex");
  });

  it("uses the agent provider when no provider was requested", () => {
    expect(resolveAgentRunProvider(undefined, "gpt-6-sol", "claude")).toBe("claude");
    expect(resolveAgentRunProvider(undefined, undefined, "claude")).toBe("claude");
  });

  it("does not send a Claude agent model to Codex when the provider changes", () => {
    expect(resolveAgentRunModel(undefined, "claude-sonnet-5", "codex", "claude")).toBeUndefined();
    expect(resolveAgentRunModel("gpt-6-sol", "claude-sonnet-5", "codex", "claude")).toBe("gpt-6-sol");
    expect(resolveAgentRunModel(undefined, "claude-sonnet-5", "claude", "claude")).toBe("claude-sonnet-5");
  });
});
