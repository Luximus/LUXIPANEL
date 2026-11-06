import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';

test('rootless HTTP deployment returns the owned loopback port for supervisor health validation',async()=>{
 const archive=Buffer.from('source');const image='sha256:'+'a'.repeat(64);let output='';const commands=[];
 const job={projectId:'a'.repeat(32),home:'/home/fixture',versionId:'version',requestId:'request',environment:'preview',archive:archive.toString('base64'),variables:{},limits:{diskMb:100,maxDatabases:0},snapshot:{sourceDigest:createHash('sha256').update(archive).digest('hex'),manifest:{resources:[],components:[{name:'app',context:'.',surface:'http',port:8080,healthPath:'/health',volumes:[]}]}}};
 const missing=()=>Object.assign(new Error('missing'),{code:'ENOENT'});
 const fs={mkdir:async()=>{},realpath:async p=>p,stat:async()=>{throw missing()},statfs:async()=>({bavail:10000000,bsize:4096}),readdir:async()=>[],writeFile:async()=>{},readFile:async file=>{if(file.endsWith('images.json'))return JSON.stringify({app:image});if(file==='/proc/meminfo')return 'MemAvailable: 4000000 kB\n';throw missing()}};
 const spawn=(bin,args)=>{commands.push([bin,...args]);const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{};child.stdin={end:()=>setImmediate(()=>{const value=bin==='/usr/bin/du'?'1':args[0]==='port'?'127.0.0.1:18080':'';if(value)child.stdout.emit('data',Buffer.from(value));child.emit('close',0)})};return child};
 const net={createServer:()=>{const server=new EventEmitter();server.listen=(_port,_host,cb)=>cb();server.address=()=>({port:18080});server.close=cb=>cb();return server}};
 const dependencies={'node:fs/promises':{default:fs,readdir:fs.readdir},'node:path':{default:path},'node:crypto':{createHash,randomBytes},'node:child_process':{spawn},'node:net':{default:net},'node:http':{default:{get(){throw Error('tenant_loopback_probe_forbidden')}}}};
 const context=createContext({process:{getuid:()=>39013,env:{HOME:job.home},stdin:(async function*(){yield JSON.stringify(job)})(),stdout:{write:value=>output+=value},exitCode:0},Buffer,setTimeout,clearTimeout,setImmediate});
 const runner=new SourceTextModule(await readFile(process.env.DEPLOYMENT_RUNNER_PATH ?? new URL('./deployment-tenant.mjs',import.meta.url),'utf8'),{context});const modules=new Map();
 const linker=async name=>{if(!modules.has(name)){if(name==='./runtime-policy.mjs')modules.set(name,new SourceTextModule(await readFile(new URL(name,import.meta.url),'utf8'),{context}));else{const exports=dependencies[name];assert.ok(exports,name);modules.set(name,new SyntheticModule(Object.keys(exports),function(){for(const[key,value]of Object.entries(exports))this.setExport(key,value)},{context}))}}return modules.get(name)};
 await runner.link(linker);await runner.evaluate();const result=JSON.parse(output);
 assert.equal(result.ok,true,result.error);assert.deepEqual(JSON.parse(JSON.stringify(result.result.components)),[{name:'app',port:18080,image,surface:'http'}]);assert.ok(commands.some(command=>command[1]==='port'));
});
