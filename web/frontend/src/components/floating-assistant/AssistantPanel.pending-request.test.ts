// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import AssistantPanel from "./AssistantPanel";

vi.mock("@/i18n/client", () => ({ getClientMessages: async () => ({ assistant: {}, components: {} }) }));
vi.mock("./assistant-api", () => ({
  PROVIDER_ORDER: ["gemini", "codex"],
  assistantApi: {
    getConfig: async () => ({ enabled: true, activeProvider: "codex", providers: {
      gemini: { active: true, mode: "api" }, codex: { active: true, mode: "api" },
    } }),
  },
}));
vi.mock("./ChatTab", () => ({
  ChatTab: ({ openReq }: { openReq?: unknown }) =>
    createElement("div", { "data-open-request": openReq ? JSON.stringify(openReq) : "" }),
}));
vi.mock("./AssistantSettingsModal", () => ({ AssistantSettingsModal: () => null }));

afterEach(() => { document.body.replaceChildren(); });

it("waits for providers, then routes the chosen provider and auto-send prompt to chat", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const consumed = vi.fn();
  await act(async () => {
    root.render(createElement(AssistantPanel, {
      locale: "es", variant: "drawer",
      pendingRequest: { requestId: "process-742", prompt: "Explica el PID 742", submit: "auto", providerId: "gemini", serverEntries: [{ path: "/srv/app", isDir: true }] },
      onPendingRequestConsumed: consumed,
    }));
  });
  const request = JSON.parse(host.querySelector("[data-open-request]")?.getAttribute("data-open-request") || "null");
  expect(request).toMatchObject({ kind: "new-assistant", provider: "gemini",
    requestId: "process-742", prompt: "Explica el PID 742", submit: "auto", serverEntries: [{ path: "/srv/app", isDir: true }] });
  expect(consumed).toHaveBeenCalledTimes(1);
  await act(async () => { root.unmount(); });
});
