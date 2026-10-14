import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

// Original upbeat pop/electronic score. 90 beats at 120 BPM = 45 seconds.
// A major-key marimba motif, warm bass, claps and on-screen interaction sounds.
const RATE = 48000, SECONDS = 45, BEAT = .5, COUNT = RATE * SECONDS;
const L = new Float32Array(COUNT), R = new Float32Array(COUNT);
const sin = (phase) => Math.sin(phase * Math.PI * 2);
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (v) => Math.max(0, Math.min(1, v));
const env = (t, d, attack = .005, release = .05) => clamp(t / attack) * clamp((d - t) / release);
let seed = 194825;
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
function add(start, duration, gain, pan, synth) {
  const begin = Math.round(start * RATE);
  const end = Math.min(COUNT, begin + Math.round(duration * RATE));
  const left = gain * Math.sqrt((1 - pan) / 2), right = gain * Math.sqrt((1 + pan) / 2);
  for (let i = Math.max(0, begin); i < end; i++) {
    const sample = synth((i - begin) / RATE);
    L[i] += sample * left;
    R[i] += sample * right;
  }
}
function marimba(time, note, gain, pan = 0, d = .42) {
  const f = hz(note);
  add(time, d, gain, pan, (t) => env(t, d, .002, .035) * Math.exp(-t * 8.5) * (sin(f * t) + .29 * sin(f * 3.99 * t) + .13 * sin(f * 7 * t)));
  add(time + BEAT * .75, d, gain * .16, -pan, (t) => env(t, d, .006) * Math.exp(-t * 9) * sin(f * t));
}
const chords = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
const tune = [0, 2, 3, 2, 1, 2, 1, 3];
for (let b = 0; b < 90; b++) {
  const time = b * BEAT;
  const chord = chords[Math.floor(b / 8) % 4];
  const outro = b >= 80;
  const light = b >= 62 && b < 70;
  const strength = outro ? .60 : light ? .66 : 1;
  add(time, .27, .32 * strength, 0, (t) => {
    const phase = 52 * t + 91 * (1 - Math.exp(-t * 37)) / 37;
    return env(t, .27, .001) * (sin(phase) * Math.exp(-t * 18) + .07 * noise() * Math.exp(-t * 150));
  });
  if (b % 2 === 1) {
    let low = 0;
    add(time, .17, .096 * strength, .03, (t) => {
      const n = noise(); low = .78 * low + .22 * n;
      return (n - low) * env(t, .17, .001) * (Math.exp(-t * 24) + (t > .016 ? .4 * Math.exp(-(t - .016) * 38) : 0));
    });
  }
  for (let h = 0; h < (light || outro ? 2 : 4); h++) {
    let low = 0;
    const count = light || outro ? 2 : 4;
    add(time + h * BEAT / count + (h % 2 ? .014 : 0), .065, .03 * strength * (h % 2 ? .60 : 1), h % 2 ? -.45 : .45, (t) => {
      const n = noise(); low = .82 * low + .18 * n;
      return (n - low) * Math.exp(-t * 62) * env(t, .065, .001);
    });
  }
  const bass = hz(chord[0] - 24);
  add(time + .07, .36, .145 * strength, 0, (t) => env(t, .36, .015) * Math.tanh((sin(bass * t) + .22 * sin(bass * 2 * t)) * 1.2));
  if (b % 4 === 3 && !outro) add(time + .39, .13, .065, 0, (t) => env(t, .13) * sin(bass * 2 * t));
  if (!light) {
    marimba(time + .25, chord[tune[b % 8]] + 12, outro ? .037 : .056, b % 2 ? -.32 : .32);
    if (b >= 22 && b < 62 && b % 2 === 0) marimba(time + .375, chord[(b + 1) % 4] + 12, .026, -.40, .3);
  }
  if (b % 2 === 0) {
    for (let i = 0; i < chord.length; i++) {
      const f = hz(chord[i]);
      add(time + .12, .69, .03 * strength, (i - 1.5) * .38, (t) => env(t, .69, .015, .10) * Math.exp(-t * 3.4) * (sin(f * t) + .23 * sin(f * 2.003 * t)));
    }
  }
  if ([7, 21, 37, 49, 61, 69, 79].includes(b)) {
    for (let h = 0; h < 4; h++) add(time + h * .125, .08, .025 + h * .009, (h - 1.5) * .25, (t) => noise() * Math.exp(-t * 43) * env(t, .08, .001));
  }
}

// Held harmony creates space for reading the offer and the URL.
for (let phrase = 0; phrase < 12; phrase++) {
  const time = phrase * 4;
  const chord = chords[phrase % 4];
  for (let i = 0; i < chord.length; i++) {
    const f = hz(chord[i] + 12);
    add(time, 4.1, .018, (i - 1.5) * .40, (t) => env(t, 4.1, .21, .5) * (.6 + .4 * clamp((t % BEAT) / .18)) * (sin(f * t) + .18 * sin(f * 1.002 * t)));
  }
}
const cuts = [0, 4, 11, 19, 25, 31, 35, 40];
for (let i = 0; i < cuts.length; i++) {
  const time = cuts[i];
  if (time > 0) {
    let low = 0;
    add(time - .22, .27, .064, i % 2 ? -.25 : .25, (t) => {
      const n = noise(); low = .96 * low + .04 * n;
      return (n - low) * env(t, .27, .19, .04) * (t / .27);
    });
  }
  add(time, .45, .13, 0, (t) => env(t, .45, .001) * Math.exp(-t * 13) * (sin(66 * t + 12 * (1 - Math.exp(-t * 20)) / 20) + .12 * noise()));
  marimba(time, 84, .060, -.3, .55);
  marimba(time + .035, 88, .043, .3, .55);
}
// Send, generation cards, visual edit, message receipt and native app reveal.
for (const frame of [225, 242, 254, 266, 355, 376, 395, 415, 661, 806, 966, 1237]) {
  add(frame / 30, .115, .041, frame % 2 ? -.2 : .2, (t) => env(t, .115, .002) * Math.exp(-t * 28) * (sin(1000 * t + 230 * t * t) + .12 * sin(2000 * t)));
}
let peak = 0;
for (let i = 0; i < COUNT; i++) {
  const fade = clamp((SECONDS - i / RATE) / .75);
  L[i] *= fade; R[i] *= fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const master = .84 / peak;
const wav = Buffer.alloc(44 + COUNT * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(COUNT * 4, 40);
for (let i = 0; i < COUNT; i++) {
  wav.writeInt16LE(Math.round(L[i] * master * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(R[i] * master * 32767), 46 + i * 4);
}
mkdirSync(".cache/audio-v3", { recursive: true });
mkdirSync("public/audio", { recursive: true });
const raw = resolve(".cache/audio-v3/score-source.wav");
const output = resolve("public/audio/score-business.wav");
writeFileSync(raw, wav);
const analysis = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
if (analysis.status !== 0) throw new Error(analysis.stderr || `Audio analysis failed: ${analysis.error}`);
const stats = JSON.parse(analysis.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const filter = `loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", filter, "-ar", "48000", "-c:a", "pcm_s16le", output]);
console.log(`Original LuxiSoft business score: ${output} (45s, 120 BPM, stereo, -14 LUFS)`);
