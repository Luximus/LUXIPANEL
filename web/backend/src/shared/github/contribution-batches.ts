// SPDX-License-Identifier: AGPL-3.0-only
import type { ContributionJob } from "./owner-contributions.js";
export const LEGACY_OVERLAP_ERROR="Hubo tareas simultáneas en el mismo repositorio. Los cambios se conservan y requieren revisión antes de publicarse.";
export function sameContributionPrincipal(a:ContributionJob,b:ContributionJob):boolean{
 return a.root===b.root && a.user.userId===b.user.userId && a.user.username===b.user.username && a.user.kind===b.user.kind;
}
const snapshot=(j:ContributionJob)=>/^[a-f0-9]{40}$/.test(j.before)&&/^[a-f0-9]{40}$/.test(j.head);
const legacySuccess=(j:ContributionJob)=>!j.isolated&&!j.batchId&&!j.legacyRecovery&&!j.patchHash&&!j.commit&&j.status==="blocked"&&j.overlapped===true&&j.error===LEGACY_OVERLAP_ERROR&&!!j.cliBinding;
/** Metadata-only migration. Never infer success from a timeout or read live files. */
export function legacyRecoveryBatches(jobs:ContributionJob[]):Array<{members:ContributionJob[];boundary:ContributionJob}>{
 const result:Array<{members:ContributionJob[];boundary:ContributionJob}>=[];
 for(const root of new Set(jobs.filter(legacySuccess).map(j=>j.root))){
  const rows=jobs.filter(j=>j.root===root).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  for(let i=0;i<rows.length;i++){
   const first=rows[i]!;if(!legacySuccess(first)||!snapshot(first))continue;
   let end=Date.parse(first.updatedAt),n=i+1;
   if(!Number.isFinite(end)||end<Date.parse(first.createdAt))continue;
   while(n<rows.length && Date.parse(rows[n]!.createdAt)<=end){
    end=Math.max(end,Date.parse(rows[n]!.completedAt??rows[n]!.updatedAt));n++;
   }
   const members=rows.slice(i,n),boundary=rows[n];
   // The original guard only writes this exact error after a successful turn.
   // Every overlapping participant must have that evidence, including its CLI binding.
   if(members.length<2||members.some(j=>!legacySuccess(j)||!sameContributionPrincipal(first,j)))continue;
   if(!boundary||!snapshot(boundary)||!sameContributionPrincipal(first,boundary)||boundary.head!==first.head)continue;
   result.push({members,boundary});i=n-1;
  }
 }
 return result;
}

/** Upgrade an in-flight legacy group only when its original baseline survives. */
export function legacyActiveBatches(jobs:ContributionJob[],recovered:ContributionJob[]):ContributionJob[][]{
 const result:ContributionJob[][]=[];
 for(const root of new Set(recovered.filter(j=>!j.batchId&&!j.isolated).map(j=>j.root))){
  const first=recovered.filter(j=>j.root===root).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))[0];
  if(!first||first.batchId||!snapshot(first))continue;
  const members=jobs.filter(j=>j.root===root&&j.createdAt>=first.createdAt);
  if(members.some(j=>!sameContributionPrincipal(first,j)||j.batchId||!(legacySuccess(j)||recovered.some(r=>r.id===j.id))))continue;
  result.push(members.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)));
 }
 return result;
}
