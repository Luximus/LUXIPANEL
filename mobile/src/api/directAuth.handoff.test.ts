import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { redeemPanelHandoff } from "./directAuth";
type Reply = { status: number; cookie?: string; body?: string };
class Xhr {
  static sent: Xhr[] = []; static replies: Reply[] = [];
  responseText = ""; status = 0; timeout = 0; cookie = ""; body: string | undefined;
  method = ""; url = ""; headers: Record<string, string> = {};
  onload?: () => void;
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  getResponseHeader(name: string) { return name.toLowerCase() === "set-cookie" ? this.cookie : null; }
  getAllResponseHeaders() { return `Set-Cookie: ${this.cookie}`; }
  send(body?: string) {
    this.body = body; Xhr.sent.push(this);
    const reply = Xhr.replies.shift()!;
    this.status = reply.status; this.cookie = reply.cookie ?? ""; this.responseText = reply.body ?? "";
    this.onload?.();
  }
}
const handoff = { url: "https://box.example/prefix/api/auth/sso/handoff", ticket: "private-one-use-ticket" };
const expiry = Math.floor(Date.now() / 1000) + 600;
const jwt = `header.${Buffer.from(JSON.stringify({ exp: expiry })).toString("base64url")}.signature`;
beforeEach(() => {
  Xhr.sent = []; Xhr.replies = [{ status: 200, cookie: "luxipanel_csrf=csrf-value; Path=/" }, { status: 200, cookie: `luxipanel_session=${jwt}; HttpOnly; Path=/`, body: "<!doctype html><script>location.replace('/panel')</script>" }];
  vi.stubGlobal("XMLHttpRequest", Xhr);
});
afterEach(() => vi.unstubAllGlobals());
it("captures the native session from the existing HTML handoff response without rendering HTML", async () => {
  expect(await redeemPanelHandoff("https://box.example/prefix", handoff)).toEqual({ jwt, csrf: { name: "luxipanel_csrf", value: "csrf-value" }, exp: expiry * 1000 });
  expect(Xhr.sent).toHaveLength(2);
  expect(Xhr.sent[1]).toMatchObject({ method: "POST", url: handoff.url, body: JSON.stringify({ ticket: handoff.ticket }) });
  expect(Xhr.sent.every(request => !request.url.includes(handoff.ticket))).toBe(true);
  expect(Xhr.sent[1]!.headers.Cookie).toBe("luxipanel_csrf=csrf-value");
});
it("never sends a ticket to a different host, path, or a URL with credentials", async () => {
  for (const url of ["https://other.example/api/auth/sso/handoff", "https://box.example/other", "https://user:pass@box.example/prefix/api/auth/sso/handoff", `${handoff.url}?ticket=secret`]) {
    expect(await redeemPanelHandoff("https://box.example/prefix", { ...handoff, url })).toBeNull();
  }
  expect(Xhr.sent).toHaveLength(0);
});
it("does not treat an expired ticket's login HTML as a successful session", async () => {
  Xhr.replies[1] = { status: 200, body: "<!doctype html><script>location.replace('/login')</script>" };
  expect(await redeemPanelHandoff("https://box.example/prefix", handoff)).toBeNull();
});
it("does not redeem while the caller is no longer active", async () => {
  expect(await redeemPanelHandoff("https://box.example/prefix", handoff, () => false)).toBeNull();
  expect(Xhr.sent).toHaveLength(0);
});
