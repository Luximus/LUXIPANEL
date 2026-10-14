import {expect,it} from "vitest";
import {baseGroupTemplate,setModuleSelection,type ModuleSurface} from "./native-hosting-policy";
it("retains permissions shared with another selected module when a provider module is unchecked",()=>{
 const files:ModuleSurface={module:"files",label:"Files",sidebar:["files"],views:["files.list","shared"],actions:["files.read"]};
 const backups:ModuleSurface={module:"backups",label:"Backups",sidebar:["backups"],views:["backups.list","shared"],actions:["backup.read"]};
 const policy=baseGroupTemplate();
 const catalog=[files,backups];
 let modules=setModuleSelection(policy,[],files,true,catalog);
 modules=setModuleSelection(policy,modules,backups,true,catalog);
 modules=setModuleSelection(policy,modules,files,false,catalog);
 expect(modules).toEqual(["backups"]);
 expect(policy.views).toContain("shared");
 expect(policy.views).not.toContain("files.list");
 expect(policy.sidebar).toContain("dashboard");
 expect(policy.actions).toEqual(["backup.read"]);
 expect(policy.fileAccess.allowAll).toBe(false);
});
