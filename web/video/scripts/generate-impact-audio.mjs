import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

// Original score: 96 beats at 128 BPM = exactly 45 seconds.
const RATE = 48000;
const LENGTH = 45;
const BEAT = 60 / 128;
const COUNT = RATE * LENGTH;
const L = new Float32Array(COUNT);
const R = new Float32Array(COUNT);
const TAU = Math.PI * 2;
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const sin = (n) => Math.sin(TAU * n);
let seed = 5234189;
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const limit = (n) => Math.min(1, Math.max(0, n));
const env = (t, d, a = .008, release = .035) => limit(t / a) * limit((d - t) / release);
function add(start, duration, gain, pan, synth) {
  const begin = Math.max(0, Math.round(start * RATE));
  const end = Math.min(COUNT, begin + Math.round(duration * RATE));
  const gl = gain * Math.sqrt((1 - pan) / 2);
  const gr = gain * Math.sqrt((1 + pan) / 2);
  for (let i = begin; i < end; i++) {
    const t = (i - begin) / RATE;
    const value = synth(t);
    L[i] += value * gl;
    R[i] += value * gr;
  }
}
function pluck(start, note, gain, pan = 0, duration = .42) {
  const freq = hz(note);
  add(start, duration, gain, pan, (t) => {
    const e = env(t, duration, .003, .035) * Math.exp(-t * 7.8);
    return e * (sin(freq * t) + .38 * sin(freq * 2.001 * t) + .16 * sin(freq * 3 * t) + .06 * sin(freq * 4.01 * t));
  });
  // One rhythmic, quieter echo: enough width without blurring the beat.
  add(start + BEAT * .75, duration, gain * .20, -pan, (t) => env(t, duration, .005) * Math.exp(-t * 9) * sin(freq * t));
}

const chords = [[54, 61, 66, 69], [50, 57, 62, 66], [57, 64, 69, 73], [52, 59, 64, 68]];
const melody = [0, 2, 1, 3, 2, 1, 3, 2];

for (let b = 0; b < 96; b++) {
  const time = b * BEAT;
  const chord = chords[Math.floor(b / 8) % 4];
  const outro = b >= 88;
  const breakBeat = b >= 72 && b < 76;
  const strength = outro ? .52 : breakBeat ? .62 : b < 24 ? .84 : 1;

  // Four-on-the-floor kick with a short attack, sub tail and gentle click.
  add(time, .33, .34 * strength, 0, (t) => {
    const phase = 47 * t + 95 * (1 - Math.exp(-t * 34)) / 34;
    return env(t, .33, .0015) * (sin(phase) * Math.exp(-t * 15) + noise() * .10 * Math.exp(-t * 150));
  });
  if (b % 4 === 1 || b % 4 === 3) {
    let smoothNoise = 0;
    add(time, .20, .105 * strength, .03, (t) => {
      const n = noise();
      smoothNoise = smoothNoise * .72 + n * .28;
      const high = n - smoothNoise;
      const clap = Math.exp(-t * 23) + .4 * Math.exp(-Math.max(0, t - .016) * 40) * (t >= .016 ? 1 : 0);
      return env(t, .2, .001) * (high * clap + sin(190 * t) * Math.exp(-t * 38) * .12);
    });
  }
  for (let tick = 0; tick < (b >= 24 && b < 88 ? 4 : 2); tick++) {
    const offset = tick * (b >= 24 && b < 88 ? BEAT / 4 : BEAT / 2);
    let smoothNoise = 0;
    add(time + offset, .065, .031 * strength * (tick % 2 ? .55 : 1), tick % 2 ? -.4 : .4, (t) => {
      const n = noise();
      smoothNoise = .8 * smoothNoise + .2 * n;
      return (n - smoothNoise) * env(t, .065, .001) * Math.exp(-t * 65);
    });
  }

  // Saturated bass is ducked at each kick; syncopation creates forward motion.
  if (!outro || b % 2 === 0) {
    const bass = hz(chord[0] - 24);
    add(time + BEAT * .17, BEAT * .78, .17 * strength, 0, (t) => {
      const source = sin(bass * t) + .24 * sin(2 * bass * t) + .09 * sin(3 * bass * t);
      return env(t, BEAT * .78, .012, .045) * Math.tanh(source * 1.35) * .85;
    });
  }
  if (!outro && !breakBeat) {
    const note = chord[melody[b % 8]] + (b < 24 ? 0 : 12);
    pluck(time + BEAT / 2, note, b < 24 ? .035 : .047, b % 2 ? -.25 : .25);
    if (b >= 48 && b < 72) pluck(time + BEAT * .75, chord[(b + 1) % 4] + 12, .026, b % 2 ? .5 : -.5, .27);
  }
  if (b % 2 === 0 && !breakBeat) {
    for (let i = 1; i < chord.length; i++) {
      const freq = hz(chord[i]);
      add(time + BEAT * .5, BEAT * 1.25, .023 * strength, (i - 2) * .32, (t) => {
        const sidechain = .35 + .65 * limit((t % BEAT) / .15);
        return env(t, BEAT * 1.25, .023, .12) * Math.exp(-t * 2.2) * sidechain * (sin(freq * t) + .2 * sin(freq * 2 * t) + .08 * sin(freq * 3 * t));
      });
    }
  }
  // Short snare fills into the two main reveals.
  if (b === 23 || b === 47 || b === 71) {
    for (let hit = 0; hit < 4; hit++) add(time + hit * BEAT / 4, .09, .037 + hit * .006, (hit - 1.5) * .2, (t) => noise() * Math.exp(-t * 45) * env(t, .09, .001));
  }
}

// Airy harmony under the rhythm, with a final held chord behind the CTA.
for (let phrase = 0; phrase < 12; phrase++) {
  const time = phrase * 8 * BEAT;
  const chord = chords[phrase % 4];
  for (let i = 0; i < chord.length; i++) {
    const freq = hz(chord[i] + 12);
    add(time, 8 * BEAT + .15, .023, (i - 1.5) * .38, (t) => {
      const sidechain = .6 + .4 * limit((t % BEAT) / .2);
      return env(t, 8 * BEAT + .15, .2, .5) * sidechain * (sin(freq * t) + .22 * sin(freq * 1.003 * t));
    });
  }
}

const cuts = [0, 113 / 30, 338 / 30, 675 / 30, 1013 / 30, 1238 / 30];
for (let c = 0; c < cuts.length; c++) {
  const time = cuts[c];
  if (time > 0) {
    let low = 0;
    add(time - .30, .36, .09, c % 2 ? -.22 : .22, (t) => {
      const n = noise(); low = .96 * low + .04 * n;
      return (n - low) * env(t, .36, .24, .06) * (t / .36);
    });
  }
  add(time, .57, .18, 0, (t) => env(t, .57, .002) * Math.exp(-t * 10) * (sin(52 * t + 20 * (1 - Math.exp(-t * 10)) / 10) + .15 * noise()));
  pluck(time, 78, .055, -.3, .7);
  pluck(time + .025, 85, .035, .3, .7);
}
// Send, agent assignments, server responses and approvals match the film's frames.
for (const frame of [204, 367, 377, 387, 735, 795, 855, 1055, 1112, 1152, 1168, 1184]) {
  const time = frame / 30;
  add(time, .13, .048, frame % 2 ? -.22 : .22, (t) => env(t, .13, .002) * Math.exp(-t * 27) * (sin(1100 * t + 160 * t * t) + .18 * sin(2200 * t)));
}

let peak = 0;
for (let i = 0; i < COUNT; i++) {
  const gain = limit((LENGTH - i / RATE) / .7);
  L[i] *= gain; R[i] *= gain;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const master = .86 / peak;
const wav = Buffer.alloc(44 + COUNT * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(RATE, 24); wav.writeUInt32LE(RATE * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(COUNT * 4, 40);
for (let i = 0; i < COUNT; i++) {
  wav.writeInt16LE(Math.round(L[i] * master * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(R[i] * master * 32767), 46 + i * 4);
}
mkdirSync(".cache/audio-v2", { recursive: true });
mkdirSync("public/audio", { recursive: true });
const raw = resolve(".cache/audio-v2/score-source.wav");
const output = resolve("public/audio/score-impact.wav");
writeFileSync(raw, wav);
// Two-pass loudness normalization preserves the rhythmic dynamics and prevents clipping.
const analysis = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
if (analysis.status !== 0) throw new Error(analysis.stderr || "Audio analysis failed");
const stats = JSON.parse(analysis.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const filter = `loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", filter, "-ar", "48000", "-c:a", "pcm_s16le", output]);
console.log(`Original impact score: ${output} (45s, 128 BPM, stereo, normalized to -14 LUFS)`);
