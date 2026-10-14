// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { requestAssistant, resetAssistantRequestBus } from "@/lib/assistant-request";
import FloatingAssistantDrawer from "./FloatingAssistantDrawer";

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  DrawerContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
  DrawerTitle: ({ children }: { children: ReactNode }) => createElement("span", null, children),
}));
vi.mock("@/lib/use-namespace-messages", () => ({
  useNamespaceMessages: (_locale: unknown, _namespace: unknown, fallback: unknown) => fallback,
}));
vi.mock("@/lib/use-module-gate", () => ({
  useModuleGate: () => ({ enabled: true, showFloatingButton: false }),
}));
vi.mock("@/lib/panel-routes", () => ({ pathIsAssistantView: () => false }));
vi.mock("./AssistantPanel", () => ({
  default: ({ pendingRequest }: { pendingRequest?: { requestId: string; prompt: string; providerId: string | null; submit: string } }) =>
    createElement("div", { "data-request": pendingRequest ? JSON.stringify(pendingRequest) : "" }),
}));

afterEach(() => {
  resetAssistantRequestBus();
  delete window.__lxpAssistantAPI;
  document.body.replaceChildren();
});

it("hands a provider choice to the drawer once with auto submit intact", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(createElement(FloatingAssistantDrawer, { locale: "es" })); });

  let id = "";
  await act(async () => {
    id = requestAssistant({ kind: "prompt", prompt: "Explica el PID 742", submit: "auto",
      providerId: "gemini", origin: { module: "monitor", action: "explainProcess" } });
  });
  const handoff = JSON.parse(host.querySelector("[data-request]")?.getAttribute("data-request") || "null");
  expect(handoff).toEqual({ requestId: id, prompt: "Explica el PID 742", submit: "auto", providerId: "gemini" });

  await act(async () => { root.unmount(); });
});
