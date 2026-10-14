// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { clearLocalOp, mergeLocalOps, nextOpSeq, setLocalOp, type ConvLocalOps } from "./conv-local-ops";
import type { Conversation } from "./types";

const conv = (id: string, extra: Partial<Conversation> = {}): Conversation => ({ id, title: `t-${id}`, ...extra });

describe("mergeLocalOps", () => {
  it("devuelve el snapshot tal cual si no hay mutaciones pendientes", () => {
    const items = [conv("a"), conv("b")];
    expect(mergeLocalOps(items, new Map())).toBe(items);
  });

  it("una página que llega tarde NO resucita el chat borrado", () => {
    const ops: ConvLocalOps = new Map();
    setLocalOp(ops, "b", { removed: true });
    // La página 2 se pidió antes del borrado, así que aún trae "b".
    expect(mergeLocalOps([conv("a"), conv("b"), conv("c")], ops).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("un snapshot stale NO revierte el rename ni el pin recién aplicados", () => {
    const ops: ConvLocalOps = new Map();
    setLocalOp(ops, "a", { title: "nuevo" });
    setLocalOp(ops, "a", { pinned: true });
    const [merged] = mergeLocalOps([conv("a", { title: "viejo", pinned: false })], ops);
    expect(merged).toMatchObject({ id: "a", title: "nuevo", pinned: true });
  });

  it("no toca los campos sin mutación pendiente", () => {
    const ops: ConvLocalOps = new Map();
    setLocalOp(ops, "a", { pinned: true });
    const [merged] = mergeLocalOps([conv("a", { title: "server", preview: "p" })], ops);
    expect(merged).toMatchObject({ title: "server", preview: "p", pinned: true });
  });
});

describe("clearLocalOp", () => {
  it("tras el rollback del rename, el snapshot del servidor vuelve a mandar", () => {
    const ops: ConvLocalOps = new Map();
    setLocalOp(ops, "a", { title: "nuevo" });
    clearLocalOp(ops, "a", "title");
    expect(ops.size).toBe(0);
    expect(mergeLocalOps([conv("a", { title: "server" })], ops)[0]?.title).toBe("server");
  });

  it("conserva las otras mutaciones pendientes del mismo chat", () => {
    const ops: ConvLocalOps = new Map();
    setLocalOp(ops, "a", { title: "nuevo", pinned: true });
    clearLocalOp(ops, "a", "pinned");
    expect(ops.get("a")).toEqual({ title: "nuevo" });
  });

  it("el rollback de un borrado fallido devuelve el chat a la lista", () => {
    const ops: ConvLocalOps = new Map();
    setLocalOp(ops, "a", { removed: true });
    expect(mergeLocalOps([conv("a")], ops)).toHaveLength(0);
    clearLocalOp(ops, "a", "removed");
    expect(mergeLocalOps([conv("a")], ops)).toHaveLength(1);
  });
});

// ── Versionado (seq): dos mutaciones rápidas sobre la MISMA fila ──────────────
describe("clearLocalOp versionado", () => {
  it("nextOpSeq es monotónico (identifica cada mutación)", () => {
    const a = nextOpSeq();
    const b = nextOpSeq();
    expect(b).toBeGreaterThan(a);
  });

  it("el rollback del rename #1 (fallido) NO borra la op del rename #2 (aceptado)", () => {
    const ops: ConvLocalOps = new Map();
    const seq1 = nextOpSeq();
    setLocalOp(ops, "a", { title: "uno" }, seq1);
    const seq2 = nextOpSeq();
    setLocalOp(ops, "a", { title: "dos" }, seq2);

    // Llega tarde el fallo del PATCH #1: ya no es el dueño del valor pendiente.
    expect(clearLocalOp(ops, "a", "title", seq1)).toBe(false);
    expect(ops.get("a")?.title).toBe("dos");
    // Y un snapshot del servidor con el título viejo NO revierte el rename bueno.
    expect(mergeLocalOps([conv("a", { title: "viejo" })], ops)[0]?.title).toBe("dos");
  });

  it("el rollback de la mutación VIGENTE sí limpia (y devuelve true)", () => {
    const ops: ConvLocalOps = new Map();
    const seq = nextOpSeq();
    setLocalOp(ops, "a", { pinned: true }, seq);
    expect(clearLocalOp(ops, "a", "pinned", seq)).toBe(true);
    expect(ops.size).toBe(0);
    expect(mergeLocalOps([conv("a", { pinned: false })], ops)[0]?.pinned).toBe(false);
  });

  it("cada campo se versiona por separado: el fallo del pin no toca el rename posterior", () => {
    const ops: ConvLocalOps = new Map();
    const seqPin = nextOpSeq();
    setLocalOp(ops, "a", { pinned: true }, seqPin);
    const seqTitle = nextOpSeq();
    setLocalOp(ops, "a", { title: "nuevo" }, seqTitle);

    expect(clearLocalOp(ops, "a", "pinned", seqPin)).toBe(true);
    expect(ops.get("a")).toMatchObject({ title: "nuevo" });
    expect(ops.get("a")?.pinned).toBeUndefined();
    expect(clearLocalOp(ops, "a", "title", seqTitle)).toBe(true);
    expect(ops.size).toBe(0);
  });

  it("no revive una op ya limpiada (rollback duplicado)", () => {
    const ops: ConvLocalOps = new Map();
    const seq = nextOpSeq();
    setLocalOp(ops, "a", { removed: true }, seq);
    expect(clearLocalOp(ops, "a", "removed", seq)).toBe(true);
    expect(clearLocalOp(ops, "a", "removed", seq)).toBe(false);
  });
});
