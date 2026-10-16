import { randomUUID, createHash } from "node:crypto";
import { deliverContribution, validateContributionPatch, contributionFailure, ContributionDeliveryError, type ContributionJob } from "./owner-contributions.js";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";import os from "node:os";import path from "node:path";import {execFileSync} from "node:child_process";
const config=vi.hoisted(()=>({LUXIPANEL_CONFIG_DIR:"",LUXIPANEL_INSTALL_ROOT:""}));
vi.mock("../../config/env.js",()=>({env:config}));
vi.mock("./user-connection.js",()=>({githubStatus:vi.fn(async()=>({canEditCore:false})),githubToken:vi.fn(async()=>({token:"unit-test",login:"Luximus",id:80057597}))}));
vi.mock("../logger/index.js",()=>({createModuleLogger:()=>({error:vi.fn(),warn:vi.fn()})}));
import { captureSource, publishablePath, overlapsCore, assertCoreDeveloper } from "./owner-contributions.js";
import { githubStatus } from "./user-connection.js";
describe("maintainer contribution snapshots",()=>{
 let root:string;
 beforeEach(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),"lxp-owner-"));config.LUXIPANEL_CONFIG_DIR=root;config.LUXIPANEL_INSTALL_ROOT=root;});
 afterEach(async()=>{await fs.rm(root,{recursive:true,force:true});});
 it("accepts Git binary marker text inside source but rejects actual binary patches",()=>{
  expect(()=>validateContributionPatch('diff --git a/web/a.ts b/web/a.ts\n@@ -1 +1 @@\n-old\n+const marker="GIT binary patch";\n')).not.toThrow();
  expect(()=>validateContributionPatch('diff --git a/web/a.ts b/web/a.ts\nGIT binary patch\nliteral 123\n')).toThrow("archivos binarios");
  expect(()=>validateContributionPatch("é".repeat(2*1024*1024+1))).toThrow("4 MB");
 });
 it("preserves safe actionable errors and does not expose raw Git credentials",()=>{
  expect(contributionFailure(new ContributionDeliveryError("base-missing","Falta la base"))).toEqual({transient:false,message:"Falta la base"});
  const error=contributionFailure(new Error("git rejected AUTHORIZATION: basic private-value"));
  expect(error.transient).toBe(false);expect(error.message).not.toContain("private-value");
 });
 it("excludes credentials, private projects, binaries and runtime files",()=>{
  for(const p of ["web/backend/.env","web/backend/.env.production","web/backend/private/a.ts","web/backend/node_modules/pkg/index.js","web/frontend/dist/a.js","LP-LICENSE-SERVER/src/app.ts","../web/a.ts","web/backend/tokens.json","desktop/cert.p12"])expect(publishablePath(p),p).toBe(false);
  for(const p of ["web/backend/src/app.ts","web/frontend/src/components/Credentials.tsx","mobile/src/app.tsx","docs/CHANGELOG.md"])expect(publishablePath(p),p).toBe(true);
 });
 it("records only the turn delta and preserves the live Git index",async()=>{
  const git=(...args:string[])=>execFileSync("git",args,{cwd:root,encoding:"utf8"});
  git("init","-q");git("config","user.email","test@example.invalid");git("config","user.name","Test");
  await fs.mkdir(path.join(root,"web/src"),{recursive:true});
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=1;\n");await fs.writeFile(path.join(root,"web/src/b.ts"),"export const b=1;\n");
  git("add",".");git("commit","-qm","baseline");git("branch","-M","developer");
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=2;\n");git("add","web/src/a.ts");
  const index=await fs.readFile(path.join(root,".git/index"));
  const before=await captureSource(root,path.join(root,"before.index"));
  await fs.writeFile(path.join(root,"web/src/b.ts"),"export const b=2;\n");
  await fs.writeFile(path.join(root,"web/.env"),"secret=value");
  const after=await captureSource(root,path.join(root,"after.index"));
  expect(git("diff","--name-only",before,after).trim()).toBe("web/src/b.ts");
  expect(await fs.readFile(path.join(root,".git/index"))).toEqual(index);
 });
 it("denies direct core development to unverified users including ancestor and symlink paths",async()=>{
  expect(overlapsCore("/var/www","/var/www/LUXIPANEL")).toBe(true);expect(overlapsCore("/var/www/LUXIPANEL-other","/var/www/LUXIPANEL")).toBe(false);
  await expect(assertCoreDeveloper(undefined,root,"local")).rejects.toThrow();
  await expect(assertCoreDeveloper(undefined,os.tmpdir(),"remote")).resolves.toBeUndefined();
 });
});

describe("durable CLI contribution recovery",()=>{
 let root:string;
 const user={userId:1,username:"maintainer",displayName:"Maintainer",kind:"admin",role:"admin",modules:[]} as ContributionJob["user"];
 const noDelivery=async()=>{throw new Error("No real remote in recovery tests");};
 beforeEach(async()=>{
  vi.useFakeTimers({toFake:["setInterval","clearInterval"]});vi.resetModules();
  root=await fs.mkdtemp(path.join(os.tmpdir(),"lxp-recover-"));config.LUXIPANEL_CONFIG_DIR=root;config.LUXIPANEL_INSTALL_ROOT=root;
  vi.mocked(githubStatus).mockResolvedValue({canEditCore:true} as Awaited<ReturnType<typeof githubStatus>>);
  const git=(...args:string[])=>execFileSync("git",args,{cwd:root,encoding:"utf8"});
  git("init","-q");git("config","user.email","test@example.invalid");git("config","user.name","Test");
  await fs.mkdir(path.join(root,"web/src"),{recursive:true});await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=1;\n");
  git("add",".");git("commit","-qm","baseline");git("branch","-M","developer");
 });
 afterEach(async()=>{
  // Initialization starts a background outbox scan with a short-lived flock
  // child. Let it release the fixture before deleting it or changing config.
  await new Promise(resolve=>setTimeout(resolve,40));
  vi.useRealTimers();vi.mocked(githubStatus).mockResolvedValue({canEditCore:false} as Awaited<ReturnType<typeof githubStatus>>);
  await fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:25});
 });
 it.each([true,false])("reserves the exact task across restart and only seals confirmed success=%s",async success=>{
  let api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",root,"local",true);expect(ticket).not.toBeNull();
  const desc={conversationId:"turn",jobId:"cli-current",startedAt:Date.now(),moduleRecovery:"signed-scope"};
  await api.bindOwnerContributionCli(user,desc,"local");
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=2;\n");
  const lock=path.join(root,"github-users/contributions/active.json");
  await fs.writeFile(lock,JSON.stringify({pid:99999999,jobId:ticket!.job.id,conversationId:"turn"}));
  vi.resetModules();api=await import("./owner-contributions.js");
  const recovered=await api.initializeOwnerContributions(noDelivery,async j=>j.cliBinding===api.contributionCliBinding(desc));
  expect(recovered.map(j=>j.id)).toEqual([ticket!.job.id]);
  expect(await api.recoverOwnerContribution(user,{...desc,jobId:"stale"},"local")).toBeNull();
  expect(await api.recoverOwnerContribution({...user,userId:2},desc,"local")).toBeNull();
  expect(await api.recoverOwnerContribution(user,desc,"remote")).toBeNull();
  const resumed=await api.recoverOwnerContribution(user,desc,"local");expect(resumed).not.toBeNull();
  await api.finishOwnerContribution(resumed,success);
  const dir=path.join(root,"github-users/contributions",ticket!.job.id);
  if(success)expect(await fs.readFile(path.join(dir,"change.patch"),"utf8")).toContain("+export const a=2;");
  else {expect(JSON.parse(await fs.readFile(path.join(dir,"job.json"),"utf8")).status).toBe("interrupted");await expect(fs.stat(path.join(dir,"change.patch"))).rejects.toThrow();}
  await expect(fs.stat(lock)).rejects.toThrow();
  // Let the deliberately rejected delivery persist its safe status before cleanup.
  await new Promise(resolve=>setTimeout(resolve,30));
 });
 it.each([process.pid,99999999])("ignores a legacy lock even with pid %s and does not publish an unverified CLI",async pid=>{
  let api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",root,"local",true);
  const lock=path.join(root,"github-users/contributions/active.json");await fs.writeFile(lock,JSON.stringify({pid,jobId:ticket!.job.id,conversationId:"turn"}));
  vi.resetModules();api=await import("./owner-contributions.js");
  expect(await api.initializeOwnerContributions(noDelivery,async()=>false)).toEqual([]);
  const saved=JSON.parse(await fs.readFile(path.join(root,"github-users/contributions",ticket!.job.id,"job.json"),"utf8"));
  expect(saved.status).toBe("interrupted");await expect(fs.stat(lock)).rejects.toThrow();
 });
 it("allows simultaneous chats without publishing mixed changes, in either completion order",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const [first,second]=await Promise.all([
   api.beginOwnerContribution(user,"first",root,"local",true),
   api.beginOwnerContribution(user,"second",root,"local",true),
  ]);
  expect(first).not.toBeNull();expect(second).not.toBeNull();
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=2;\n");
  expect(await api.finishOwnerContribution(second,true)).toBeNull();
  // One task ending must not clear the reservation of the remaining task.
  const third=await api.beginOwnerContribution(user,"third",root,"local",true);expect(third).not.toBeNull();
  expect(await api.finishOwnerContribution(first,true)).toBeNull();
  await fs.writeFile(path.join(root,"web/src/b.ts"),"export const b=3;\n");
  expect(await api.finishOwnerContribution(third,true)).toBeNull();
  for(const ticket of [first,second,third]){
   const dir=path.join(root,"github-users/contributions",ticket!.job.id);
   const saved=JSON.parse(await fs.readFile(path.join(dir,"job.json"),"utf8"));
   expect(saved.status).toBe("blocked");expect(saved.overlapped).toBe(true);expect(saved.patchHash).toBeUndefined();
   await expect(fs.stat(path.join(dir,"change.patch"))).rejects.toThrow();
   expect(await api.finishOwnerContribution(ticket,true)).toBeNull();
  }
  expect(await fs.readFile(path.join(root,"web/src/a.ts"),"utf8")).toContain("a=2");
  expect(await fs.readFile(path.join(root,"web/src/b.ts"),"utf8")).toContain("b=3");
  // The next independent turn still captures only its own delta.
  const solo=await api.beginOwnerContribution(user,"solo",root,"local",true);
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=4;\n");
  expect(await api.finishOwnerContribution(solo,true)).toBe(solo!.job.id);
  const patch=await fs.readFile(path.join(root,"github-users/contributions",solo!.job.id,"change.patch"),"utf8");
  expect(patch).toContain("-export const a=2;");expect(patch).toContain("+export const a=4;");expect(patch).not.toContain("b.ts");
  await new Promise(resolve=>setTimeout(resolve,30));
 });
 it("recovers all overlapping signed CLI tasks without losing the publication guard",async()=>{
  let api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const tickets=await Promise.all(["one","two"].map(id=>api.beginOwnerContribution(user,id,root,"local",true)));
  const descriptors=tickets.map(t=>({conversationId:t!.job.conversationId,jobId:"cli-"+t!.job.id,startedAt:Date.now(),moduleRecovery:"signed-scope"}));
  for(const desc of descriptors)await api.bindOwnerContributionCli(user,desc,"local");
  vi.resetModules();api=await import("./owner-contributions.js");
  const recovered=await api.initializeOwnerContributions(noDelivery,async j=>descriptors.some(d=>j.cliBinding===api.contributionCliBinding(d)));
  expect(recovered.map(j=>j.id).sort()).toEqual(tickets.map(t=>t!.job.id).sort());
  for(const desc of descriptors){
   expect(await api.recoverOwnerContribution(user,{...desc,jobId:"wrong"},"local")).toBeNull();
   const ticket=await api.recoverOwnerContribution(user,desc,"local");
   expect(ticket).not.toBeNull();expect(ticket!.job.overlapped).toBe(true);
   expect(await api.finishOwnerContribution(ticket,true)).toBeNull();
  }
  const solo=await api.beginOwnerContribution(user,"next",root,"local",true);
  expect(solo!.job.overlapped).toBeUndefined();await api.finishOwnerContribution(solo,false);
 });
});

it.each(["success","missing-base","conflict"])("verifies actual Git delivery with %s",async scenario=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"lxp-delivery-"));
 const git=(cwd:string,...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8"});
 try {
  config.LUXIPANEL_CONFIG_DIR=root;
  const seed=path.join(root,"seed"),remote=path.join(root,"remote.git");await fs.mkdir(seed);
  git(seed,"init","-q");git(seed,"config","user.name","Test");git(seed,"config","user.email","test@example.invalid");
  await fs.mkdir(path.join(seed,"web/src"),{recursive:true});await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=1;\n");
  git(seed,"add",".");git(seed,"commit","-qm","base");git(seed,"branch","-M","developer");git(root,"clone","--bare",seed,remote);
  if(scenario==="missing-base")await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=1;\n");
  if(scenario==="conflict")await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=99;\n");
  const before=await captureSource(seed,path.join(root,"before.index"));
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=2;\n");
  if(scenario==="missing-base")await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=2;\n");
  const after=await captureSource(seed,path.join(root,"after.index"));
  const patch=git(seed,"diff","--binary",before,after);
  const id=randomUUID(),dir=path.join(root,"github-users/contributions",id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,"change.patch"),patch);
  const job:ContributionJob={id,conversationId:"test",root:seed,user:{userId:1,username:"test",displayName:"Test",kind:"admin",role:"admin",modules:[]},before,head:git(seed,"rev-parse","HEAD").trim(),status:"pending",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),files:["web/src/a.ts"],patchHash:createHash("sha256").update(patch).digest("hex")};
  if(scenario!=="success"){
   await expect(deliverContribution(job,remote,async u=>u)).rejects.toMatchObject({code:scenario==="missing-base"?"base-missing":"patch-conflict"});
   expect(git(remote,"rev-list","--count","developer").trim()).toBe("1");expect(job.commit).toBeUndefined();return;
  }
  await deliverContribution(job,remote,async u=>u);
  expect(job.status).toBe("pushed");expect(git(remote,"show","developer:web/src/a.ts")).toBe("export const a=2;\n");
  const sha=job.commit;job.status="pending";await deliverContribution(job,remote,async u=>u);
  expect(job.commit).toBe(sha);expect(git(remote,"rev-list","--count","developer").trim()).toBe("2");
 }finally{await fs.rm(root,{recursive:true,force:true});}
});


describe("original project contributions and legacy worktree compatibility",()=>{
 let root:string,seed:string,remote:string;
 const user={userId:1,username:"maintainer",displayName:"Maintainer",kind:"admin",role:"admin",modules:[]} as ContributionJob["user"];
 const git=(cwd:string,...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8"});
 const noDelivery=async()=>{throw new Error("Automatic network disabled in tests");};
 const existingWorktree=async(id:string)=>{
  const cwd=path.join(root,"team-"+id);git(seed,"worktree","add","--detach",cwd,"HEAD");return cwd;
 };
 beforeEach(async()=>{
  vi.useFakeTimers({toFake:["setInterval","clearInterval"]});vi.resetModules();
  root=await fs.mkdtemp(path.join(os.tmpdir(),"lxp-isolation-"));seed=path.join(root,"source");remote=path.join(root,"remote.git");await fs.mkdir(seed);
  config.LUXIPANEL_CONFIG_DIR=root;config.LUXIPANEL_INSTALL_ROOT=seed;
  vi.mocked(githubStatus).mockResolvedValue({canEditCore:true} as Awaited<ReturnType<typeof githubStatus>>);
  git(seed,"init","-q");git(seed,"config","user.name","Test");git(seed,"config","user.email","test@example.invalid");
  await fs.mkdir(path.join(seed,"web/src"),{recursive:true});
  for(const f of ["a","b"])await fs.writeFile(path.join(seed,`web/src/${f}.ts`),`export const ${f}=1;\n`);
  git(seed,"add",".");git(seed,"commit","-qm","base");git(seed,"branch","-M","developer");git(root,"clone","--bare",seed,remote);
 });
 afterEach(async()=>{await new Promise(resolve=>setTimeout(resolve,40));vi.useRealTimers();vi.unstubAllGlobals();await fs.rm(root,{recursive:true,force:true});});
 it("publishes both parallel tasks and verifies a retry without duplicate commits",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const [a,b]=await Promise.all([api.beginOwnerContribution(user,"a",await existingWorktree("a"),"local",true),api.beginOwnerContribution(user,"b",await existingWorktree("b"),"local",true)]);
  expect(a!.job.root).not.toBe(b!.job.root);expect(a!.job.overlapped).toBeUndefined();
  await fs.writeFile(path.join(a!.job.root,"web/src/a.ts"),"export const a=2;\n");
  await fs.writeFile(path.join(b!.job.root,"web/src/b.ts"),"export const b=2;\n");
  for(const ticket of [a,b]){await api.finishOwnerContribution(ticket,true);await new Promise(resolve=>setTimeout(resolve,30));await api.deliverIsolatedContribution(ticket!.job,remote,async u=>u);}
  expect(git(remote,"show","developer:web/src/a.ts")).toContain("a=2");expect(git(remote,"show","developer:web/src/b.ts")).toContain("b=2");
  expect(await fs.readFile(path.join(seed,"web/src/a.ts"),"utf8")).toContain("a=1");
  await api.deliverIsolatedContribution(b!.job,remote,async u=>u);expect(git(remote,"rev-list","--count","developer").trim()).toBe("3");
 });
 it("keeps conflicting task commits and their files",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const a=await api.beginOwnerContribution(user,"a",await existingWorktree("a"),"local",true),b=await api.beginOwnerContribution(user,"b",await existingWorktree("b"),"local",true);
  for(const [ticket,n] of [[a,2],[b,3]] as const){await fs.writeFile(path.join(ticket!.job.root,"web/src/a.ts"),`export const a=${n};\n`);await api.finishOwnerContribution(ticket,true);}
  await new Promise(resolve=>setTimeout(resolve,40));await api.deliverIsolatedContribution(a!.job,remote,async u=>u);
  await expect(api.deliverIsolatedContribution(b!.job,remote,async u=>u)).rejects.toMatchObject({code:"patch-conflict"});
  expect(await fs.readFile(path.join(b!.job.root,"web/src/a.ts"),"utf8")).toContain("a=3");
  expect(git(seed,"show",`refs/luxipanel/tasks/${b!.job.id}:web/src/a.ts`)).toContain("a=3");
 });
 it("tracks the original project and publishes without creating a source or delivery checkout",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=9;\n");git(seed,"add","web/src/a.ts");
  const index=await fs.readFile(path.join(seed,".git/index")),head=git(seed,"rev-parse","HEAD");
  const worktrees=git(seed,"worktree","list","--porcelain");
  const ticket=await api.beginOwnerContribution(user,"turn",path.join(seed,"web/src"),"local",true);
  expect(ticket!.job.root).toBe(seed);expect(ticket!.job.workspaceCwd).toBeUndefined();expect(ticket!.job.isolated).toBeUndefined();
  await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=2;\n");
  const note={title:"Chats más claros",changes:["El selector permite elegir al agente por nombre y puesto."]};
  await fs.mkdir(path.join(seed,"docs/changes"),{recursive:true});
  await fs.writeFile(path.join(seed,"docs/changes/selector.json"),JSON.stringify(note));
  await api.finishOwnerContribution(ticket,true);await new Promise(resolve=>setTimeout(resolve,40));
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  expect(git(remote,"show","developer:web/src/b.ts")).toContain("b=2");
  const message=git(remote,"log","-1","--format=%B","developer");
  expect(message.split("\n")[0]).toBe(note.title);
  expect((await import("./change-notes.js")).publishedChangeNotes(message)).toEqual([note]);

  expect(git(remote,"show","developer:web/src/a.ts")).toContain("a=1");
  expect(git(seed,"branch","--show-current").trim()).toBe("developer");
  expect(git(seed,"rev-parse","HEAD")).toBe(head);
  expect(await fs.readFile(path.join(seed,".git/index"))).toEqual(index);
  expect(await fs.readFile(path.join(seed,"web/src/a.ts"),"utf8")).toContain("a=9");
  expect(git(seed,"worktree","list","--porcelain")).toBe(worktrees);
  await expect(fs.stat(path.join(seed,".lxp"))).rejects.toThrow();
  const records=await fs.readdir(path.join(root,"github-users/contributions",ticket!.job.id),{withFileTypes:true});
  expect(records.some(e=>e.isDirectory())).toBe(false);
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  expect(git(remote,"rev-list","--count","developer").trim()).toBe("2");
 });
 it("leaves plan turns, remote targets and unrelated projects alone",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  expect(await api.beginOwnerContribution(user,"plan",seed,"local",false)).toBeNull();
  expect(await api.beginOwnerContribution(user,"remote",seed,"remote",true)).toBeNull();
  expect(await api.beginOwnerContribution(user,"other",remote,"local",true)).toBeNull();
  await expect(fs.stat(path.join(seed,".lxp"))).rejects.toThrow();
 });
 it("keeps core permissions on an explicitly supplied worktree outside the project",async()=>{
  const api=await import("./owner-contributions.js");
  await expect(api.assertCoreDeveloper(undefined,await existingWorktree("outside"),"local")).rejects.toThrow();
 });
 it("publishes additions and deletions through the private index",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",seed,"local",true);
  await fs.unlink(path.join(seed,"web/src/b.ts"));
  await fs.writeFile(path.join(seed,"web/src/settings.json"),'{"enabled":true}\n');
  await api.finishOwnerContribution(ticket,true);await new Promise(resolve=>setTimeout(resolve,40));
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  expect(git(remote,"ls-tree","--name-only","developer:web/src")).not.toContain("b.ts");
  expect(JSON.parse(git(remote,"show","developer:web/src/settings.json"))).toEqual({enabled:true});
 });
 it("requires developer without switching branches or losing pending files",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  git(seed,"switch","-c","main");await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=8;\n");
  await expect(api.beginOwnerContribution(user,"turn",seed,"local",true)).rejects.toThrow("rama developer");
  expect(git(seed,"branch","--show-current").trim()).toBe("main");
  expect(await fs.readFile(path.join(seed,"web/src/a.ts"),"utf8")).toContain("a=8");
 });
 it("does not publish after the branch changes, even if HEAD is the same commit",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",seed,"local",true);
  git(seed,"switch","-c","main");await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=8;\n");
  await api.finishOwnerContribution(ticket,true);
  expect(ticket!.job.status).toBe("blocked");expect(ticket!.job.patchHash).toBeUndefined();
 });
 it("preserves interrupted legacy work without redirecting the next project turn",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const old=await api.beginOwnerContribution(user,"turn",await existingWorktree("old"),"local",true);
  await fs.writeFile(path.join(old!.job.root,"web/src/a.ts"),"export const a=9;\n");await api.finishOwnerContribution(old,false);
  const ticket=await api.beginOwnerContribution(user,"turn",seed,"local",true);
  expect(ticket!.job.root).toBe(seed);expect(ticket!.job.overlapped).toBeUndefined();
  expect(await fs.readFile(path.join(old!.job.root,"web/src/a.ts"),"utf8")).toContain("a=9");
  await api.finishOwnerContribution(ticket,false);
 });
 it("uses a kernel lock to exclude concurrent publishers",async()=>{
  const api=await import("./owner-contributions.js");const release=await api.publisherLock();expect(release).toBeTypeOf("function");
  expect(await api.publisherLock()).toBeUndefined();release!();
 });
 it.each(["success","failure"])("records CI %s only for the published SHA",async conclusion=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(async u=>u);
  vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,json:async()=>({workflow_runs:[{head_sha:"wrong",status:"completed",conclusion:"success",run_number:20},{head_sha:"abc",status:"completed",conclusion,html_url:"https://github.com/Luxisoft/LUXIPANEL/actions/runs/1",run_number:1}]})})));
  const job:ContributionJob={id:randomUUID(),conversationId:"a",root:seed,user,before:"",head:"",status:"pushed",commit:"abc",ci:"pending",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await api.refreshContributionChecks(job);expect(job.ci).toBe(conclusion);
 });
});
