// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  window.sessionStorage.clear();
  vi.resetModules();
});

it("restores each chat's model and effort after a page reload", async () => {
  vi.resetModules();
  const { chatUiState } = await import("./chat-ui-state");
  chatUiState.patchConversationChoice("codex", "chat-a", { model: "gpt-6-sol", effort: "High" });
  chatUiState.patchConversationChoice("codex", "chat-b", { model: "", effort: "Low" });
  chatUiState.patchConversationChoice("claude", "chat-a", { model: "claude-opus-4-8", effort: "Auto" });

  vi.resetModules();
  const { chatUiState: reloaded } = await import("./chat-ui-state");
  expect(reloaded.getConversationChoice("codex", "chat-a")).toEqual({ model: "gpt-6-sol", effort: "High" });
  expect(reloaded.getConversationChoice("codex", "chat-b")).toEqual({ model: "", effort: "Low" });
  expect(reloaded.getConversationChoice("claude", "chat-a")).toEqual({ model: "claude-opus-4-8", effort: "Auto" });
});

it("transfers a new chat's picks to its saved id and clears them on target switch", async () => {
  vi.resetModules();
  const { chatUiState } = await import("./chat-ui-state");
  chatUiState.patchConversationChoice("codex", null, { model: "gpt-6-sol", effort: "Medium" });
  chatUiState.moveNewConversationChoice("codex", "saved-chat");
  expect(chatUiState.getConversationChoice("codex", "saved-chat")).toEqual({ model: "gpt-6-sol", effort: "Medium" });
  expect(chatUiState.getConversationChoice("codex", null)).toBeNull();

  window.dispatchEvent(new Event("luxipanel:target-changed"));
  expect(chatUiState.getConversationChoice("codex", "saved-chat")).toBeNull();
});
