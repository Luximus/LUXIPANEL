import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(root, "public/higgsfield45");
const out = resolve(root, "out/higgsfield45");
mkdirSync(publicDir, { recursive: true });
mkdirSync(out, { recursive: true });
const source = readFileSync(resolve(root, "src/higgsfield45-data.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { HIGGSFIELD45: campaign } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const files = [
  ["/var/www/LP-LICENSE-SERVER/app/assets/icon.png", "lp-icon.png"],
  ["/var/www/LP-LICENSE-SERVER/frontend/public/play_store.webp", "google-play-badge.webp"],
];
const assets = files.map(([from, name]) => {
  if (!existsSync(from)) throw new Error(`Missing original asset: ${from}`);
  copyFileSync(from, resolve(publicDir, name));
  copyFileSync(from, resolve(out, name));
  return { name, source: from, sha256: createHash("sha256").update(readFileSync(from)).digest("hex") };
});
const time = (n, sep = ",") => {
  const milliseconds = Math.round(n * 1000);
  return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}${sep}${String(milliseconds % 1000).padStart(3, "0")}`;
};
function cues(preview) {
  const result = [];
  for (const scene of campaign.scenes) {
    const phrases = preview && scene.previewCaptions ? scene.previewCaptions : scene.captions;
    const counts = phrases.map(t => t.split(/\s+/).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const available = scene.end - scene.start - .5;
    let start = scene.start + .25;
    phrases.forEach((text, i) => {
      const end = i === phrases.length - 1 ? scene.end - .25 : start + available * counts[i] / total;
      result.push({ start: Math.round(start * 30) / 30, end: Math.round(end * 30) / 30, text });
      start = end;
    });
  }
  return result;
}
for (const preview of [false, true]) {
  const c = cues(preview);
  const suffix = preview ? "preview" : "release";
  writeFileSync(resolve(out, `subtitles-${suffix}.srt`), c.map((v, i) => `${i + 1}\n${time(v.start)} --> ${time(v.end)}\n${v.text}\n`).join("\n"));
  writeFileSync(resolve(out, `subtitles-${suffix}.vtt`), "WEBVTT\n\n" + c.map(v => `${time(v.start, ".")} --> ${time(v.end, ".")}\n${v.text}\n`).join("\n"));
}
writeFileSync(resolve(out, "voiceover-es-release.txt"), campaign.scenes.map(s => `[${s.start.toFixed(1)}–${s.end.toFixed(1)} s] ${s.narration}`).join("\n\n") + "\n");
const prompts = [
  campaign.name, "MASTER PROMPT", campaign.masterPrompt, "NEGATIVE PROMPT", campaign.negativePrompt,
  "PRODUCTION NOTES", "Generate the Spanish narration in Higgsfield. Align phrases to their scene windows without cutting words. Composite original UI footage, logo, badge and typography as exact layers after cinematic generation. Export 1080 × 1920, 30 fps, exactly 1350 frames, H.264/yuv420p and AAC 48 kHz. Timeline transition handles must not reduce the 45-second duration.",
  "RELEASE HOLD", "The Play listing is not verified. The release narration and badge availability version must not be distributed until the public listing and installation have been checked. The current MP4 is an animatic with original music; it has no Higgsfield footage or voiceover. Conceptual drawings do not replace real product captures.",
  ...campaign.scenes.flatMap(s => [
    `${s.id.toUpperCase()} | ${s.start}–${s.end} seconds | ${(s.end - s.start) * campaign.fps} timeline frames`,
    `Kling 3.0; vertical 9:16. Generate ${Math.max(5, s.end - s.start)} seconds; trim to the specified edit window.`,
    s.prompt, `COMPOSITE: ${s.visual}`, `REQUIRED SOURCE: ${s.requiredCapture}`, `VOICE: ${s.narration}`,
  ]),
].join("\n\n");
writeFileSync(resolve(out, "higgsfield-prompts.txt"), prompts + "\n");
writeFileSync(resolve(out, "campaign.json"), JSON.stringify({ ...campaign, assets, captions: cues(false), previewCaptions: cues(true) }, null, 2));
writeFileSync(resolve(out, "production-status.json"), JSON.stringify({
  updatedAt: new Date().toISOString(),
  preview: "45-second Remotion animatic, original score, conceptual visuals, no AI-generated footage and no narration",
  higgsfield: "not connected; generation pending",
  realPanelCapture: "authenticated captures pending; no user credentials accessed",
  nativeAndroidCapture: "pending; do not substitute mobile web screenshots",
  googlePlay: { state: "release hold", package: "com.luxisoft.lxpanel", listingLastObservedHTTP: 404, portalPlayStoreUrl: null },
  releaseReady: false,
}, null, 2));
const escaped = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
writeFileSync(resolve(out, "review.html"), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LUXIPANEL — Revisión de video</title><style>
*{box-sizing:border-box}body{margin:0;background:#080a12;color:#eaf0f8;font:16px/1.6 system-ui,sans-serif}main{max-width:1220px;margin:auto;padding:40px 24px}header{border-bottom:1px solid #303447;padding-bottom:24px}header img{width:80px;float:right}h1{font-size:clamp(28px,4vw,48px);letter-spacing:-1px;line-height:1.12;margin:12px 0}small,.muted{color:#a3adc3}a{color:#35d8f5}button{background:#161b2b;color:#eaf0f8;border:1px solid #34394d;border-radius:12px;padding:14px;text-align:left;cursor:pointer;font:inherit}button:hover,button.active{border-color:#35d8f5;background:#132333}.status{color:#ffc879}.grid{display:grid;grid-template-columns:390px 1fr;gap:36px;margin-top:32px}video{width:100%;border-radius:16px;background:#000}.shots{display:grid;gap:10px}.shots strong{display:block;color:#35d8f5}.detail{margin-top:24px;background:#121622;padding:24px;border-radius:16px}pre{white-space:pre-wrap;font:14px/1.6 ui-monospace,monospace}summary{cursor:pointer;color:#35d8f5}@media(max-width:800px){.grid{grid-template-columns:1fr}video{max-height:75vh}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style><main><header><img src="lp-icon.png" alt="Icono oficial LP"><small>PREVISUALIZACIÓN · 45 S · 9:16</small><h1>Tu infraestructura,<br>a otro nivel.</h1><p>Video para desarrolladores, administradores y proveedores de hosting. <a href="https://luxipanel.com">luxipanel.com</a></p><p class="status">Borrador con música original. Faltan planos de Higgsfield, locución y capturas de producto. Estreno condicionado a Google Play.</p></header><section class="grid"><div><video id="video" controls preload="metadata" playsinline><source src="luxipanel-45s-preview.mp4" type="video/mp4"><track kind="captions" src="subtitles-preview.vtt" srclang="es" label="Español"></video><p><a href="luxipanel-45s-preview.mp4" download>Descargar previsualización MP4</a><br><a href="higgsfield-prompts.txt" download>Prompts de producción</a> · <a href="voiceover-es-release.txt" download>Locución</a> · <a href="subtitles-release.srt" download>Subtítulos</a></p></div><div><div class="shots">${campaign.scenes.map(s => `<button data-start="${s.start}" aria-label="Revisar escena ${s.id}"><strong>${String(s.start).padStart(2, "0")}–${s.end} s · ${escaped(s.kicker)}</strong>${escaped(s.title.join(" "))}</button>`).join("")}</div><article class="detail"><h2 id="title"></h2><p id="visual"></p><p id="narration"></p><small id="capture"></small><details><summary>Prompt de la escena</summary><pre id="prompt"></pre></details></article></div></section><footer><p class="muted">Las ilustraciones son conceptos de montaje. Los recursos de marca se conservan sin modificaciones. La previsualización no acredita generación en Higgsfield ni disponibilidad actual en Google Play.</p></footer></main><script>
const scenes=${JSON.stringify(campaign.scenes).replaceAll("<", "\\u003c")};const video=document.querySelector('#video');const buttons=[...document.querySelectorAll('[data-start]')];function show(t){const s=scenes.find(s=>t>=s.start&&t<s.end)||scenes.at(-1);document.querySelector('#title').textContent=s.title.join(' ');document.querySelector('#visual').textContent=s.visual;document.querySelector('#narration').textContent=s.narration;document.querySelector('#capture').textContent='Captura necesaria: '+s.requiredCapture;document.querySelector('#prompt').textContent=s.prompt;buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.start)===s.start));}buttons.forEach(b=>b.addEventListener('click',()=>{video.currentTime=Number(b.dataset.start);show(video.currentTime);}));video.addEventListener('timeupdate',()=>show(video.currentTime));show(0);
</script></html>`);
console.log(JSON.stringify({ output: out, scenes: campaign.scenes.length, frames: campaign.seconds * campaign.fps, assets: assets.length, narrationWords: campaign.scenes.reduce((n, s) => n + s.narration.split(/\s+/).length, 0), status: "generation pending Higgsfield connection" }));
