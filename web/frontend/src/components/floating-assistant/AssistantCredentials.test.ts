// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";
import { AssistantI18nProvider, mergeAssistantMessages } from "./i18n";
import { assistantApi, assistantCliApi, type AssistantConfigState } from "./assistant-api";
import { GeneralTab } from "./GeneralTab";
import { CredentialSections } from "../workspace/credentials/AssistantCredentialSettings";

vi.mock("../workspace/view-context", () => ({
  useViewContext: () => ({ messages: { settings: { credentials: { title: "Credenciales", error: "Error" } } } }),
}));
vi.mock("./NotifySettings", () => ({ NotifySettings: () => null }));
vi.mock("./SkillsSettings", () => ({ SkillsSettings: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const provider = (active = false) => ({
  mode: "cli" as const,
  active,
  api: { hasApiKey: true, apiKeyHint: "••••1234", model: "gpt-6-sol" },
  cli: { installed: false, loggedIn: false },
});

function config(): AssistantConfigState {
  return {
    enabled: true,
    activeProvider: "minimax",
    defaultChatProvider: "codex",
    defaultChatModel: "gpt-6-sol",
    providers: {
      claude: provider(), codex: provider(true), gemini: provider(),
      deepseek: provider(), grok: provider(), minimax: provider(),
    },
    voice: { enabled: true, capabilities: { stt: "openai", tts: "openai" } },
  } as AssistantConfigState;
}

it("keeps the OpenAI key in Credentials and saves it without changing CLI mode", async () => {
  vi.spyOn(assistantCliApi, "specs").mockResolvedValue([]);
  const state = config();
  const save = vi.spyOn(api, "put").mockResolvedValue({ ok: true, status: 200, data: { config: state } } as never);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(AssistantI18nProvider, { value: mergeAssistantMessages({}), children:
    createElement(CredentialSections, { config: state, onChange: vi.fn() }),
  })));
  const providerSelect = host.querySelector('select[aria-label="Proveedores"]') as HTMLSelectElement;
  expect(providerSelect?.value).toBe("codex");
  expect(host.textContent).toContain("El audio usa la clave API de OpenAI");
  const keyInput = host.querySelector('input[type="password"]') as HTMLInputElement;
  expect(keyInput).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(keyInput, "new-openai-key");
    keyInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => (Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Guardar") as HTMLButtonElement).click());
  expect(save).toHaveBeenCalledWith("/api/ai/config/providers/codex", { api: { apiKey: "new-openai-key" } });
  await act(async () => root.unmount());
});

it("keeps model and audio preferences in General without credential fields", async () => {
  const patchConfig = vi.spyOn(assistantApi, "patchConfig").mockResolvedValue(config());
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(AssistantI18nProvider, { value: mergeAssistantMessages({}), children:
    createElement(GeneralTab, { config: config(), onConfigChange: vi.fn() }),
  })));
  expect(host.querySelector('#lxp-assistant-default-chat-model')).not.toBeNull();
  expect(host.textContent).toContain("Selección automática de modelo");
  expect(host.textContent).toContain("Voz (audio)");
  expect(host.querySelector('input[type="password"]')).toBeNull();
  expect(host.textContent).not.toContain("clave API");
  const voiceSelect = Array.from(host.querySelectorAll("select")).find(select => select.querySelector('option[value="nova"]')) as HTMLSelectElement;
  await act(async () => {
    voiceSelect.value = "nova";
    voiceSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(patchConfig).toHaveBeenCalledWith({ voice: { voice: "nova" } });
  await act(async () => root.unmount());
});
