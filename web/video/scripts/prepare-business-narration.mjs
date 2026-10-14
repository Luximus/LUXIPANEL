import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const language = process.argv[2];
if (!["es", "en"].includes(language)) throw new Error("Choose es or en.");
const manifest = JSON.parse(readFileSync("narration/business-voice.json", "utf8"));
const cache = resolve(".cache/elevenlabs-business");
const output = resolve(`public/audio/narration-business-${language}.wav`);
mkdirSync(cache, { recursive: true });
const timings = [];
const inputs = [];
const chains = [];
for (let i = 0; i < manifest.segments.length; i++) {
  const segment = manifest.segments[i];
  const path = resolve(cache, `${language}-${String(i + 1).padStart(2, "0")}.mp3`);
  const json = path.replace(/\.mp3$/, ".json");
  if (!existsSync(path) || !existsSync(json)) throw new Error(`Missing ElevenLabs generation: ${language} scene ${i + 1}`);
  const generated = JSON.parse(readFileSync(json, "utf8"));
  if (generated.text !== segment[language] || generated.voiceId !== manifest.voices[language].id || generated.model !== manifest.model) throw new Error(`Generation does not match manifest: ${language} scene ${i + 1}`);
  const alignment = generated.alignment;
  const first = Math.max(0, alignment.character_start_times_seconds[0] - .03);
  const last = alignment.character_end_times_seconds.at(-1) + .08;
  const duration = last - first;
  const available = segment.end - segment.start;
  const tempo = Math.max(1, duration / available);
  // Never truncate speech or force an unnatural pace just to fit the picture.
  if (tempo > 1.18) throw new Error(`Rephrase ${language} scene ${i + 1}: ${duration.toFixed(2)}s needs ${tempo.toFixed(2)}x tempo for ${available.toFixed(2)}s`);
  inputs.push("-i", path);
  const delay = Math.round(segment.start * 1000);
  chains.push(`[${i}:a]atrim=start=${first}:end=${last},asetpts=PTS-STARTPTS,atempo=${tempo.toFixed(8)},aresample=48000,adelay=${delay}:all=1[s${i}]`);
  timings.push({ scene: segment.scene, start: segment.start, speechEnd: segment.start + duration / tempo, slotEnd: segment.end, sourceSpeechDuration: duration, tempo });
}
const stems = manifest.segments.map((_, i) => `[s${i}]`).join("");
chains.push(`${stems}amix=inputs=8:normalize=0:duration=longest,apad,atrim=duration=${manifest.duration}[voice]`);
const raw = resolve(cache, `${language}-narration-raw.wav`);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", chains.join(";"), "-map", "[voice]", "-c:a", "pcm_s24le", "-ar", "48000", "-ac", "1", raw]);
const analysis = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-16:TP=-3:LRA=7:print_format=json", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
if (analysis.status !== 0) throw new Error("Narration loudness analysis failed.");
const stats = JSON.parse(analysis.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const filter = `loudnorm=I=-16:TP=-3:LRA=7:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", filter, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s24le", output]);
writeFileSync(resolve(cache, `${language}-timing-report.json`), JSON.stringify({ duration: manifest.duration, source: "ElevenLabs character alignment", timings }, null, 2));
console.log(JSON.stringify({ language, output, timings }, null, 2));
