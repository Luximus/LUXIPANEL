// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * PIPS — protocolo IPC panel ↔ worker sandbox (Fase F1).
 *
 * Transporte: un socket `SOCK_SEQPACKET` en el fd 3 del worker (preserva
 * límites de mensaje). El framing aquí es length-prefix (4 bytes BE + payload
 * JSON UTF-8) para ser AGNÓSTICO del transporte: así los tests pueden usar un
 * stream y producción un SEQPACKET, con la MISMA validación. Toda trama mayor
 * que `maxFrameBytes` se rechaza ANTES de bufferizar (anti-DoS de memoria).
 *
 * Reglas duras (revisión §5): rechazar `v≠1`, tipo desconocido, id reusado y
 * trama sobre-dimensionada. El decoder NUNCA crece sin techo: si el length
 * declarado excede el máximo, lanza y el supervisor mata al worker.
 *
 * F1 sólo ejercita `hello`/`echo` (el child hace eco por fd-3). F2/F3 amplían
 * el wire a las schemas de §5 (`dispatch` con `source`+`policy`, `ready` con
 * `v8`+`hostHash`, `capCall`/`capResult`/`capReturn`, `selftest`, `log`,
 * `ping`/`pong`). El framing, las claves prohibidas, el id monótono y el techo
 * de memoria NO cambian: sólo se enriquecen las uniones de tipos.
 */
import type { Capability } from "../module-sdk/index.js";

export const PROTOCOL_VERSION = 1 as const;

/** Política efectiva (operator ∩ manifest) que viaja EN el frame de dispatch.
 *  El child NUNCA re-lee disco: autoriza el broker panel-side contra esta copia
 *  congelada. */
export interface DispatchPolicyWire {
  capabilities: Capability[];
  http_allowlist: string[];
}

/** Fuente del módulo copiada POR VALOR (no una ruta que el child re-lea). */
export interface DispatchSourceWire {
  entryBytes: string;
  manifestHash: string;
}

/** Panel → worker. */
export type HostMessage =
  | { v: 1; type: "hello"; id: number; abi: string; node: string }
  | {
      v: 1;
      type: "dispatch";
      id: number;
      moduleId: string;
      tool: string;
      input: unknown;
      deadlineMs: number;
      source: DispatchSourceWire;
      policy: DispatchPolicyWire;
    }
  // capResult = respuesta del broker a un capCall (la del §5); capReturn se
  // conserva como alias histórico F1 para no romper consumidores existentes.
  | { v: 1; type: "capResult"; id: number; callId: number; ok: boolean; value?: unknown; error?: string; code?: string }
  | { v: 1; type: "capReturn"; id: number; callId: number; ok: boolean; value?: unknown; error?: string; code?: string }
  | { v: 1; type: "ping"; id: number }
  | { v: 1; type: "echo"; id: number; payload: unknown };

/** Worker → panel. */
export type WorkerMessage =
  | { v: 1; type: "ready"; id: number; abi: string; node: string; v8: string; hostHash: string }
  | { v: 1; type: "capCall"; id: number; callId: number; cap: string; method: string; args: unknown }
  | { v: 1; type: "result"; id: number; ok: boolean; output: unknown }
  | { v: 1; type: "selftest"; id: number; step: number; ok: boolean; detail: string }
  | { v: 1; type: "log"; id: number; level: string; msg: string }
  | { v: 1; type: "error"; id: number; message: string }
  | { v: 1; type: "pong"; id: number }
  | { v: 1; type: "echo"; id: number; payload: unknown };

export type AnyMessage = HostMessage | WorkerMessage;

const HOST_TYPES = new Set(["hello", "dispatch", "capResult", "capReturn", "ping", "echo"]);
const WORKER_TYPES = new Set(["ready", "capCall", "result", "selftest", "log", "error", "pong", "echo"]);
const LEN = 4;

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

/** Serializa un mensaje a una trama length-prefixed. Lanza si excede el techo. */
export function encodeFrame(msg: AnyMessage, maxFrameBytes: number): Buffer {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  if (body.length > maxFrameBytes) {
    throw new ProtocolError(`frame too large: ${body.length} > ${maxFrameBytes}`);
  }
  const head = Buffer.allocUnsafe(LEN);
  head.writeUInt32BE(body.length, 0);
  return Buffer.concat([head, body]);
}

/** Claves prohibidas: un frame hostil con `__proto__`/`constructor`/`prototype`
 *  propias se neutraliza aquí (defensa anti prototype-pollution para todo
 *  consumidor downstream que haga spread/merge/index del mensaje). */
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];

function validateShape(obj: unknown, allowed: Set<string>, lastId: number): AnyMessage {
  if (obj === null || typeof obj !== "object") throw new ProtocolError("frame is not an object");
  for (const k of FORBIDDEN_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new ProtocolError(`frame carries forbidden key: ${k}`);
    }
  }
  const m = obj as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION) throw new ProtocolError(`unsupported protocol version: ${String(m.v)}`);
  if (typeof m.type !== "string" || !allowed.has(m.type)) {
    throw new ProtocolError(`unknown message type: ${String(m.type)}`);
  }
  if (typeof m.id !== "number" || !Number.isInteger(m.id) || m.id < 0) {
    throw new ProtocolError(`invalid message id: ${String(m.id)}`);
  }
  // Frames CORRELATED BY callId (capCall worker→panel; capResult/capReturn
  // panel→worker) legitimately REUSE the dispatch `id` across several
  // round-trips of a single dispatch (e.g. a module that makes >1 capability
  // call). They are NOT control frames, so the strict-monotonic `id` rule does
  // NOT apply to them — they correlate and de-dupe by `callId`, which MUST be a
  // valid non-negative integer. Applying the monotonic rule here would kill any
  // worker that issues more than one capCall per dispatch (the dispatch id is
  // constant within the dispatch). This mirrors the child's inbound parser,
  // which already exempts capResult/capReturn. (RUNTIME-DESIGN §5.)
  if (m.type === "capCall" || m.type === "capResult" || m.type === "capReturn") {
    if (typeof m.callId !== "number" || !Number.isInteger(m.callId) || m.callId < 0) {
      throw new ProtocolError(`invalid callId on ${m.type}: ${String(m.callId)}`);
    }
    return obj as AnyMessage;
  }
  // Control frames (ready/dispatch/result/selftest/log/error/ping/pong/echo/
  // hello): anti-replay without per-id state (avoids an unbounded Set) — the id
  // MUST be strictly increasing. Rejects reuse and rollback in O(1).
  if (m.id <= lastId) throw new ProtocolError(`non-monotonic/reused message id: ${m.id} <= ${lastId}`);
  return obj as AnyMessage;
}

/**
 * Decoder incremental con techo de memoria DURO. Acumula chunks en una lista
 * (sin `Buffer.concat` por push ⇒ sin coste O(n²) ante dribbling) y emite
 * mensajes completos. Garantías anti-DoS frente a un worker hostil:
 *   - el parcial retenido NUNCA excede `maxFrameBytes + LEN` (una trama hostil
 *     con length declarado > máximo se rechaza ANTES de bufferizar el cuerpo);
 *   - el id estrictamente creciente reemplaza al Set de vistos (sin leak).
 */
export class FrameDecoder {
  private chunks: Buffer[] = [];
  private buffered = 0;
  private lastId = -1;
  private readonly allowed: Set<string>;

  constructor(
    direction: "fromWorker" | "fromHost",
    private readonly maxFrameBytes: number,
  ) {
    this.allowed = direction === "fromWorker" ? WORKER_TYPES : HOST_TYPES;
  }

  /** Extrae los primeros `n` bytes como buffer contiguo (copia O(n), no O(total)). */
  private take(n: number): Buffer {
    const out = Buffer.allocUnsafe(n);
    let off = 0;
    while (off < n) {
      const c = this.chunks[0]!;
      const need = n - off;
      if (c.length <= need) {
        c.copy(out, off);
        off += c.length;
        this.chunks.shift();
      } else {
        c.copy(out, off, 0, need);
        this.chunks[0] = c.subarray(need);
        off += need;
      }
    }
    this.buffered -= n;
    return out;
  }

  /** Lee el length de la cabecera (primeros LEN bytes) sin consumir. */
  private peekLen(): number {
    const head = Buffer.allocUnsafe(LEN);
    let off = 0;
    for (const c of this.chunks) {
      const take = Math.min(LEN - off, c.length);
      c.copy(head, off, 0, take);
      off += take;
      if (off >= LEN) break;
    }
    return head.readUInt32BE(0);
  }

  /** Empuja bytes y devuelve los mensajes completos disponibles. */
  push(chunk: Buffer): AnyMessage[] {
    if (chunk.length) {
      this.chunks.push(chunk);
      this.buffered += chunk.length;
    }
    const out: AnyMessage[] = [];
    for (;;) {
      if (this.buffered < LEN) break;
      const len = this.peekLen();
      if (len > this.maxFrameBytes) {
        throw new ProtocolError(`declared frame length ${len} exceeds max ${this.maxFrameBytes}`);
      }
      if (len === 0) throw new ProtocolError("zero-length frame");
      if (this.buffered < LEN + len) break; // parcial acotado por maxFrameBytes
      const frame = this.take(LEN + len);
      const body = frame.subarray(LEN);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString("utf8"));
      } catch {
        throw new ProtocolError("frame body is not valid JSON");
      }
      const msg = validateShape(parsed, this.allowed, this.lastId);
      // Only CONTROL frames advance the monotonic watermark. callId-correlated
      // frames (capCall/capResult/capReturn) reuse the dispatch id and must NOT
      // move `lastId` — otherwise the dispatch's terminal `result` frame (which
      // shares that id) would be wrongly rejected as non-monotonic.
      if (msg.type !== "capCall" && msg.type !== "capResult" && msg.type !== "capReturn") {
        this.lastId = (msg as { id: number }).id;
      }
      out.push(msg);
    }
    return out;
  }

  /** Sólo para tests/teardown: ¿quedan bytes parciales sin consumir? */
  get pendingBytes(): number {
    return this.buffered;
  }
}
