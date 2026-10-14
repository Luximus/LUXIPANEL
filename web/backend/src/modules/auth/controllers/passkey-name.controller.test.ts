import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
const mocks=vi.hoisted(()=>({rename:vi.fn()}));
vi.mock("../services/passkey.service.js",()=>({passkeyService:{rename:mocks.rename}}));
vi.mock("../services/auth.service.js",()=>({authService:{},clearFailedCount:vi.fn(),establishLocalBridge:vi.fn(),recordFailedMfaAttempt:vi.fn(),resolveLockScope:vi.fn()}));
vi.mock("../repositories/index.js",()=>({panelUserRepository:{},passkeyRepository:{}}));
vi.mock("../services/login-methods.service.js",()=>({resolveEffectiveLoginMethods:vi.fn(),withLocalAuthScope:vi.fn()}));
import { passkeyController } from "./passkey.controller.js";
const app=express();app.use(express.json());
app.patch("/passkeys/:id",(req,res,next)=>{res.locals.user={userId:7};next();},passkeyController.rename);
app.use((err:any,_req:any,res:any,_next:any)=>res.status(400).json({error:err.name}));
beforeEach(()=>{vi.clearAllMocks();mocks.rename.mockResolvedValue({id:"key-a",label:"Laptop"});});
describe("rename passkey request",()=>{
 it("trims the name and takes ownership from the session only",async()=>{
  const res=await request(app).patch("/passkeys/key-a").send({label:"  Laptop  ",userId:8,createdAt:"2000-01-01"});
  expect(res.status).toBe(200);expect(res.body).toEqual({ok:true,data:{id:"key-a",label:"Laptop"}});
  expect(mocks.rename).toHaveBeenCalledWith(7,"key-a","Laptop");
 });
 it.each(["","   ","x".repeat(129),null,42])("rejects invalid names (%s)",async label=>{
  const res=await request(app).patch("/passkeys/key-a").send({label});
  expect(res.status).toBe(400);expect(mocks.rename).not.toHaveBeenCalled();
 });
 it("does not substitute a default name when the name is missing",async()=>{
  expect((await request(app).patch("/passkeys/key-a").send({})).status).toBe(400);
  expect(mocks.rename).not.toHaveBeenCalled();
 });
});

