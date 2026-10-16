import {describe,it,expect} from "vitest";
import {legacyRecoveryBatches,legacyActiveBatches,LEGACY_OVERLAP_ERROR} from "./contribution-batches.js";
import type {ContributionJob} from "./owner-contributions.js";
const time=(n:number)=>new Date(1700000000000+n*1000).toISOString();
const user={userId:1,username:"owner",displayName:"Owner",kind:"admin",role:"admin",modules:[]} as ContributionJob["user"];
const job=(id:string,start:number,end:number,more:Partial<ContributionJob>={}):ContributionJob=>({id,conversationId:id,root:"/source",user,before:"a".repeat(40),head:"b".repeat(40),status:"blocked",overlapped:true,cliBinding:"signed",error:LEGACY_OVERLAP_ERROR,createdAt:time(start),updatedAt:time(end),...more});
const fixture=()=>[job("first",1,5),job("second",2,4,{before:"",head:""}),job("boundary",6,6,{status:"capturing",overlapped:false,before:"c".repeat(40),error:undefined})];
describe("closed legacy batches",()=>{
 it("recovers a closed successful group using the next task's starting snapshot",()=>{
  const rows=fixture();expect(legacyRecoveryBatches(rows)).toEqual([{members:rows.slice(0,2),boundary:rows[2]}]);
 });
 it.each(["interrupted","active","foreign","no-binding","wrong-error","no-boundary","changed-head","no-baseline"])("keeps %s work out of automatic recovery",reason=>{
  const rows=fixture();
  if(reason==="interrupted")rows[1].status="interrupted";
  if(reason==="active")rows[1].status="capturing";
  if(reason==="foreign")rows[1].user={...user,userId:2};
  if(reason==="no-binding")rows[1].cliBinding=undefined;
  if(reason==="wrong-error")rows[1].error="Error de autorización";
  if(reason==="no-boundary")rows.pop();
  if(reason==="changed-head")rows[2].head="d".repeat(40);
  if(reason==="no-baseline")rows[0].before="";
  expect(legacyRecoveryBatches(rows)).toEqual([]);
 });
 it("uses the initial snapshot of the next group even when that group later overlaps",()=>{
  const rows=fixture();rows[2]=job("third",6,10,{before:"c".repeat(40)});
  rows.push(job("fourth",7,9,{before:"",head:""}),job("next",11,11,{status:"empty",overlapped:false}));
  const batches=legacyRecoveryBatches(rows);expect(batches).toHaveLength(2);
  expect(batches[0].boundary.id).toBe("third");expect(batches[1].boundary.id).toBe("next");
 });
});

describe("in-flight legacy batches",()=>{
 it("joins verified surviving jobs to their original baseline",()=>{
  const rows=fixture().slice(0,2).map(j=>({...j,status:"capturing" as const,error:undefined}));
  expect(legacyActiveBatches(rows,rows)).toEqual([rows]);
 });
 it("retains a completed participant while the original leader is still active",()=>{
  const rows=fixture().slice(0,2);rows[0].status="capturing";rows[0].error=undefined;
  expect(legacyActiveBatches(rows,[rows[0]])).toEqual([rows]);
 });
 it.each(["failed","unverified","missing-baseline"])("does not adopt %s work on upgrade",reason=>{
  const rows=fixture().slice(0,2).map(j=>({...j,status:"capturing" as ContributionJob["status"],error:undefined as string|undefined}));
  if(reason==="failed")rows[1].status="interrupted";
  if(reason==="missing-baseline")rows[0].before="";
  expect(legacyActiveBatches(rows,reason==="missing-baseline"?rows:[rows[0]])).toEqual([]);
 });
});
