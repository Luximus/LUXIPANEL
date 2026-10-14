import { describe, expect, it } from "vitest";
import { baseGroupTemplate, setModuleSelection, type ModuleSurface } from "./provider-policy";
const files: ModuleSurface={module:"files",label:"Archivos",sidebar:["files"],views:["panel.files"],actions:["files.read","files.write"]};
const second: ModuleSurface={module:"custom",label:"Custom",sidebar:["custom"],views:["panel.custom"],actions:["files.read"]};
const ai: ModuleSurface={module:"assistant",label:"IA",sidebar:["assistant"],views:["panel.assistant"],actions:[]};
describe("provider module selection",()=>{
  it("enables the actual chat menu and view together",()=>{
    const p=baseGroupTemplate();expect(setModuleSelection(p,[],ai,true,[ai])).toEqual(["assistant"]);
    expect(p.sidebar).toContain("assistant");expect(p.views).toContain("panel.assistant");
  });
  it("preserves shared grants and removes file writes when deselecting files",()=>{
    const p=baseGroupTemplate();setModuleSelection(p,[],files,true,[files,second]);
    const selected=setModuleSelection(p,["files"],second,true,[files,second]);
    expect(setModuleSelection(p,selected,files,false,[files,second])).toEqual(["custom"]);
    expect(p.actions).toEqual(["files.read"]);expect(p.views).not.toContain("panel.files");
  });
  it("keeps an intentionally empty module selection",()=>{
    const p=baseGroupTemplate();setModuleSelection(p,[],files,true,[files]);
    expect(setModuleSelection(p,["files"],files,false,[files])).toEqual([]);expect(p.actions).toEqual([]);
  });
});
