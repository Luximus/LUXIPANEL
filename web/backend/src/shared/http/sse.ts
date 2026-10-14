// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * `openSse()` — Server-Sent Events bootstrap (B-24).
 *
 * Three controllers (chat, ai-assistant agent, notifications) each opened an
 * SSE stream by hand with the same four headers, the same `flushHeaders()`, the
 * same 15 s comment heartbeat and the same "don't write to a closed socket"
 * guard — but each with a slightly different spelling.
 *
 * `X-Accel-Buffering: no` is NOT optional: without it nginx buffers the
 * response and the client sees nothing until the stream ends. The comment
 * heartbeat is not optional either — an idle SSE stream is killed by
 * Cloudflare's HTTP/3 layer (`ERR_QUIC_PROTOCOL_ERROR` on the client) and by
 * most intermediaries; comment frames (`: …`) keep it warm and are ignored by
 * the EventSource parser because they carry no `data:`.
 *
 * Writes are fail-soft: once the socket is gone `send()`/`comment()` become
 * no-ops instead of throwing inside an event-bus listener.
 */

import type { Response } from "express";

export interface SseOptions {
  /** `Content-Type`. Default `"text/event-stream"`. */
  contentType?: string;
  /** `Cache-Control`. Default `"no-cache, no-transform"`. */
  cacheControl?: string;
  /** Heartbeat period in ms; `null` disables it. Default 15 000. */
  heartbeatMs?: number | null;
  /** Heartbeat comment body (without the leading `: `). Default `"ping"`. */
  heartbeatComment?: string | (() => string);
  /** Optional comment written right after the headers (connection greeting). */
  greeting?: string | (() => string);
}

export interface SseSendOptions {
  /** Named event (`event:` line) — omit for the default `message` event. */
  event?: string;
  /** Monotonic id (`id:` line) so a reconnect can resume via `Last-Event-ID`. */
  id?: number | string;
}

export interface SseStream {
  /** Write one `data:` frame (JSON-encoded), optionally named/ided. */
  send(data: unknown, opts?: SseSendOptions): void;
  /** Write a raw comment frame (`: <text>`). */
  comment(text: string): void;
  /** Stop the heartbeat. Idempotent; does NOT end the response. */
  close(): void;
}

function resolve(value: string | (() => string) | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return typeof value === "function" ? value() : value;
}

/** Send SSE headers, start the heartbeat and return the writer. */
export function openSse(res: Response, opts: SseOptions = {}): SseStream {
  res.setHeader("Content-Type", opts.contentType ?? "text/event-stream");
  res.setHeader("Cache-Control", opts.cacheControl ?? "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders?.();

  const write = (chunk: string): void => {
    if (res.writableEnded) return;
    try {
      res.write(chunk);
      // `compression` (si alguna vez envolviera este stream) expone `flush()`;
      // llamarlo garantiza que cada frame salga al socket de inmediato.
      (res as Response & { flush?: () => void }).flush?.();
    } catch {
      /* socket torn down — the close handler does the cleanup */
    }
  };

  if (opts.greeting !== undefined) write(`: ${resolve(opts.greeting, "")}\n\n`);

  const periodMs = opts.heartbeatMs === undefined ? 15_000 : opts.heartbeatMs;
  const heartbeat =
    periodMs === null
      ? null
      : setInterval(() => write(`: ${resolve(opts.heartbeatComment, "ping")}\n\n`), periodMs);

  let closed = false;
  return {
    send(data: unknown, sendOpts: SseSendOptions = {}): void {
      let frame = "";
      if (sendOpts.event !== undefined) frame += `event: ${sendOpts.event}\n`;
      if (sendOpts.id !== undefined) frame += `id: ${sendOpts.id}\n`;
      frame += `data: ${JSON.stringify(data)}\n\n`;
      write(frame);
    },
    comment(text: string): void {
      write(`: ${text}\n\n`);
    },
    close(): void {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
    },
  };
}
