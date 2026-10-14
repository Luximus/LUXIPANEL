// Trusted structured adapter: never accepts SQL, credentials or host destinations.
const identifier=value=>{
 if(typeof value!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(value)||/^(pg_|luxisoft_)/.test(value))throw Error('invalid_data_identifier');
 return '"'+value+'"';
};
const literal=value=>"convert_from(decode('"+Buffer.from(JSON.stringify(value)).toString('base64')+"','base64'),'UTF8')::jsonb";
const text=value=>'('+literal(String(value))+" #>> '{}')";
const tableFor=d=>d.storage==='form'?'form_submissions':d.storage==='events'?'application_events':d.table??'application_records';
const properties=d=>d.storage==='form'?'answers':'data';
const keyPath=key=>'->'+text(key);
export function validateDataRequest(r){
 if(!r||typeof r!=='object'||!['metadata','rows','one','stats','replay','edit','trash','restore'].includes(r.operation))throw Error('invalid_data_operation');
 if(!['preview','production'].includes(r.environment)||!/^[a-z][a-z0-9-]{0,29}$/.test(r.resource))throw Error('invalid_data_resource');
 const d=r.collection;
 if(!d||!['form','application','events','registered'].includes(d.storage)||typeof d.id!=='string'||d.id.length>100)throw Error('invalid_data_collection');
 identifier(tableFor(d));
 if(d.storage==='form'&&!/^[a-z][a-z0-9-]{0,39}$/.test(d.formId??''))throw Error('invalid_form_id');
 if(!Array.isArray(d.fields)||d.fields.length>100||d.fields.some(f=>!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(f.key)||['constructor','prototype','__proto__'].includes(f.key)))throw Error('invalid_data_fields');
 const q=r.query??{};
 if(q.page!==undefined&&(!Number.isInteger(q.page)||q.page<0||q.page>1000000))throw Error('invalid_data_page');
 if(q.limit!==undefined&&(!Number.isInteger(q.limit)||q.limit<1||q.limit>100))throw Error('invalid_data_limit');
 if(q.cursor&&(!q.cursor.createdAt||!Number.isFinite(Date.parse(q.cursor.createdAt))||(typeof q.cursor.id!=='string'||q.cursor.id.length>100||(d.storage==='events'?!/^[A-Za-z0-9_-]+$/.test(q.cursor.id):!/^[a-f0-9-]{36}$/.test(q.cursor.id)))||q.sort!=='created_at'||q.direction!=='desc'))throw Error('invalid_data_cursor');
 if(q.search!==undefined&&(typeof q.search!=='string'||q.search.length>200))throw Error('invalid_data_search');
 for(const value of [q.from,q.to])if(value!==undefined&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw Error('invalid_data_date');
 if(q.sort&&q.sort!=='created_at'&&!d.fields.some(f=>f.key===q.sort)||q.direction&&!['asc','desc'].includes(q.direction))throw Error('invalid_data_sort');
 if(q.field&&!d.fields.some(f=>f.key===q.field))throw Error('invalid_data_field');
 if(q.metric&&!['count','sum','avg'].includes(q.metric))throw Error('invalid_data_metric');
 if(q.group&&!['day','category'].includes(q.group))throw Error('invalid_data_group');
 if(q.zone&&!/^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/.test(q.zone))throw Error('invalid_data_timezone');
 if(q.filters&&(typeof q.filters!=='object'||Array.isArray(q.filters)||Object.entries(q.filters).some(([k,v])=>!d.fields.some(f=>f.key===k)||typeof v!=='string'||v.length>300)))throw Error('invalid_data_filter');
 for(const k of ['recordId','trashId','requestId','actorId'])if(r[k]!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r[k]))throw Error('invalid_data_id');
 if(['edit','trash','restore','replay'].includes(r.operation)){
  if(!r.requestId||!r.actorId||!/^[a-f0-9]{32}$/.test(r.revision??''))throw Error('invalid_data_revision');
  if(!/^[a-f0-9]{64}$/.test(r.mutationHash??''))throw Error('invalid_data_hash');
  if(d.storage==='events')throw Error('immutable_data_collection');
  if(!['restore','replay'].includes(r.operation)&&!r.recordId||r.operation==='restore'&&!r.trashId)throw Error('invalid_data_id');
  if(r.operation==='edit'&&(!r.values||Array.isArray(r.values)||typeof r.values!=='object'||Buffer.byteLength(JSON.stringify(r.values))>65536))throw Error('invalid_data_values');
 }
 return r;
}
export function dataTableName(d){return tableFor(d);}
function conditions(r,alias='t'){
 const d=r.collection,q=r.query??{},values=alias+'.'+identifier(properties(d)),parts=['TRUE'];
 if(d.storage==='form')parts.push(alias+'.form_id='+text(d.formId));
 if(q.search)parts.push('position(lower('+text(q.search)+') in lower('+values+'::text))>0');
 if(q.from)parts.push(alias+'.created_at>='+text(q.from)+'::timestamptz');
 if(q.to)parts.push(alias+'.created_at<'+text(q.to)+'::timestamptz');
 for(const [key,value]of Object.entries(q.filters??{}))parts.push('('+values+keyPath(key)+'='+literal(value)+' OR '+values+keyPath(key)+' @> '+literal([value])+')');
 return parts.join(' AND ');
}
function expression(d,key,alias='t'){return d.storage==='form'&&d.fields.find(f=>f.key===key)?.computed==='quizScore'?alias+".answers->'_quizScore'->'earned'":alias+'.'+identifier(properties(d))+keyPath(key);}
export function buildDataSql(input,{hasTrash=false}={}){
 const r=validateDataRequest(input),d=r.collection,q=r.query??{},table=identifier(tableFor(d)),values=identifier(properties(d));
 if(r.operation==='replay'){
  if(!hasTrash)return "SELECT jsonb_build_object('seen',false);";
  return "SELECT coalesce((SELECT CASE WHEN actor_id="+text(r.actorId)+" AND request_hash="+text(r.mutationHash)+" THEN jsonb_build_object('seen',true,'result',result) ELSE jsonb_build_object('error','data_operation_conflict') END FROM luxisoft_data_operations WHERE id="+text(r.requestId)+"::uuid),jsonb_build_object('seen',false));";
 }
 if(r.operation==='metadata'){
  const forms=d.storage==='form'?"(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM (SELECT DISTINCT ON(form_id,schema_version) form_id,schema_version,definition FROM "+table+" ORDER BY form_id,schema_version,created_at DESC LIMIT 500) s)":"'[]'::jsonb";
  const historical=hasTrash?"(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM (SELECT DISTINCT ON(row_data->>'form_id',row_data->>'schema_version') row_data->>'form_id' AS form_id,row_data->>'schema_version' AS schema_version,row_data->'definition' AS definition FROM luxisoft_data_trash WHERE storage='form' ORDER BY row_data->>'form_id',row_data->>'schema_version',deleted_at DESC LIMIT 500) s)":"'[]'::jsonb";
  const fieldKeys=d.storage==='form'?"'[]'::jsonb":"(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM (SELECT DISTINCT key FROM "+table+" t CROSS JOIN LATERAL jsonb_object_keys(t."+values+") key WHERE key ~ '^[a-zA-Z][a-zA-Z0-9_]{0,62}$' AND key NOT IN ('constructor','prototype') ORDER BY key LIMIT 100) s)";
  return "SELECT jsonb_build_object('definitions',"+forms+",'historical',"+historical+",'fields',"+fieldKeys+");";
 }
 if(r.operation==='rows'||r.operation==='one'){
  if(q.trashed||r.trashId){
   if(!hasTrash)return "SELECT jsonb_build_object('rows','[]'::jsonb,'total',0);";
   const cond="collection_id="+text(d.id)+(r.trashId?" AND id="+text(r.trashId)+"::uuid":"")+(q.search?" AND position(lower("+text(q.search)+") in lower(row_data::text))>0":"")+(q.from?" AND deleted_at>="+text(q.from)+"::timestamptz":"")+(q.to?" AND deleted_at<"+text(q.to)+"::timestamptz":"");
   const fieldFilters=Object.entries(q.filters??{}).map(([key,value])=>' AND ((row_data->'+text(properties(d))+keyPath(key)+')='+literal(value)+' OR (row_data->'+text(properties(d))+keyPath(key)+') @> '+literal([value])+')').join('');
   return "WITH matched AS (SELECT row_data AS row,descriptor,id AS trash_id,deleted_at,md5(row_data::text) AS revision FROM luxisoft_data_trash WHERE "+cond+fieldFilters+") SELECT jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM (SELECT * FROM matched ORDER BY deleted_at DESC,trash_id DESC LIMIT "+(q.limit??25)+" OFFSET "+((q.page??0)*(q.limit??25))+") s),'total',(SELECT count(*) FROM matched));";
  }
  let sort='t.created_at';
  if(q.sort&&q.sort!=='created_at'){
   const f=d.fields.find(f=>f.key===q.sort),e=expression(d,q.sort);
   sort=f?.type==='number'?"CASE WHEN jsonb_typeof("+e+")='number' THEN ("+e+" #>> '{}')::numeric END":"("+e+" #>> '{}')";
  }
  const cursor=q.cursor?' AND (t.created_at,t.id::text)<('+text(q.cursor.createdAt)+'::timestamptz,'+text(q.cursor.id)+')':'';
  const cond=conditions(r)+cursor+(r.recordId?' AND t.id::text='+text(r.recordId):'');
  return "WITH matched AS (SELECT to_jsonb(t) AS row,md5(to_jsonb(t)::text) AS revision,"+sort+" AS sort_value,t.id FROM "+table+" t WHERE "+cond+") SELECT jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(s),'[]'::jsonb) FROM (SELECT row,revision FROM matched ORDER BY sort_value "+(q.direction==='asc'?'ASC':'DESC')+" NULLS LAST,id "+(q.direction==='asc'?'ASC':'DESC')+" LIMIT "+(q.limit??25)+" OFFSET "+((q.page??0)*(q.limit??25))+") s),'total',(SELECT count(*) FROM matched));";
 }
 if(r.operation==='stats'){
  const field=d.fields.find(f=>f.key===q.field),group=q.group??'day',e=field?expression(d,field.key):null,metric=q.metric??'count';
  if(metric!=='count'&&field?.type!=='number')throw Error('invalid_data_metric');
  const numeric=e?"CASE WHEN jsonb_typeof("+e+")='number' THEN ("+e+" #>> '{}')::numeric END":'NULL::numeric';
  const label=group==='day'?"to_char(t.created_at AT TIME ZONE "+text(q.zone??'UTC')+",'YYYY-MM-DD')":e?"coalesce(nullif("+e+" #>> '{}',''),'—')":"'—'";
  const base="SELECT "+label+" AS label,"+numeric+" AS value FROM "+table+" t WHERE "+conditions(r);
  const multiselect=group==='category'&&field?.type==='multiselect';
  const cte=multiselect?"SELECT coalesce(v.label,'—') label,NULL::numeric value FROM "+table+" t LEFT JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof("+e+")='array' THEN CASE WHEN jsonb_array_length("+e+")>0 THEN "+e+" ELSE '[null]'::jsonb END ELSE '[null]'::jsonb END) v(label) ON TRUE WHERE "+conditions(r):base;
  const agg=metric==='sum'?'coalesce(sum(value),0)':metric==='avg'?'avg(value)':'count(*)',ranking=group==='day'?'label ASC':'amount DESC NULLS LAST,label';
  return "WITH source AS ("+cte+"), buckets AS (SELECT label,"+agg+" AS amount,count(value) AS numeric_count,sum(value) AS numeric_sum FROM source GROUP BY label), ranked AS (SELECT *,row_number() OVER(ORDER BY "+ranking+") rank FROM buckets), selected AS (SELECT label,amount FROM ranked WHERE rank<=60 UNION ALL SELECT '__luxisoft_other__',"+(metric==='avg'?'sum(numeric_sum)/nullif(sum(numeric_count),0)':'sum(amount)')+" FROM ranked WHERE rank>60 HAVING count(*)>0) SELECT jsonb_build_object('count',(SELECT count(*) FROM "+table+" t WHERE "+conditions(r)+"),'sum',(SELECT coalesce(sum(value),0) FROM source),'average',(SELECT avg(value) FROM source),'series',(SELECT coalesce(jsonb_agg(s ORDER BY "+(group==='day'?'label':'value DESC NULLS LAST,label')+"),'[]'::jsonb) FROM (SELECT label,amount AS value FROM selected) s));";
 }
 const request=literal(r),idCondition=d.storage==='form'?" AND form_id="+text(d.formId):'';
 const binding=r.operation==='restore'?"tr.id="+text(r.trashId)+"::uuid AND tr.collection_id="+text(d.id):"t.id::text="+text(r.recordId)+idCondition;
 const slots=d.booking?"IF candidate->>'stage' IS DISTINCT FROM "+text(d.booking.cancelledStage)+" THEN PERFORM pg_advisory_xact_lock(hashtextextended((candidate->>'date')||':'||(candidate->>'time')||':'||(candidate->>'item'),0));IF (SELECT count(*) FROM "+table+" b WHERE b.data->>'date'=candidate->>'date' AND b.data->>'time'=candidate->>'time' AND b.data->>'item'=candidate->>'item' AND b.data->>'stage'<>"+text(d.booking.cancelledStage)+" AND b.id::text<>target_id)>="+Math.max(1,Math.min(100000,Number(d.booking.capacity)||1))+" THEN INSERT INTO luxisoft_data_result VALUES('{\"error\":\"slot_full\"}');RETURN;END IF;END IF;":'';
 let action;
 if(r.operation==='edit')action="candidate=req->'values';"+slots+"UPDATE "+table+" SET "+values+"=candidate WHERE id::text=target_id;result=jsonb_build_object('saved',true,'id',target_id);";
 else if(r.operation==='trash')action="INSERT INTO luxisoft_data_trash(id,collection_id,storage,record_id,row_data,descriptor,deleted_by) VALUES((req->>'requestId')::uuid,req->'collection'->>'id',req->'collection'->>'storage',target_id,original,req->'collection',req->>'actorId');DELETE FROM "+table+" WHERE id::text=target_id;result=jsonb_build_object('deleted',true,'id',target_id);";
 else action="candidate=original->"+text(properties(d))+";"+slots+"INSERT INTO "+table+" SELECT * FROM jsonb_populate_record(NULL::"+table+",original);DELETE FROM luxisoft_data_trash tr WHERE "+binding+";result=jsonb_build_object('restored',true,'id',target_id);";
 const load=r.operation==='restore'?"SELECT tr.row_data,tr.record_id INTO original,target_id FROM luxisoft_data_trash tr WHERE "+binding+" FOR UPDATE;":"SELECT to_jsonb(t),t.id::text INTO original,target_id FROM "+table+" t WHERE "+binding+" FOR UPDATE;";
 return [
 "BEGIN;SET LOCAL statement_timeout='12s';SET LOCAL lock_timeout='4s';",
 "DO $init$ BEGIN IF to_regclass('luxisoft_data_operations') IS NULL OR to_regclass('luxisoft_data_trash') IS NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('luxisoft-data-schema-v1',0)); END IF; END $init$;",
 "CREATE TABLE IF NOT EXISTS luxisoft_data_trash(id uuid PRIMARY KEY,collection_id text NOT NULL,storage text NOT NULL,record_id text NOT NULL,row_data jsonb NOT NULL,descriptor jsonb NOT NULL,deleted_by text NOT NULL,deleted_at timestamptz NOT NULL DEFAULT now());",
 "CREATE INDEX IF NOT EXISTS luxisoft_data_trash_collection_idx ON luxisoft_data_trash(collection_id,deleted_at DESC);",
 "CREATE TABLE IF NOT EXISTS luxisoft_data_operations(id uuid PRIMARY KEY,actor_id text NOT NULL,request_hash text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());",
 "CREATE TEMP TABLE luxisoft_data_result(data jsonb) ON COMMIT DROP;",
 "DO $luxisoft_data$ DECLARE req jsonb:="+request+";original jsonb;target_id text;candidate jsonb;result jsonb;prior record;BEGIN",
 "PERFORM pg_advisory_xact_lock(hashtextextended(req->>'requestId',0));",
 "SELECT * INTO prior FROM luxisoft_data_operations WHERE id=(req->>'requestId')::uuid;",
 "IF FOUND THEN IF prior.actor_id<>req->>'actorId' OR prior.request_hash<>req->>'mutationHash' THEN INSERT INTO luxisoft_data_result VALUES('{\"error\":\"data_operation_conflict\"}');ELSE INSERT INTO luxisoft_data_result VALUES(prior.result);END IF;RETURN;END IF;",
 load,
 "IF original IS NULL THEN INSERT INTO luxisoft_data_result VALUES('{\"error\":\"data_record_not_found\"}');RETURN;END IF;",
 "IF md5(original::text)<>req->>'revision' THEN INSERT INTO luxisoft_data_result VALUES('{\"error\":\"data_record_changed\"}');RETURN;END IF;",
 action,
 "INSERT INTO luxisoft_data_operations(id,actor_id,request_hash,result) VALUES((req->>'requestId')::uuid,req->>'actorId',req->>'mutationHash',result);",
 "INSERT INTO luxisoft_data_result VALUES(result);",
 "EXCEPTION WHEN unique_violation THEN INSERT INTO luxisoft_data_result VALUES('{\"error\":\"data_restore_conflict\"}');WHEN foreign_key_violation OR check_violation OR not_null_violation THEN INSERT INTO luxisoft_data_result VALUES('{\"error\":\"data_constraint_conflict\"}');END $luxisoft_data$;",
 "SELECT data FROM luxisoft_data_result;COMMIT;"
 ].join('\n');
}
