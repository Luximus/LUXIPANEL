// SPDX-License-Identifier: AGPL-3.0-only
import WebSocket from "ws";
/** Media-only bridge. The phone never controls instructions, tools or approvals. */
export class RealtimePcmRelay {
  private client?: WebSocket;
  private deadline: ReturnType<typeof setTimeout>;
  private windowAt = Date.now();
  private bytes = 0;
  private output = new Map<string, number>();
  private ended = false;
  constructor(private send: (event: unknown) => void, private end: () => void) {
    this.deadline = setTimeout(end, 25_000); this.deadline.unref();
  }
  attach(ws: WebSocket): void {
    if (this.ended || this.client) throw new Error("La sesión de audio ya está conectada o terminó.");
    this.client = ws; clearTimeout(this.deadline);
    let alive = true;
    const heartbeat = setInterval(() => {
      if (!alive) { ws.terminate(); return; }
      alive = false; ws.ping();
    }, 20_000); heartbeat.unref();
    ws.on("pong", () => { alive = true; });
    ws.once("close", () => { clearInterval(heartbeat); if (!this.ended) this.end(); });
    ws.on("error", () => { if (!this.ended) this.end(); });
    ws.on("message", (raw, binary) => {
      if (this.ended) return;
      if (Date.now() - this.windowAt >= 1000) { this.windowAt = Date.now(); this.bytes = 0; }
      if (binary) {
        const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        this.bytes += buffer.length;
        if (!buffer.length || buffer.length % 2 || buffer.length > 24000 || this.bytes > 144000) {
          ws.close(1008, "Audio inválido"); return;
        }
        this.send({ type:"input_audio_buffer.append", audio:buffer.toString("base64") });
        return;
      }
      // Only playback acknowledgement and mute/clear are accepted from the phone.
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "mute") this.send({ type:"input_audio_buffer.clear" });
        else if (message.type === "truncate") {
          const duration = this.output.get(message.itemId);
          if (duration === undefined || !Number.isFinite(message.playedMs)) return;
          this.send({type:"conversation.item.truncate",item_id:message.itemId,content_index:0,
            audio_end_ms:Math.max(0, Math.min(Math.floor(message.playedMs), Math.floor(duration)))});
          this.output.delete(message.itemId);
        }
      } catch { /* no control-plane forwarding */ }
    });
    this.push({type:"ready"});
  }
  forward(event: Record<string, any>): void {
    if (event.type === "response.output_audio.delta" && typeof event.delta === "string") {
      const itemId = String(event.item_id ?? "");
      this.output.set(itemId, (this.output.get(itemId) ?? 0) + Buffer.from(event.delta,"base64").length / 48);
      if (this.output.size > 12) this.output.delete(this.output.keys().next().value!);
      this.push({type:"audio",itemId,audio:event.delta});
    } else if (event.type === "input_audio_buffer.speech_started") this.push({type:"interrupt"});
  }
  push(event: Record<string, unknown>): void {
    const ws = this.client;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 2_000_000) { ws.close(1013,"Audio lento"); this.end(); return; }
    ws.send(JSON.stringify(event));
  }
  close(): void {
    this.ended = true; clearTimeout(this.deadline);
    this.client?.close(1000,"Voz finalizada");
  }
}
