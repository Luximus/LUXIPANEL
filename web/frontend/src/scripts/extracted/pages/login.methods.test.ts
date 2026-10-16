import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("/scripts/extracted/lib/i18n-client.js", () => ({getClientMessages: async () => ({login: {authError: "Login failed", errors: {invalidTotpCode: "Invalid code"}}})}));
vi.mock("/scripts/extracted/lib/native-bridge.js", () => ({notifyNativeTheme() {}, notifyNativeLanguage() {}, isAppWebView: () => false}));
import initScript from "./login-define-vars-script1";
const methods = ["password", "passkey", "recovery"] as const;
const request = vi.fn();
function render(mask: number) {
 document.body.innerHTML = `<div id="login-card" ${methods.map((m, i) => `data-allow-${m}="${Boolean(mask & (1 << i))}"`).join(" ")}></div>
 <div id="login-error" class="hidden"></div><div id="login-method-tabs">
 ${methods.map(m => `<button type="button" id="tab-${m}" class="method-tab" data-method="${m}"></button>`).join("")}</div>
 ${methods.map(m => `<form id="form-${m}" class="method-form"><input id="${m === "password" ? "username" : `${m}-username`}" value="test"><button type="button" id="btn-${m}"></button></form>`).join("")}
 <input id="password" value="test"><input id="recovery-code" value="ABCD-EFGH-IJKL">
 <div id="form-2fa" class="hidden"><input id="totp-code"><button id="btn-2fa-cancel"></button></div>`;
}
function hidden(id: string) {return document.getElementById(id)!.classList.contains("hidden");}
beforeEach(() => {window.location.href = "/login"; request.mockReset().mockImplementation(async () => new Response(JSON.stringify({ok: true}))); vi.stubGlobal("fetch", request);});
afterEach(() => {vi.unstubAllGlobals(); document.body.innerHTML = "";});
describe("login method visibility", () => {
 it.each([1, 2, 3, 4, 5, 6, 7])("offers exactly the enabled methods, including after MFA cancel (mask %s)", async mask => {
  render(mask); await initScript({locale: "es"});
  const first = methods.find((_, i) => mask & (1 << i));
  for (const [i, method] of methods.entries()) {
   expect(hidden(`tab-${method}`)).toBe(!(mask & (1 << i)));
   expect(hidden(`form-${method}`)).toBe(method !== first);
  }
  expect(document.activeElement?.id).toBe(first === "password" ? "username" : `${first}-username`);
  document.getElementById("btn-2fa-cancel")!.click();
  for (const method of methods) expect(hidden(`form-${method}`)).toBe(method !== first);
  for (const [i, method] of methods.entries()) if (!(mask & (1 << i))) {
   document.getElementById(`tab-${method}`)!.click(); expect(hidden(`form-${method}`)).toBe(true);
  }
 });
 it.each([1, 2, 4])("initializes when the server omits disabled tabs and forms (mask %s)", async mask => {
  render(mask);
  for (const [i, method] of methods.entries()) if (!(mask & (1 << i))) {
   document.getElementById(`tab-${method}`)!.remove();
   document.getElementById(`form-${method}`)!.remove();
  }
  await initScript({locale: "es"});
  document.getElementById("btn-2fa-cancel")!.click();
  const method = methods.find((_, i) => mask & (1 << i))!;
  expect(hidden(`form-${method}`)).toBe(false);
  expect(document.querySelectorAll(".method-tab")).toHaveLength(1);
 });
 it("does not fall back to password when no policy is available", async () => {
  render(0); document.getElementById("login-card")!.removeAttribute("data-allow-password");
  await initScript({locale: "es"}); document.getElementById("btn-2fa-cancel")!.click();
  for (const method of methods) {expect(hidden(`tab-${method}`)).toBe(true); expect(hidden(`form-${method}`)).toBe(true);}
 });
 it.each([1, 2, 4])("does not submit disabled methods via synthetic events (mask %s)", async mask => {
  render(mask); await initScript({locale: "es"}); request.mockClear();
  for (const [i, method] of methods.entries()) if (!(mask & (1 << i))) {
   document.getElementById(`form-${method}`)!.dispatchEvent(new Event("submit", {cancelable: true}));
   document.getElementById(`btn-${method}`)!.click();
  }
  expect(request).not.toHaveBeenCalled();
 });
});
