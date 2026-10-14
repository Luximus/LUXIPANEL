import { describe, expect, it } from "vitest";
import { PcmFramer } from "./pcm-framer";
describe("native call hardware audio framing", () => {
  it.each([16000, 44100, 48000])(
    "keeps a 1 kHz tone and 20 ms frames at %i Hz",
    (rate) => {
      const framer = new PcmFramer();
      const frames: Int16Array[] = [];
      const input = Float32Array.from(
        { length: rate + 100 },
        (_, i) => 0.5 * Math.sin((2 * Math.PI * 1000 * i) / rate),
      );
      for (let offset = 0; offset < input.length; offset += 137)
        frames.push(...framer.push(input.slice(offset, offset + 137), rate));
      expect(frames.length).toBeGreaterThanOrEqual(50);
      expect(frames.every((frame) => frame.length === 320)).toBe(true);
      const samples = frames.slice(1, 50).flatMap((frame) => [...frame]);
      const rms = Math.sqrt(
        samples.reduce((sum, value) => sum + (value / 32768) ** 2, 0) /
          samples.length,
      );
      expect(rms).toBeGreaterThan(0.3);
      expect(rms).toBeLessThan(0.37);
    },
  );
  it("clips PCM and discards old samples after a reconnect", () => {
    const framer = new PcmFramer();
    const frames = framer.push(new Float32Array(1000).fill(2), 16000);
    expect(frames[0][0]).toBe(32767);
    framer.reset();
    const silence = framer.push(new Float32Array(1000), 16000);
    expect([...silence[0]].every((value) => value === 0)).toBe(true);
  });
});
