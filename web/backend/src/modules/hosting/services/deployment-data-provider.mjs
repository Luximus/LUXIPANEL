import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {panelConfigDir} from '../../../config/paths.js';
import {quoteArg,pathExists} from '../../../shared/executor/index.js';
import {ForbiddenError,ConflictError} from '../../../shared/errors/index.js';
import {providerService} from './provider.service.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export async function deploymentDataRequest(provider,accountRef,projectRef,input){
 if(!uuid.test(accountRef)||!uuid.test(projectRef)||!input||!uuid.test(input.versionId)||Buffer.byteLength(JSON.stringify(input))>262144)throw new ForbiddenError('invalid_data_request');
 if(!['metadata','rows','one','stats','replay','edit','trash','restore'].includes(input.operation)||!['preview','production'].includes(input.environment))throw new ForbiddenError('invalid_data_request');
 providerService.assertOperation(provider,['edit','trash','restore'].includes(input.operation)?'deployments.write':'deployments.read');
 const owned=await providerService.ownedAccount(provider,accountRef),{account,executor}=owned;
 if(account.status!=='active'||!/^hp[a-f0-9]{20}$/.test(account.username)||account.homeRoot!=='/home/'+account.username)throw new ForbiddenError('invalid_data_account');
 const scope=createHash('sha256').update(provider.id+':'+accountRef+':'+projectRef).digest('hex'),root=path.join(panelConfigDir(),'hosting','deployments',scope);
 if(await pathExists(executor,path.join(root,'retire.json')))throw new ConflictError('deployment_retired');
 let snapshot;try{snapshot=JSON.parse(String(await executor.readFile(path.join(root,'versions',input.versionId,'manifest.json'),'utf8')));}catch{throw new ConflictError('data_version_unavailable');}
 if(!snapshot.manifest?.resources?.some(r=>r.name===input.resource&&r.engine==='postgres'))throw new ForbiddenError('invalid_data_resource');
 const file=path.join(root,'data',randomUUID()+'.json');await executor.mkdir(path.dirname(file),{recursive:true});
 await executor.writeFile(file,JSON.stringify({username:account.username,home:account.homeRoot,projectId:projectRef,versionId:input.versionId,environment:input.environment,request:input}),{mode:0o600});
 try{
  const result=await executor.exec('/usr/bin/sudo -n /usr/lib/luxipanel/deployment-helper '+quoteArg(file)+' data',{timeoutMs:40000});
  let output;try{output=JSON.parse(result.stdout);}catch{throw new ConflictError('project_data_unavailable');}
  if(result.exitCode!==0||!output.ok)throw new ConflictError('project_data_unavailable');
  return output.data;
 }finally{await executor.unlink(file).catch(()=>{});}
}
