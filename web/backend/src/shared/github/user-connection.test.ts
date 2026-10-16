import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const config=vi.hoisted(()=>({LUXIPANEL_CONFIG_DIR:"",JWT_SECRET:"unit-test-".repeat(5),NODE_ENV:"test",LOG_LEVEL:"silent",CREDENTIAL_VAULT_KEY:"",GIT_ENCRYPTION_KEY:""}));
vi.mock("../../config/env.js",()=>({env:config}));
import { githubPrincipal, githubSetupRoute, githubStatus, linkGithub, githubToken, requireGithub, disconnectGithub, startGithubDevice, pollGithubDevice } from "./user-connection.js";
const owner={userId:1,username:"operator"},other={userId:2,username:"another"};
const identity=(id=80057597,login="Luximus")=>new Response(JSON.stringify({id,login,type:"User"}),{headers:{"x-oauth-scopes":"read:user,repo"}});
describe("individual GitHub connections",()=>{
 beforeEach(async()=>{config.LUXIPANEL_CONFIG_DIR=await fs.mkdtemp(path.join(os.tmpdir(),"lxp-github-"));process.env.LUXIPANEL_GITHUB_REQUIRED="true";vi.stubGlobal("fetch",vi.fn(async()=>identity()));});
 afterEach(async()=>{await fs.rm(config.LUXIPANEL_CONFIG_DIR,{recursive:true,force:true});vi.unstubAllGlobals();delete process.env.LUXIPANEL_GITHUB_REQUIRED;delete process.env.LUXIPANEL_GITHUB_CLIENT_ID;});
 it("requires connection but preserves setup, session and recovery",async()=>{
  await expect(requireGithub(owner)).rejects.toMatchObject({statusCode:403,code:"GITHUB_CONNECTION_REQUIRED"});
  for(const p of ["/api/session","/api/auth/github","/api/auth/native/authorize","/api/auth/passkeys","/api/auth/totp/status","/api/auth/recovery/status","/api/logout"])expect(githubSetupRoute(p)).toBe(true);
  for(const p of ["/api/files/read","/api/auth/github-evil","/api/auth/ws-token","/api/agent"])expect(githubSetupRoute(p)).toBe(false);
 });
 it("isolates credentials, encrypts them and does not infer owner from username",async()=>{
  const token="test-token-not-a-real-credential";
  await linkGithub(owner,token);await expect(requireGithub(owner)).resolves.toBeUndefined();
  expect((await githubStatus(other)).connected).toBe(false);
  expect((await githubStatus(owner)).canEditCore).toBe(false);
  const dir=path.join(config.LUXIPANEL_CONFIG_DIR,"github-users");const files=await fs.readdir(dir);
  const stored=await fs.readFile(path.join(dir,files[0]!),"utf8");expect(stored).not.toContain(token);expect((await fs.stat(path.join(dir,files[0]!))).mode&0o777).toBe(0o600);
  await fs.writeFile(path.join(dir,"owner.json"),JSON.stringify({principal:githubPrincipal(owner),githubId:80057597}));
  expect((await githubStatus(owner)).canEditCore).toBe(true);
  await linkGithub(other,token);expect((await githubStatus(other)).canEditCore).toBe(false);
 });
 it("binds direct identities to their identity server, not a selected target",()=>{
  expect(githubPrincipal({...owner,direct:true,targetId:"B",githubIdentityDirect:false})).toBe(githubPrincipal(owner));
  expect(githubPrincipal({...owner,direct:true,targetId:"A"})).not.toBe(githubPrincipal({...owner,direct:true,targetId:"B"}));
  expect(githubPrincipal({...owner,direct:true,targetId:"B",githubIdentityTargetId:"A"})).toBe(githubPrincipal({...owner,direct:true,targetId:"A"}));
 });
 it("revalidates publication and revokes rejected credentials",async()=>{
  await linkGithub(owner,"test-token");vi.mocked(fetch).mockResolvedValue(new Response("{}",{status:401}));
  await expect(githubToken(owner)).rejects.toThrow();expect((await githubStatus(owner)).connected).toBe(false);
 });
 it("disconnect cannot be undone by a slow verification request",async()=>{
  await linkGithub(owner,"test-token");
  let release!:(r:Response)=>void;vi.mocked(fetch).mockImplementation(()=>new Promise(r=>{release=r;}));
  const pending=githubToken(owner);await new Promise(r=>setTimeout(r,20));await disconnectGithub(owner);release(identity());
  await expect(pending).rejects.toThrow();expect((await githubStatus(owner)).connected).toBe(false);
 });
 it("rejects a device authorization polled by another account",async()=>{
  process.env.LUXIPANEL_GITHUB_CLIENT_ID="test-device-app";
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({device_code:"private-device",user_code:"ABCD-EFGH",verification_uri:"https://github.com/login/device",expires_in:900,interval:5})));
  const attempt=await startGithubDevice(owner);expect(JSON.stringify(attempt)).not.toContain("private-device");
  await expect(pollGithubDevice(other,attempt.id)).rejects.toThrow();
 });
});
