// SPDX-License-Identifier: AGPL-3.0-only
/** Installation-local outbox for the verified maintainer's chat changes.
 * Snapshot indexes and delivery checkouts never change the running branch/index.
 * Only the delta of a successful, non-overlapping turn is eligible for publication.
 * Concurrent chats continue; shared-workspace deltas require manual review.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../../config/env.js";
import { repositoryRoot } from "../installation-layout.js";
import { githubStatus, githubToken } from "./user-connection.js";
import { assertPublishableSource } from "../diagnostics/publication-check.js";
import { ForbiddenError } from "../errors/index.js";
import type { SessionUser } from "../types/index.js";
import { createModuleLogger } from "../logger/index.js";
const exec = promisify(execFile), log = createModuleLogger("owner-contributions");
const REMOTE = "https://github.com/Luxisoft/LUXIPANEL.git";
const baseEnv = () => Object.fromEntries(["PATH","HOME","USER","LANG","TMPDIR"].filter(k=>process.env[k]).map(k=>[k,process.env[k]!]));
export const coreRepository = () => repositoryRoot(env.LUXIPANEL_INSTALL_ROOT || fileURLToPath(new URL("../../../../",import.meta.url)));
const outbox = () => path.join(env.LUXIPANEL_CONFIG_DIR,"github-users","contributions");
export function overlapsCore(cwd:string,root:string):boolean {
 const a=path.resolve(cwd), b=path.resolve(root);
 return a===b || a.startsWith(b+path.sep) || b.startsWith(a+path.sep);
}
export function publishablePath(file:string):boolean {
 if(!file || file.startsWith("/") || file.split("/").some(p=>p===".."||p===".git"||/^(?:node_modules|dist|build|coverage|private|logs|backups|\.releases|\.lxp|\.astro|\.next|\.env(?:\..*)?)$/i.test(p)))return false;
 if(/(?:^|\/)(?:credentials?|secrets?|tokens?)\.(?:json|ya?ml|ini|toml)$/i.test(file))return false;
 return /^(?:web\/|desktop\/|mobile\/|scripts\/|docs\/|\.github\/)/.test(file) && /\.(?:[cm]?[jt]sx?|astro|css|html|json|md|ya?ml|py|sh|toml)$/.test(file)
   || /^(?:README(?:\.[\w-]+)?\.md|CONTRIBUTING\.md|CHANGELOG\.md|LICENSE|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.gitignore|\.gitleaks\.toml)$/.test(file);
}
export interface ContributionJob {
 id:string; conversationId:string; root:string; user:SessionUser; before:string; head:string;
 status:"capturing"|"empty"|"interrupted"|"pending"|"blocked"|"pushed";
 createdAt:string; updatedAt:string; patchHash?:string; commit?:string; base?:string; files?:string[];
 error?:string; attempt?:number; nextAttempt?:number; ci?:"pending"|"success"|"failure"|"missing"; checksUrl?:string; ciCheckedAt?:number;
 repository?:string; author?:{login:string;id:number}; isolated?:boolean; sourceCommit?:string; workspaceCwd?:string; integratedBy?:string; pushedAt?:string;
 cliBinding?:string;
 /** Shared checkout was used by overlapping turns; never publish its aggregate delta. */
 overlapped?:boolean;
}
export interface ContributionCli { conversationId:string; jobId:string; startedAt:number; moduleRecovery?:string }
export const contributionCliBinding=(desc:ContributionCli)=>createHash("sha256").update(JSON.stringify([desc.conversationId,desc.jobId,desc.startedAt,desc.moduleRecovery])).digest("hex");
export type Ticket={job:ContributionJob};
export class ContributionDeliveryError extends Error {
 constructor(readonly code:"base-missing"|"patch-conflict",message:string){super(message);this.name="ContributionDeliveryError";}
}
export function validateContributionPatch(patch:string):void{
 if(Buffer.byteLength(patch,"utf8")>4*1024*1024)throw new Error("El aporte supera el límite de 4 MB.");
 // A source line mentioning this Git marker is ordinary text, not a binary hunk.
 if(/^GIT binary patch\r?$/m.test(patch))throw new Error("El aporte contiene archivos binarios.");
 assertPublishableSource(patch);
}
export function contributionFailure(error:unknown):{transient:boolean;message:string}{
 if(error instanceof ContributionDeliveryError)return {transient:false,message:error.message};
 const text=error instanceof Error?error.message:"";
 const transient=/timed out|timeout|resolve host|connect|network|remote end hung|ECONN|GitHub no|fetch first|non-fast-forward|failed to push some refs|502|503|504/i.test(text);
 return {transient,message:transient?"GitHub no respondió. El aporte está guardado y se reintentará.":"No se pudo publicar el aporte. Revisa conflictos, permisos o las comprobaciones; los cambios están guardados."};
}
export async function contributionGit(cwd:string,args:string[],extra:Record<string,string>={}):Promise<string>{
 const r=await exec("git",["-c","core.hooksPath=/dev/null","-c","core.fsmonitor=false",...args],{cwd,env:{...baseEnv(),GIT_TERMINAL_PROMPT:"0",...extra},timeout:120000,maxBuffer:16*1024*1024});
 return r.stdout;
}
export async function saveContribution(job:ContributionJob) {
 job.updatedAt=new Date().toISOString();
 const dir=path.join(outbox(),job.id);await fs.mkdir(dir,{recursive:true,mode:0o700});
 const temp=path.join(dir,"job."+randomUUID()+".tmp");await fs.writeFile(temp,JSON.stringify(job),{mode:0o600});await fs.rename(temp,path.join(dir,"job.json"));
}
export async function captureSource(root:string,index:string):Promise<string>{
 const realRoot = await fs.realpath(root);
 const candidates=[...new Set((await contributionGit(root,["ls-files","--cached","--others","--exclude-standard","-z"])).split("\0").filter(publishablePath))];
 const files:string[]=[];
 for(const file of candidates){
  const stat=await fs.lstat(path.join(root,file)).catch(e=>{if(e.code==="ENOENT")return null;throw e;});
  if(!stat)continue;
  if(!stat.isFile() || stat.size>8*1024*1024)throw new Error("Un archivo del aporte no es código regular o supera 8 MB.");
  const real=await fs.realpath(path.join(root,file));if(!real.startsWith(realRoot+path.sep))throw new Error("Ruta fuera del repositorio.");
  files.push(file);
 }
 const opts={GIT_INDEX_FILE:index};await contributionGit(root,["read-tree","--empty"],opts);
 // Explicit source paths, never 'git add .' or the operator's index.
 for(let i=0;i<files.length;i+=100)await contributionGit(root,["add","--",...files.slice(i,i+100)],opts);
 return (await contributionGit(root,["write-tree"],opts)).trim();
}
export async function assertCoreDeveloper(user:SessionUser|undefined,cwd:string,targetId:string):Promise<void>{
 if(targetId!=="local")return;
 const real=await fs.realpath(cwd).catch(()=>path.resolve(cwd));
 if(overlapsCore(real,await fs.realpath(coreRepository()).catch(()=>coreRepository())) && (!user || !(await githubStatus(user)).canEditCore))
  throw new ForbiddenError("La modificación directa de LUXIPANEL está reservada a Luximus. Utiliza el flujo de módulos y fixes para proponer aportes.");
}
let initialized:Promise<ContributionJob[]>|undefined, timer:ReturnType<typeof setInterval>|undefined, draining=false;
let authorize:((user:SessionUser)=>Promise<SessionUser>)|undefined;
// Serialize only bookkeeping/snapshots, never the lifetime of an assistant turn.
// The backend owns one registry; durable job records restore signed CLI runs.
const activeContributions=new Map<string,ContributionJob>();
let stateUpdate:Promise<void>=Promise.resolve();
function withContributionState<T>(update:()=>Promise<T>):Promise<T>{
 const result=stateUpdate.then(update);
 stateUpdate=result.then(()=>undefined,()=>undefined);
 return result;
}
export function initializeOwnerContributions(check:(user:SessionUser)=>Promise<SessionUser>,canRecover?:(job:ContributionJob)=>Promise<boolean>) {
 authorize=check;
 if(!initialized)initialized=(async()=>{
  await fs.mkdir(outbox(),{recursive:true,mode:0o700});
  const recovered:ContributionJob[]=[];
  for(const entry of await fs.readdir(outbox(),{withFileTypes:true})){
   if(!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name))continue;
   const job=JSON.parse(await fs.readFile(path.join(outbox(),entry.name,"job.json"),"utf8")) as ContributionJob;
   if(job.status==="capturing"){
    if(job.cliBinding && await canRecover?.(job)){recovered.push(job);continue;}
    job.status="interrupted";job.error="La tarea terminó sin un resultado confirmado.";await saveContribution(job);
   }
  }
  for(const job of recovered){
   if(!job.isolated && recovered.some(other=>!other.isolated && other.id!==job.id && overlapsCore(other.root,job.root)))job.overlapped=true;
   activeContributions.set(job.id,job);await saveContribution(job);
  }
  // Legacy single-writer metadata no longer controls whether a chat can run.
  await fs.rm(path.join(outbox(),"active.json"),{force:true});
  timer=setInterval(()=>void drain(),60000);timer.unref();void drain();
  return recovered;
 })().catch(e=>{log.error({error:String(e)},"Could not initialize contribution outbox");throw e;});
 return initialized;
}
export async function beginOwnerContribution(user:SessionUser|undefined,conversationId:string,cwd:string,targetId:string,enabled:boolean):Promise<Ticket|null>{
 await assertCoreDeveloper(user,cwd,targetId);
 if(!enabled || targetId!=="local" || !user || !(await githubStatus(user)).canEditCore || !overlapsCore(await fs.realpath(cwd),await fs.realpath(coreRepository())))return null;
 if(!initialized)throw new Error("El envío automático todavía no está listo.");
 await initialized;
 const root=await fs.realpath(coreRepository());
 return withContributionState(async()=>{
  const job:ContributionJob={id:randomUUID(),conversationId,root,user:{userId:user.userId,username:user.username,displayName:user.username,kind:user.kind,role:user.role,modules:user.modules},before:"",head:"",status:"capturing",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  try{
   for(const active of activeContributions.values()){
    if(!overlapsCore(active.root,root))continue;
    // Persist on BOTH jobs: finishing either first must not re-enable publication.
    job.overlapped=true;active.overlapped=true;await saveContribution(active);
   }
   await saveContribution(job);
   if(!job.overlapped){
    job.head=(await contributionGit(root,["rev-parse","HEAD"])).trim();
    job.before=await captureSource(root,path.join(outbox(),job.id,"before.index"));
    await saveContribution(job);
   }
   activeContributions.set(job.id,job);
   return {job};
  }catch(e){job.status="blocked";job.error="No se pudo preparar el seguimiento del aporte.";await saveContribution(job);throw e;}
 });
}
function activeContribution(user:SessionUser,desc:ContributionCli,targetId:string):ContributionJob|null{
 if(targetId!=="local")return null;
 return [...activeContributions.values()]
  .filter(job=>job.status==="capturing" && job.conversationId===desc.conversationId && job.user.userId===user.userId && job.user.username===user.username)
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]??null;
}
/** Called immediately after persisting the CLI descriptor, including self-heal retries. */
export async function bindOwnerContributionCli(user:SessionUser|undefined,desc:ContributionCli,targetId:string):Promise<void>{
 if(!user || !desc.moduleRecovery || !initialized)return;
 await initialized;
 await withContributionState(async()=>{
  const job=activeContribution(user,desc,targetId);
  if(!job || desc.startedAt<Date.parse(job.createdAt))return;
  job.cliBinding=contributionCliBinding(desc);await saveContribution(job);
 });
}
export async function recoverOwnerContribution(user:SessionUser|undefined,desc:ContributionCli,targetId:string):Promise<Ticket|null>{
 if(!user || !initialized)return null;
 await initialized;
 return withContributionState(async()=>{
  const job=activeContribution(user,desc,targetId);
  if(!job || !job.cliBinding || job.cliBinding!==contributionCliBinding(desc))return null;
  return {job};
 });
}
export async function finishOwnerContribution(ticket:Ticket|null,success:boolean):Promise<string|null>{
 if(!ticket)return null;
 return withContributionState(async()=>{
  // Use the current registry object, including overlap observed after this ticket.
  const job=activeContributions.get(ticket.job.id);
  if(!job)return null;
  try{
   if(!success){job.status="interrupted";await saveContribution(job);return null;}
   if(job.overlapped){
    job.status="blocked";job.error="Hubo tareas simultáneas en el mismo repositorio. Los cambios se conservan y requieren revisión antes de publicarse.";
    await saveContribution(job);return null;
   }
   if(!job.isolated && (await contributionGit(job.root,["rev-parse","HEAD"])).trim()!==job.head)throw new Error("La rama o su historial cambió durante la tarea; el aporte requiere revisión.");
   const after=await captureSource(job.root,path.join(outbox(),job.id,"after.index"));
   const files=(await contributionGit(job.root,["diff","--name-only","-z",job.before,after])).split("\0").filter(Boolean);
   if(!files.length){job.status="empty";await saveContribution(job);return null;}
   const patch=await contributionGit(job.root,["diff","--no-ext-diff","--binary",job.before,after,"--",...files]);
   validateContributionPatch(patch);
   job.files=files;job.patchHash=createHash("sha256").update(patch).digest("hex");
   await fs.writeFile(path.join(outbox(),job.id,"change.patch"),patch,{mode:0o600});
   if(job.isolated){
    const index=path.join(outbox(),job.id,"commit.index"),opts={GIT_INDEX_FILE:index};
    await contributionGit(job.root,["read-tree",job.head],opts);
    for(let i=0;i<files.length;i+=100)await contributionGit(job.root,["add","-A","--",...files.slice(i,i+100)],opts);
    const tree=(await contributionGit(job.root,["write-tree"],opts)).trim();
    const identity=job.author??await githubToken(job.user,true);
    const author={GIT_AUTHOR_NAME:identity.login,GIT_AUTHOR_EMAIL:`${identity.id}+${identity.login}@users.noreply.github.com`,GIT_COMMITTER_NAME:identity.login,GIT_COMMITTER_EMAIL:`${identity.id}+${identity.login}@users.noreply.github.com`};
    job.sourceCommit=(await contributionGit(job.root,["commit-tree",tree,"-p",job.head,"-m",`chore: cambios del asistente ${job.id}\n\nLUXIPANEL-Task: ${job.id}`],author)).trim();
    await contributionGit(job.root,["update-ref",`refs/luxipanel/tasks/${job.id}`,job.sourceCommit]);
   }
   job.status="pending";await saveContribution(job);
   // Queue owns retries; no attempt is repeated until remote commit state is checked.
   void drain();return job.id;
  }catch(e){job.status="blocked";job.error=e instanceof Error?e.message:"No se pudo preparar el aporte.";await saveContribution(job);return job.id;}
  finally{activeContributions.delete(job.id);}
 });
}
export async function listOwnerContributions(user:SessionUser):Promise<Pick<ContributionJob,"id"|"conversationId"|"status"|"createdAt"|"updatedAt"|"commit"|"error"|"ci"|"sourceCommit"|"checksUrl"|"integratedBy">[]>{
 if(!(await githubStatus(user)).canEditCore)throw new ForbiddenError();
 const result:ContributionJob[]=[];
 for(const e of await fs.readdir(outbox(),{withFileTypes:true}).catch(()=>[])){
  if(!e.isDirectory()||!/^[a-f0-9-]{36}$/.test(e.name))continue;
  const job=JSON.parse(await fs.readFile(path.join(outbox(),e.name,"job.json"),"utf8")) as ContributionJob;
  if(job.user.userId===user.userId&&job.user.username===user.username)result.push(job);
 }
 return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(({id,conversationId,status,createdAt,updatedAt,commit,error,ci,sourceCommit,checksUrl,integratedBy})=>({id,conversationId,status,createdAt,updatedAt,commit,error,ci,sourceCommit,checksUrl,integratedBy}));
}
export async function retryOwnerContribution(user:SessionUser,id:string):Promise<void>{
 if(!/^[a-f0-9-]{36}$/.test(id)||!(await githubStatus(user)).canEditCore)throw new ForbiddenError();
 const job=JSON.parse(await fs.readFile(path.join(outbox(),id,"job.json"),"utf8")) as ContributionJob;
 if(job.user.userId!==user.userId||job.user.username!==user.username||!["blocked","pending"].includes(job.status)||!job.patchHash)throw new ForbiddenError();
 job.status="pending";job.nextAttempt=0;job.error=undefined;await saveContribution(job);void drain();
}
export async function deliverContribution(job:ContributionJob, remoteUrl = REMOTE, authorizeUser = authorize):Promise<void>{
 if(job.sourceCommit)return deliverIsolatedContribution(job,remoteUrl,authorizeUser);
 if(!authorizeUser)throw new Error("Autorización no disponible");
 const user=await authorizeUser(job.user),identity=await githubToken(user,true);
 const dir=path.join(outbox(),job.id),cwd=path.join(dir,"delivery"),patch=await fs.readFile(path.join(dir,"change.patch"),"utf8");
 if(createHash("sha256").update(patch).digest("hex")!==job.patchHash)throw new Error("La integridad del aporte cambió.");
 validateContributionPatch(patch);
 if(job.files?.some(f=>/^web\/modules\//.test(f)))throw new Error("Los módulos se publican desde Dev mediante su flujo de PR a modules.");
 // Token goes to a short-lived child environment, never argv, remote URLs or logs.
 const auth={GIT_CONFIG_COUNT:"2",GIT_CONFIG_KEY_0:"credential.helper",GIT_CONFIG_VALUE_0:"",GIT_CONFIG_KEY_1:"http.https://github.com/.extraheader",GIT_CONFIG_VALUE_1:"AUTHORIZATION: basic "+Buffer.from("x-access-token:"+identity.token).toString("base64")};
 if(!job.commit)await fs.rm(cwd,{recursive:true,force:true});
 await fs.mkdir(cwd,{recursive:true,mode:0o700});
 await contributionGit(cwd,["init","--quiet"]);
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,"refs/heads/developer:refs/remotes/upstream/developer"],auth);
 const remote=(await contributionGit(cwd,["rev-parse","refs/remotes/upstream/developer"])).trim();
 if(job.commit){
  try{await contributionGit(cwd,["merge-base","--is-ancestor",job.commit,remote]);job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";await saveContribution(job);return;}catch{/* pending or unrelated update */}
  if(job.base!==remote)throw new Error("developer avanzó antes de confirmar el envío. El commit se conserva para revisión.");
 }else{
  await contributionGit(cwd,["checkout","--quiet","--detach",remote]);
  try{await contributionGit(cwd,["apply","--check","--index",path.join(dir,"change.patch")]);}
  catch(error){
   const details=String((error as {stderr?:string}).stderr??"");
   if(/does not exist in index|No such file or directory/.test(details))
    throw new ContributionDeliveryError("base-missing","developer todavía no contiene archivos anteriores de los que depende este aporte. Hay que sincronizar esa base antes de enviarlo; el parche está conservado.");
   throw new ContributionDeliveryError("patch-conflict","El aporte no coincide con el código de developer. Hay cambios previos pendientes o conflictos que deben resolverse antes de enviarlo; el parche está conservado.");
  }
  await contributionGit(cwd,["apply","--index",path.join(dir,"change.patch")]);
  await contributionGit(cwd,["diff","--cached","--check"]);
  const staged=(await contributionGit(cwd,["diff","--cached","--name-only","-z"])).split("\0").filter(Boolean);
  if(staged.some(f=>!publishablePath(f)))throw new Error("El aporte incluye rutas fuera del código permitido.");
  for(const f of staged){
   const content=await fs.readFile(path.join(cwd,f),"utf8").catch(e=>{if(e.code==="ENOENT")return "";throw e;});assertPublishableSource(content);
   if(f.endsWith(".json")&&content)JSON.parse(content);
  }
  const message="chore: cambios del asistente "+job.id+"\n\nLUXIPANEL-Task: "+job.id+"\n";
  await fs.writeFile(path.join(dir,"message.txt"),message,{mode:0o600});
  await contributionGit(cwd,["-c","user.name="+identity.login,"-c","user.email="+identity.id+"+"+identity.login+"@users.noreply.github.com","commit","--quiet","--file",path.join(dir,"message.txt")]);
  job.commit=(await contributionGit(cwd,["rev-parse","HEAD"])).trim();job.base=remote;await saveContribution(job);
 }
 await contributionGit(cwd,["push","--porcelain",remoteUrl,job.commit+":refs/heads/developer"],auth);
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,"refs/heads/developer:refs/remotes/upstream/developer"],auth);
 await contributionGit(cwd,["merge-base","--is-ancestor",job.commit!,"refs/remotes/upstream/developer"]);
 job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";job.error=undefined;await saveContribution(job);
 await fs.rm(cwd,{recursive:true,force:true});
 await fs.rm(path.join(dir,"before.index"),{force:true});await fs.rm(path.join(dir,"after.index"),{force:true});
}
async function drain():Promise<void>{
 if(draining||!authorize)return;draining=true;
 let unlock:(()=>void)|undefined;
 try{
  unlock=await publisherLock();
  if(!unlock)return;
  const rows=await fs.readdir(outbox(),{withFileTypes:true});
  const ordered:ContributionJob[]=[];
  for(const row of rows){
   if(!row.isDirectory()||!/^[a-f0-9-]{36}$/.test(row.name))continue;
   const job=JSON.parse(await fs.readFile(path.join(outbox(),row.name,"job.json"),"utf8")) as ContributionJob;
   if(job.status==="pending")ordered.push(job);
   if(job.status==="pushed" && job.commit && (job.ci===undefined||job.ci==="pending"||job.ci==="missing") && Date.now()-(job.ciCheckedAt||0)>60000)await refreshContributionChecks(job).catch(()=>undefined);
  }
  ordered.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(const job of ordered){
   if((job.nextAttempt||0)>Date.now())continue;
   try{await deliverContribution(job);}catch(e){
    // Git errors can contain headers: never persist/log raw process errors.
    const {transient,message}=contributionFailure(e);
    job.attempt=(job.attempt||0)+1;
    job.status=transient?"pending":"blocked";job.error=message;
    job.nextAttempt=Date.now()+Math.min(3600000,60000*2**Math.min(job.attempt,6));await saveContribution(job);continue;
   }
  }
 }catch{log.warn("No se pudo consultar la cola de aportes.");}finally{unlock?.();draining=false;}
}

/** Kernel lock survives backend crashes and excludes other publisher processes. */
export async function publisherLock():Promise<(()=>void)|undefined>{
 await fs.mkdir(outbox(),{recursive:true,mode:0o700});
 return new Promise((resolve,reject)=>{
  const child=spawn("flock",["-n",path.join(outbox(),"publisher.lock"),"sh","-c","printf ready; cat >/dev/null"],{stdio:["pipe","pipe","ignore"]});
  child.once("error",reject);
  child.stdout.once("data",()=>resolve(()=>child.stdin.end()));
  child.once("exit",()=>resolve(undefined));
 });
}
const gitAuth=(token:string)=>({GIT_CONFIG_COUNT:"2",GIT_CONFIG_KEY_0:"credential.helper",GIT_CONFIG_VALUE_0:"",GIT_CONFIG_KEY_1:"http.https://github.com/.extraheader",GIT_CONFIG_VALUE_1:"AUTHORIZATION: basic "+Buffer.from("x-access-token:"+token).toString("base64")});

/** New tasks use independent worktrees. Incomplete turns resume the same workspace. */
export async function beginIsolatedOwnerContribution(user:SessionUser|undefined,conversationId:string,cwd:string,targetId:string,enabled:boolean,remoteUrl=REMOTE):Promise<Ticket|null>{
 await assertCoreDeveloper(user,cwd,targetId);
 if(!enabled||targetId!=="local"||!user||!(await githubStatus(user)).canEditCore)return null;
 const core=await fs.realpath(coreRepository()),real=await fs.realpath(cwd);
 let common="";
 try{common=(await contributionGit(real,["rev-parse","--path-format=absolute","--git-common-dir"])).trim();}catch{}
 if(!overlapsCore(real,core)&&common!==path.join(core,".git"))return null;
 if(!initialized)throw new Error("El envío automático todavía no está listo.");await initialized;
 // Migration guard is installation-local; no reset of any active working tree.
 const maintenance=await fs.stat(path.join(outbox(),"maintenance.json")).catch(()=>null);
 if(maintenance)throw new Error("Se está sincronizando el código existente. Los cambios están conservados; reintenta esta tarea al finalizar la sincronización.");
 return withContributionState(async()=>{
  const entries=await fs.readdir(outbox(),{withFileTypes:true});
  const resumable:ContributionJob[]=[];
  for(const e of entries){
   if(!e.isDirectory()||!/^[a-f0-9-]{36}$/.test(e.name))continue;
   const j=JSON.parse(await fs.readFile(path.join(outbox(),e.name,"job.json"),"utf8")) as ContributionJob;
   if(j.isolated&&j.conversationId===conversationId&&j.user.userId===user.userId&&j.user.username===user.username&&j.status==="interrupted")resumable.push(j);
  }
  const resume=resumable.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  if(resume){
   await fs.access(resume.root);resume.status="capturing";resume.error=undefined;await saveContribution(resume);activeContributions.set(resume.id,resume);return {job:resume};
  }
  const identity=await githubToken(user,true);
  await contributionGit(core,["fetch","--quiet","--no-tags",remoteUrl,"refs/heads/developer:refs/remotes/lxp-owner/developer"],gitAuth(identity.token));
  const base=(await contributionGit(core,["rev-parse","refs/remotes/lxp-owner/developer"])).trim();
  const id=randomUUID(),workspace=path.join(core,".lxp","owner-workspaces",id);
  await fs.mkdir(path.dirname(workspace),{recursive:true,mode:0o700});
  // Existing team worktrees stay owned by their lifecycle; capture them in place.
  const top=common===path.join(core,".git")?(await contributionGit(real,["rev-parse","--show-toplevel"])).trim():core;
  const external=top!==core;
  const root=external?(await contributionGit(real,["rev-parse","--show-toplevel"])).trim():workspace;
  if(!external)await contributionGit(core,["worktree","add","--detach",root,base]);
  const sub=real.startsWith(core+path.sep)&&!real.includes("/.lxp/")?path.relative(core,real):"";
  const job:ContributionJob={id,conversationId,root,user:{userId:user.userId,username:user.username,displayName:user.username,kind:user.kind,role:user.role,modules:user.modules},before:"",head:(await contributionGit(root,["rev-parse","HEAD"])).trim(),isolated:true,repository:core,author:{login:identity.login,id:identity.id},workspaceCwd:external?real:path.join(root,sub),status:"capturing",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await saveContribution(job);job.before=await captureSource(root,path.join(outbox(),id,"before.index"));
  const anchor=(await contributionGit(root,["commit-tree",job.before,"-p",job.head,"-m",`Private snapshot ${id}`],{GIT_AUTHOR_NAME:"LUXIPANEL",GIT_AUTHOR_EMAIL:"snapshot@localhost",GIT_COMMITTER_NAME:"LUXIPANEL",GIT_COMMITTER_EMAIL:"snapshot@localhost"})).trim();
  await contributionGit(root,["update-ref",`refs/luxipanel/snapshots/${id}`,anchor]);await saveContribution(job);
  activeContributions.set(id,job);return {job};
 });
}

export async function deliverIsolatedContribution(job:ContributionJob,remoteUrl=REMOTE,authorizeUser=authorize):Promise<void>{
 if(!authorizeUser)throw new Error("Autorización no disponible");
 const user=await authorizeUser(job.user),identity=await githubToken(user,true),auth=gitAuth(identity.token);
 const dir=path.join(outbox(),job.id),cwd=path.join(dir,"delivery-v2-"+randomUUID());
 await fs.mkdir(cwd,{recursive:true,mode:0o700});await contributionGit(cwd,["init","--quiet"]);
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,"refs/heads/developer:refs/remotes/upstream/developer"],auth);
 const remote=(await contributionGit(cwd,["rev-parse","refs/remotes/upstream/developer"])).trim();
 if(job.commit){
  try{await contributionGit(cwd,["merge-base","--is-ancestor",job.commit,remote]);job.status="pushed";job.ci??="pending";job.error=undefined;await saveContribution(job);return;}catch{}
 }
 await contributionGit(cwd,["fetch","--quiet",job.repository??job.root,job.sourceCommit!]);
 // Dedicated integration checkout; source task worktrees and their refs remain intact.
 await contributionGit(cwd,["checkout","--quiet","--detach",remote]);
 try{await contributionGit(cwd,["cherry-pick","--no-commit",job.sourceCommit!]);}
 catch{
  await contributionGit(cwd,["cherry-pick","--abort"]).catch(()=>undefined);
  throw new ContributionDeliveryError("patch-conflict","Otra tarea modificó las mismas líneas. Ambas versiones están guardadas; resuelve el conflicto antes de reenviar.");
 }
 await contributionGit(cwd,["diff","--cached","--check"]);
 const patch=await contributionGit(cwd,["diff","--cached","--binary"]);validateContributionPatch(patch);
 const files=(await contributionGit(cwd,["diff","--cached","--name-only","-z"])).split("\0").filter(Boolean);
 if(files.some(f=>!publishablePath(f)||f.startsWith("web/modules/")))throw new Error("El aporte incluye archivos fuera del flujo del núcleo.");
 for(const f of files){const content=await fs.readFile(path.join(cwd,f),"utf8").catch(e=>{if(e.code==="ENOENT")return "";throw e;});assertPublishableSource(content);if(f.endsWith(".json")&&content)JSON.parse(content);}
 if(!files.length){job.commit=remote;job.integratedBy=remote;job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";await saveContribution(job);return;}
 await contributionGit(cwd,["-c","user.name="+identity.login,"-c","user.email="+identity.id+"+"+identity.login+"@users.noreply.github.com","commit","--quiet","-m",`chore: cambios del asistente ${job.id}\n\nLUXIPANEL-Task: ${job.id}`]);
 job.commit=(await contributionGit(cwd,["rev-parse","HEAD"])).trim();job.base=remote;await saveContribution(job);
 await contributionGit(cwd,["push","--porcelain",remoteUrl,job.commit+":refs/heads/developer"],auth);
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,"refs/heads/developer:refs/remotes/upstream/developer"],auth);
 await contributionGit(cwd,["merge-base","--is-ancestor",job.commit,"refs/remotes/upstream/developer"]);
 job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";job.error=undefined;await saveContribution(job);
}

export async function refreshContributionChecks(job:ContributionJob):Promise<void>{
 if(!job.commit)return;
 if(!authorize)throw new Error("Autorización no disponible");
 const user=await authorize(job.user),identity=await githubToken(user,true);
 const r=await fetch(`https://api.github.com/repos/Luxisoft/LUXIPANEL/actions/workflows/release-checks.yml/runs?head_sha=${encodeURIComponent(job.commit)}&per_page=20`,{headers:{Authorization:`Bearer ${identity.token}`,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(15000),redirect:"error"});
 if(!r.ok)throw new Error("No se pudo consultar la verificación en GitHub.");
 const body=await r.json() as {workflow_runs:Array<{head_sha:string;status:string;conclusion:string|null;html_url:string;run_number:number}>};
 const run=body.workflow_runs.filter(r=>r.head_sha===job.commit).sort((a,b)=>b.run_number-a.run_number)[0];
 job.ciCheckedAt=Date.now();
 if(!run)job.ci=Date.now()-Date.parse(job.pushedAt??job.createdAt)>600000?"missing":"pending";
 else {job.checksUrl=run.html_url;job.ci=run.status!=="completed"?"pending":run.conclusion==="success"?"success":"failure";}
 await saveContribution(job);
}
