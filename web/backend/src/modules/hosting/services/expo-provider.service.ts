import { verifyExpoStore } from "./expo-store-auth.js";
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { env } from "../../../config/env.js";
import { panelConfigDir } from "../../../config/paths.js";
import { quoteArg, runWithExecutor, pathExists, type Executor } from "../../../shared/executor/index.js";
import { expoProviderToken } from "../../../shared/expo-provider-bridge.js";
import { dataStore } from "../../../shared/data-store/index.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../../shared/errors/index.js";
import { providerService } from "./provider.service.js";
import type { HostingProvider } from "../models/provider.model.js";
import { EXPO_PROVIDER_RUNNER } from "./expo-provider-runner.js";
import { filesSchema, sourceDigest, validateExpoSource } from "./expo-provider-policy.js";
import { getRedis } from "../../../shared/redis/index.js";
import { repositoryExpoFiles } from "./expo-repository-policy.js";

export const snapshotSchema = z.union([z.object({files:repositoryExpoFiles,sourceDigest:z.string().regex(/^[a-f0-9]{64}$/),sourceMode:z.literal("repository")}).strict(),z.object({ files: filesSchema, sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),sourceMode:z.literal("foundation").optional() }).strict()]);
export const jobSchema = z.object({ requestId: z.string().uuid(), versionId: z.string().uuid(), kind: z.enum(["validate", "build", "submit"]), platform: z.enum(["android", "ios"]).default("android"), profile: z.enum(["preview", "production", "development"]).default("preview"), easBuildId: z.string().uuid().optional(), track: z.enum(["internal", "alpha", "beta", "production"]).default("internal"), storeAppId: z.string().max(100).optional() });
type AppRecord = { id: string; accountRef: string; appRef: string; projectId: string | null; androidPackage?:string; bundleIdentifier?:string; google?: string; apple?: string; createdAt?: string };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ref = (value: string) => z.string().uuid().parse(value);
function cryptKey() { if (!/^[a-f0-9]{64}$/i.test(env.CREDENTIAL_VAULT_KEY ?? "")) throw new ConflictError("Configura la clave de bóveda antes de conectar tiendas"); return Buffer.from(env.CREDENTIAL_VAULT_KEY!, "hex"); }
function seal(value: unknown) { const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",cryptKey(),iv); const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return [iv,cipher.getAuthTag(),body].map(b=>b.toString("base64")).join("."); }
function open(value: string): Record<string, any> { const [iv,tag,body]=value.split(".");const c=createDecipheriv("aes-256-gcm",cryptKey(),Buffer.from(iv!,"base64"));c.setAuthTag(Buffer.from(tag!,"base64"));return JSON.parse(Buffer.concat([c.update(Buffer.from(body!,"base64")),c.final()]).toString()); }
async function context(provider: HostingProvider, accountRef: string, appRef: string) {
  ref(accountRef);ref(appRef);
  const owned = await providerService.ownedAccount(provider,accountRef);
  if (owned.account.status !== "active") throw new ForbiddenError("Cuenta suspendida");
  const id=hash(`${provider.id}:${accountRef}:${appRef}`);
  const root=path.join(panelConfigDir(),"hosting","expo",id);
  const records=dataStore<AppRecord>(owned.executor,"hosting","expo-apps",{idStrategy:"uuid"});
  return {...owned,id,root,records};
}
async function locked<T>(key: string, fn:()=>Promise<T>) { const redis=getRedis(),owner=randomUUID(),k="lxp:expo:"+hash(key);if(await redis.set(k,owner,"EX",180,"NX")!=="OK")throw new ConflictError("Operación en curso");const heartbeat=setInterval(()=>{void redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('EXPIRE',KEYS[1],180) else return 0 end",1,k,owner).catch(()=>{});},30000);try{return await fn();}finally{clearInterval(heartbeat);await redis.eval("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",1,k,owner);} }
async function readJson(executor: Executor, file: string) { return JSON.parse(String(await executor.readFile(file,"utf8"))); }
async function optionalJson(executor:Executor,file:string) { if(!await pathExists(executor,file))return null;return readJson(executor,file); }
const safe = (row: AppRecord) => ({ projectId:row.projectId, connections:{google:Boolean(row.google),apple:Boolean(row.apple)} });

export const expoProviderService = {
 async register(provider: HostingProvider, accountRef: string, appRef: string) {
  const c=await context(provider,accountRef,appRef);
  return locked(c.id,async()=>{const existing=await c.records.get(c.id);if(existing)return safe(existing);await c.executor.mkdir(c.root,{recursive:true});return safe(await c.records.create({id:c.id,accountRef,appRef,projectId:null}));});
 },
 async status(provider: HostingProvider,accountRef: string,appRef: string) { const c=await context(provider,accountRef,appRef),row=await c.records.get(c.id);if(!row)throw new NotFoundError("App Expo");return safe(row); },
 async snapshot(provider:HostingProvider,accountRef:string,appRef:string,versionId:string,input:z.infer<typeof snapshotSchema>) {
  ref(versionId);validateExpoSource(input.files,input.sourceMode);if(sourceDigest(input.files)!==input.sourceDigest)throw new ConflictError("El código no corresponde al digest");
  const c=await context(provider,accountRef,appRef);return locked(c.id,async()=>{const appRow=await c.records.get(c.id);if(!appRow)throw new NotFoundError("App Expo");
  const expo=JSON.parse(input.files["app.json"]!).expo;
  if(appRow.androidPackage&&appRow.androidPackage!==expo.android.package||appRow.bundleIdentifier&&appRow.bundleIdentifier!==expo.ios.bundleIdentifier)throw new ConflictError("Los identificadores de la app son inmutables");
  if(!appRow.androidPackage)await c.records.update(c.id,{androidPackage:expo.android.package,bundleIdentifier:expo.ios.bundleIdentifier});
  const root=path.join(c.root,"versions",versionId);await c.executor.mkdir(root,{recursive:true});const file=path.join(root,"source.json");const old=await optionalJson(c.executor,file);if(old&&old.sourceDigest!==input.sourceDigest)throw new ConflictError("Una versión existente es inmutable");if(!old)await c.executor.writeFile(file,JSON.stringify(input),{mode:0o600});return {versionId,sourceDigest:input.sourceDigest};});
 },
 async credentials(provider:HostingProvider,accountRef:string,appRef:string,store:"google"|"apple",config:Record<string,unknown>) {
  const c=await context(provider,accountRef,appRef),row=await c.records.get(c.id);if(!row)throw new NotFoundError("App Expo");
  // Fixed token endpoints: user-supplied credential URLs are never requested.
  if(store==="google"){const raw=config.serviceAccount;const sa=typeof raw==="string"?JSON.parse(raw):raw as Record<string,unknown>;if(!sa?.client_email||!sa.private_key||sa.type!=="service_account")throw new ConflictError("Archivo de cuenta de servicio inválido");config={serviceAccount:sa};}
  else if(!config.privateKey||!config.issuerId||!config.keyId||!config.teamId||!config.storeAppId)throw new ConflictError("Faltan datos de la conexión Apple");
  await verifyExpoStore(store,config,String(store==="google"?row.androidPackage:row.bundleIdentifier));
  await c.records.update(c.id,{[store]:seal(config)});return {provider:store,status:"verified",connectedToExpo:true};
 },
 async enqueue(provider:HostingProvider,accountRef:string,appRef:string,input:z.infer<typeof jobSchema>) {
  const c=await context(provider,accountRef,appRef);
  return locked(c.id,async()=>{
   const row=await c.records.get(c.id);if(!row)throw new NotFoundError("App Expo");
   const root=path.join(c.root,"jobs",input.requestId),stateFile=path.join(root,"state.json");
   const old=await optionalJson(c.executor,stateFile);const digest=hash(JSON.stringify(input));if(old){if(old.requestDigest!==digest)throw new ConflictError("Referencia de trabajo reutilizada");return old;}
   const versionRoot=path.join(c.root,"versions",input.versionId);const snapshot=await readJson(c.executor,path.join(versionRoot,"source.json"));validateExpoSource(snapshot.files,snapshot.sourceMode);
   const token=input.kind==="validate"?"":await expoProviderToken(c.executor);
   let projectId=row.projectId;
   if(input.kind!=="validate"&&!projectId){
    const initRoot=path.join(c.root,"init");await c.executor.mkdir(initRoot,{recursive:true});
    const app=JSON.parse(snapshot.files["app.json"]);app.expo.slug="app-"+appRef.slice(0,12);delete app.expo.owner;delete app.expo.extra?.eas;
    delete app.expo.plugins;
    await c.executor.writeFile(path.join(initRoot,"app.json"),JSON.stringify(app),{mode:0o600});
    await c.executor.writeFile(path.join(initRoot,"package.json"),JSON.stringify({name:"luxisoft-expo-broker",version:"1.0.0",private:true}),{mode:0o600});
    // ExecOptions.env keeps the token out of command arguments and diagnostics.
    const result=await runWithExecutor(c.executor,()=>c.executor.exec(`/usr/bin/eas init --non-interactive --force`,{cwd:initRoot,env:{EXPO_TOKEN:token,CI:"1"},timeoutMs:120000}));
    if(result.exitCode!==0)throw new ConflictError("No se pudo vincular Expo; revisa la cuenta del módulo");
    projectId=(await readJson(c.executor,path.join(initRoot,"app.json")))?.expo?.extra?.eas?.projectId;
    if(!projectId)throw new ConflictError("Expo no devolvió el identificador del proyecto");await c.records.update(c.id,{projectId});
   }
   if(input.kind==="build"&&!await readJson(c.executor,path.join(versionRoot,"package-lock.json")).catch(()=>null))throw new ConflictError("Valida esta versión antes de compilar");
   let credentials: Record<string,unknown>|null=input.platform==="ios"&&row.apple?open(row.apple):null;
   if(input.kind==="build"&&input.platform==="ios"&&!credentials)throw new ConflictError("Conecta Apple antes de compilar para iOS");
   if(input.kind==="submit"){
    if(!input.easBuildId)throw new ConflictError("Selecciona el build exacto");
    const key=input.platform==="ios"?row.apple:row.google;if(!key)throw new ConflictError("Conecta la tienda al proyecto Expo");credentials=open(key);
    if(input.platform==="ios"&&!input.storeAppId)throw new ConflictError("Selecciona la app de App Store Connect");
    if(input.platform==="ios"&&String(credentials.storeAppId)!==input.storeAppId)throw new ConflictError("La app Apple no coincide con la conexión");
    const jobs=await c.executor.readdir(path.join(c.root,"jobs"));let ownedBuild=false;
    for(const name of jobs){const state=await optionalJson(c.executor,path.join(c.root,"jobs",name.name,"state.json"));if(state?.kind==="build"&&state.versionId===input.versionId&&state.result?.easBuildId===input.easBuildId&&state.status==="finished")ownedBuild=true;}
    if(!ownedBuild)throw new NotFoundError("Build de esta versión");
    const build=await this.buildStatus(provider,accountRef,appRef,input.easBuildId);
    if(build.status!=="FINISHED"||String(build.platform).toLowerCase()!==input.platform)throw new ConflictError("El build no está terminado o pertenece a otra plataforma");
   }
   await c.executor.mkdir(root,{recursive:true});
   const state={id:input.requestId,status:"queued",kind:input.kind,versionId:input.versionId,sourceDigest:snapshot.sourceDigest,requestDigest:digest,projectId,createdAt:new Date().toISOString()};
   await c.executor.writeFile(stateFile,JSON.stringify(state),{mode:0o600});
   const manifest={...input,root,versionRoot,home:c.account.homeRoot,runnerLock:path.join(path.dirname(c.root),"runner.lock"),username:c.account.username,expoSlug:"app-"+appRef.slice(0,12),public:state,files:snapshot.files,sourceMode:snapshot.sourceMode,token,projectId,credentials};
   const manifestPath=path.join(root,"input.json"),runner=path.join(root,"runner.mjs");
   await c.executor.writeFile(manifestPath,JSON.stringify(manifest),{mode:0o600});await c.executor.writeFile(runner,EXPO_PROVIDER_RUNNER,{mode:0o600});
   const result=await c.executor.exec(`sh -lc ${quoteArg(`nohup /usr/bin/node ${quoteArg(runner)} ${quoteArg(manifestPath)} </dev/null >${quoteArg(path.join(root,"launch.log"))} 2>&1 &`)}`,{timeoutMs:10000});
   if(result.exitCode!==0){await c.executor.writeFile(stateFile,JSON.stringify({...state,status:"failed",error:"provider_launch_failed"}),{mode:0o600});await c.executor.exec(`rm -f -- ${quoteArg(manifestPath)}`,{timeoutMs:10000});throw new ConflictError("No se pudo iniciar el trabajo Expo");}return state;
  });
 },
 async cancelValidation(provider:HostingProvider,accountRef:string,appRef:string,jobId:string){
  ref(jobId);const c=await context(provider,accountRef,appRef);
  return locked(c.id,async()=>{const root=path.join(c.root,"jobs",jobId),state=await optionalJson(c.executor,path.join(root,"state.json"));if(!state)throw new NotFoundError("Trabajo Expo");if(state.kind!=="validate")throw new ConflictError("Solo se puede cancelar una validación local");if(["finished","failed","cancelled"].includes(state.status))return state;await c.executor.writeFile(path.join(root,"cancel.json"),"{}",{mode:0o600});return {id:jobId,status:"cancelling"};});
 },
 async job(provider:HostingProvider,accountRef:string,appRef:string,jobId:string,preview=false) {ref(jobId);const c=await context(provider,accountRef,appRef);const root=path.join(c.root,"jobs",jobId);const state=await readJson(c.executor,path.join(root,"state.json")).catch(()=>null);if(!state)throw new NotFoundError("Trabajo Expo");if(preview&&state.status==="finished"&&state.kind==="validate")return readJson(c.executor,path.join(root,"preview.json"));if(state.result?.lock)delete state.result.lock;return state;},
 async buildStatus(provider:HostingProvider,accountRef:string,appRef:string,buildId:string) {ref(buildId);const c=await context(provider,accountRef,appRef),row=await c.records.get(c.id);const token=await expoProviderToken(c.executor);const response=await fetch("https://api.expo.dev/graphql",{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({query:"query($id: ID!){builds{byId(buildId:$id){id status platform artifacts{buildUrl applicationArchiveUrl} project{id}}}}",variables:{id:buildId}}),signal:AbortSignal.timeout(20000)});const result=await response.json() as any;const build=result.data?.builds?.byId;if(!build||build.project?.id!==row?.projectId)throw new NotFoundError("Build de la app");return {...build,artifactUrl:build.artifacts?.applicationArchiveUrl||build.artifacts?.buildUrl||null};},
};
