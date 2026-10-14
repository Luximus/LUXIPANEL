// @vitest-environment happy-dom
import { act, createElement, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ChatTab } from "./ChatTab";
import { chatUiState } from "./chat-ui-state";
import type { AssistantConfigState } from "./assistant-api";

let nextBarId = 0;
vi.mock("./ChatPane", () => ({
  ChatPane: ({ provider, active, mobileProviderNav }: {
    provider: string;
    active: boolean;
    mobileProviderNav: { onSelect(id: string): void };
  }) => createElement("button", {
    type: "button",
    "data-pane": provider,
    "data-active": String(active),
    onClick: () => mobileProviderNav.onSelect(provider === "claude" ? "codex" : "claude"),
  }, provider),
}));
vi.mock("./CliUsageBars", () => ({
  CliUsageBars: ({ provider }: { provider: string }) => {
    const instance = useRef(++nextBarId);
    return createElement("div", { "data-usage-provider": provider, "data-instance": instance.current });
  },
}));
vi.mock("./i18n", () => ({ useAssistantI18n: () => ({ chatTab: {} }) }));
vi.mock("@/components/ui/ViewTransition", () => ({
  useViewDirection: () => 0,
  useViewEnterReplay: () => ({ current: null }),
}));

const config = {
  enabled: true,
  activeProvider: "claude",
  providers: {
    claude: { active: true, mode: "cli" },
    codex: { active: true, mode: "cli" },
  },
} as AssistantConfigState;

afterEach(() => {
  chatUiState.setActiveProvider(null);
  document.body.replaceChildren();
});

it("shows usage for the provider selected in chat and remounts its bar", async () => {
  chatUiState.setActiveProvider("claude");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(ChatTab, { enabled: true, config, onOpenProviders: vi.fn() })); });
  const first = host.querySelector("[data-usage-provider]")!;
  expect(first.getAttribute("data-usage-provider")).toBe("claude");
  expect(host.querySelector('[data-pane="codex"]')).toBeNull();
  const originalPane = host.querySelector('[data-pane="claude"]');

  await act(async () => {
    (host.querySelector('[data-pane="claude"]') as HTMLButtonElement).click();
  });
  const second = host.querySelector("[data-usage-provider]")!;
  expect(second.getAttribute("data-usage-provider")).toBe("codex");
  expect(second.getAttribute("data-instance")).not.toBe(first.getAttribute("data-instance"));
  expect(host.querySelector('[data-pane="codex"]')?.getAttribute("data-active")).toBe("true");
  expect(host.querySelector('[data-pane="claude"]')).toBe(originalPane);
  expect(host.querySelector('[data-pane="claude"]')?.getAttribute("data-active")).toBe("false");
  await act(async () => { root.unmount(); });
});

it("selects the requested provider when configuration arrives after the request", async () => {
  chatUiState.setActiveProvider("claude");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const props = { enabled: true, onOpenProviders: vi.fn(), openReq: {
    kind: "new-assistant" as const,
    provider: "codex" as const,
    requestId: "process-742",
    prompt: "Explica el PID 742",
    submit: "auto" as const,
    nonce: 1,
  } };
  await act(async () => { root.render(createElement(ChatTab, { ...props, config: null })); });
  await act(async () => { root.render(createElement(ChatTab, { ...props, config })); });
  expect(host.querySelector("[data-usage-provider]")?.getAttribute("data-usage-provider")).toBe("codex");
  expect(host.querySelector('[data-pane="codex"]')?.getAttribute("data-active")).toBe("true");
  await act(async () => { root.unmount(); });
});
