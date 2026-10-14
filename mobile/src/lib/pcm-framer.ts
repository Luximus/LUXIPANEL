/** Streaming hardware-rate → mono 16 kHz / 320-sample PCM16 frames. */
export class PcmFramer {
  private source: number[] = [];
  private position = 0;
  private output: number[] = [];
  private rate = 0;
  private filtered = 0;
  reset() {
    this.source = [];
    this.position = 0;
    this.output = [];
    this.rate = 0;
    this.filtered = 0;
  }
  push(samples: Float32Array, rate: number): Int16Array[] {
    if (!Number.isFinite(rate) || rate <= 0) return [];
    if (this.rate && this.rate !== rate) this.reset();
    this.rate = rate;
    const step = rate / 16000,
      alpha = 1 - Math.exp((-2 * Math.PI * 7000) / rate);
    for (const sample of samples) {
      this.filtered += alpha * (sample - this.filtered);
      this.source.push(rate > 16000 ? this.filtered : sample);
    }
    const frames: Int16Array[] = [];
    while (this.position + 1 < this.source.length) {
      const index = Math.floor(this.position),
        fraction = this.position - index;
      const value =
        this.source[index] * (1 - fraction) + this.source[index + 1] * fraction;
      this.output.push(
        Math.round(
          Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767),
        ),
      );
      this.position += step;
      if (this.output.length === 320) {
        frames.push(Int16Array.from(this.output));
        this.output = [];
      }
    }
    const consumed = Math.min(
      Math.floor(this.position),
      this.source.length - 1,
    );
    this.source.splice(0, consumed);
    this.position -= consumed;
    return frames;
  }
}
