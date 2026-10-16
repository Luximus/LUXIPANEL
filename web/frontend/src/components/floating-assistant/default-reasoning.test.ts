// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GeneralTab } from "./GeneralTab";
import { assistantApi, type AssistantConfigState } from "./assistant-api";
import { uiPrefs } from "./ui-prefs";
import { normalizeReasoningEffort } from "./reasoning-effort";
vi.mock("./AssistantPreferences", () => ({ AssistantPreferences: () => null }));
let root: Root;
const config = { defaultChatProvider: "codex", defaultChatModel: "gpt-6-astra", defaultChatEffort: "", providers: { codex: { active: true } } } as AssistantConfigState;
function View() {
  const [state, setState] = useState(config);
  return createElement(GeneralTab, { config: state, onConfigChange: setState });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  uiPrefs.set({ defaultChatEffort: "" });
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks(); document.body.replaceChildren();
});
async function select(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLSelectElement>("#lxp-assistant-default-chat-effort")!;
    input.value = value; input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
it("places reasoning after the model and persists both a level and Auto", async () => {
  const save = vi.spyOn(assistantApi, "patchConfig").mockImplementation(async patch => ({ ...config, ...patch }));
  await act(async () => root.render(createElement(View)));
  const model = document.querySelector("#lxp-assistant-default-chat-model")!;
  const effort = document.querySelector<HTMLSelectElement>("#lxp-assistant-default-chat-effort")!;
  expect(model.parentElement?.nextElementSibling).toBe(effort.parentElement);
  expect([...effort.options].map(option => option.value)).toEqual(["", "low", "medium", "high", "xhigh"]);
  await select("high");
  expect(save).toHaveBeenCalledWith({ defaultChatEffort: "high" });
  expect(effort.value).toBe("high"); expect(uiPrefs.get().defaultChatEffort).toBe("high");
  await select("");
  expect(effort.value).toBe(""); expect(uiPrefs.get().defaultChatEffort).toBe("");
});
it("reports failed persistence without changing the saved preference", async () => {
  vi.spyOn(assistantApi, "patchConfig").mockRejectedValue(new Error("offline"));
  await act(async () => root.render(createElement(View)));
  await select("xhigh");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("No se pudo guardar");
  expect(uiPrefs.get().defaultChatEffort).toBe("");
  expect(document.querySelector<HTMLSelectElement>("#lxp-assistant-default-chat-effort")!.value).toBe("");
});
it("normalizes missing and invalid preferences to Auto", () => {
  expect(normalizeReasoningEffort(undefined)).toBe("");
  expect(normalizeReasoningEffort("invalid")).toBe("");
  expect(normalizeReasoningEffort("xhigh")).toBe("xhigh");
});
