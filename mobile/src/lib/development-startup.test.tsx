import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { formatDevelopmentError } from "./development-errors";
import { createDevelopmentRoot } from "./development-startup";

const mocks = vi.hoisted(() => ({ reload: vi.fn(), openURL: vi.fn(async () => {}) }));
vi.mock("react-native", () => ({
  DevSettings: { reload: mocks.reload }, Linking: { openURL: mocks.openURL },
  ScrollView: "ScrollView", View: "View", Text: "Text", Pressable: "Pressable", StyleSheet: { create: (value: unknown) => value },
}));
let tree: ReactTestRenderer | undefined;
let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.stubGlobal("__DEV__", true); vi.clearAllMocks();
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const display = () => JSON.stringify(tree!.toJSON());

it("registers a usable root after an unavailable native import and reports the actual error", async () => {
  vi.stubEnv("EXPO_PUBLIC_DEVELOPMENT_APK_URL", "https://downloads.example.org/client.apk");
  const error = new Error("Native RNSkia Module cannot be found!");
  const Root = createDevelopmentRoot(() => { throw error; });
  await act(async () => { tree = create(<Root />); });
  expect(logged).toHaveBeenCalledWith("[LUXIPANEL import startup]", error);
  expect(display()).toContain(error.message);
  expect(display()).toContain("Descargar cliente de desarrollo");
  const buttons = tree!.root.findAllByType("Pressable" as any);
  await act(async () => buttons[0].props.onPress());
  expect(mocks.openURL).toHaveBeenCalledWith("https://downloads.example.org/client.apk");
  buttons[1].props.onPress(); expect(mocks.reload).toHaveBeenCalledOnce();
});
it("keeps the diagnostic and retry available without a download URL", async () => {
  vi.stubEnv("EXPO_PUBLIC_DEVELOPMENT_APK_URL", "");
  const Root = createDevelopmentRoot(() => { throw new Error("Native RNSkia Module cannot be found!"); });
  await act(async () => { tree = create(<Root />); });
  expect(display()).toContain("RNSkia");
  expect(display()).not.toContain("Descargar cliente de desarrollo");
  tree!.root.findByType("Pressable" as any).props.onPress();
  expect(mocks.reload).toHaveBeenCalledOnce();
});
it("reports render errors and preserves a visible diagnostic instead of losing the root", async () => {
  const error = new Error("Login render failed");
  function Broken(): React.ReactNode { throw error; }
  const Root = createDevelopmentRoot(() => Broken);
  await act(async () => { tree = create(<Root />); });
  expect(logged).toHaveBeenCalledWith("[LUXIPANEL render startup]", error);
  expect(display()).toContain("Login render failed");
  expect(display()).not.toContain("Descargar cliente de desarrollo");
});
it("keeps the working login mounted and its form state intact", async () => {
  let mounts = 0;
  function Login() { const [draft, setDraft] = React.useState(""); React.useEffect(() => { mounts++; }, []); return React.createElement("Form", { draft, setDraft }); }
  const Root = createDevelopmentRoot(() => Login);
  await act(async () => { tree = create(<Root />); });
  await act(async () => tree!.root.findByType("Form" as any).props.setDraft("login draft"));
  expect(tree!.root.findByType("Form" as any).props.draft).toBe("login draft"); expect(mounts).toBe(1);
});
it("never runs the recovery wrapper in production", () => {
  vi.stubGlobal("__DEV__", false); const load = vi.fn();
  expect(() => createDevelopmentRoot(load)).toThrow("must not run in production"); expect(load).not.toHaveBeenCalled();
});
it("removes URL query credentials and JWTs and omits object payloads", () => {
  const formatted = formatDevelopmentError(new Error("at https://server.test/index.bundle?token=secret-token eyJabc.def.ghi"));
  expect(formatted).not.toContain("secret-token"); expect(formatted).not.toContain("eyJabc.def.ghi");
  expect(formatted).toContain("https://server.test/index.bundle");
  expect(formatDevelopmentError({ password: "secret" })).not.toContain("secret");
});
