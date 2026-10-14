import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mkdtempSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir,userInfo} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import net from 'node:net';
import {buildDataSql,validateDataRequest} from './data-query.mjs';
const actorId='11111111-1111-4111-8111-111111111111';
const collection={id:'app.records',storage:'application',fields:[{key:'quantity',type:'number'},{key:'stage',type:'select'},{key:'tags',type:'multiselect'}]};
const request=(operation,extra={})=>({operation,environment:'preview',resource:'database',collection,...extra});
const mutate=(operation,row,extra={})=>request(operation,{recordId:row.row.id,revision:row.revision,requestId:randomUUID(),actorId,mutationHash:createHash('sha256').update(JSON.stringify([operation,row.row.id,row.revision,extra])).digest('hex'),...extra});
test('rejects SQL identifiers, unsafe ids, excessive responses and unknown operations',()=>{
 for(const change of [{operation:'sql'},{resource:'other/../database'},{collection:{...collection,table:'users;DROP TABLE x'}},{recordId:"x' OR true"},{query:{limit:101}},{query:{sort:"name'"}},{query:{filters:{unknown:'x'}}}])assert.throws(()=>validateDataRequest(request('rows',change)));
 const sql=buildDataSql(request('rows',{query:{search:"');DROP TABLE application_records;--"}}));assert(!sql.includes('DROP TABLE'));assert(sql.includes("decode('"));
 assert.throws(()=>buildDataSql(request('stats',{query:{field:'stage',metric:'sum'}})));
});
test('private PostgreSQL preserves records, complete statistics, revision checks, trash, restoration and booking capacity',{skip:!existsSync('/usr/lib/postgresql/17/bin/initdb')},async()=>{
 const root=mkdtempSync(join(tmpdir(),'luxi-data-query-')),pg='/usr/lib/postgresql/17/bin';
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 let started=false,hasTrash=false;
 try{
  execFileSync(pg+'/initdb',['-D',root+'/pg','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});
  execFileSync(pg+'/pg_ctl',['-D',root+'/pg','-l',root+'/pg.log','-o','-h 127.0.0.1 -p '+port+' -k '+root,'-w','start'],{stdio:'ignore'});started=true;
  const run=sql=>execFileSync(pg+'/psql',['-h','127.0.0.1','-p',String(port),'-U',userInfo().username,'-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  const query=r=>JSON.parse(run(buildDataSql(r,{hasTrash})));
  run("CREATE TABLE application_records(id uuid PRIMARY KEY,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());CREATE TABLE form_submissions(id uuid PRIMARY KEY,form_id text,schema_version text,definition jsonb,answers jsonb,created_at timestamptz NOT NULL DEFAULT now());");
  run("INSERT INTO application_records(id,data,created_at) SELECT md5(n::text)::uuid,jsonb_build_object('quantity',n,'stage',CASE WHEN n%2=0 THEN 'A' ELSE 'B' END,'tags',jsonb_build_array('A','B')),'2026-10-04'::date FROM generate_series(1,1205)n;");
  let rows=query(request('rows',{query:{page:0,limit:25}}));assert.equal(rows.total,1205);assert.equal(rows.rows.length,25);
  const stats=query(request('stats',{query:{group:'category',field:'quantity',metric:'sum'}}));assert.equal(stats.count,1205);assert.equal(stats.sum,726615);assert.equal(stats.series.reduce((s,r)=>s+r.value,0),726615);
  const tags=query(request('stats',{query:{group:'category',field:'tags',metric:'count'}}));assert.equal(tags.count,1205);assert.deepEqual(tags.series,[{label:'A',value:1205},{label:'B',value:1205}]);
  const filtered=query(request('rows',{query:{filters:{stage:'A'},limit:100}}));assert.equal(filtered.total,602);
  const seen=new Set();let cursor;
  for(let page=0;page<13;page++){
   const chunk=query(request('rows',{query:{limit:100,sort:'created_at',direction:'desc',cursor}})).rows;
   for(const row of chunk){assert(!seen.has(row.row.id));seen.add(row.row.id);}
   const last=chunk.at(-1);cursor=last?{createdAt:last.row.created_at,id:last.row.id}:undefined;
  }
  assert.equal(seen.size,1205);
  const concurrent=r=>new Promise((resolve,reject)=>execFile(pg+'/psql',['-h','127.0.0.1','-p',String(port),'-U',userInfo().username,'-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],(error,stdout)=>{if(error)reject(error);else resolve(JSON.parse(stdout.trim()));}).stdin.end(buildDataSql(r,{hasTrash})));
  const first=rows.rows[0],other=rows.rows[1];
  const simultaneous=await Promise.all([concurrent(mutate('edit',first,{values:first.row.data})),concurrent(mutate('edit',other,{values:other.row.data}))]);assert(simultaneous.every(r=>r.saved));
  hasTrash=true;
  const old=rows.rows[0],edit=mutate('edit',old,{values:{...old.row.data,quantity:99}});assert.equal(query(edit).saved,true);hasTrash=true;
  assert.equal(query(edit).saved,true);
  assert.equal(query(mutate('edit',old,{values:{quantity:777}})).error,'data_record_changed');
  const edited=query(request('one',{recordId:old.row.id})).rows[0];assert.equal(edited.row.data.quantity,99);
  const trash=mutate('trash',edited);assert.equal(query(trash).deleted,true);assert.equal(query(trash).deleted,true);
  assert.equal(query(request('rows')).total,1204);
  const bin=query(request('rows',{query:{trashed:true}}));assert.equal(bin.total,1);assert.equal(bin.rows[0].row.id,old.row.id);
  const restore=mutate('restore',bin.rows[0],{recordId:undefined,trashId:bin.rows[0].trash_id});assert.equal(query(restore).restored,true);assert.equal(query(request('rows')).total,1205);assert.equal(query(restore).restored,true);
  assert.equal(query(request('replay',{requestId:restore.requestId,actorId,revision:restore.revision,mutationHash:restore.mutationHash})).seen,true);
  assert.equal(query(request('replay',{requestId:restore.requestId,actorId,revision:restore.revision,mutationHash:'0'.repeat(64)})).error,'data_operation_conflict');
  const formId=randomUUID();run("INSERT INTO form_submissions VALUES('"+formId+"','quiz','v1','{\"id\":\"quiz\",\"fields\":[]}'::jsonb,'{\"answer\":\"A\",\"_quizScore\":{\"earned\":5,\"possible\":5}}'::jsonb,now());");
  const forms={id:'form.quiz',storage:'form',formId:'quiz',fields:[{key:'score',type:'number',readOnly:true,computed:'quizScore'}]};
  const fscores=query(request('stats',{collection:forms,query:{field:'score',metric:'avg',group:'day'}}));assert.equal(fscores.average,5);
  const fr=query(request('rows',{collection:forms})).rows[0],ft=mutate('trash',fr,{collection:forms});assert.equal(query(ft).deleted,true);
  const fb=query(request('rows',{collection:forms,query:{trashed:true}})).rows[0];assert.equal(query(mutate('restore',fb,{collection:forms,recordId:undefined,trashId:fb.trash_id})).restored,true);
  run("TRUNCATE application_records;INSERT INTO application_records VALUES('"+randomUUID()+"','{\"date\":\"2026-10-05\",\"time\":\"09:00\",\"item\":\"A\",\"stage\":\"Confirmada\"}',now());INSERT INTO application_records VALUES('"+randomUUID()+"','{\"date\":\"2026-10-06\",\"time\":\"09:00\",\"item\":\"A\",\"stage\":\"Confirmada\"}',now());");
  const booking={...collection,booking:{capacity:1,cancelledStage:'Cancelada'}},book=query(request('rows',{collection:booking})).rows.find(r=>r.row.data.date==='2026-10-06');
  assert.equal(query(mutate('edit',book,{collection:booking,values:{...book.row.data,date:'2026-10-05'}})).error,'slot_full');
  assert.equal(query(request('one',{recordId:book.row.id})).rows[0].row.data.date,'2026-10-06');
  const bt=mutate('trash',book,{collection:booking});assert.equal(query(bt).deleted,true);
  run("INSERT INTO application_records VALUES('"+randomUUID()+"','{\"date\":\"2026-10-06\",\"time\":\"09:00\",\"item\":\"A\",\"stage\":\"Confirmada\"}',now());");
  const bb=query(request('rows',{collection:booking,query:{trashed:true}})).rows.find(r=>r.row.id===book.row.id);
  assert.equal(query(mutate('restore',bb,{collection:booking,recordId:undefined,trashId:bb.trash_id})).error,'slot_full');
 }catch(error){if(error.stderr)console.error(error.stderr.toString().slice(0,1800));throw error;}
 finally{if(started)execFileSync(pg+'/pg_ctl',['-D',root+'/pg','-m','fast','-w','stop'],{stdio:'ignore'});await fs.rm(root,{recursive:true,force:true});}
});
