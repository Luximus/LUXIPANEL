import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'out/seedance25');
const STATE = resolve(OUT, 'production.private.json');
const KEY_FILE = '/var/www/luxisoft/backend/.env';
const API = 'https://api.higgsfield.ai/';
const script = [
  'Tus servidores y proyectos merecen otro nivel de control.',
  'LUXIPANEL conecta tus VPS en un solo lugar.',
  'Trabaja con IA, agentes y contexto de tus proyectos. Tú apruebas las acciones.',
  'Del desarrollo al despliegue: código, terminal y GitHub conectados.',
  'Supervisa servicios, seguridad y respaldos.',
  'Crea módulos y monetiza tus soluciones.',
  'Tu infraestructura, contigo. Disponible en Google Play.',
  'LUXIPANEL. Desarrolla más. Gestiona mejor. Luxipanel punto com.',
];
const firstPrompt = `Create a premium, photorealistic 30-second live-action technology product commercial. Vertical 9:16. This is real cinematic moving footage for LUXIPANEL, an infrastructure and developer platform. Camera movement, natural human movement, changing focus, realistic materials and physically plausible light. Restrained charcoal, cyan, magenta and warm gold accents inspired by an iridescent LP icon. Confident, innovative and sophisticated. No slideshow, no presentation cards, no animated flat illustrations, no fake infographic, no onscreen typography, no watermarks. No presenter speaking to camera. The developer is seen from behind or hands-only, wearing a black overshirt in a modern dark workspace. One consistent set and equipment.

Five professionally edited shots with exact approximate timing:
0-5 seconds: fast but smooth tracking camera glides between real server racks with tiny status lights, passes a rack edge as a natural wipe and arrives behind a developer working at a desk. Strong hook, no catastrophe or fake error messages.
5-11 seconds: over-shoulder dolly towards a large landscape monitor and laptop. The developer interacts with the workstation, infrastructure lights respond subtly. Keep the main monitor's rectangular display unobstructed, all four corners visible, nearly facing the camera. Display is plain matte dark charcoal, reserved for authentic interface footage added in post. No fabricated writing.
11-19 seconds: smoothly arc around the workstation with a subtle focus pull from the developer's hand to the monitor, then a closer, clean front three-quarter view of the same monitor. Show decisive mouse movement and a calm, capable developer. Keep the screen surface flat and visible, no fingers over it, no reflections concealing it. Cinematic foreground parallax. The screen remains plain dark charcoal for real AI interface replacement.
19-25 seconds: match cut on the developer's keyboard movement to a tactile close shot of keyboard and monitor, then a gentle push in towards the entire monitor, representing coding, terminal and repository workflow. No fabricated code, monitor stays blank charcoal for accurate product compositing.
25-30 seconds: smooth pull-back from the monitor to reveal the workstation and rack lights, a clean visual metaphor for infrastructure running smoothly. Finish with the developer's right hand beginning to reach towards a smartphone on the desk, the phone and workstation visible, clean charcoal screens. Hold a stable final frame for continuation.

AUDIO IS MANDATORY. Native audio: one single OFFSCREEN male professional advertising narrator speaking neutral Latin American Spanish, confident, warm, clear and human, steady timbre. DRY CLEAN VOICE ONLY: no background music, no room tone, no sound effects, no echo. Read the ENTIRE following Spanish script EXACTLY ONCE within these 30 seconds at a natural approximately 160-175 words per minute. Read all eight paragraphs, including the Android/Google Play and URL closing lines even though those visuals will be added in the continuation. Narration is an independent master voice track and will be spaced in editing. Do not omit, paraphrase, invent or repeat any words. Pronounce LUXIPANEL as 'Luxipanel', VPS as Spanish letters 'uve pe ese', IA as 'i a', GitHub as 'Git jab', and luxipanel.com as 'luxipanel punto com'. No English speech and no visible lip-sync.
EXACT SPOKEN SCRIPT:
${script.join('\n')}`;

const secondPrompt = `Continue the preceding cinematic LUXIPANEL technology commercial in exactly the same photorealistic workstation, light, colors, equipment and black overshirt. 15 seconds of genuinely moving live-action-style footage, vertical framing inherited from the reference image, restrained charcoal/cyan/magenta/warm-gold brand lighting. Realistic hands and phone. No slideshow, no cards, no fake flat graphics, no subtitles, no fabricated readable writing, no watermarks. Screen areas are clean plain matte charcoal surfaces for authentic LUXIPANEL recordings inserted in post. All four screen corners stay visible whenever a screen is featured, minimal reflection, no hand covering the display.
0-4 seconds: match the reference frame and continue the camera motion. Briefly orbit the developer's workstation, representing an extensible platform and developer modules. The developer's hand reaches for an Android smartphone on the desk. Subtle lens parallax and realistic shallow depth of field.
4-10 seconds: follow the hand lifting the Android phone in one fluid professional tracking move. A convincing close hero view of the phone screen in portrait orientation, almost facing the camera, stable rectangular geometry, all four corners visible. Device occupies a generous portion of the frame. Its display is blank charcoal for the real native app to be composited. The developer makes one small thumb gesture beside the display, never covering it. Natural human action.
10-15 seconds: elegant slow pull-back and slight orbit leaves the smartphone on the right or lower right of frame and a spacious clean dark area centered/upper center for the original LP icon, LUXIPANEL name and luxipanel.com URL to be placed in post. The workstation/server lights form a premium bokeh background. Keep the background moving gently; this ending is a filmed product hero shot, not a static title slide. End on an elegant, resolved lighting cue.
AUDIO IS MANDATORY: generate a polished original instrumental cinematic electronic advertising music bed, 120 BPM, warm low synth pulse, crisp restrained percussion, airy atmospheric texture and a confident resolving finish. NO voice, NO singing, NO spoken words, NO narration. Music only, with a clean consistent middle passage suitable for looping underneath the 45-second master voiceover. No copyrighted song imitation.`;

function envValue(name) {
  for (const line of readFileSync(KEY_FILE, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match?.[1] === name) return match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  throw new Error('Credential is not configured');
}
function save(state) {
  mkdirSync(OUT, { recursive: true });
  const temp = STATE + '.tmp';
  writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  renameSync(temp, STATE);
  const evidence = {
    provider: 'higgsfield', model: 'Seedance 2.5', durationSeconds: 45,
    aspectRatio: '9:16', resolution: '1080p', nativeNarrationRequired: true,
    nativeAudioDelivered: Boolean(state.jobs[0].metadata?.audioCodec),
    status: state.jobs[0].error?.message?.includes('credit balance') ? 'blocked_insufficient_api_balance' : state.jobs.every(j=>j.status==='completed') ? 'generated_pending_edit_and_review' : 'in_progress',
    narration: script, createdAt: state.createdAt,
    jobs: state.jobs.map(j => ({ name: j.name, model: j.model, duration: j.input.duration,
      idempotencyKey: j.idempotencyKey, requestId: j.requestId ?? null,
      status: j.status ?? 'not_submitted', file: j.file ?? null, sha256: j.sha256 ?? null,
      previousAttempts: j.previousAttempts ?? [],
      metadata: j.metadata ?? null, error: j.error ?? null,
      prompt: j.input.prompt,
    })),
  };
  writeFileSync(resolve(OUT, 'generation-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
}
function load() {
  if (existsSync(STATE)) return JSON.parse(readFileSync(STATE, 'utf8'));
  const state = { version: 1, createdAt: new Date().toISOString(), jobs: [
    { name: '01-developer-infrastructure', model: 'bytedance/seedance-2.5/text-to-video', idempotencyKey: 'luxipanel-seedance25:' + randomUUID(),
      input: { prompt: firstPrompt, duration: 30, resolution: '1080p', aspect_ratio: '9:16', bitrate_mode: 'high', output_format: 'mp4', generate_audio: true } },
    { name: '02-modules-android-brand', model: 'bytedance/seedance-2.5/image-to-video', idempotencyKey: 'luxipanel-seedance25:' + randomUUID(),
      input: { prompt: secondPrompt, duration: 15, resolution: '1080p', bitrate_mode: 'high', output_format: 'mp4', generate_audio: true } },
  ] };
  save(state);
  writeFileSync(resolve(OUT, 'voiceover-es.txt'), script.join('\n') + '\n');
  return state;
}
function apiUrl(value) {
  const url = new URL(value, API);
  if (url.username || url.password || url.hash || url.search ||
    !(url.origin === new URL(API).origin || url.origin === 'https://platform.higgsfield.ai' && /^\/requests\/[a-f0-9-]+\/(status|cancel)$/.test(url.pathname))) {
    throw new Error('Unexpected provider lifecycle URL');
  }
  return url.href;
}
async function request(value, method = 'GET', body, idempotencyKey) {
  const res = await fetch(apiUrl(value), { method, redirect: 'error',
    headers: { authorization: 'Key ' + envValue('HIGGSFIELD_API_KEY'), 'content-type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string' && /^[\w .:/-]{1,240}$/.test(data.detail) ? data.detail : 'provider_request_rejected';
    const error = new Error(`Higgsfield HTTP ${res.status}: ${detail}`);
    error.httpStatus = res.status;
    error.detail = detail;
    if (Array.isArray(data.detail)) error.validation = data.detail.map(e => ({ loc: e.loc, type: e.type, msg: e.msg })).slice(0, 12);
    throw error;
  }
  return data;
}
function print(data) { process.stdout.write(JSON.stringify(data) + '\n'); }
async function download(job, state) {
  const output = job.result?.video;
  if (!output?.url) throw new Error('Completed job has no video URL');
  const u = new URL(output.url);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Invalid video URL');
  const file = resolve(OUT, job.name + '.mp4');
  if (!existsSync(file)) {
    const res = await fetch(u, { signal: AbortSignal.timeout(300000) });
    if (!res.ok) throw new Error('Video download failed HTTP ' + res.status);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Output is not an MP4');
    writeFileSync(file, bytes, { mode: 0o600 });
  }
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',file], { maxBuffer: 1 << 20 }).toString());
  job.file = file;
  job.sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  const v = metadata.streams.find(s => s.codec_type === 'video');
  const a = metadata.streams.find(s => s.codec_type === 'audio');
  job.metadata = { durationSeconds: Number(metadata.format.duration), width: v?.width, height: v?.height, frameRate: v?.r_frame_rate,
    videoCodec: v?.codec_name, audioCodec: a?.codec_name ?? null, audioChannels: a?.channels ?? null, bytes: Number(metadata.format.size) };
  save(state);
  if (!a) throw new Error('Higgsfield did not provide the mandatory native audio');
  print({ name: job.name, status: job.status, requestId: job.requestId, file, metadata: job.metadata });
}
const [command = 'status', which = 'first', reference] = process.argv.slice(2);
const state = load();
const job = state.jobs[which === 'second' ? 1 : 0];
try {
  if (command === 'init') print({ directory: OUT, narrationWords: script.join(' ').split(/\s+/).length, jobs: state.jobs.map(j => ({ name: j.name, model: j.model, duration: j.input.duration })) });
  else if (command === 'estimate') {
    const result = await request('estimate/' + job.model, 'POST', job.input);
    print({ name: job.name, type: result.type, pricing: result.pricing_description, usd: result.usd ?? null });
  } else if (command === 'prepare-reference') {
    const first = state.jobs[0];
    if (first.status !== 'completed' || !first.file || !first.metadata?.audioCodec) throw new Error('Cannot prepare continuity before the first actual video with native audio is delivered');
    const frame = resolve(OUT, 'continuity.png');
    if (!existsSync(frame)) execFileSync('ffmpeg', ['-v','error','-nostdin','-threads','1','-sseof','-0.08','-i',first.file,'-frames:v','1','-y',frame]);
    if (!state.jobs[1].input.image_url) {
      const upload = await request('files/generate-upload-url','POST',{content_type:'image/png'});
      const url = new URL(upload.upload_url);
      const publicUrl = new URL(upload.public_url);
      if (url.protocol!=='https:' || publicUrl.protocol!=='https:' || url.username || publicUrl.username) throw new Error('Invalid provider upload URLs');
      const uploaded = await fetch(url,{method:'PUT',redirect:'error',headers:upload.upload_headers ?? {'Content-Type':'image/png'},body:readFileSync(frame),signal:AbortSignal.timeout(60000)});
      if (!uploaded.ok) throw new Error('Continuity frame upload failed HTTP '+uploaded.status);
      state.jobs[1].input.image_url = publicUrl.href;
      save(state);
    }
    print({continuityFrame:frame,uploaded:true,secondBlockReady:true});
  } else if (command === 'reference') {
    if (!reference || !/^https:\/\//.test(reference)) throw new Error('Reference must be an HTTPS image URL');
    job.input.image_url = reference; save(state); print({ name: job.name, referenceConfigured: true });
  } else if (command === 'resume-after-topup') {
    if (job.status !== 'failed' || !/credit balance|not_enough_credits/i.test(job.error?.message ?? '')) throw new Error('Only an insufficient-credit failure can be resumed with this command');
    job.previousAttempts ??= [];
    job.previousAttempts.push({ requestId: job.requestId, idempotencyKey: job.idempotencyKey, status: job.status, error: job.error });
    for (const field of ['requestId','statusUrl','cancelUrl','status','error','submissionAttemptedAt','result']) delete job[field];
    job.idempotencyKey = 'luxipanel-seedance25:' + randomUUID();
    save(state); print({ name: job.name, readyToSubmit: true, action: 'Run submit for this same production after account top-up' });
  } else if (command === 'submit') {
    if (job.requestId) { print({ name: job.name, requestId: job.requestId, status: job.status, reusedExistingJob: true }); if (job.status==='failed') process.exitCode=1; }
    else {
      if (which === 'second' && (state.jobs[0].status !== 'completed' || !state.jobs[0].metadata?.audioCodec)) throw new Error('First block must be completed with mandatory native audio before submitting the continuation');
      if (which === 'second' && !job.input.image_url) throw new Error('Continuation requires its reference frame');
      if (job.submissionAttemptedAt && job.error?.httpStatus === undefined) throw new Error('Previous submission is uncertain; recover it using the same idempotency key, never create another job');
      job.submissionAttemptedAt = new Date().toISOString(); save(state);
      const result = await request(job.model, 'POST', job.input, job.idempotencyKey);
      job.requestId = result.request_id; job.status = result.status ?? 'queued'; save(state);
      if (!job.requestId || !result.status_url) throw new Error('Provider response omitted its lifecycle identifiers');
      job.statusUrl = apiUrl(result.status_url); job.cancelUrl = result.cancel_url ? apiUrl(result.cancel_url) : null;
      delete job.error; save(state); print({ name: job.name, requestId: job.requestId, status: job.status });
    }
  } else if (command === 'poll' || command === 'status') {
    if (!job.requestId) print({ name: job.name, status: 'not_submitted', error: job.error ?? null });
    else {
      const result = await request(job.statusUrl);
      job.status = result.status;
      if (result.status === 'completed') job.result = result;
      if (['failed','nsfw','canceled','cancelled'].includes(result.status)) {
        job.error = { providerStatus: result.status, message: typeof result.error === 'string' ? result.error.slice(0, 600) : 'Provider generation failed', at: new Date().toISOString() };
      }
      save(state);
      if (job.status === 'completed') await download(job, state);
      else { print({ name: job.name, requestId: job.requestId, status: job.status, ...(job.error ? { error: job.error } : {}) }); if (job.error) process.exitCode = 1; }
    }
  } else if (command === 'download') await download(job, state);
  else throw new Error('Unknown command');
} catch (error) {
  job.error = { message: error.message, ...(error.httpStatus ? { httpStatus: error.httpStatus, detail: error.detail, validation: error.validation } : {}), at: new Date().toISOString() };
  save(state); print({ name: job.name, error: job.error }); process.exitCode = 1;
}
