import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({findAccount:vi.fn(),createAccount:vi.fn(),create:vi.fn(),findByUsername:vi.fn()}));
vi.mock("../repositories/provider.repository.js",()=>({providerRepository:{findAccount:m.findAccount,createAccount:m.createAccount}}));
vi.mock("../repositories/hosting-account.repository.js",()=>({hostingAccountRepository:{findByUsername:async()=>null}}));
vi.mock("./hosting.service.js",()=>({hostingService:{create:m.create}}));
vi.mock("../../../shared/redis/index.js",()=>({getRedis:()=>({set:async()=>"OK",eval:async()=>1})}));
vi.mock("../../auth/repositories/index.js",()=>({panelUserRepository:{findByUsername:m.findByUsername},totpRepository:{}}));
vi.mock("../../admin/services/module-registry.service.js",()=>({moduleRegistryService:{getAll:()=>[{id:"files",name:"Files"},{id:"assistant",name:"AI"}]}}));
import {providerService}from"./provider.service.js";
import {defaultProviderGroupTemplate}from"./provider-group-policy.js";
import type {HostingProvider}from"../models/provider.model.js";
beforeEach(()=>{vi.restoreAllMocks();vi.clearAllMocks();m.create.mockImplementation(async(data)=>({id:5,username:data.username,homeRoot:`/home/${data.username}`}));m.createAccount.mockResolvedValue({id:"link"});m.findAccount.mockResolvedValue(null);m.findByUsername.mockResolvedValue({id:20,enabled:true});});
describe("API account group provisioning",()=>{
  it("passes configured granular permissions to the normal group provisioning path",async()=>{
    const template=defaultProviderGroupTemplate(["files","assistant"]);template.actions=["files.view","files.read"];
    template.fileAccess.readOnlyPaths=["."];
    const provider={id:"provider",targetId:"local",allowedModules:["files","assistant"],groupTemplate:template}as HostingProvider;
    vi.spyOn(providerService,"getAccount").mockResolvedValue({username:"hp-test"}as never);
    await providerService.ensureAccount(provider,"account",{});
    const input=m.create.mock.calls[0]![0];
    expect(input.permissionTemplate.sidebar).toContain("assistant");
    expect(input.permissionTemplate.actions).toEqual(["files.read","files.view"]);
    expect(input.permissionTemplate.fileAccess.readOnlyPaths).toEqual([`/home/${input.username}`]);
    expect(input.permissionTemplate.fileAccess.allowAll).toBe(false);
  });
  it("does not overwrite existing groups when an API client ensures the account again",async()=>{
    m.findAccount.mockResolvedValue({id:"link",accountId:5});
    vi.spyOn(providerService,"getAccount").mockResolvedValue({username:"hp-test"}as never);
    await providerService.ensureAccount({id:"provider",targetId:"local"}as HostingProvider,"account",{});
    expect(m.create).not.toHaveBeenCalled();
  });
});
