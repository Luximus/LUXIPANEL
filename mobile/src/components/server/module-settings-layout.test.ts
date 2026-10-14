import { describe, expect, it } from "vitest";
import { settingsSections } from "./module-settings-layout";

describe("web settings order independent of component mount order",()=>{
  it("opens Users and Roles before Summary and Access, in any registration order",()=>{
    for (const keys of [["summary","access","table:roles","table:users"],["table:users","summary","table:roles","access"],["table:roles","access","table:users","summary"]]) {
      expect(settingsSections("users",keys)?.map(section=>section.key)).toEqual(["users","roles","summary","access"]);
    }
  });
  it("puts Cron presets ahead of Service and keeps main-table options out of the configuration",()=>{
    expect(settingsSections("cron",["service","table:tasks","rules","cats"])?.map(s=>s.key)).toEqual(["cats","rules","service"]);
  });
  it("groups Monitor process controls before refresh without creating another navigation item",()=>{
    const sections=settingsSections("monitor",["view","history","alerts","watchdog","diagnostics","table:processes"]);
    expect(sections?.map(s=>s.key)).toEqual(["table","history","alerts","watchdog","diagnostics"]);
    expect(sections?.[0].sources).toEqual(["table:processes","view"]);
  });
  it("keeps Files shortcuts and server operations separate from General and Roots",()=>{
    expect(settingsSections("files",["general","shortcuts","roots","operation","table:files"])?.map(s=>s.key)).toEqual(["general","roots","shortcuts","operation"]);
  });
  it("keeps backup storage settings ahead of history, without a schedules configuration",()=>{
    expect(settingsSections("backups",["table:history","table:schedules","local","cloud","table:storages"])?.map(s=>[s.key,s.sources])).toEqual([
      ["local",["local"]],["cloud",["cloud"]],["table",["table:storages","table:history"]],
    ]);
  });
  it("retains the web Mail navigation even when the selected main view is Spam",()=>{
    expect(settingsSections("mail",["routing","forwards","encryption","archive","default","outbound","table:accounts","spam"])?.map(s=>s.key)).toEqual(["table","routing","forwards","encryption","archive","default","outbound"]);
  });
  it("puts the Expo store table after build preferences and related modules",()=>{
    expect(settingsSections("expo",["table:stores","related","table:builds","table:projects","table:env"])?.[0].sources).toEqual(["table:builds","related","table:stores"]);
  });
  it("does not invent an empty section or disturb modules without a dedicated layout",()=>{
    expect(settingsSections("users",["summary"])?.map(s=>s.key)).toEqual(["summary"]);
    expect(settingsSections("obsidian",["appearance","shortcuts","vaults","ai"])).toBeUndefined();
  });
});
