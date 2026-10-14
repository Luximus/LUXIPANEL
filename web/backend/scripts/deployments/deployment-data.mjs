#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {buildDataSql,validateDataRequest,dataTableName} from './data-query.mjs';
let body='';for await(const chunk of process.stdin){body+=chunk;if(body.length>262144)throw Error('data_request_too_large');}
const job=JSON.parse(body),project=String(job.projectId).replaceAll('-','');
try{
 if(process.getuid()===0||!/^[a-f0-9]{32}$/.test(project)||job.home!==process.env.HOME)throw Error('invalid_data_identity');
 const r=validateDataRequest(job.request),container='luxi-'+project+'-'+r.environment+'-data-'+r.resource;
 const execute=sql=>new Promise((resolve,reject)=>{
  const p=spawn('/usr/bin/podman',['exec','-i',container,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','app','-d','app'],{stdio:['pipe','pipe','pipe']});let output='',bytes=0;
  const timeout=setTimeout(()=>{p.kill('SIGKILL');reject(Error('data_timeout'));},15000);
  p.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024*1024){p.kill('SIGKILL');reject(Error('data_response_too_large'));}else output+=chunk;});p.stderr.resume();
  p.on('error',reject);p.on('close',code=>{clearTimeout(timeout);if(code!==0)return reject(Error('data_query_failed'));try{resolve(JSON.parse(output.trim()));}catch{reject(Error('data_response_invalid'));}});p.stdin.end("SET statement_timeout='12s';SET lock_timeout='4s';"+sql);
 });
 const table=dataTableName(r.collection);
 const available=await execute("SELECT jsonb_build_object('ready',to_regclass('public."+table+"') IS NOT NULL,'trash',to_regclass('public.luxisoft_data_trash') IS NOT NULL);");
 if(!available.ready)process.stdout.write(JSON.stringify({ok:true,data:{ready:false,rows:[],total:0,definitions:[],historical:[],count:0,series:[]}}));
 else {const data=await execute(buildDataSql(r,{hasTrash:available.trash}));process.stdout.write(JSON.stringify({ok:true,data}));}
}catch{process.stdout.write(JSON.stringify({ok:false,error:'project_data_unavailable'}));process.exitCode=1;}
