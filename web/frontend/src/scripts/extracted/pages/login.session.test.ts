import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("/scripts/extracted/lib/i18n-client.js", () => ({
  getClientMessages: async () => ({ login: { authError: "Login failed", errors: { invalidTotpCode: "Invalid code" } } }),
}));
vi.mock("/scripts/extracted/lib/native-bridge.js", () => ({
  notifyNativeTheme() {}, notifyNativeLanguage() {}, isAppWebView: () => false,
}));

import initScript from "./login-define-vars-script1";

const bridgeKey = "panel-active-bridge-session";
const scopeKey = "panel-active-target-scope";
let response: Record<string, unknown>;
const navigate = vi.fn();

beforeEach(async () => {
  window.location.href = "/login";
  navigate.mockClear();
  (window as any).__lxpAuthNavigate = navigate;
  sessionStorage.clear();
  sessionStorage.setItem(bridgeKey, "expired-bridge");
  sessionStorage.setItem(scopeKey, "previous-server");
  sessionStorage.setItem("unrelated-preference", "keep");
  document.body.innerHTML = `<div id="login-card"></div><div id="login-error" class="hidden"></div>
    <form id="form-password"><input id="username" value="test"><input id="password" value="test"><button id="btn-password"></button></form>
    <form id="form-2fa" class="hidden"><input id="totp-code" value="123456"><button id="btn-2fa" type="button"></button></form>`;
  response = { ok: true };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(response))));
  await initScript({ locale: "es" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  document.body.innerHTML = "";
});

function submitPassword() {
  document.getElementById("form-password")!.dispatchEvent(new Event("submit", { cancelable: true }));
}

it("starts a completed login without the previous tab's server override", async () => {
  submitPassword();
  await vi.waitFor(() => expect(sessionStorage.getItem(bridgeKey)).toBeNull());
  expect(sessionStorage.getItem(scopeKey)).toBeNull();
  expect(sessionStorage.getItem("unrelated-preference")).toBe("keep");
  expect(navigate).toHaveBeenCalledWith("/", {history:"replace"});
  expect(window.location.pathname).toBe("/login");
});

it("preserves the selected server after rejected credentials", async () => {
  response = { ok: false, error: "Login failed" };
  submitPassword();
  await vi.waitFor(() => expect(document.getElementById("login-error")!.textContent).toBe("Login failed"));
  expect(sessionStorage.getItem(bridgeKey)).toBe("expired-bridge");
  expect(sessionStorage.getItem(scopeKey)).toBe("previous-server");
});

it("waits for MFA success before resetting the old server", async () => {
  response = { ok: true, mfaPending: true };
  submitPassword();
  await vi.waitFor(() => expect(document.getElementById("form-2fa")!.classList.contains("hidden")).toBe(false));
  expect(sessionStorage.getItem(bridgeKey)).toBe("expired-bridge");
  response = { ok: false };
  document.getElementById("btn-2fa")!.click();
  await vi.waitFor(() => expect(document.getElementById("login-error")!.textContent).toBe("Invalid code"));
  expect(sessionStorage.getItem(bridgeKey)).toBe("expired-bridge");
  response = { ok: true };
  document.getElementById("btn-2fa")!.click();
  await vi.waitFor(() => expect(sessionStorage.getItem(bridgeKey)).toBeNull());
  expect(sessionStorage.getItem(scopeKey)).toBeNull();
});

it("can enter the panel when session storage is blocked", async () => {
  const remove = vi.spyOn(window.sessionStorage, "removeItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  submitPassword();
  await vi.waitFor(() => expect(remove).toHaveBeenCalled());
  expect(navigate).toHaveBeenCalledWith("/", {history:"replace"});
  expect(window.location.pathname).toBe("/login");
});
