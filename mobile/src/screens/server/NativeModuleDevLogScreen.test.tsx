import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ call: vi.fn(async () => ({ ok: true, data: {} })), reload: vi.fn() }));
vi.mock("react-native", () => ({ View: "View", Linking: { openURL: vi.fn() } }));
vi.mock("../../components/ui/PanelText", () => ({ PanelText: "Text" }));
vi.mock("../../components/ui/Button", () => ({ Button: "Button" }));
vi.mock("../../components/ui/SegmentedControl", () => ({ SegmentedControl: "Tabs" }));
vi.mock("../../components/server/ServerModuleScreen", () => ({ ServerModuleScreen: "Screen" }));
vi.mock("./NativeOperationCard", () => ({ NativeOperationCard: "Operation" }));
vi.mock("./NativeModuleDevTools", () => ({ configFields: [] }));
vi.mock("../../hooks/useTheme", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("../../theme/colors", () => ({ getThemeTokens: () => ({}) }));
vi.mock("../../i18n/native-text", () => ({ nativeText: (text: string) => text }));
vi.mock("../../api/serverApi", () => ({ callServerApi: mocks.call }));
vi.mock("../../hooks/useServerApi", () => ({ useServerResource: (_fetch: unknown, deps: string[]) => ({
  data: deps.length === 2 ? { ready: true, components: ["luxipanel", "my-module"], policyPrefix: "user:module:", issues: [], config: {} } :
    _fetch!.toString().includes("repairs") ? [] : { items: [{ id: deps[2] === "modules" ? "module-failure" : "core-failure", severity: "error", module: "test", message: "Failure", count: 1 }] },
  reload: mocks.reload, loading: false, error: "",
}) }));
import { NativeModuleDevLogScreen } from "./NativeModuleDevLogScreen";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
const props = { panelId: "panel-a", token: "session-a", onBack: vi.fn() };
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.clearAllMocks(); });
const button = (label: string) => tree!.root.findAllByType("Button" as any).find(node => node.props.label === label)!;
it("sends module corrections and reports to the selected LOG view and server", async () => {
  await act(async () => { tree = create(<NativeModuleDevLogScreen {...props}/>); });
  await act(async () => tree!.root.findByType("Tabs" as any).props.onChange("modules"));
  await act(async () => button("Corregir").props.onPress());
  expect(mocks.call).toHaveBeenCalledWith("panel-a", "session-a", "POST", "/api/module-dev/logs/repairs?view=modules", { incidentId: "module-failure" });
  await act(async () => button("Reportar").props.onPress());
  expect(mocks.call).toHaveBeenCalledWith("panel-a", "session-a", "POST", "/api/module-dev/logs/incidents/module-failure/report?view=modules", {});
});
it("clears the old incident details when switching LOG tabs", async () => {
  await act(async () => { tree = create(<NativeModuleDevLogScreen {...props}/>); });
  await act(async () => button("Ver detalle").props.onPress());
  expect(tree!.root.findAllByType("Operation" as any).some(node => node.props.readPath === "/api/module-dev/logs/incidents/core-failure?view=luxipanel")).toBe(true);
  await act(async () => tree!.root.findByType("Tabs" as any).props.onChange("modules"));
  expect(tree!.root.findAllByType("Operation" as any)).toHaveLength(0);
});
it("ignores a correction response that belongs to a previously selected server", async () => {
  let finish: (response: any) => void = () => {};
  mocks.call.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { tree = create(<NativeModuleDevLogScreen {...props}/>); });
  await act(async () => button("Corregir").props.onPress());
  await act(async () => tree!.update(<NativeModuleDevLogScreen {...props} panelId="panel-b" token="session-b"/>));
  await act(async () => finish({ ok: false, error: "Old server response" }));
  expect(tree!.root.findAllByType("Text" as any).some(node => node.children.includes("Old server response"))).toBe(false);
  expect(mocks.reload).not.toHaveBeenCalled();
});
