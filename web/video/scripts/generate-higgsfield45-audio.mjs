import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Original synthesized guide score. No voice, samples or third-party music.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rate = 48000;
const seconds = 45;
const beat = .5; // 120 BPM.
const count = rate * seconds;
const left = new Float32Array(count);
const right = new Float32Array(count);
const tau = 2 * Math.PI;
const hz = n => 440 * 2 ** ((n - 69) / 12);
let seed = 1052026;
const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const clamp = n => Math.max(0, Math.min(1, n));
const env = (t, d, a = .005, r = .04) => clamp(t / a) * clamp((d - t) / r);
function add(start, duration, gain, pan, fn) {
  const begin = Math.max(0, Math.round(start * rate));
  const end = Math.min(count, Math.round((start + duration) * rate));
  const gl = gain * Math.sqrt((1 - pan) / 2), gr = gain * Math.sqrt((1 + pan) / 2);
  for (let i = begin; i < end; i++) {
    const t = i / rate - start;
    const s = fn(t);
    left[i] += s * gl; right[i] += s * gr;
  }
}
const chords = [[57, 64, 69, 72], [53, 60, 65, 69], [60, 67, 72, 76], [55, 62, 67, 71]];
for (let b = 0; b < 90; b++) {
  const at = b * beat, chord = chords[Math.floor(b / 8) % 4];
  const strength = at >= 40 ? .48 : at < 4 ? .6 : 1;
  add(at, .3, .22 * strength, 0, t => env(t, .3, .002) * Math.exp(-t * 15) * Math.sin(tau * (48 * t + 80 * (1 - Math.exp(-t * 30)) / 30)));
  if (b % 2) add(at, .14, .07 * strength, .1, t => env(t, .14, .001) * Math.exp(-t * 28) * noise());
  add(at + .25, .065, .025 * strength, b % 2 ? -.35 : .35, t => noise() * env(t, .065, .001) * Math.exp(-t * 55));
  add(at + .07, .37, .085 * strength, 0, t => env(t, .37, .012) * Math.sin(tau * hz(chord[0] - 24) * t));
  if (at < 40) {
    const pitch = hz(chord[[0, 2, 1, 3][b % 4]] + 12);
    add(at + .25, .4, .025 * strength, b % 2 ? -.3 : .3, t => env(t, .4, .002) * Math.exp(-t * 8) * (Math.sin(tau * pitch * t) + .3 * Math.sin(tau * pitch * 2 * t)));
  }
  if (b % 8 === 0) chord.forEach((note, i) => add(at, 4.2, .017, (i - 1.5) * .35, t => env(t, 4.2, .25, .5) * (Math.sin(tau * hz(note) * t) + .2 * Math.sin(tau * hz(note) * 1.003 * t))));
}
for (const at of [4, 9, 17, 24, 29, 34, 40]) {
  add(at - .32, .4, .048, 0, t => noise() * env(t, .4, .29, .08));
  add(at, .5, .08, 0, t => env(t, .5, .003) * Math.exp(-t * 12) * Math.sin(tau * 58 * t));
}
const wav = Buffer.alloc(44 + count * 4);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(count * 4, 40);
for (let i = 0; i < count; i++) {
  const fade = clamp((seconds - i / rate) / .7) * clamp(i / rate / .08);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * fade)) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * fade)) * 32767), 46 + i * 4);
}
const dir = resolve(root, "public/higgsfield45");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "score-120bpm.wav"), wav);
console.log(JSON.stringify({ seconds, bpm: 120, sampleRate: rate, channels: 2, original: true, narration: false }));
