// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PanelModulesDashboard } from "./PanelModulesDashboard";

const m = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api: { get: m.get }, scopeHeaders: () => ({}) }));
vi.mock("./i18n", () => ({ useAssistantI18n: () => ({ chatTab: {} }) }));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  m.get.mockResolvedValue({ ok: true, data: [
    { id: "monitor", enabled: true },
    { id: "files", enabled: true },
    { id: "assistant", enabled: true },
  ] });
  const sidebar = document.createElement("aside");
  sidebar.id = "sidebar";
  sidebar.innerHTML = [
    '<a data-module="monitor" href="/panel/monitor" title="Monitor"><i class="ti ti-activity"></i>Monitor</a>',
    '<a data-module="assistant" href="/panel" title="Agentes IA"><i class="ti ti-robot"></i>Agentes IA</a>',
  ].join("");
  document.body.append(sidebar);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
});

it("uses the permission-filtered sidebar as the quick module source", async () => {
  await act(async () => {
    root.render(createElement(PanelModulesDashboard, {
      checkingAvailability: false,
      onOpenProviders: vi.fn(),
      onRetryAvailability: vi.fn(),
    }));
  });
  await vi.waitFor(() => {
    expect(host.querySelector('a[href="/panel/monitor"]')?.textContent).toContain("Monitor");
  });
  expect(host.querySelector('a[href="/panel/files"]')).toBeNull();
  expect(host.querySelector('a[href="/panel"]')).toBeNull();
});
