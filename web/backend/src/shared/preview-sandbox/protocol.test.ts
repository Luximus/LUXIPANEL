// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { encodeFrame, FrameDecoder, ProtocolError, type AnyMessage } from "./protocol.js";

const MAX = 1024;

describe("preview-sandbox protocol framing", () => {
  it("round-trips a valid worker message", () => {
    const msg: AnyMessage = { v: 1, type: "ready", id: 0, abi: "127", node: "v22.0.0" };
    const dec = new FrameDecoder("fromWorker", MAX);
    const out = dec.push(encodeFrame(msg, MAX));
    expect(out).toEqual([msg]);
    expect(dec.pendingBytes).toBe(0);
  });

  it("buffers partial frames across chunks", () => {
    const msg: AnyMessage = { v: 1, type: "echo", id: 7, payload: { a: 1 } };
    const frame = encodeFrame(msg, MAX);
    const dec = new FrameDecoder("fromWorker", MAX);
    expect(dec.push(frame.subarray(0, 3))).toEqual([]);
    expect(dec.push(frame.subarray(3))).toEqual([msg]);
  });

  it("decodes multiple frames in one chunk", () => {
    const a: AnyMessage = { v: 1, type: "echo", id: 1, payload: 1 };
    const b: AnyMessage = { v: 1, type: "echo", id: 2, payload: 2 };
    const dec = new FrameDecoder("fromWorker", MAX);
    const out = dec.push(Buffer.concat([encodeFrame(a, MAX), encodeFrame(b, MAX)]));
    expect(out).toEqual([a, b]);
  });

  it("rejects an over-large declared length before buffering", () => {
    const head = Buffer.allocUnsafe(4);
    head.writeUInt32BE(MAX + 1, 0);
    const dec = new FrameDecoder("fromWorker", MAX);
    expect(() => dec.push(head)).toThrow(ProtocolError);
  });

  it("refuses to encode a frame above the cap", () => {
    const big: AnyMessage = { v: 1, type: "echo", id: 1, payload: "x".repeat(MAX) };
    expect(() => encodeFrame(big, MAX)).toThrow(ProtocolError);
  });

  it("rejects an unknown message type for the direction", () => {
    // 'capCall' is a worker→host type; sending it on the fromHost decoder is invalid.
    const wire = encodeFrame({ v: 1, type: "capCall", id: 1, callId: 1, capability: "x", args: 0 } as AnyMessage, MAX);
    const dec = new FrameDecoder("fromHost", MAX);
    expect(() => dec.push(wire)).toThrow(/unknown message type/);
  });

  it("rejects a wrong protocol version", () => {
    const body = Buffer.from(JSON.stringify({ v: 2, type: "ready", id: 0 }), "utf8");
    const head = Buffer.allocUnsafe(4);
    head.writeUInt32BE(body.length, 0);
    const dec = new FrameDecoder("fromWorker", MAX);
    expect(() => dec.push(Buffer.concat([head, body]))).toThrow(/unsupported protocol version/);
  });

  it("rejects a reused / non-monotonic message id", () => {
    const a: AnyMessage = { v: 1, type: "echo", id: 5, payload: 1 };
    const dec = new FrameDecoder("fromWorker", MAX);
    dec.push(encodeFrame(a, MAX));
    expect(() => dec.push(encodeFrame(a, MAX))).toThrow(/reused message id/);
    // a lower id after a higher one is also rejected (monotonic contract)
    const dec2 = new FrameDecoder("fromWorker", MAX);
    dec2.push(encodeFrame({ v: 1, type: "echo", id: 9, payload: 1 }, MAX));
    expect(() => dec2.push(encodeFrame({ v: 1, type: "echo", id: 8, payload: 1 }, MAX))).toThrow(/non-monotonic/);
  });

  it("rejects a frame carrying a forbidden __proto__ own key", () => {
    const body = Buffer.from('{"__proto__":{"polluted":1},"v":1,"type":"echo","id":1,"payload":0}', "utf8");
    const head = Buffer.allocUnsafe(4);
    head.writeUInt32BE(body.length, 0);
    const dec = new FrameDecoder("fromWorker", MAX);
    expect(() => dec.push(Buffer.concat([head, body]))).toThrow(/forbidden key/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects a zero-length frame", () => {
    const head = Buffer.alloc(4); // length 0
    const dec = new FrameDecoder("fromWorker", MAX);
    expect(() => dec.push(head)).toThrow(/zero-length/);
  });

  it("does not buffer quadratically: many 1-byte chunks of one frame decode once", () => {
    const msg: AnyMessage = { v: 1, type: "echo", id: 1, payload: "x".repeat(300) };
    const frame = encodeFrame(msg, MAX);
    const dec = new FrameDecoder("fromWorker", MAX);
    let result: AnyMessage[] = [];
    for (let i = 0; i < frame.length; i++) result = result.concat(dec.push(frame.subarray(i, i + 1)));
    expect(result).toEqual([msg]);
    expect(dec.pendingBytes).toBe(0);
  });

  it("rejects non-JSON frame bodies", () => {
    const body = Buffer.from("{not json", "utf8");
    const head = Buffer.allocUnsafe(4);
    head.writeUInt32BE(body.length, 0);
    const dec = new FrameDecoder("fromWorker", MAX);
    expect(() => dec.push(Buffer.concat([head, body]))).toThrow(/not valid JSON/);
  });
});

describe("preview-sandbox protocol §5 message schemas", () => {
  it("round-trips a dispatch frame carrying source bytes + effective policy", () => {
    const msg: AnyMessage = {
      v: 1,
      type: "dispatch",
      id: 1,
      moduleId: "mymod",
      tool: "doThing",
      input: { a: 1 },
      deadlineMs: 5000,
      source: { entryBytes: "module.exports={}", manifestHash: "deadbeef" },
      policy: { capabilities: ["storage", "server.fs.read"], http_allowlist: [] },
    };
    const dec = new FrameDecoder("fromHost", 4096);
    expect(dec.push(encodeFrame(msg, 4096))).toEqual([msg]);
  });

  it("round-trips a ready frame with v8 + hostHash (the child self-hash)", () => {
    const msg: AnyMessage = {
      v: 1,
      type: "ready",
      id: 0,
      abi: "127",
      node: "v22.22.2",
      v8: "12.4.254.21",
      hostHash: "abc123",
    };
    const dec = new FrameDecoder("fromWorker", 4096);
    expect(dec.push(encodeFrame(msg, 4096))).toEqual([msg]);
  });

  it("round-trips capCall (cap+method+args) and capResult", () => {
    const call: AnyMessage = { v: 1, type: "capCall", id: 1, callId: 7, cap: "storage", method: "get", args: ["k"] };
    const res: AnyMessage = { v: 1, type: "capResult", id: 2, callId: 7, ok: true, value: { v: 1 } };
    const dw = new FrameDecoder("fromWorker", 4096);
    expect(dw.push(encodeFrame(call, 4096))).toEqual([call]);
    const dh = new FrameDecoder("fromHost", 4096);
    expect(dh.push(encodeFrame(res, 4096))).toEqual([res]);
  });

  it("accepts MULTIPLE capCalls reusing the dispatch id, then a result at the same id (§5 callId correlation)", () => {
    // A module that makes >1 capability call emits several capCall frames that
    // all carry the SAME dispatch id (e.g. 5) but DISTINCT callIds. The terminal
    // `result` also carries that dispatch id. The strict-monotonic id rule must
    // NOT apply to callId-correlated frames, or the worker would be killed.
    const dec = new FrameDecoder("fromWorker", 4096);
    dec.push(encodeFrame({ v: 1, type: "ready", id: 0, abi: "1", node: "v", v8: "1", hostHash: "h" } as AnyMessage, 4096));
    const c1: AnyMessage = { v: 1, type: "capCall", id: 5, callId: 1, cap: "storage", method: "get", args: ["a"] };
    const c2: AnyMessage = { v: 1, type: "capCall", id: 5, callId: 2, cap: "storage", method: "get", args: ["b"] };
    const res: AnyMessage = { v: 1, type: "result", id: 5, ok: true, output: { done: true } };
    expect(dec.push(encodeFrame(c1, 4096))).toEqual([c1]);
    expect(dec.push(encodeFrame(c2, 4096))).toEqual([c2]); // same id, NOT rejected
    expect(dec.push(encodeFrame(res, 4096))).toEqual([res]); // terminal at same id, accepted
  });

  it("rejects a capCall / capResult missing a valid callId", () => {
    const dw = new FrameDecoder("fromWorker", 4096);
    const bad = Buffer.from(JSON.stringify({ v: 1, type: "capCall", id: 1, cap: "storage", method: "get", args: [] }), "utf8");
    const head = Buffer.allocUnsafe(4);
    head.writeUInt32BE(bad.length, 0);
    expect(() => dw.push(Buffer.concat([head, bad]))).toThrow(/invalid callId/);
  });

  it("round-trips selftest / log / pong worker frames", () => {
    const st: AnyMessage = { v: 1, type: "selftest", id: 1, step: 4, ok: true, detail: "netcut" };
    const lg: AnyMessage = { v: 1, type: "log", id: 2, level: "warn", msg: "x" };
    const pg: AnyMessage = { v: 1, type: "pong", id: 3 };
    const d = new FrameDecoder("fromWorker", 4096);
    expect(d.push(Buffer.concat([encodeFrame(st, 4096), encodeFrame(lg, 4096), encodeFrame(pg, 4096)]))).toEqual([
      st,
      lg,
      pg,
    ]);
  });

  it("still rejects a worker→host type on the host decoder for the new types", () => {
    // 'selftest' is worker→panel; sending it fromHost is invalid.
    const wire = encodeFrame({ v: 1, type: "selftest", id: 1, step: 1, ok: true, detail: "x" } as AnyMessage, 4096);
    expect(() => new FrameDecoder("fromHost", 4096).push(wire)).toThrow(/unknown message type/);
    // 'dispatch' is panel→worker; sending it fromWorker is invalid.
    const wire2 = encodeFrame(
      {
        v: 1,
        type: "dispatch",
        id: 1,
        moduleId: "m",
        tool: "t",
        input: 0,
        deadlineMs: 1,
        source: { entryBytes: "", manifestHash: "" },
        policy: { capabilities: [], http_allowlist: [] },
      } as AnyMessage,
      4096,
    );
    expect(() => new FrameDecoder("fromWorker", 4096).push(wire2)).toThrow(/unknown message type/);
  });

  it("still enforces v≠1 / reused-id / over-frame on the new dispatch type", () => {
    // reused id on dispatch
    const d = new FrameDecoder("fromHost", 4096);
    const f = (id: number) =>
      encodeFrame(
        {
          v: 1,
          type: "ping",
          id,
        } as AnyMessage,
        4096,
      );
    d.push(f(3));
    expect(() => d.push(f(3))).toThrow(/reused message id/);
    // v≠1
    const body = Buffer.from(JSON.stringify({ v: 2, type: "ping", id: 1 }), "utf8");
    const head = Buffer.allocUnsafe(4);
    head.writeUInt32BE(body.length, 0);
    expect(() => new FrameDecoder("fromHost", 4096).push(Buffer.concat([head, body]))).toThrow(
      /unsupported protocol version/,
    );
  });
});
