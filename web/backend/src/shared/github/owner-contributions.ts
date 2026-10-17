// SPDX-License-Identifier: AGPL-3.0-only
/** Installation-local outbox for the verified maintainer's chat changes.
 * Private Git indexes never change the running branch/index or copy the checkout.
 * Concurrent turns by the same principal are sealed together after all succeed.
 * Durable snapshots keep pending batches independent of later workspace changes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../../config/env.js";
import { repositoryRoot } from "../installation-layout.js";
import { legacyRecoveryBatches, legacyActiveBatches, sameContributionPrincipal } from "./contribution-batches.js";
import { githubStatus, githubToken } from "./user-connection.js";
import { assertPublishableSource } from "../diagnostics/publication-check.js";
import { collectChangeNotes, contributionMessage, type PublicChangeNote } from "./change-notes.js";
import { applyContributionContinuation, type ContributionContinuationReview } from "./contribution-continuation.js";
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
 error?:string; attempt?:number; nextAttempt?:number; ci?:"pending"|"success"|"failure"|"missing"; checksUrl?:string; ciCheckedAt?:number; ciRequestedAt?:number;
 teamTaskId?:string; repository?:string; author?:{login:string;id:number}; isolated?:boolean; sourceCommit?:string; workspaceCwd?:string; integratedBy?:string; pushedAt?:string;
 cliBinding?:string;
 notes?:PublicChangeNote[];
 /** A batch can publish only after every participant confirms success. */
 batchId?:string; completedAt?:string; succeeded?:boolean; after?:string; includedIn?:string; checkoutAligned?:boolean;
 /** Evidence for review only; never a publishable patch or a successful outcome. */
 interruption?:{observedAt:string;patchHash?:string};
 /** A separate, explicitly reviewed delivery never changes the failed task's outcome. */
 recoveryOf?:string; recoveredBy?:string; reviewedAt?:string;
 continuationReview?:ContributionContinuationReview;
 legacyRecovery?:{members:string[];after:string};
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
 const detail=error as {stderr?:unknown;stdout?:unknown}|null;
 // Inspect process output for classification only; never store raw Git errors,
 // which may include authorization headers or source snippets.
 const text=[error instanceof Error?error.message:"",typeof detail?.stderr==="string"?detail.stderr:"",typeof detail?.stdout==="string"?detail.stdout:""].join("\n");
 if(/new blank line at EOF|trailing whitespace|space before tab in indent/i.test(text))return {transient:false,message:"La validación de formato detectó espacios sobrantes o una línea vacía al final de un archivo. Corrige el formato, incluidos los archivos nuevos; el aporte está guardado."};
 if(/workflow/i.test(text)&&/scope|permission|refusing/i.test(text))return {transient:false,message:"La conexión GitHub necesita permiso workflow para publicar cambios de Actions. El commit y los archivos están guardados."};
 if(/secret scanning|push protection|detected secret/i.test(text))return {transient:false,message:"GitHub bloqueó el aporte por una posible credencial. Revisa el contenido antes de publicarlo; los archivos están guardados."};
 if(/GH006|GH013|protected branch|rule violations/i.test(text))return {transient:false,message:"GitHub rechazó el aporte por las reglas de la rama. Revisa las comprobaciones o revisiones requeridas; los archivos están guardados."};
 if(/Authentication failed|Bad credentials|invalid credentials|invalid username or token/i.test(text))return {transient:false,message:"GitHub rechazó las credenciales. Vuelve a conectar tu cuenta; los archivos están guardados."};
 if(/403|permission.*denied|write access.*not granted/i.test(text))return {transient:false,message:"La conexión GitHub no tiene permiso para publicar este aporte. Revisa los permisos del repositorio; los archivos están guardados."};
 if(/fetch first|non-fast-forward/i.test(text))return {transient:true,message:"developer recibió cambios durante el envío. El aporte está guardado y se volverá a comprobar antes de reintentarlo."};
 const transient=/timed out|timeout|resolve host|Failed to connect|network is unreachable|remote end hung|ECONN|502|503|504/i.test(text);
 return {transient,message:transient?"No se pudo completar la conexión con GitHub. El aporte está guardado y se reintentará.":"No se pudo publicar el aporte. Revisa conflictos, permisos o las comprobaciones; los cambios están guardados."};
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
 const core=await fs.realpath(coreRepository()).catch(()=>coreRepository());
 let belongsToCore=overlapsCore(real,core);
 if(!belongsToCore){
  try{belongsToCore=(await contributionGit(real,["rev-parse","--path-format=absolute","--git-common-dir"])).trim()===path.join(core,".git");}catch{/* Unrelated directory. */}
 }
 if(belongsToCore && (!user || !(await githubStatus(user)).canEditCore))
  throw new ForbiddenError("La modificación directa de LUXIPANEL está reservada a Luximus. Utiliza el flujo de módulos y fixes para proponer aportes.");
}
let initialized:Promise<ContributionJob[]>|undefined, timer:ReturnType<typeof setInterval>|undefined, draining=false, drainAgain=false;
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
  const recovered:ContributionJob[]=[],tracked:ContributionJob[]=[];
  for(const entry of await fs.readdir(outbox(),{withFileTypes:true})){
   if(!entry.isDirectory() || !/^[a-f0-9-]{36}$/.test(entry.name))continue;
   const job=JSON.parse(await fs.readFile(path.join(outbox(),entry.name,"job.json"),"utf8")) as ContributionJob;
   tracked.push(job);
   if(job.status==="capturing"){
    if(job.cliBinding && await canRecover?.(job)){recovered.push(job);continue;}
    job.status="interrupted";job.succeeded=false;job.completedAt=new Date().toISOString();job.error="La tarea terminó sin un resultado confirmado.";await saveContribution(job);
   }
  }
  for(const members of legacyActiveBatches(tracked,recovered)){
   const first=members[0]!;
   for(const member of members){
    member.batchId=first.id;
    if(member.status==="blocked"){
     member.completedAt=member.updatedAt;member.succeeded=true;member.status="pending";member.error=undefined;
    }
    await saveContribution(member);
   }
  }
  for(const job of recovered){
   if(recovered.some(other=>other.id!==job.id && other.root===job.root))job.overlapped=true;
   if(!job.overlapped && !job.isolated)job.batchId??=job.id;
   activeContributions.set(job.id,job);await saveContribution(job);
  }
  for(const job of tracked.filter(j=>j.status==="interrupted"&&!j.after)){
   // Only an unambiguous, unchanged task boundary can be observed at startup.
   if(tracked.some(j=>j.id!==job.id&&j.root===job.root&&j.createdAt>job.createdAt))continue;
   await preserveInterruptedContribution(job);
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
 if(!enabled || targetId!=="local" || !user || !(await githubStatus(user)).canEditCore)return null;
 const core=await fs.realpath(coreRepository()),real=await fs.realpath(cwd);
 let common="",top="";
 try{
  common=(await contributionGit(real,["rev-parse","--path-format=absolute","--git-common-dir"])).trim();
  top=(await contributionGit(real,["rev-parse","--show-toplevel"])).trim();
 }catch{/* An ancestor project can contain the core repository. */}
 if(!overlapsCore(real,core)&&common!==path.join(core,".git"))return null;
 if(!initialized)throw new Error("El envío automático todavía no está listo.");
 await initialized;
 // An explicitly supplied team/legacy worktree keeps its own lifecycle. Never
 // allocate one, fetch another checkout, or redirect an ordinary project's cwd.
 const root=common===path.join(core,".git")&&top!==core?top:core;
 const isolated=root!==core;
 if(!isolated && (await contributionGit(root,["branch","--show-current"])).trim()!=="developer")
  throw new Error("El proyecto LUXIPANEL debe estar en la rama developer. Conserva los cambios pendientes antes de cambiar de rama.");
 if(await fs.stat(path.join(outbox(),"maintenance.json")).catch(()=>null))
  throw new Error("Se está sincronizando el código existente. Los cambios están conservados; reintenta esta tarea al finalizar la sincronización.");
 return withContributionState(async()=>{
  // Reconcile confirmed changes before taking the next turn's baseline. A busy
  // task, deployment, staged edit or conflicting source still prevents alignment.
  if(!isolated)await alignRecentPublishedContributions(root);
  const job:ContributionJob={id:randomUUID(),conversationId,root,user:{userId:user.userId,username:user.username,displayName:user.username,kind:user.kind,role:user.role,modules:user.modules},before:"",head:"",...(isolated?{isolated:true,repository:core}:{}),status:"capturing",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  try{
   for(const active of activeContributions.values()){
    if(active.root!==root)continue;
    // Persist on BOTH jobs: finishing either first must not re-enable publication.
    job.overlapped=true;active.overlapped=true;
    if(!isolated && active.batchId)job.batchId=active.batchId;
    await saveContribution(active);
   }
   if(!isolated && !job.overlapped)job.batchId=job.id;
   await saveContribution(job);
   if(!job.overlapped){
    job.head=(await contributionGit(root,["rev-parse","HEAD"])).trim();
    job.before=await captureSource(root,path.join(outbox(),job.id,"before.index"));
    const anchor=(await contributionGit(root,["commit-tree",job.before,"-p",job.head,"-m",`Private snapshot ${job.id}`],{GIT_AUTHOR_NAME:"LUXIPANEL",GIT_AUTHOR_EMAIL:"snapshot@localhost",GIT_COMMITTER_NAME:"LUXIPANEL",GIT_COMMITTER_EMAIL:"snapshot@localhost"})).trim();
    await contributionGit(root,["update-ref",`refs/luxipanel/snapshots/${job.id}`,anchor]);
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
export async function finishOwnerContribution(ticket:Ticket|null,success:boolean,verified=false):Promise<string|null>{
 if(!ticket)return null;
 if(success&&ticket.job.teamTaskId&&!verified)return null;
 return withContributionState(async()=>{
  // Use the current registry object, including overlap observed after this ticket.
  const job=activeContributions.get(ticket.job.id);
  if(!job)return null;
  try{
   job.completedAt=new Date().toISOString();job.succeeded=success;
   if(!success){job.status="interrupted";await saveContribution(job);await preserveInterruptedContribution(job);await sealBatch(job.batchId);return null;}
   if(job.overlapped && !job.batchId){
    job.status="blocked";job.error="Hubo tareas simultáneas en el mismo repositorio. Los cambios se conservan y requieren revisión antes de publicarse.";
    await saveContribution(job);return null;
   }
   if(!job.isolated && ((await contributionGit(job.root,["branch","--show-current"])).trim()!=="developer" || (await contributionGit(job.root,["rev-parse","HEAD"])).trim()!==(job.head || (await readContributionJobs()).find(j=>j.id===job.batchId)?.head)))throw new Error("La rama o su historial cambió durante la tarea; el aporte requiere revisión.");
   const after=await captureSource(job.root,path.join(outbox(),job.id,"after.index"));
   job.after=after;
   const anchor=(await contributionGit(job.root,["commit-tree",after,"-m",`Private completed snapshot ${job.id}`],{GIT_AUTHOR_NAME:"LUXIPANEL",GIT_AUTHOR_EMAIL:"snapshot@localhost",GIT_COMMITTER_NAME:"LUXIPANEL",GIT_COMMITTER_EMAIL:"snapshot@localhost"})).trim();
   await contributionGit(job.root,["update-ref",`refs/luxipanel/snapshots/${job.id}-after`,anchor]);
   await applyContributionContinuation(job,after);
   job.status="pending";await saveContribution(job);
   if(job.batchId)return await sealBatch(job.batchId);
   return await prepareContribution(job,after)?job.id:null;
  }catch(e){job.status="blocked";job.succeeded=false;job.error=e instanceof Error?e.message:"No se pudo preparar el aporte.";await saveContribution(job);return job.id;}
  finally{activeContributions.delete(job.id);void drain();}
 });
}

export async function readContributionJobs():Promise<ContributionJob[]>{
 const rows=await fs.readdir(outbox(),{withFileTypes:true}).catch(()=>[]);
 return Promise.all(rows.filter(e=>e.isDirectory()&&/^[a-f0-9-]{36}$/.test(e.name)).map(async e=>JSON.parse(await fs.readFile(path.join(outbox(),e.name,"job.json"),"utf8")) as ContributionJob));
}

/** Preserve an interrupted single-writer delta without approving or publishing it. */
async function preserveInterruptedContribution(job:ContributionJob):Promise<void>{
 if(!job.before||job.overlapped||job.includedIn||job.isolated||job.after||[...activeContributions.values()].some(j=>j.id!==job.id&&j.root===job.root))return;
 try{
  if((await contributionGit(job.root,["branch","--show-current"])).trim()!=="developer" || (await contributionGit(job.root,["rev-parse","HEAD"])).trim()!==job.head)return;
  const dir=path.join(outbox(),job.id),after=await captureSource(job.root,path.join(dir,"interrupted.index"));
  await contributionGit(job.root,["update-ref",`refs/luxipanel/snapshots/${job.id}-interrupted`,after]);
  job.after=after;job.files=(await contributionGit(job.root,["diff","--name-only","-z",job.before,after])).split("\0").filter(Boolean);
  job.interruption={observedAt:new Date().toISOString()};
  if(job.files.length){
   const patch=await contributionGit(job.root,["diff","--no-ext-diff","--full-index","--binary",job.before,after]);
   validateContributionPatch(patch);
   await fs.writeFile(path.join(dir,"interrupted.patch"),patch,{mode:0o600});
   job.interruption.patchHash=createHash("sha256").update(patch).digest("hex");
   job.error="La tarea se interrumpió con cambios pendientes. Se guardó una instantánea para revisarlos y completar la tarea antes de publicar o actualizar.";
  }
 }catch{
  job.error="La tarea se interrumpió y no se pudo completar su instantánea. El código local se conserva; revisa la tarea antes de publicar o actualizar.";
 }finally{await saveContribution(job);}
}

export type ContributionUpdateBlocker="assistant-active"|"publication-pending"|"contribution-review"|"checkout-sync";
export function reviewedContribution(job:ContributionJob,jobs:ContributionJob[]):ContributionJob|undefined{
 return jobs.find(next=>sameContributionPrincipal(next,job) && !!next.patchHash && !!next.reviewedAt && (
  (next.recoveryOf===job.id && next.before===job.before && next.after===job.after) ||
  (next.succeeded===true && !!next.completedAt && !!job.interruption?.patchHash &&
   next.continuationReview?.sources?.some(source=>source.id===job.id&&source.snapshotHash===job.interruption?.patchHash) &&
   next.continuationReview.after===next.after && next.continuationReview.patchHash===next.patchHash)
 ));
}
/** Read-only diagnosis. No source is published, discarded, or reset by preflight. */
export async function contributionUpdateBlocker(root:string,changedFiles:string[]):Promise<ContributionUpdateBlocker|undefined>{
 if(initialized)await initialized;
 return withContributionState(async()=>{
  if([...activeContributions.values()].some(j=>j.root===root))return "assistant-active";
  if(!changedFiles.length)return undefined;
  const changed=new Set(changedFiles),jobs=(await readContributionJobs()).filter(j=>j.root===root&&!j.isolated&&!j.includedIn);
  const head=(await contributionGit(root,["rev-parse","HEAD"])).trim();
  let pending=false,synchronizing=false;
  for(const job of jobs){
   if(reviewedContribution(job,jobs))continue;
   const files=job.files?.filter(f=>changed.has(f))??[];
   if(!files.length||job.status==="empty"||job.status==="capturing")continue;
   if(job.status==="pushed"&&job.commit){
    try{await contributionGit(root,["merge-base","--is-ancestor",job.commit,head]);continue;}catch{/* published, not yet aligned */}
    synchronizing=true;continue;
   }
   // Ignore historical interruptions whose observed edits are already in HEAD.
   if(job.after){
    try{if(!(await contributionGit(root,["diff","--name-only",job.after,head,"--",...files])).trim())continue;}catch{/* Missing evidence must be reviewed. */}
   }
   if(job.status==="pending"&&job.patchHash){pending=true;continue;}
   if(job.status==="interrupted"||job.status==="blocked")return "contribution-review";
  }
  return pending?"publication-pending":synchronizing?"checkout-sync":undefined;
 });
}
async function prepareContribution(job:ContributionJob,after:string):Promise<boolean>{
   const before=job.continuationReview?.before??job.before;
   const files=(await contributionGit(job.root,["diff","--name-only","-z",before,after])).split("\0").filter(Boolean);
   if(!files.length){job.status="empty";await saveContribution(job);return false;}
   const patch=await contributionGit(job.root,["diff","--no-ext-diff",...(job.continuationReview?["--full-index"]:[]),"--binary",before,after,"--",...files]);
   validateContributionPatch(patch);
   job.notes=await collectChangeNotes(files, async file => {
    const exists=(await contributionGit(job.root,["ls-tree","--name-only",after,"--",file])).trim();
    return exists ? contributionGit(job.root,["show",after+":"+file]) : "";
   });
   job.files=files;job.patchHash=createHash("sha256").update(patch).digest("hex");
   await fs.writeFile(path.join(outbox(),job.id,"change.patch"),patch,{mode:0o600});
   if(job.isolated){
    const index=path.join(outbox(),job.id,"commit.index"),opts={GIT_INDEX_FILE:index};
    await contributionGit(job.root,["read-tree",job.head],opts);
    for(let i=0;i<files.length;i+=100)await contributionGit(job.root,["add","-A","--",...files.slice(i,i+100)],opts);
    const tree=(await contributionGit(job.root,["write-tree"],opts)).trim();
    const identity=job.author??await githubToken(job.user,true);
    const author={GIT_AUTHOR_NAME:identity.login,GIT_AUTHOR_EMAIL:`${identity.id}+${identity.login}@users.noreply.github.com`,GIT_COMMITTER_NAME:identity.login,GIT_COMMITTER_EMAIL:`${identity.id}+${identity.login}@users.noreply.github.com`};
    job.sourceCommit=(await contributionGit(job.root,["commit-tree",tree,"-p",job.head,"-m",contributionMessage(job.id,job.notes)],author)).trim();
    await contributionGit(job.root,["update-ref",`refs/luxipanel/tasks/${job.id}`,job.sourceCommit]);
   }
   job.status="pending";job.error=undefined;await saveContribution(job);return true;
}
async function syncBatchMembers(leader:ContributionJob,jobs:ContributionJob[]):Promise<void>{
 for(const member of jobs.filter(j=>j.batchId===leader.id&&j.id!==leader.id)){
  member.includedIn=leader.id;member.status=leader.status;member.error=leader.error;
  member.commit=leader.commit;member.ci=leader.ci;member.checksUrl=leader.checksUrl;member.integratedBy=leader.commit;
  await saveContribution(member);
 }
}
async function sealBatch(id:string|undefined):Promise<string|null>{
 if(!id)return null;
 const jobs=await readContributionJobs(),members=jobs.filter(j=>j.batchId===id),leader=activeContributions.get(id)??members.find(j=>j.id===id);
 if(!leader || members.some(j=>j.status==="capturing"))return null;
 if(leader.legacyRecovery?.members.some(id=>!members.some(j=>j.id===id)))return null;
 if(leader.patchHash || leader.status==="empty"){await syncBatchMembers(leader,jobs);return leader.status==="empty"?null:id;}
 if(members.some(j=>j.succeeded!==true||!j.completedAt||!sameContributionPrincipal(j,leader))){
  for(const member of members.filter(j=>j.status==="pending")){
   member.status="blocked";member.error="Una tarea del grupo no terminó correctamente o pertenece a otra identidad. Los cambios se conservan para revisión.";await saveContribution(member);
  }
  return null;
 }
 const last=members.sort((a,b)=>a.completedAt!.localeCompare(b.completedAt!)).at(-1)!;
 if(!leader.before || !last.after)return null;
 let prepared=false;
 try{prepared=await prepareContribution(leader,last.after);}
 catch(e){leader.status="blocked";leader.succeeded=false;leader.error=contributionFailure(e).message;await saveContribution(leader);}
 await syncBatchMembers(leader,jobs);
 return prepared?id:null;
}
/** Only closed, successful legacy groups bounded by a later immutable snapshot. */
export async function recoverClosedContributionBatches():Promise<void>{
 const jobs=await readContributionJobs();
 for(const {members,boundary} of legacyRecoveryBatches(jobs)){
  const leader=members[0];if(!leader)continue;
  leader.completedAt??=leader.updatedAt;
  leader.legacyRecovery={members:members.map(j=>j.id),after:boundary.before};
  await saveContribution(leader);
 }
 for(const leader of jobs.filter(j=>j.legacyRecovery&&!j.patchHash&&j.status!=="empty")){
  const plan=leader.legacyRecovery!;
  // A durable plan resumes interrupted migration without losing participants.
  const members=plan.members.map(id=>jobs.find(j=>j.id===id));
  if(members.some(j=>!j||!sameContributionPrincipal(j,leader)))continue;
  await contributionGit(leader.root,["cat-file","-e",leader.before+"^{tree}"]);
  await contributionGit(leader.root,["cat-file","-e",plan.after+"^{tree}"]);
  for(const member of members as ContributionJob[]){
   if(member.batchId===leader.id)continue;
   member.batchId=leader.id;member.completedAt??=member.updatedAt;member.succeeded=true;member.after=plan.after;
   member.status="pending";member.error=undefined;await saveContribution(member);
  }
 }
 for(const id of new Set((await readContributionJobs()).map(j=>j.batchId).filter((id):id is string=>!!id)))await sealBatch(id);
}

export async function listOwnerContributions(user:SessionUser){
 if(!(await githubStatus(user)).canEditCore)throw new ForbiddenError();
 const result:ContributionJob[]=[];
 for(const e of await fs.readdir(outbox(),{withFileTypes:true}).catch(()=>[])){
  if(!e.isDirectory()||!/^[a-f0-9-]{36}$/.test(e.name))continue;
  const job=JSON.parse(await fs.readFile(path.join(outbox(),e.name,"job.json"),"utf8")) as ContributionJob;
  if(job.user.userId===user.userId&&job.user.username===user.username)result.push(job);
 }
 return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(job=>{
  const {id,conversationId,status,createdAt,updatedAt,commit,error,ci,sourceCommit,checksUrl,integratedBy}=job;
  const recovery=reviewedContribution(job,result);
  return {id,conversationId,status,createdAt,updatedAt,commit,error,ci,sourceCommit,checksUrl,integratedBy,
   recoveredBy:recovery?.id,files:job.files??[],
   canRetry:!recovery&&!job.includedIn&&["blocked","pending"].includes(status)&&!!job.patchHash,
   canReview:!recovery&&status==="interrupted"&&!job.isolated&&!job.includedIn&&!job.overlapped&&!!job.interruption?.patchHash&&!!job.after};
 });
}
export function requestContributionDelivery():void{void drain();}
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
 const dir=path.join(outbox(),job.id),cwd=job.root,patchFile=path.join(dir,"change.patch");
 const patch=await fs.readFile(patchFile,"utf8");
 if(createHash("sha256").update(patch).digest("hex")!==job.patchHash)throw new Error("La integridad del aporte cambió.");
 validateContributionPatch(patch);
 if(job.files?.some(f=>/^web\/modules\//.test(f)))throw new Error("Los módulos se publican desde Dev mediante su flujo de PR a modules.");
 const auth=gitAuth(identity.token),remoteRef=`refs/luxipanel/delivery/${job.id}`;
 // Fetch objects only. Applying and committing use a private index: no copied
 // source directory, checkout, reset, or changes to the operator's staging area.
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,`refs/heads/developer:${remoteRef}`],auth);
 const remote=(await contributionGit(cwd,["rev-parse",remoteRef])).trim();
 if(job.commit){
  // Old pending jobs may have their commit only in the former delivery checkout.
  try{await contributionGit(cwd,["cat-file","-e",job.commit+"^{commit}"]);}
  catch{await contributionGit(cwd,["fetch","--quiet",path.join(dir,"delivery"),job.commit]);}
  try{await contributionGit(cwd,["merge-base","--is-ancestor",job.commit,remote]);job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";job.error=undefined;await saveContribution(job);return;}catch{/* pending or unrelated update */}
  if(job.base!==remote)throw new Error("developer avanzó antes de confirmar el envío. El commit se conserva para revisión.");
 }else{
  const opts={GIT_INDEX_FILE:path.join(dir,"delivery.index")};
  await contributionGit(cwd,["read-tree",remote],opts);
  let applied=false;
  try{await contributionGit(cwd,["apply","--check","--cached",patchFile],opts);}
  catch(error){
   // Captured blob identities let Git merge compatible changes or recognize
   // edits already present upstream. Conflicts stay in the private index;
   // neither the running checkout nor the operator's index is modified.
   try{await contributionGit(cwd,["apply","--3way","--cached",patchFile],opts);applied=true;}
   catch{
    const details=String((error as {stderr?:string}).stderr??"");
    if(/does not exist in index|No such file or directory/.test(details))
     throw new ContributionDeliveryError("base-missing","developer todavía no contiene archivos anteriores de los que depende este aporte. Hay que sincronizar esa base antes de enviarlo; el parche está conservado.");
    throw new ContributionDeliveryError("patch-conflict","El aporte no coincide con el código de developer. Hay cambios previos pendientes o conflictos que deben resolverse antes de enviarlo; el parche está conservado.");
   }
  }
  if(!applied)await contributionGit(cwd,["apply","--cached",patchFile],opts);
  await contributionGit(cwd,["diff","--cached","--check",remote],opts);
  const staged=(await contributionGit(cwd,["diff","--cached","--name-only","-z",remote],opts)).split("\0").filter(Boolean);
  if(!staged.length){
   job.commit=remote;job.base=remote;job.integratedBy=remote;job.status="pushed";
   job.pushedAt??=new Date().toISOString();job.ci="pending";job.error=undefined;
   await saveContribution(job);return;
  }
  if(staged.some(f=>!publishablePath(f)||f.startsWith("web/modules/")))throw new Error("El aporte incluye rutas fuera del código permitido.");
  const remaining=(await contributionGit(cwd,["diff","--cached","--diff-filter=d","--name-only","-z",remote],opts)).split("\0").filter(Boolean);
  for(const f of remaining){
   const content=await contributionGit(cwd,["show",":"+f],opts);assertPublishableSource(content);
   if(f.endsWith(".json"))JSON.parse(content);
  }
  const tree=(await contributionGit(cwd,["write-tree"],opts)).trim();
  const author={GIT_AUTHOR_NAME:identity.login,GIT_AUTHOR_EMAIL:`${identity.id}+${identity.login}@users.noreply.github.com`,GIT_COMMITTER_NAME:identity.login,GIT_COMMITTER_EMAIL:`${identity.id}+${identity.login}@users.noreply.github.com`};
  job.commit=(await contributionGit(cwd,["commit-tree",tree,"-p",remote,"-m",contributionMessage(job.id,job.notes)],author)).trim();
  await contributionGit(cwd,["update-ref",`refs/luxipanel/contributions/${job.id}`,job.commit]);
  job.base=remote;await saveContribution(job);
 }
 await contributionGit(cwd,["push","--porcelain",remoteUrl,job.commit+":refs/heads/developer"],auth);
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,`refs/heads/developer:${remoteRef}`],auth);
 await contributionGit(cwd,["merge-base","--is-ancestor",job.commit!,remoteRef]);
 job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";job.error=undefined;await saveContribution(job);
 await fs.rm(path.join(dir,"delivery.index"),{force:true});
 await fs.rm(path.join(dir,"before.index"),{force:true});await fs.rm(path.join(dir,"after.index"),{force:true});
}


/** Acknowledge published files without touching source or unrelated local edits.
 * Called under the capture mutex; staging, active turns and deployment locks win.
 */
export async function alignPublishedContribution(job:ContributionJob):Promise<boolean>{
 if(job.status!=="pushed"||!job.commit||job.isolated||job.includedIn||[...activeContributions.values()].some(j=>j.root===job.root))return false;
 let releaseManager:(()=>void)|undefined,releaseBuild:(()=>void)|undefined;
 const index=path.join(outbox(),job.id,"alignment.index");
 try{
  for(const dir of [".releases",".lxp"])await fs.mkdir(path.join(job.root,dir),{recursive:true});
  releaseManager=await contributionFileLock(path.join(job.root,".releases/manager.lock"));if(!releaseManager)return false;
  releaseBuild=await contributionFileLock(path.join(job.root,".lxp/build.lock"));if(!releaseBuild)return false;
  if((await contributionGit(job.root,["branch","--show-current"])).trim()!=="developer")return false;
  const head=(await contributionGit(job.root,["rev-parse","HEAD"])).trim();
  if(head===job.commit)return true;
  await contributionGit(job.root,["merge-base","--is-ancestor",head,job.commit]);
  // An operator's staged changes are never reset, even when content matches.
  await contributionGit(job.root,["diff","--cached","--quiet"]);
  const changed=(await contributionGit(job.root,["diff","--name-only","-z",head,job.commit])).split("\0").filter(Boolean);
  if(changed.some(f=>!publishablePath(f)))return false;
  const local=await captureSource(job.root,index);
  // Unfinished work outside the published delta remains dirty. Every path
  // advanced in HEAD must match exactly, including additions and deletions.
  for(let i=0;i<changed.length;i+=100){
   if((await contributionGit(job.root,["diff","--name-only",local,job.commit,"--",...changed.slice(i,i+100)])).trim())return false;
  }
  // Mixed reset only advances the same branch and index; it never writes source.
  await contributionGit(job.root,["reset","--mixed",job.commit]);
  job.checkoutAligned=true;await saveContribution(job);return true;
 }catch{return false;}finally{await fs.rm(index,{force:true});releaseBuild?.();releaseManager?.();}
}

async function alignRecentPublishedContributions(root?:string):Promise<void>{
 const latest=(await readContributionJobs()).filter(j=>j.status==="pushed"&&!j.includedIn&&!j.isolated&&(!root||j.root===root)).sort((a,b)=>(b.pushedAt??b.updatedAt).localeCompare(a.pushedAt??a.updatedAt));
 const aligned=new Set<string>();
 for(const job of latest){
  if(aligned.has(job.root))continue;
  if(await alignPublishedContribution(job))aligned.add(job.root);
 }
}

async function drain():Promise<void>{
 if(!authorize)return;
 if(draining){drainAgain=true;return;}draining=true;
 let unlock:(()=>void)|undefined;
 try{
  unlock=await publisherLock();
  if(!unlock)return;
  await withContributionState(recoverClosedContributionBatches);
  const rows=await fs.readdir(outbox(),{withFileTypes:true});
  const ordered:ContributionJob[]=[];
  for(const row of rows){
   if(!row.isDirectory()||!/^[a-f0-9-]{36}$/.test(row.name))continue;
   const job=JSON.parse(await fs.readFile(path.join(outbox(),row.name,"job.json"),"utf8")) as ContributionJob;
   if(job.status==="pending" && job.patchHash && !job.includedIn)ordered.push(job);
  }
  ordered.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(const job of ordered){
   if((job.nextAttempt||0)>Date.now())continue;
   try{await deliverContribution(job);}catch(e){
    // Git errors can contain headers: never persist/log raw process errors.
    const {transient,message}=contributionFailure(e);
    job.attempt=(job.attempt||0)+1;
    job.status=transient?"pending":"blocked";job.error=message;
    job.nextAttempt=Date.now()+Math.min(3600000,60000*2**Math.min(job.attempt,6));await saveContribution(job);await syncBatchMembers(job,await readContributionJobs());continue;
   }
   await syncBatchMembers(job,await readContributionJobs());
  }
  await withContributionState(()=>alignRecentPublishedContributions());
  // Slow or unavailable Actions must not delay delivery and local alignment.
  const checks=(await readContributionJobs()).filter(j=>!j.includedIn&&j.status==="pushed"&&j.commit&&(j.ci===undefined||j.ci==="pending"||j.ci==="missing")&&Date.now()-(j.ciCheckedAt||0)>60000).sort((a,b)=>(a.ciCheckedAt||0)-(b.ciCheckedAt||0));
  for(const job of checks.slice(0,3))await refreshContributionChecks(job).catch(()=>undefined);
 }catch{log.warn("No se pudo consultar la cola de aportes.");}finally{
  unlock?.();draining=false;
  if(drainAgain){drainAgain=false;queueMicrotask(()=>void drain());}
 }
}

/** Kernel lock survives backend crashes and excludes other publisher processes. */
export async function publisherLock():Promise<(()=>void)|undefined>{
 await fs.mkdir(outbox(),{recursive:true,mode:0o700});
 return contributionFileLock(path.join(outbox(),"publisher.lock"));
}
async function contributionFileLock(file:string):Promise<(()=>void)|undefined>{
 return new Promise((resolve,reject)=>{
  const child=spawn("flock",["-n",file,"sh","-c","printf ready; cat >/dev/null"],{stdio:["pipe","pipe","ignore"]});
  child.once("error",reject);
  child.stdout.once("data",()=>resolve(()=>child.stdin.end()));
  child.once("exit",()=>resolve(undefined));
 });
}
const gitAuth=(token:string)=>({GIT_CONFIG_COUNT:"2",GIT_CONFIG_KEY_0:"credential.helper",GIT_CONFIG_VALUE_0:"",GIT_CONFIG_KEY_1:"http.https://github.com/.extraheader",GIT_CONFIG_VALUE_1:"AUTHORIZATION: basic "+Buffer.from("x-access-token:"+token).toString("base64")});

/** Compatibility delivery for work already captured in an explicit or legacy worktree. */
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
 await contributionGit(cwd,["-c","user.name="+identity.login,"-c","user.email="+identity.id+"+"+identity.login+"@users.noreply.github.com","commit","--quiet","-m",contributionMessage(job.id,job.notes)]);
 job.commit=(await contributionGit(cwd,["rev-parse","HEAD"])).trim();job.base=remote;await saveContribution(job);
 await contributionGit(cwd,["push","--porcelain",remoteUrl,job.commit+":refs/heads/developer"],auth);
 await contributionGit(cwd,["fetch","--quiet","--no-tags",remoteUrl,"refs/heads/developer:refs/remotes/upstream/developer"],auth);
 await contributionGit(cwd,["merge-base","--is-ancestor",job.commit,"refs/remotes/upstream/developer"]);
 job.status="pushed";job.pushedAt??=new Date().toISOString();job.ci="pending";job.error=undefined;await saveContribution(job);
 if(remoteUrl===REMOTE)await refreshContributionChecks(job,authorizeUser).catch(()=>undefined);
}

export async function refreshContributionChecks(job:ContributionJob,authorizeUser=authorize):Promise<void>{
 if(!job.commit)return;
 if(!authorizeUser)throw new Error("Autorización no disponible");
 const user=await authorizeUser(job.user),identity=await githubToken(user,true);
 const r=await fetch(`https://api.github.com/repos/Luxisoft/LUXIPANEL/actions/workflows/release-checks.yml/runs?head_sha=${encodeURIComponent(job.commit)}&per_page=20`,{headers:{Authorization:`Bearer ${identity.token}`,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(15000),redirect:"error"});
 if(!r.ok)throw new Error("No se pudo consultar la verificación en GitHub.");
 const body=await r.json() as {workflow_runs:Array<{head_sha:string;status:string;conclusion:string|null;html_url:string;run_number:number}>};
 const run=body.workflow_runs.filter(r=>r.head_sha===job.commit).sort((a,b)=>b.run_number-a.run_number)[0];
 job.ciCheckedAt=Date.now();
 if(!run){
  job.ci=Date.now()-Date.parse(job.pushedAt??job.createdAt)>600000?"missing":"pending";
  if(!job.ciRequestedAt){
   const headers={Authorization:`Bearer ${identity.token}`,Accept:"application/vnd.github+json","Content-Type":"application/json"};
   const branch=await fetch("https://api.github.com/repos/Luxisoft/LUXIPANEL/git/ref/heads/developer",{headers,signal:AbortSignal.timeout(15000),redirect:"error"});
   if(!branch.ok)throw new Error("No se pudo confirmar developer antes de solicitar las comprobaciones.");
   const ref=await branch.json() as {object:{sha:string}};
   if(ref.object.sha!==job.commit){job.ci="missing";job.error="El commit está publicado, pero developer avanzó antes de iniciar sus comprobaciones.";}
   else {
    // Record before sending: on timeout, poll the exact SHA instead of duplicating a run.
    job.ciRequestedAt=Date.now();await saveContribution(job);
    const dispatch=await fetch("https://api.github.com/repos/Luxisoft/LUXIPANEL/actions/workflows/release-checks.yml/dispatches",{method:"POST",headers,body:JSON.stringify({ref:"developer"}),signal:AbortSignal.timeout(15000),redirect:"error"});
    if(!dispatch.ok){job.ci="missing";job.error="GitHub recibió el commit, pero no autorizó iniciar sus comprobaciones. Revisa el acceso a Actions de la conexión GitHub.";}
   }
  }
 }
 else {job.checksUrl=run.html_url;job.ci=run.status!=="completed"?"pending":run.conclusion==="success"?"success":"failure";}
 await saveContribution(job);
}

/** Team verification is the publication boundary, including recovered workers. */
export async function finishOwnerTeamContribution(conversationId:string,taskId:string,success:boolean):Promise<void>{
 const job=[...activeContributions.values()].find(j=>j.conversationId===conversationId&&j.teamTaskId===taskId);
 if(job)await finishOwnerContribution({job},success,true);
}
