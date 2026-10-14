/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const {panelOrigin,partitionFor,samePanel,browserUA} = createRequire(import.meta.url)("../../electron/panel-policy.cjs");
describe("desktop panel isolation policy",()=>{
 it("normalizes deployed panel origins and preserves explicit HTTP/ports",()=>{expect(panelOrigin("panel.example")).toBe("https://panel.example");expect(panelOrigin("http://192.168.1.2:4321/login")).toBe("http://192.168.1.2:4321");});
 it.each(["", "https://user:password@panel.example", "https://panel.example/ssh", "https://panel.example?jwt=secret", "https://panel.example#secret", "file:///etc/passwd"])("rejects invalid profile %s",input=>expect(()=>panelOrigin(input)).toThrow());
 it("isolates browser storage by local profile, even on the same host",()=>{expect(partitionFor("profile-a")).not.toBe(partitionFor("profile-b"));expect(partitionFor("profile-a")).toBe(partitionFor("profile-a"));});
 it("keeps all same-panel pages while refusing a changed origin",()=>{expect(samePanel("https://panel.example/panel/files?path=/", "https://panel.example")).toBe(true);expect(samePanel("https://other.example/login", "https://panel.example")).toBe(false);expect(samePanel("https://panel.example:444/login", "https://panel.example")).toBe(false);});
 it("uses browser chrome controls without an Electron marker",()=>expect(browserUA("Mozilla/5.0 Chrome/144.0 Electron/41.0 desktop/1.0.4 Safari/537.36")).toBe("Mozilla/5.0 Chrome/144.0 Safari/537.36"));
});
