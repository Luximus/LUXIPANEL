import { describe, expect, it, vi } from "vitest";
vi.mock("../../admin/services/module-registry.service.js", () => ({ moduleRegistryService: { getAll: () => [
  {id:"files",name:"Archivos"}, {id:"assistant",name:"Agentes IA"}, {id:"terminal",name:"Terminal"},
] } }));
import { defaultProviderGroupTemplate, instantiateProviderGroupTemplate, normalizeProviderGroupTemplate, providerPermissionCatalog } from "./provider-group-policy.js";
import { deriveModulesFromPermissions } from "../../../shared/auth/role-permissions.js";

describe("provider group templates", () => {
  it("copies AI and granular file grants into each account's own home", () => {
    const template=defaultProviderGroupTemplate(["files","assistant"]);
    template.actions=["files.read","files.view"];
    template.fileAccess={allowAll:false,allowPaths:["sites"],denyPaths:["sites/private"],readOnlyPaths:["sites/static"],defaultPath:"sites"};
    const first=instantiateProviderGroupTemplate(template,["files","assistant"],"/home/first");
    const second=instantiateProviderGroupTemplate(template,["files","assistant"],"/home/second");
    expect(first.sidebar).toContain("assistant");expect(first.views).toContain("panel.assistant");
    expect(first.actions).not.toContain("files.write");
    expect(first.fileAccess.allowPaths).toEqual(["/home/first/sites"]);
    expect(second.fileAccess.denyPaths).toEqual(["/home/second/sites/private"]);
    expect(template.fileAccess.allowPaths).toEqual(["sites"]);
    expect(deriveModulesFromPermissions(first)).not.toContain("admin");
  });
  it.each(["/etc","../other","sites/../../other","a\\..\\b","x\u0000y"])("rejects paths outside the tenant: %s", bad => {
    const p=defaultProviderGroupTemplate(["files"]);p.fileAccess.allowPaths=[bad];
    expect(()=>instantiateProviderGroupTemplate(p,["files"],"/home/client")).toThrow();
  });
  it("rejects unknown grants, unselected modules and administration", () => {
    const p=defaultProviderGroupTemplate(["files"]);
    expect(()=>normalizeProviderGroupTemplate({...p,views:["panel.assistant"]},["files"])).toThrow();
    expect(()=>normalizeProviderGroupTemplate({...p,actions:["files.fake"]},["files"])).toThrow();
    expect(()=>normalizeProviderGroupTemplate(p,["files","admin"])).toThrow();
    expect(providerPermissionCatalog().modules.some(m=>m.module==="admin")).toBe(false);
  });
  it("allows explicitly empty modules and permissions without restoring defaults", () => {
    const p=defaultProviderGroupTemplate([]);p.actions=[];
    expect(normalizeProviderGroupTemplate(p,[]).actions).toEqual([]);
  });
  it("validates the initial folder and command group while retaining command restrictions", () => {
    const p=defaultProviderGroupTemplate(["files","terminal"]);
    p.commandPolicy={allowAll:false,groups:["filesystem"],allowCommands:["git status"],denyCommands:["rm"]};
    const actual=instantiateProviderGroupTemplate(p,["files","terminal"],"/home/client");
    expect(actual.commandPolicy).toEqual(p.commandPolicy);
    p.fileAccess.allowPaths=["sites"];
    expect(()=>normalizeProviderGroupTemplate(p,["files","terminal"])).toThrow("carpeta inicial");
    p.fileAccess.defaultPath="sites";p.commandPolicy.groups=["unknown"];
    expect(()=>normalizeProviderGroupTemplate(p,["files","terminal"])).toThrow("comandos");
  });
});
