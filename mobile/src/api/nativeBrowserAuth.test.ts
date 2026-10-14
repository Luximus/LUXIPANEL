import { describe, expect, it, vi } from "vitest";
vi.mock("expo-web-browser",()=>({openAuthSessionAsync:vi.fn()}));
import { verifyNativeCallback } from "./nativeBrowserAuth";
import { normalizePanelProfileUrl } from "./directAuth";
const state="s".repeat(43),code="c".repeat(43);
describe("native login callback",()=>{
 it("accepts the fixed callback and matching state",()=>expect(verifyNativeCallback(`luxipanel://auth/callback?code=${code}&state=${state}`,state)).toBe(code));
 it.each([`https://evil.example/callback?code=${code}&state=${state}`,`luxipanel://other/callback?code=${code}&state=${state}`,`luxipanel://auth/callback?code=${code}&state=wrong`,`luxipanel://auth/callback?code=invalid&state=${state}`,`luxipanel://auth/callback?code=${code}&code=${code}&state=${state}`])("rejects an unbound callback",url=>expect(()=>verifyNativeCallback(url,state)).toThrow());
 it("normalizes the panel without sending credentials to another path",()=>{expect(normalizePanelProfileUrl("panel.example")).toBe("https://panel.example");expect(normalizePanelProfileUrl("http://10.0.0.2:4321/api/")).toBe("http://10.0.0.2:4321");expect(()=>normalizePanelProfileUrl("https://user:pass@panel.example")).toThrow();expect(()=>normalizePanelProfileUrl("https://panel.example/path")).toThrow();});
});
