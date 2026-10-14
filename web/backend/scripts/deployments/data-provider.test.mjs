import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
const refs={account:'11111111-1111-4111-8111-111111111111',project:'22222222-2222-4222-8222-222222222222',version:'33333333-3333-4333-8333-333333333333'};
const provider={id:'fixture',targetId:'local'},base={operation:'rows',versionId:refs.version,resource:'database',environment:'preview',collection:{id:'app.records',storage:'application',fields:[]}};
test('data provider binds account, project version, environment, capabilities and private task cleanup',async()=>{
 const calls=[],context=vm.createContext({Buffer}),files=new Map();
 let active=true,available=true,retired=false,owns=true;
 const executor={mkdir:async()=>{},writeFile:async(file,body)=>{files.set(file,JSON.parse(body));calls.push(['write',file]);},readFile:async()=>JSON.stringify({manifest:{resources:available?[{name:'database',engine:'postgres'}]:[]}}),unlink:async file=>{files.delete(file);calls.push(['unlink',file]);},exec:async(command)=>{
  const task=[...files.values()][0];assert.equal(task.environment,'preview');assert.equal(task.request.resource,'database');assert.equal(task.projectId,refs.project);assert(!command.includes('answers'));return {stdout:JSON.stringify({ok:true,data:{rows:[],total:0}}),exitCode:0};
 }};
 class ForbiddenError extends Error{}class ConflictError extends Error{}
 const service={assertOperation:(_p,op)=>calls.push(['scope',op]),ownedAccount:async(_p,ref)=>{assert.equal(ref,refs.account);if(!owns)throw new ForbiddenError('ownership');return {account:{status:active?'active':'suspended',username:'hp'+'a'.repeat(20),homeRoot:'/home/hp'+'a'.repeat(20)},executor};}};
 const source=await readFile(new URL('../../src/modules/hosting/services/deployment-data-provider.mjs',import.meta.url),'utf8'),module=new vm.SourceTextModule(source,{context});
 await module.link(async name=>{
  const exports=name==='node:crypto'?{createHash:crypto.createHash,randomUUID:crypto.randomUUID}:name==='node:path'?{default:path}:name.includes('paths')?{panelConfigDir:()=>'/etc/luxipanel'}:name.includes('executor')?{quoteArg:s=>"'"+s+"'",pathExists:async()=>retired}:name.includes('errors')?{ForbiddenError,ConflictError}:{providerService:service};
  return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context});
 });await module.evaluate();
 const send=input=>module.namespace.deploymentDataRequest(provider,refs.account,refs.project,input);
 assert.deepEqual(JSON.parse(JSON.stringify(await send(base))),{rows:[],total:0});assert.equal(files.size,0);assert(calls[0][1]==='deployments.read');
 const written=calls.find(c=>c[0]==='write')[1];assert(written.includes(crypto.createHash('sha256').update(provider.id+':'+refs.account+':'+refs.project).digest('hex')+'/data/'));
 calls.length=0;await send({...base,operation:'trash'});assert.equal(calls[0][1],'deployments.write');
 for(const flag of ['active','available','retired','owns']){
  if(flag==='active')active=false;if(flag==='available')available=false;if(flag==='retired')retired=true;if(flag==='owns')owns=false;
  await assert.rejects(send(base));active=available=owns=true;retired=false;
 }
 await assert.rejects(send({...base,environment:'other'}));await assert.rejects(send({...base,versionId:'not-a-uuid'}));await assert.rejects(send({...base,operation:'sql'}));
 assert.equal(files.size,0);
});
