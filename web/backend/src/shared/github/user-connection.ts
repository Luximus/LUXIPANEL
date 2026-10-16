// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Installation-local GitHub grants. Never infer ownership from a display name or global gh session. */
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { encrypt, decrypt, sha256 } from "../utils/crypto.js";
import type { SessionUser } from "../types/index.js";
import { AppError, ErrorCodes, ForbiddenError, ValidationError, ServiceUnavailableError } from "../errors/index.js";

export type GithubPrincipal = Pick<SessionUser, "userId" | "username" | "targetId" | "direct"> & { githubIdentityTargetId?: string; githubIdentityDirect?: boolean };
export interface GithubConnection {
  principal: string; login: string; githubId: number; tokenEnc: string;
  scopes: string[]; verifiedAt: number; revoked?: boolean;
}
export interface GithubConnectionStatus {
  required: boolean; connected: boolean; login?: string; githubId?: number;
  canContribute: boolean; canEditCore: boolean; deviceFlowAvailable: boolean;
}
const root = () => path.join(env.LUXIPANEL_CONFIG_DIR, "github-users");
const key = () => sha256("LUXIPANEL:github-users:v1:" + (env.CREDENTIAL_VAULT_KEY || env.GIT_ENCRYPTION_KEY || env.JWT_SECRET));
export function githubPrincipal(user: GithubPrincipal): string {
  if (!Number.isSafeInteger(user.userId) || user.userId < 0 || !user.username) throw new ForbiddenError("Invalid GitHub principal");
  const direct = user.githubIdentityDirect ?? user.direct;
  if (direct && !(user.githubIdentityTargetId ?? user.targetId)) throw new ForbiddenError("Identity server required");
  return JSON.stringify([direct ? (user.githubIdentityTargetId ?? user.targetId) : "local", user.userId, user.username]);
}
const file = (user: GithubPrincipal) => path.join(root(), sha256(githubPrincipal(user)) + ".json");
export function githubRequired(user: GithubPrincipal): boolean {
  // Mandatory onboarding belongs to the installation identity, not SSH accounts.
  // Scoped tokens retain their signed origin even when their target is remote.
  if (user.githubIdentityDirect ?? user.direct) return false;
  return process.env.LUXIPANEL_GITHUB_REQUIRED === "true" || (process.env.LUXIPANEL_GITHUB_REQUIRED !== "false" && (process.env.NODE_ENV ?? env.NODE_ENV) !== "test");
}
async function read(user: GithubPrincipal): Promise<GithubConnection | null> {
  try {
    const record = JSON.parse(await readFile(file(user), "utf8")) as GithubConnection;
    if (record.principal !== githubPrincipal(user)) throw new Error("Invalid GitHub connection binding");
    return record;
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}
const mutations = new Map<string,Promise<unknown>>();
async function withConnectionLock<T>(user:GithubPrincipal,fn:()=>Promise<T>):Promise<T>{
 const id=githubPrincipal(user),previous=mutations.get(id)??Promise.resolve();
 const current=previous.catch(()=>undefined).then(fn);mutations.set(id,current);
 try{return await current;}finally{if(mutations.get(id)===current)mutations.delete(id);}
}
async function save(user: GithubPrincipal, record: GithubConnection): Promise<void> {
  await mkdir(root(), {recursive:true,mode:0o700});
  const temp = file(user) + "." + randomUUID() + ".tmp";
  await writeFile(temp, JSON.stringify(record), {mode:0o600});
  await rename(temp, file(user));
}
export async function githubIdentity(token: string): Promise<{login:string;id:number;scopes:string[]}> {
  let response: Response;
  try {
    response = await fetch("https://api.github.com/user", {
      headers: {Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json"},
      redirect:"error",signal:AbortSignal.timeout(10_000),
    });
  } catch (error) { throw new ServiceUnavailableError(error instanceof Error && error.name === "TimeoutError" ? "GitHub no respondió a tiempo. Vuelve a intentarlo." : "No se pudo contactar con GitHub. Vuelve a intentarlo."); }
  if (response.status === 401) throw new ForbiddenError("GitHub rechazó la credencial.");
  if (!response.ok) throw new ServiceUnavailableError("GitHub no pudo verificar la conexión en este momento.");
  const data = await response.json() as {login?:string;id?:number;type?:string};
  if (!data.login || !Number.isSafeInteger(data.id) || data.type !== "User") throw new ValidationError("Conecta una cuenta personal de GitHub.");
  return {login:data.login,id:data.id!,scopes:(response.headers.get("x-oauth-scopes") || "").split(",").map(s=>s.trim()).filter(Boolean)};
}
export async function linkGithub(user: GithubPrincipal, token: string): Promise<GithubConnectionStatus> {
  if (!token || token.length > 4096 || /\s/.test(token)) throw new ValidationError("Introduce una credencial GitHub válida.");
  const actor = await githubIdentity(token);
  await withConnectionLock(user,()=>save(user, {principal:githubPrincipal(user),login:actor.login,githubId:actor.id,tokenEnc:encrypt(token,key()),scopes:actor.scopes,verifiedAt:Date.now()}));
  return githubStatus(user);
}
export async function disconnectGithub(user: GithubPrincipal): Promise<void> {
  await withConnectionLock(user,()=>unlink(file(user)).catch(e=>{if(e.code!=="ENOENT")throw e;}));
}
async function ownerMatches(user: GithubPrincipal, connection: GithubConnection): Promise<boolean> {
  try {
    const owner = JSON.parse(await readFile(path.join(root(),"owner.json"),"utf8")) as {principal:string;githubId:number};
    return !user.direct && owner.principal === githubPrincipal(user) && owner.githubId === connection.githubId && connection.githubId === 80057597;
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; throw e; }
}
export async function githubStatus(user: GithubPrincipal): Promise<GithubConnectionStatus> {
  const connection = await read(user);
  const connected = !!connection && !connection.revoked;
  return {required:githubRequired(user),connected,
    ...(connected ? {login:connection.login,githubId:connection.githubId} : {}),
    canContribute:connected && (connection.scopes.includes("public_repo") || connection.scopes.includes("repo") || connection.scopes.length === 0),
    canEditCore:connected && await ownerMatches(user,connection),
    deviceFlowAvailable:!!process.env.LUXIPANEL_GITHUB_CLIENT_ID};
}
const refreshing = new Map<string,Promise<unknown>>();
export async function requireGithub(user: GithubPrincipal): Promise<void> {
  if (!githubRequired(user)) return;
  const record = await read(user);
  if (record && !record.revoked && Date.now() - record.verifiedAt > 15 * 60_000) {
    const id = githubPrincipal(user);
    let check = refreshing.get(id);
    if (!check) { check = githubToken(user).finally(() => refreshing.delete(id)); refreshing.set(id,check); }
    try { await check; } catch (e) { if (!(e instanceof ForbiddenError)) throw e; }
  }
  if (githubRequired(user) && !(await githubStatus(user)).connected) {
    throw new AppError("Conecta tu cuenta GitHub para continuar.", 403, ErrorCodes.GITHUB_CONNECTION_REQUIRED);
  }
}
/** Revalidate before publication, never fall back to another user's credential. */
export async function githubToken(user: GithubPrincipal, ownerOnly = false): Promise<{token:string;login:string;id:number}> {
  const record = await read(user);
  if (!record || record.revoked || (ownerOnly && !await ownerMatches(user,record))) throw new ForbiddenError("La cuenta no tiene autorización para publicar estos cambios.");
  const token = decrypt(record.tokenEnc,key());
  try {
    const identity = await githubIdentity(token);
    if (identity.id !== record.githubId) throw new ForbiddenError("La identidad de GitHub ha cambiado.");
    await withConnectionLock(user, async()=>{
    const current = await read(user);
    if (!current || current.tokenEnc !== record.tokenEnc || current.revoked) throw new ForbiddenError("La conexión GitHub cambió durante la operación.");
    await save(user,{...current,verifiedAt:Date.now(),login:identity.login,scopes:identity.scopes});
    });
    return {token,login:identity.login,id:identity.id};
  } catch(e) {
    if (e instanceof ForbiddenError) await withConnectionLock(user,async()=>{ const current=await read(user); if(current?.tokenEnc===record.tokenEnc) await save(user,{...current,revoked:true}); });
    throw e;
  }
}
export function githubSetupRoute(raw: string): boolean {
  const pathname = raw.split("?")[0];
  return pathname === "/api/session" || pathname === "/api/logout"
    || /^\/api\/auth\/github(?:\/|$)/.test(pathname!)
    || pathname === "/api/auth/refresh"
    || /^\/api\/(?:auth\/(?:native|passkeys|totp|recovery|qr))(?:\/|$)/.test(pathname!);
}
interface DeviceAttempt {principal:string;deviceCode:string;expiresAt:number;interval:number;nextPoll:number}
const attempts = new Map<string,DeviceAttempt>();
export async function startGithubDevice(user: GithubPrincipal) {
  const clientId = process.env.LUXIPANEL_GITHUB_CLIENT_ID;
  if (!clientId) throw new ValidationError("La conexión con navegador todavía no está configurada. Puedes vincular un token personal.");
  for(const [id,a] of attempts)if(a.expiresAt<Date.now())attempts.delete(id);
  if(attempts.size>=1000)throw new ServiceUnavailableError("Hay demasiadas conexiones pendientes. Vuelve a intentarlo.");
  const response = await fetch("https://github.com/login/device/code",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({client_id:clientId,scope:"read:user"}),signal:AbortSignal.timeout(10000),redirect:"error"});
  const data=await response.json() as {device_code?:string;user_code?:string;verification_uri?:string;expires_in?:number;interval?:number};
  if(!response.ok || !data.device_code || !data.user_code || data.verification_uri!=="https://github.com/login/device")throw new ServiceUnavailableError("GitHub no pudo iniciar la conexión.");
  const id=randomUUID(),interval=Math.max(5,data.interval||5)*1000,expiresAt=Date.now()+Math.min(900,data.expires_in||900)*1000;
  attempts.set(id,{principal:githubPrincipal(user),deviceCode:data.device_code,expiresAt,interval,nextPoll:Date.now()+interval});
  return {id,userCode:data.user_code,url:data.verification_uri,expiresAt,intervalMs:interval};
}
export async function pollGithubDevice(user: GithubPrincipal,id:string) {
  const a=attempts.get(id);
  if(!a || a.principal!==githubPrincipal(user) || a.expiresAt<Date.now())throw new ValidationError("La autorización expiró. Inicia la conexión otra vez.");
  if(Date.now()<a.nextPoll)return {pending:true};
  a.nextPoll=Date.now()+a.interval;
  const response=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({client_id:process.env.LUXIPANEL_GITHUB_CLIENT_ID,device_code:a.deviceCode,grant_type:"urn:ietf:params:oauth:grant-type:device_code"}),signal:AbortSignal.timeout(10000),redirect:"error"});
  const data=await response.json() as {access_token?:string;error?:string};
  if(data.error==="authorization_pending")return {pending:true};
  if(data.error==="slow_down"){a.interval+=5000;return {pending:true};}
  if(!response.ok || !data.access_token){attempts.delete(id);throw new ValidationError("La autorización no se completó. Inicia la conexión otra vez.");}
  const status=await linkGithub(user,data.access_token);attempts.delete(id);return {pending:false,status};
}
