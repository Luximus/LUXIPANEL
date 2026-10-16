import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../config/env.js", () => ({ env: { LOG_LEVEL: "silent", NODE_ENV: "test", LUXIPANEL_CONFIG_DIR: "/tmp" } }));
vi.mock("../../../shared/executor/index.js", () => ({ quoteArg: (s: string) => `'${s.replaceAll("'", "'\\''")}'` }));
vi.mock("../repositories/usage.repository.js", () => ({ usageRepository: { record: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("./providers/provider-factory.js", () => ({ buildProvider: vi.fn() }));
vi.mock("./translation/translation-factory.js", () => ({ buildTranslationProvider: vi.fn() }));
import { releaseTranslatorCandidates, translateReleaseDocument, releaseCliCompletion } from "./release-translation-provider.js";
import { buildProvider } from "./providers/provider-factory.js";
import { usageRepository } from "../repositories/usage.repository.js";
import { defaultAssistantConfig } from "../models/assistant-config.types.js";

const config = () => {
  const c = defaultAssistantConfig();
  for (const slot of Object.values(c.providers)) slot.active = false;
  c.enabled = true; c.activeProvider = "minimax"; c.defaultChatProvider = "codex";
  c.translation.aiFollowActive = false; c.translation.ai = { providerId: "minimax", model: "old" };
  c.providers.codex = { active: true, mode: "cli", cli: { installed: true, loggedIn: true, model: "configured-cli-model" } };
  return c;
};
beforeEach(() => { vi.clearAllMocks(); });
it("follows enabled Settings agents and their mode/model, ignoring pinned MiniMax", () => {
  const c = config();
  expect(releaseTranslatorCandidates(c)).toEqual([{ id: "codex", mode: "cli", model: "configured-cli-model" }]);
  c.providers.codex.cli!.loggedIn = false;
  expect(releaseTranslatorCandidates(c)).toEqual([]);
  c.providers.gemini = { active: true, mode: "api", api: { apiKey: "configured", model: "selected-model" } };
  expect(releaseTranslatorCandidates(c)).toEqual([{ id: "gemini", mode: "api", model: "selected-model" }]);
  c.enabled = false; expect(releaseTranslatorCandidates(c)).toEqual([]);
});
it("uses API agents without tools, falls back after quota failure and records actual usage", async () => {
  const c = config();
  c.providers.codex = { active: true, mode: "api", api: { apiKey: "first", model: "first-model" } };
  c.providers.gemini = { active: true, mode: "api", api: { apiKey: "second", model: "second-model" } };
  vi.mocked(buildProvider).mockImplementation((_config, id) => ({
    async *run(messages: any[], options: any) {
      expect(options.tools).toEqual([]); expect(options.signal).toBeInstanceOf(AbortSignal);
      if (id === "codex") { yield { type: "error", message: "insufficient_balance" }; return; }
      yield { type: "text", delta: messages[0].content.replace("Fixed", "Corregido") };
      yield { type: "usage", model: "second-model", inputTokens: 12, outputTokens: 6 };
    },
  }) as never);
  const executor = { target: { id: "one" } } as never;
  expect(await translateReleaseDocument(c, "Fixed `keep-code()`", "es", executor, "42")).toEqual({ ok: true, text: "Corregido `keep-code()`" });
  expect(buildProvider).toHaveBeenCalledTimes(2);
  expect(usageRepository.record).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini", mode: "api", userId: "42", inputTokens: 12, estimated: false }), executor);
});
it("fails closed on duplicated or lost code placeholders", async () => {
  const c = config(); c.providers.codex = { active: true, mode: "api", api: { apiKey: "key", model: "model" } };
  vi.mocked(buildProvider).mockReturnValue({ async *run() { yield { type: "text", delta: "⟦LXP0⟧ ⟦LXP0⟧" }; } } as never);
  expect((await translateReleaseDocument(c, "Original `code`", "es", {} as never, "42")).ok).toBe(false);
});
it("runs Codex using the executor's saved login with tools/config inheritance disabled and cleans up", async () => {
  const c = config();
  const exec = vi.fn().mockResolvedValue({ exitCode: 0, stdout: '{"type":"item.completed","item":{"type":"agent_message","text":"Hola"}}\n{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":2}}', stderr: "" });
  const writeFile = vi.fn().mockResolvedValue(undefined);
  const executor = { exec, writeFile } as never;
  expect((await releaseCliCompletion(executor, releaseTranslatorCandidates(c)[0]!, c, "Translate only", "Hello", 1000)).text).toBe("Hola");
  const [command, options] = exec.mock.calls[1]!;
  expect(command).toContain('--ignore-user-config'); expect(command).toContain('--sandbox read-only');
  expect(command).toContain('--disable shell_tool'); expect(command).toContain('--disable plugins');
  expect(command).toContain('model_provider="openai"'); expect(command).toContain("configured-cli-model");
  expect(command).not.toContain("dangerously"); expect(command).not.toContain("Hello");
  expect(options.isolatedEnv).toBe(true); expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(writeFile.mock.calls[0]![2]).toEqual({ mode: 0o600 });
  expect(exec.mock.calls[2]![0]).toMatch(/^rm -rf -- '\/tmp\/lxp-release-translation-/);
});
it("never treats failed CLI output as a translation and still cleans up", async () => {
  const c = config(); const exec = vi.fn().mockResolvedValue({ exitCode: 1, stdout: "login failed", stderr: "" }).mockResolvedValueOnce({ exitCode: 0 });
  await expect(releaseCliCompletion({ exec, writeFile: vi.fn() } as never, releaseTranslatorCandidates(c)[0]!, c, "Translate", "Hello", 1000)).rejects.toThrow("CLI translation failed");
  expect(exec).toHaveBeenCalledTimes(3);
});
