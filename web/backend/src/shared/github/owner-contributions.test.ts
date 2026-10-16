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
 it("classifies Git rejections from stderr without claiming a connection failure",()=>{
  const failure=(stderr:string)=>contributionFailure(Object.assign(new Error("git failed to push some refs AUTHORIZATION: basic private-value"),{stderr}));
  expect(failure("refusing to allow a Personal Access Token to create or update workflow without workflow scope")).toMatchObject({transient:false,message:expect.stringContaining("permiso workflow")});
  expect(failure("remote: GH013: Repository rule violations")).toMatchObject({transient:false,message:expect.stringContaining("reglas de la rama")});
  expect(failure("remote: Authentication failed")).toMatchObject({transient:false,message:expect.stringContaining("rechazó las credenciales")});
  expect(failure("Failed to connect: Connection timed out")).toMatchObject({transient:true,message:expect.stringContaining("conexión")});
  expect(failure("non-fast-forward")).toMatchObject({transient:true,message:expect.stringContaining("recibió cambios")});
  expect(failure("remote rejected")).toMatchObject({transient:false});
  expect(failure("remote rejected").message).not.toContain("private-value");
 });
 it("explains whitespace validation without exposing source or credentials",()=>{
  const error=Object.assign(new Error("git failed AUTHORIZATION: private-value"),{stdout:"web/new.ts:72: new blank line at EOF.\n+private-source"});
  expect(contributionFailure(error)).toMatchObject({transient:false,message:expect.stringContaining("validación de formato")});
  expect(contributionFailure(error).message).not.toMatch(/private-value|private-source/);
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
  else {
   const saved=JSON.parse(await fs.readFile(path.join(dir,"job.json"),"utf8"));
   expect(saved.status).toBe("interrupted");expect(saved.succeeded).toBe(false);expect(saved.patchHash).toBeUndefined();
   expect(saved.files).toEqual(["web/src/a.ts"]);expect(saved.interruption.patchHash).toMatch(/^[a-f0-9]{64}$/);
   expect(await fs.readFile(path.join(dir,"interrupted.patch"),"utf8")).toContain("+export const a=2;");
   await expect(fs.stat(path.join(dir,"change.patch"))).rejects.toThrow();
   await expect(api.retryOwnerContribution(user,saved.id)).rejects.toThrow();
   expect(await api.contributionUpdateBlocker(root,["web/src/a.ts"])).toBe("contribution-review");
  }
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
 it("preserves an unconfirmed task's current snapshot at restart without publishing it",async()=>{
  let api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",root,"local",true);
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=7;\n");
  vi.resetModules();api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery,async()=>false);
  const dir=path.join(root,"github-users/contributions",ticket!.job.id),saved=JSON.parse(await fs.readFile(path.join(dir,"job.json"),"utf8"));
  expect(saved.status).toBe("interrupted");expect(saved.succeeded).toBe(false);expect(saved.after).toMatch(/^[a-f0-9]{40}$/);
  expect(await fs.readFile(path.join(dir,"interrupted.patch"),"utf8")).toContain("+export const a=7;");
  expect(saved.patchHash).toBeUndefined();
 });
 it("blocks updating during a task even before that task changes any source",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",root,"local",true);
  expect(await api.contributionUpdateBlocker(root,[])).toBe("assistant-active");
  expect(await api.contributionUpdateBlocker(root+"-other",[])).toBeUndefined();
  await api.finishOwnerContribution(ticket,false);
  expect(await api.contributionUpdateBlocker(root,[])).toBeUndefined();
 });
 it("queues overlapping successful turns together, including a third joining later",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const first=await api.beginOwnerContribution(user,"first",root,"local",true);
  const second=await api.beginOwnerContribution(user,"second",root,"local",true);
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=2;\n");
  expect(await api.finishOwnerContribution(second,true)).toBeNull();
  const third=await api.beginOwnerContribution(user,"third",root,"local",true);
  expect(await api.finishOwnerContribution(first,true)).toBeNull();
  const dir=path.join(root,"github-users/contributions",first!.job.id);
  await expect(fs.stat(path.join(dir,"change.patch"))).rejects.toThrow();
  await fs.writeFile(path.join(root,"web/src/b.ts"),"export const b=3;\n");
  expect(await api.finishOwnerContribution(third,true)).toBe(first!.job.id);
  const patch=await fs.readFile(path.join(dir,"change.patch"),"utf8");
  expect(patch).toContain("+export const a=2;");expect(patch).toContain("+export const b=3;");
  for(const ticket of [second,third]){
   const memberDir=path.join(root,"github-users/contributions",ticket!.job.id);
   const saved=JSON.parse(await fs.readFile(path.join(memberDir,"job.json"),"utf8"));
   expect(saved.includedIn).toBe(first!.job.id);expect(saved.patchHash).toBeUndefined();
   await expect(fs.stat(path.join(memberDir,"change.patch"))).rejects.toThrow();
  }
  expect(await api.finishOwnerContribution(third,true)).toBeNull();
 });
 it.each(["failed","foreign"])("does not publish a shared group with a %s participant",async reason=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const a=await api.beginOwnerContribution(user,"a",root,"local",true);
  const b=await api.beginOwnerContribution(reason==="foreign"?{...user,userId:2}:user,"b",root,"local",true);
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=3;\n");
  await api.finishOwnerContribution(a,true);await api.finishOwnerContribution(b,reason!=="failed");
  const dir=path.join(root,"github-users/contributions",a!.job.id);
  await expect(fs.stat(path.join(dir,"change.patch"))).rejects.toThrow();
  expect(JSON.parse(await fs.readFile(path.join(dir,"job.json"),"utf8")).status).toBe("blocked");
 });
 it.each([false,true])("recovers overlapping signed CLI tasks (legacy=%s) and seals only after the last success",async legacy=>{
  let api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const tickets=await Promise.all(["one","two"].map(id=>api.beginOwnerContribution(user,id,root,"local",true)));
  const descriptors=tickets.map(t=>({conversationId:t!.job.conversationId,jobId:"cli-"+t!.job.id,startedAt:Date.now(),moduleRecovery:"signed-scope"}));
  for(const desc of descriptors)await api.bindOwnerContributionCli(user,desc,"local");
  const leader=tickets.find(t=>t!.job.before)!.job.id;
  if(legacy)for(const ticket of tickets){
   const file=path.join(root,"github-users/contributions",ticket!.job.id,"job.json");
   const row=JSON.parse(await fs.readFile(file,"utf8"));delete row.batchId;await fs.writeFile(file,JSON.stringify(row));
  }
  vi.resetModules();api=await import("./owner-contributions.js");
  const recovered=await api.initializeOwnerContributions(noDelivery,async j=>descriptors.some(d=>j.cliBinding===api.contributionCliBinding(d)));
  expect(recovered.map(j=>j.id).sort()).toEqual(tickets.map(t=>t!.job.id).sort());
  await fs.writeFile(path.join(root,"web/src/a.ts"),"export const a=3;\n");
  for(const [i,desc] of descriptors.entries()){
   expect(await api.recoverOwnerContribution(user,{...desc,jobId:"wrong"},"local")).toBeNull();
   const ticket=await api.recoverOwnerContribution(user,desc,"local");
   expect(ticket).not.toBeNull();expect(ticket!.job.overlapped).toBe(true);
   expect(await api.finishOwnerContribution(ticket,true)).toBe(i===0?null:leader);
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


it.each(["already-applied","compatible","partial"])("recovers %s edits against a newer remote without touching the checkout",async scenario=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),"lxp-delivery-merge-"));
 const git=(cwd:string,...args:string[])=>execFileSync("git",args,{cwd,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
 try{
  config.LUXIPANEL_CONFIG_DIR=root;
  const seed=path.join(root,"seed"),remote=path.join(root,"remote.git");await fs.mkdir(seed);
  git(seed,"init","-q");git(seed,"config","user.name","Test");git(seed,"config","user.email","test@example.invalid");
  await fs.mkdir(path.join(seed,"web/src"),{recursive:true});
  const initial=Array.from({length:12},(_,n)=>`export const line${n}=${n};\n`).join("");
  const incoming=initial.replace("line2=2","line2=20");
  const filename=path.join(seed,"web/src/a.ts");await fs.writeFile(filename,initial);
  git(seed,"add",".");git(seed,"commit","-qm","base");git(seed,"branch","-M","developer");git(root,"clone","--bare",seed,remote);
  const before=await captureSource(seed,path.join(root,"before.index"));
  await fs.writeFile(filename,incoming);
  if(scenario==="partial")await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const added=true;\n");
  const after=await captureSource(seed,path.join(root,"after.index"));
  const patch=git(seed,"diff","--binary",before,after);
  if(scenario==="partial")await fs.unlink(path.join(seed,"web/src/b.ts"));
  await fs.writeFile(filename,scenario==="compatible"?initial.replace("line4=4","line4=40"):incoming);
  git(seed,"add","web/src/a.ts");git(seed,"commit","-qm","remote edit");git(seed,"push",remote,"developer");
  const upstream=git(seed,"rev-parse","HEAD").trim(),index=await fs.readFile(path.join(seed,".git/index"));
  const live=await fs.readFile(filename,"utf8");
  const id=randomUUID(),dir=path.join(root,"github-users/contributions",id);await fs.mkdir(dir,{recursive:true});
  const patchFile=path.join(dir,"change.patch");await fs.writeFile(patchFile,patch);
  expect(()=>git(seed,"apply","--check","--cached",patchFile)).toThrow();
  const job:ContributionJob={id,conversationId:"test",root:seed,user:{userId:1,username:"test",displayName:"Test",kind:"admin",role:"admin",modules:[]},before,head:upstream,status:"pending",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),patchHash:createHash("sha256").update(patch).digest("hex")};
  await deliverContribution(job,remote,async u=>u);
  expect(job.status).toBe("pushed");
  expect(git(remote,"show","developer:web/src/a.ts")).toBe(scenario==="compatible"?incoming.replace("line4=4","line4=40"):incoming);
  if(scenario==="partial")expect(git(remote,"show","developer:web/src/b.ts")).toBe("export const added=true;\n");
  expect(git(remote,"rev-list","--count","developer").trim()).toBe(scenario==="already-applied"?"2":"3");
  if(scenario==="already-applied")expect(job.integratedBy).toBe(upstream);
  expect(await fs.readFile(filename,"utf8")).toBe(live);
  expect(await fs.readFile(path.join(seed,".git/index"))).toEqual(index);
  expect(git(seed,"rev-parse","HEAD").trim()).toBe(upstream);
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
 it.each(["clean","unfinished","staged","busy","building","conflicting"])("aligns a published checkout safely with %s state",async state=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",seed,"local",true);
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=2;\n");
  await fs.writeFile(path.join(seed,"web/src/new.ts"),"export const added=true;\n");
  await api.finishOwnerContribution(ticket,true);await new Promise(resolve=>setTimeout(resolve,40));
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  if(state==="unfinished"||state==="staged")await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=9;\n");
  if(state==="conflicting")await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=99;\n");
  if(state==="staged")git(seed,"add","web/src/b.ts");
  const active=state==="busy"?await api.beginOwnerContribution(user,"next",seed,"local",true):null;
  const head=git(seed,"rev-parse","HEAD");
  let release:(()=>void)|undefined;
  if(state==="building"){
   await fs.mkdir(path.join(seed,".lxp"),{recursive:true});
   const {spawn}=await import("node:child_process");
   const lock=spawn("flock",[path.join(seed,".lxp/build.lock"),"sh","-c","printf ready; cat >/dev/null"]);
   await new Promise<void>(resolve=>lock.stdout.once("data",()=>resolve()));release=()=>lock.stdin.end();
  }
  const index=await fs.readFile(path.join(seed,".git/index"));
  expect(await api.alignPublishedContribution(ticket!.job)).toBe(state==="clean"||state==="unfinished");
  if(state==="clean"||state==="unfinished"){
   expect(git(seed,"rev-parse","HEAD").trim()).toBe(ticket!.job.commit);
   expect(git(seed,"status","--porcelain","--","web").trim()).toBe(state==="unfinished"?"M web/src/b.ts":"");
  }else{
   expect(git(seed,"rev-parse","HEAD")).toBe(head);expect(await fs.readFile(path.join(seed,".git/index"))).toEqual(index);
  }
  expect(await fs.readFile(path.join(seed,"web/src/a.ts"),"utf8")).toContain(state==="conflicting"?"a=99":"a=2");
  if(state==="unfinished"||state==="staged")expect(await fs.readFile(path.join(seed,"web/src/b.ts"),"utf8")).toContain("b=9");
  release?.();if(active)await api.finishOwnerContribution(active,false);
 });
 it("aligns confirmed source before the next task captures its baseline",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const first=await api.beginOwnerContribution(user,"first",seed,"local",true);
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=2;\n");
  await api.finishOwnerContribution(first,true);await new Promise(resolve=>setTimeout(resolve,40));
  await api.deliverContribution(first!.job,remote,async u=>u);
  await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=7;\n");
  const next=await api.beginOwnerContribution(user,"next",seed,"local",true);
  expect(next!.job.head).toBe(first!.job.commit);
  expect(git(seed,"show",next!.job.before+":web/src/b.ts")).toContain("b=7");
  await api.finishOwnerContribution(next,true);await new Promise(resolve=>setTimeout(resolve,40));
  expect(next!.job.status).toBe("empty");
  expect(git(seed,"status","--porcelain","--","web").trim()).toBe("M web/src/b.ts");
 });
 it("aligns published additions and deletions while preserving an interrupted edit",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const interrupted=await api.beginOwnerContribution(user,"old",seed,"local",true);
  await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=9;\n");await api.finishOwnerContribution(interrupted,false);
  const ticket=await api.beginOwnerContribution(user,"next",seed,"local",true);
  await fs.unlink(path.join(seed,"web/src/a.ts"));await fs.writeFile(path.join(seed,"web/src/new.ts"),"export const added=true;\n");
  await api.finishOwnerContribution(ticket,true);await new Promise(resolve=>setTimeout(resolve,40));
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  expect(await api.alignPublishedContribution(ticket!.job)).toBe(true);
  expect(git(seed,"status","--porcelain","--","web").trim()).toBe("M web/src/b.ts");
  expect(await api.contributionUpdateBlocker(seed,["web/src/b.ts"])).toBe("contribution-review");
  expect(interrupted!.job.succeeded).toBe(false);expect(interrupted!.job.status).toBe("interrupted");
 });
 it("reports queued work separately and ignores historical interruptions already integrated",async()=>{
  const api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const lock=await api.publisherLock();
  const ticket=await api.beginOwnerContribution(user,"turn",seed,"local",true);
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=2;\n");
  await api.finishOwnerContribution(ticket,true);
  expect(await api.contributionUpdateBlocker(seed,["web/src/a.ts"])).toBe("publication-pending");
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  expect(await api.contributionUpdateBlocker(seed,["web/src/a.ts"])).toBe("checkout-sync");
  expect(await api.alignPublishedContribution(ticket!.job)).toBe(true);
  ticket!.job.status="interrupted";ticket!.job.succeeded=false;delete ticket!.job.patchHash;await api.saveContribution(ticket!.job);
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=3;\n");
  expect(await api.contributionUpdateBlocker(seed,["web/src/a.ts"])).toBeUndefined();
  lock?.();
 });
 it("aligns confirmed source before waiting for a slow CI service",async()=>{
  let api=await import("./owner-contributions.js");await api.initializeOwnerContributions(noDelivery);
  const ticket=await api.beginOwnerContribution(user,"turn",seed,"local",true);
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=2;\n");
  await api.finishOwnerContribution(ticket,true);await new Promise(resolve=>setTimeout(resolve,40));
  await api.deliverContribution(ticket!.job,remote,async u=>u);
  let entered!:()=>void,release!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;}),waiting=new Promise<void>(resolve=>{release=resolve;});
  vi.stubGlobal("fetch",vi.fn(async()=>{entered();await waiting;return {ok:true,json:async()=>({workflow_runs:[{head_sha:ticket!.job.commit,status:"completed",conclusion:"success",run_number:1}]})};}));
  vi.resetModules();api=await import("./owner-contributions.js");
  try{
   await api.initializeOwnerContributions(async u=>u);await started;
   expect(git(seed,"rev-parse","HEAD").trim()).toBe(ticket!.job.commit);
   expect(git(seed,"status","--porcelain","--","web")).toBe("");
  }finally{release();await new Promise(resolve=>setTimeout(resolve,40));}
 });
 it("recovers legacy completed work from immutable boundaries without including a later edit",async()=>{
  const api=await import("./owner-contributions.js");
  const lock=await api.publisherLock();
  const before=await api.captureSource(seed,path.join(root,"before.index"));
  await fs.writeFile(path.join(seed,"web/src/a.ts"),"export const a=2;\n");
  const after=await api.captureSource(seed,path.join(root,"after.index"));
  const head=git(seed,"rev-parse","HEAD").trim(),t=(n:number)=>new Date(1700000000000+n*1000).toISOString();
  const ids=[randomUUID(),randomUUID(),randomUUID()];
  const legacy=(id:string,start:number,end:number,more:Partial<ContributionJob>={}):ContributionJob=>({id,conversationId:id,root:seed,user,before,head,status:"blocked",overlapped:true,cliBinding:"signed",error:"Hubo tareas simultáneas en el mismo repositorio. Los cambios se conservan y requieren revisión antes de publicarse.",createdAt:t(start),updatedAt:t(end),...more});
  const rows=[legacy(ids[0],1,5),legacy(ids[1],2,4,{before:"",head:""}),legacy(ids[2],6,6,{before:after,status:"empty",overlapped:false,error:undefined})];
  for(const row of rows){const dir=path.join(root,"github-users/contributions",row.id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,"job.json"),JSON.stringify(row));}
  await fs.writeFile(path.join(seed,"web/src/b.ts"),"export const b=999;\n");
  await api.recoverClosedContributionBatches();
  const dir=path.join(root,"github-users/contributions",ids[0]);
  const recovered=JSON.parse(await fs.readFile(path.join(dir,"job.json"),"utf8")) as ContributionJob;
  const patch=await fs.readFile(path.join(dir,"change.patch"),"utf8");
  expect(patch).toContain("+export const a=2;");expect(patch).not.toContain("b.ts");
  await api.deliverContribution(recovered,remote,async u=>u);
  await api.recoverClosedContributionBatches();
  const member=JSON.parse(await fs.readFile(path.join(root,"github-users/contributions",ids[1],"job.json"),"utf8"));
  expect(member.status).toBe("pushed");expect(member.commit).toBe(recovered.commit);
  await api.deliverContribution(recovered,remote,async u=>u);
  expect(git(remote,"rev-list","--count","developer").trim()).toBe("2");
  expect(git(remote,"show","developer:web/src/b.ts")).toContain("b=1");lock?.();
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
