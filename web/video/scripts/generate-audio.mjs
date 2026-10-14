import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// An original, deterministic 120 BPM synth score written directly as PCM.
const RATE = 48000;
const DURATION = 45;
const FRAMES = RATE * DURATION;
const left = new Float32Array(FRAMES);
const right = new Float32Array(FRAMES);
let seed = 0x51f7a3d;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const mix = (time, duration, synth, gain = 1, pan = 0) => {
  const start = Math.round(time * RATE);
  const length = Math.min(Math.round(duration * RATE), FRAMES - start);
  if (start < 0 || length <= 0) return;
  const a = Math.sqrt((1 - pan) / 2) * gain;
  const b = Math.sqrt((1 + pan) / 2) * gain;
  for (let i = 0; i < length; i++) {
    const sample = synth(i / RATE, i, length);
    left[start + i] += sample * a;
    right[start + i] += sample * b;
  }
};
const sine = (phase) => Math.sin(phase * Math.PI * 2);
const smooth = (v) => Math.max(0, Math.min(1, v));
const fade = (t, length, attack, release) => smooth(t / attack) * smooth((length - t) / release);

const chords = [
  [52, 55, 59, 64], // Em7
  [48, 55, 59, 64], // Cmaj7
  [43, 50, 55, 59], // Gmaj7
  [50, 57, 62, 66], // Dmaj7
];
const arpeggio = [0, 2, 1, 3, 2, 1, 0, 2];

// Wide, slowly breathing pad. Each phrase changes every four seconds.
for (let start = 0, chordIndex = 0; start < DURATION; start += 4, chordIndex++) {
  const notes = chords[chordIndex % chords.length];
  for (let n = 0; n < notes.length; n++) {
    const freq = hz(notes[n]);
    mix(start, Math.min(4.35, DURATION - start), (t) => {
      const env = fade(t, 4.35, .62, .92);
      const motion = .88 + .12 * sine(t * .28 + n * .17);
      return env * motion * (sine(freq * t) * .76 + sine(freq * 1.003 * t) * .17 + sine(freq * 2 * t) * .07);
    }, .047, (n - 1.5) * .24);
  }
}

// Plucked, clock-like melodic motif and warm bass underpin the cut sequence.
for (let step = 0; step < DURATION * 4; step++) {
  const t = step * .25;
  const phrase = Math.floor(t / 4);
  const notes = chords[phrase % chords.length];
  const note = notes[arpeggio[step % arpeggio.length]] + 12;
  const freq = hz(note);
  const section = t < 5 ? .55 : t > 39 ? .72 : 1;
  mix(t, .38, (dt) => {
    const e = (1 - Math.exp(-dt * 120)) * Math.exp(-dt * 8.2);
    return e * (sine(freq * dt) + .31 * sine(freq * 2.005 * dt) + .1 * sine(freq * 3.01 * dt));
  }, .038 * section, step % 2 ? .35 : -.35);
  if (step % 4 === 0) {
    const bass = hz(notes[0] - 12);
    mix(t, .72, (dt) => (1 - Math.exp(-dt * 75)) * Math.exp(-dt * 3.8) * (sine(bass * dt) + .12 * sine(bass * 2 * dt)), .13 * section);
  }
}

// Light electronic percussion enters after the opening statement.
for (let beat = 0; beat < DURATION * 2; beat++) {
  const t = beat * .5;
  const section = t < 5 ? .38 : t > 39 ? .58 : 1;
  if (beat % 2 === 0) {
    mix(t, .32, (dt) => {
      const phase = 48 * dt + 56 * (1 - Math.exp(-dt * 22)) / 22;
      return sine(phase) * Math.exp(-dt * 24);
    }, .16 * section);
  } else {
    mix(t, .18, (dt) => (random() * 2 - 1) * Math.exp(-dt * 26), .038 * section, .08);
  }
  mix(t, .085, (dt) => (random() * 2 - 1) * Math.exp(-dt * 65), .017 * section, beat % 2 ? .46 : -.46);
  if (t >= 12 && t < 39) {
    mix(t + .25, .055, (dt) => (random() * 2 - 1) * Math.exp(-dt * 78), .013, beat % 2 ? -.55 : .55);
  }
}

// Scene changes, terminal confirmations, and the final wordmark get restrained accents.
for (const [index, t] of [5, 12, 21, 30, 39].entries()) {
  mix(t - .32, .54, (dt) => (random() * 2 - 1) * fade(dt, .54, .28, .14) * (.3 + .7 * dt / .54), .052, index % 2 ? -.55 : .55);
  mix(t, .65, (dt) => Math.exp(-dt * 9) * (sine(660 * dt) + .45 * sine(990 * dt)), .049, index % 2 ? .3 : -.3);
}
for (const t of [15.5, 16.9, 18.3, 19.6, 25.0, 27.4, 28.6, 34.0, 36.0]) {
  mix(t, .17, (dt) => Math.exp(-dt * 29) * (sine(960 * dt) + .2 * sine(1440 * dt)), .022, t % 2 ? .45 : -.45);
}

// Transparent ending: decay the instruments while keeping the URL legible on screen.
let peak = 0;
for (let i = 0; i < FRAMES; i++) {
  const t = i / RATE;
  const intro = smooth(t / .45);
  const end = smooth((DURATION - t) / 1.15);
  const shaped = intro * end;
  left[i] *= shaped;
  right[i] *= shaped;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const master = .78 / peak;

const pcm = Buffer.alloc(44 + FRAMES * 4);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(pcm.length - 8, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 4, 28);
pcm.writeUInt16LE(4, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(FRAMES * 4, 40);
for (let i = 0; i < FRAMES; i++) {
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i] * master)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i] * master)) * 32767), 46 + i * 4);
}
const path = resolve("public/audio/score.wav");
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, pcm);
console.log(`Wrote ${path} (${DURATION}s, ${RATE} Hz stereo, peak ${(peak * master).toFixed(3)})`);
