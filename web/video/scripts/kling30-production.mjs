import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,createWriteStream} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=resolve(ROOT,'out/kling30');
const STATE=resolve(OUT,'production.private.json');
const API='https://api.higgsfield.ai/';
const narration=[
 'LUXIPANEL une tus servidores, proyectos y agentes de IA.',
 'Desarrolla, automatiza con tu aprobación y supervisa desde un solo lugar.',
 'Amplía sus funciones con módulos y lleva el control contigo en Android.',
 'LUXIPANEL: desarrolla más, gestiona mejor. Luxipanel punto com.',
];
const firstPrompt=`Premium photoreal cinematic LUXIPANEL developer/infrastructure commercial, 15 seconds, vertical 9:16. Real moving live-action footage, sophisticated charcoal studio, cyan and subtle magenta/gold lights. A developer in a plain black overshirt seen from behind, modern workstation beside server racks. Natural human motion, smooth camera, realistic hands, tactile surfaces. No slideshow, no title cards, no illustrations, no logos, no readable text, no fabricated code, no watermark. Original brand and real product screens will be composited later.
Three shots edited with motivated cinematic transitions:
0-4s: fast smooth travelling between server racks, pass a rack edge as an elegant wipe, arrive behind the developer at the workstation.
4-11s: over-shoulder dolly then gentle arc towards the large LANDSCAPE monitor. Its flat display is plain MATTE CHARCOAL, nearly facing camera; all four corners visible with clear geometry, unobstructed, no glare, no reflections, no generated UI. Keep the monitor large and stable enough for real interface replacement. Developer makes one deliberate mouse movement. Focus pulls onto the screen, cinematic foreground parallax.
11-15s: cut on hand movement to a closer clean monitor/workstation shot, then pull back very slightly. Screen remains blank charcoal and all corners visible. End with right hand beginning to reach for a portrait Android phone on the desk; hold a stable resolved final composition for continuation.
AUDIO REQUIRED: ONE OFFSCREEN male advertising narrator, warm professional NEUTRAL LATIN AMERICAN SPANISH. DRY CLEAN VOICE ONLY: no music, no ambience, no sound effects, no echo. Read ALL of the following script EXACTLY ONCE in these 15 seconds at a natural approximately 160 words/minute. This is a master voice recording later spaced over 30 seconds: read every sentence including Android and the URL even though phone visuals come later. No omissions, repetitions or English. Pronounce LUXIPANEL as Luxipanel, IA as Spanish letters i a, URL as luxipanel punto com. Do not show anyone speaking.
EXACT SCRIPT: ${narration.join(' ')}`;
const secondPrompt=`Continue the reference image as the same premium photoreal LUXIPANEL commercial. 15 seconds, same developer black overshirt, workstation/server racks, charcoal/cyan/magenta/gold lights. True filmed moving footage, natural hands, restrained camera motion and physically plausible light. No slideshow, no title cards, no logos, no readable text, no watermark. Device displays are plain matte charcoal for original branding/real UI replacement in post.
0-6s: seamlessly continue from reference, graceful short orbit of workstation and large monitor; developer reaches for the Android phone. Monitor is flat, blank charcoal, four corners visible, nearly facing camera, minimal reflection.
6-11s: track the hand lifting a PORTRAIT Android smartphone into a close clear hero view. Realistic fingers hold the phone by its edges, never cover its display. Flat blank charcoal screen, all four corners visible, almost front-facing, generous screen area for exact original app icon/real UI. Gentle smooth camera movement; no distorted or bending phone.
11-15s: resolved elegant slow pull-back leaves phone on lower right, spacious uncluttered dark area in upper center for original LP icon, LUXIPANEL name and luxipanel.com added later. Moving rack-light bokeh, subtle parallax, polished lighting cue at finish; do not freeze into a slide.
AUDIO REQUIRED: original instrumental electronic advertising music, 120 BPM, warm synth pulse, crisp light percussion, airy texture, confident ending. NO voice, NO speech, NO singing, NO narrator. Clean musical middle section suitable for extending under the 30-second master narration. Do not imitate a copyrighted song.`;

function credential(){
 for(const line of readFileSync('/var/www/luxisoft/backend/.env','utf8').split(/\r?\n/)){
  const m=line.match(/^\s*(?:export\s+)?HIGGSFIELD_API_KEY\s*=\s*(.*)$/);
  if(m)return m[1].trim().replace(/^(['"])(.*)\1$/,'$2');
 }
 throw new Error('Higgsfield credential is missing');
}
function lifecycle(value){
 const u=new URL(value,API);
 if(u.username||u.password||u.search||u.hash||!(u.origin===new URL(API).origin||u.origin==='https://platform.higgsfield.ai'&&/^\/requests\/[a-f0-9-]+\/(status|cancel)$/.test(u.pathname)))throw new Error('Unexpected provider URL');
 return u.href;
}
async function request(url,method='GET',body,key){
 const response=await fetch(lifecycle(url),{method,redirect:'error',headers:{authorization:'Key '+credential(),'content-type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const e=new Error('Higgsfield HTTP '+response.status+': '+(typeof data.detail==='string'?data.detail.slice(0,250):'request rejected'));
  e.httpStatus=response.status;
  if(Array.isArray(data.detail))e.validation=data.detail.map(v=>({loc:v.loc,msg:v.msg,type:v.type})).slice(0,8);
  throw e;
 }
 return data;
}
function save(state){
 mkdirSync(OUT,{recursive:true});
 state.updatedAt=new Date().toISOString();
 writeFileSync(STATE+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});renameSync(STATE+'.tmp',STATE);
 const evidence={provider:'Higgsfield',model:'Kling 3.0 Standard',plannedSeconds:30,aspectRatio:'9:16',nativeNarrationRequired:true,nativeNarrationVerified:state.narrationReview?.accepted===true,nativeAudioDelivered:Boolean(state.jobs[0].metadata?.audioCodec),budget:state.budget,narration,createdAt:state.createdAt,updatedAt:state.updatedAt,jobs:state.jobs.map(j=>({name:j.name,model:j.model,plannedSeconds:j.input.duration,requestId:j.requestId??null,status:j.status??'not_submitted',error:j.error??null,file:j.file??null,metadata:j.metadata??null,sha256:j.sha256??null,prompt:j.input.prompt,previousAttempts:j.previousAttempts??[]})),narrationReview:state.narrationReview??null};
 writeFileSync(resolve(OUT,'generation-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
}
function load(){
 if(existsSync(STATE))return JSON.parse(readFileSync(STATE,'utf8'));
 const state={version:1,createdAt:new Date().toISOString(),budget:{reportedAvailableUsd:23.72,maximumProductionUsd:5,estimatedTotalUsd:null},jobs:[
  {name:'01-infrastructure-ai',model:'kling-video/v3.0/std/text-to-video',idempotencyKey:'luxipanel-kling30:'+randomUUID(),input:{prompt:firstPrompt,duration:15,sound:'on',cfg_scale:0.5,multi_shots:false,aspect_ratio:'9:16'}},
  {name:'02-modules-android-brand',model:'kling-video/v3.0/std/image-to-video',idempotencyKey:'luxipanel-kling30:'+randomUUID(),input:{prompt:secondPrompt,duration:15,sound:'on',cfg_scale:0.5,multi_shots:false}},
 ]};
 save(state);writeFileSync(resolve(OUT,'voiceover-es.txt'),narration.join('\n')+'\n');return state;
}
function print(value){process.stdout.write(JSON.stringify(value)+'\n');}
async function download(job,state){
 const url=new URL(job.result?.video?.url??'');
 if(url.protocol!=='https:'||url.username||url.password)throw new Error('Invalid generated media URL');
 const file=resolve(OUT,job.name+'.mp4');
 if(!existsSync(file)){
  const response=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!response.ok)throw new Error('Media download HTTP '+response.status);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(file+'.tmp',{mode:0o600}));
  const header=readFileSync(file+'.tmp').subarray(0,12);if(header.toString('ascii',4,8)!=='ftyp')throw new Error('Generated file is not MP4');renameSync(file+'.tmp',file);
 }
 const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{maxBuffer:1048576}).toString());
 const v=metadata.streams.find(s=>s.codec_type==='video'),a=metadata.streams.find(s=>s.codec_type==='audio');
 job.file=file;job.sha256=createHash('sha256').update(readFileSync(file)).digest('hex');
 job.metadata={durationSeconds:Number(metadata.format.duration),width:v?.width,height:v?.height,frameRate:v?.r_frame_rate,videoCodec:v?.codec_name,audioCodec:a?.codec_name??null,audioChannels:a?.channels??null,bytes:Number(metadata.format.size)};save(state);
 if(!a)throw new Error('Mandatory native audio is missing');
 print({name:job.name,requestId:job.requestId,status:job.status,file,metadata:job.metadata});
}
const [command='status',which='first',argument]=process.argv.slice(2),state=load(),job=state.jobs[which==='second'?1:0];
try{
 if(command==='init')print({directory:OUT,narrationWords:narration.join(' ').split(/\s+/).length,promptCharacters:state.jobs.map(j=>j.input.prompt.length),jobs:state.jobs.map(j=>({name:j.name,model:j.model,duration:j.input.duration}))});
 else if(command==='repair-invalid-multishot'){
  if(job.status!=='failed'||!job.error?.message?.includes('Could not generate multiple scenes'))throw new Error('Only the known unsupported multishot input can be corrected');
  job.previousAttempts??=[];
  job.previousAttempts.push({requestId:job.requestId,idempotencyKey:job.idempotencyKey,input:{...job.input},status:job.status,error:job.error});
  for(const field of ['requestId','statusUrl','cancelUrl','status','error','submissionAttemptedAt','result'])delete job[field];
  job.idempotencyKey='luxipanel-kling30:'+randomUUID();
  for(const j of state.jobs)j.input.multi_shots=false;
  save(state);print({correctedUnsupportedInput:true,continuousCameraMotion:true,previousFailedAttemptPreserved:true});
 }
 else if(command==='estimate'){
  const estimates=[];
  for(const j of state.jobs){
   const input={...j.input,...(j.model.endsWith('image-to-video')&&!j.input.image_url?{image_url:'https://open.higgsfield.ai/favicon.ico'}:{})};
   const result=await request('estimate/'+j.model,'POST',input),usd=Number(result.usd);
   if(!Number.isFinite(usd)||usd<=0)throw new Error('Provider did not return an exact numerical estimate');
   estimates.push({name:j.name,usd,credits:result.credits??null});
  }
  state.budget.estimates=estimates;state.budget.estimatedTotalUsd=Number(estimates.reduce((n,e)=>n+e.usd,0).toFixed(4));state.budget.estimatedAt=new Date().toISOString();save(state);
  if(state.budget.estimatedTotalUsd>state.budget.maximumProductionUsd)throw new Error('Estimated production exceeds its US$5 limit');print(state.budget);
 }else if(command==='submit'){
  if(job.requestId){print({name:job.name,requestId:job.requestId,status:job.status,reusedExistingJob:true});if(job.status==='failed')process.exitCode=1;}
  else{
   if(!state.budget.estimatedTotalUsd||state.budget.estimatedTotalUsd>state.budget.maximumProductionUsd)throw new Error('An acceptable full-production estimate is required');
   if(which==='second'&&(state.narrationReview?.accepted!==true||!state.jobs[0].metadata?.audioCodec))throw new Error('Complete native Spanish narration must be verified before continuation');
   if(which==='second'&&!job.input.image_url)throw new Error('Continuation reference is missing');
   if(job.submissionAttemptedAt)throw new Error('Submission already attempted; recover the existing job without creating another generation');
   job.submissionAttemptedAt=new Date().toISOString();save(state);
   const result=await request(job.model,'POST',job.input,job.idempotencyKey);
   job.requestId=result.request_id;job.status=result.status??'queued';save(state);
   if(!job.requestId||!result.status_url)throw new Error('Accepted response lacks lifecycle identifiers');
   job.statusUrl=lifecycle(result.status_url);job.cancelUrl=result.cancel_url?lifecycle(result.cancel_url):null;delete job.error;save(state);print({name:job.name,requestId:job.requestId,status:job.status});
  }
 }else if(command==='poll'||command==='status'){
  if(!job.requestId)print({name:job.name,status:'not_submitted'});
  else{
   const result=await request(job.statusUrl);job.status=result.status;
   if(result.status==='completed')job.result=result;
   if(['failed','nsfw','canceled','cancelled'].includes(result.status))job.error={providerStatus:result.status,message:typeof result.error==='string'?result.error.slice(0,600):'Provider generation failed',at:new Date().toISOString()};
   save(state);if(job.status==='completed')await download(job,state);else{print({name:job.name,requestId:job.requestId,status:job.status,error:job.error??null});if(job.error)process.exitCode=1;}
  }
 }else if(command==='download')await download(job,state);
 else if(command==='accept-narration'||command==='record-narration-review'){
  if(!argument||!existsSync(argument))throw new Error('Provide the reviewed local transcription evidence file');
  const review=JSON.parse(readFileSync(argument,'utf8'));
  if(typeof review.accepted!=='boolean'||!job.file||!job.metadata?.audioCodec)throw new Error('A native audio review is required');
  if(review.requestId!==job.requestId||review.sourceSha256!==job.sha256)throw new Error('Review does not match the generated source');
  if(command==='accept-narration'&&review.accepted!==true)throw new Error('Native narration has not passed review');
  state.narrationReview={...review,evidenceFile:resolve(argument),reviewedAt:new Date().toISOString()};save(state);print({nativeNarrationVerified:review.accepted});
 }else if(command==='prepare-reference'){
  const first=state.jobs[0];if(first.status!=='completed'||state.narrationReview?.accepted!==true)throw new Error('Native narration review is required');
  const frame=resolve(OUT,'continuity.png');
  if(!existsSync(frame))execFileSync('ffmpeg',['-v','error','-nostdin','-threads','1','-sseof','-0.08','-i',first.file,'-frames:v','1','-y',frame]);
  if(!state.jobs[1].input.image_url){
   const upload=await request('files/generate-upload-url','POST',{content_type:'image/png'}),url=new URL(upload.upload_url),publicUrl=new URL(upload.public_url);
   if(url.protocol!=='https:'||publicUrl.protocol!=='https:'||url.username||publicUrl.username)throw new Error('Unexpected upload URL');
   const uploaded=await fetch(url,{method:'PUT',redirect:'error',headers:upload.upload_headers??{'content-type':'image/png'},body:readFileSync(frame),signal:AbortSignal.timeout(60000)});
   if(!uploaded.ok)throw new Error('Continuity upload HTTP '+uploaded.status);state.jobs[1].input.image_url=publicUrl.href;save(state);
  }
  print({continuityFrame:frame,secondBlockReady:true});
 }else throw new Error('Unknown command');
}catch(error){job.error={message:error.message,...(error.httpStatus?{httpStatus:error.httpStatus,validation:error.validation}:{}),at:new Date().toISOString()};save(state);print({name:job.name,error:job.error});process.exitCode=1;}
