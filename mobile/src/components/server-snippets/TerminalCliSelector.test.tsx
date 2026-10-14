import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../api/client", () => ({ luxAssistantProxy: api }));
vi.mock("react-native", () => ({ View: "View", Text: "Text", Pressable: "Pressable", ActivityIndicator: "Spinner" }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../theme/colors", () => ({ getThemeTokens: () => ({ border: "#444", brand: "#88f", brandDim: "#224", bgCardSolid: "#111", textPrimary: "#fff", textSecondary: "#ccc", textMuted: "#999", danger: "#f44" }) }));
vi.mock("../ui/Select", () => ({ Select: "Select" }));
vi.mock("../ui/Button", () => ({ Button: "Button" }));
import { TerminalCliSelector } from "./TerminalCliSelector";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => api.mockReset());
it("registers a discovered CLI before selecting it for new terminal sessions", async () => {
  api.mockImplementation(async (_panel: string, _token: string, method: string, path: string) => {
    if (method === "GET" && path?.endsWith("/state")) return { data: { installed: ["default"], active: "default" } };
    if (method === "GET" && path?.endsWith("/probe")) return { data: { codex: true, grok: false } };
    if (path?.endsWith("/installed")) return { data: { installed: ["default", "codex"], active: "default" } };
    return { data: { installed: ["default", "codex"], active: "codex" } };
  });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<TerminalCliSelector panelId="box" token="token" language="es" />); });
  expect(tree.root.findByType("Select" as any).props.options.map((option:any)=>option.label)).toEqual(["Default", "Codex CLI"]);
  await act(async () => tree.root.findByType("Select" as any).props.onChange("codex"));
  expect(api.mock.calls.filter((call) => call[2] === "POST").map((call) => call[3])).toEqual(["/api/terminal-cli/installed", "/api/terminal-cli/active"]);
  await act(async () => tree.unmount());
});

it("cierra onboarding antiguo y vuelve a Bash si el CLI guardado falta", async () => {
  api.mockImplementation(async (_panel: string, _token: string, method: string, path: string) => {
    if (method === "GET" && path?.endsWith("/state")) return { data: { installed: ["default", "grok"], active: "grok", onboardingDone: false } };
    if (method === "GET" && path?.endsWith("/probe")) return { data: { grok: false, codex: true } };
    if (path?.endsWith("/skip")) return { data: { installed: ["default", "grok"], active: "grok", onboardingDone: true } };
    return { data: { installed: ["default", "grok"], active: "default", onboardingDone: true } };
  });
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<TerminalCliSelector panelId="box" token="token" language="es" />); });
  expect(api.mock.calls.filter((call) => call[2] === "POST").map((call) => call[3])).toEqual(["/api/terminal-cli/onboarding/skip", "/api/terminal-cli/active"]);
  expect(tree.root.findByType("Select" as any).props.value).toBe("default");
  await act(async () => tree.unmount());
});
