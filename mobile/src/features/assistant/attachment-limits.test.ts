// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENT_BASE64,
  MAX_ATTACHMENTS,
  MAX_TOTAL_ATTACHMENT_BASE64,
  mergeAttachments,
} from "./attachment-limits";
import type { ChatAttachment } from "./types";

function att(name: string, size: number): ChatAttachment {
  return { name, dataBase64: "a".repeat(size), mime: "application/octet-stream" };
}

describe("mergeAttachments", () => {
  it("añade adjuntos dentro de los límites sin rechazo", () => {
    const { next, rejected } = mergeAttachments([att("a", 10)], [att("b", 20), att("c", 30)]);
    expect(next.map((a) => a.name)).toEqual(["a", "b", "c"]);
    expect(rejected).toBeNull();
  });

  it("descarta el archivo que excede el tamaño por adjunto y conserva el resto", () => {
    const { next, rejected } = mergeAttachments([], [att("grande", MAX_ATTACHMENT_BASE64 + 1), att("ok", 10)]);
    expect(next.map((a) => a.name)).toEqual(["ok"]);
    expect(rejected).toBe("size");
  });

  it("corta al llegar al máximo de adjuntos", () => {
    const prev = Array.from({ length: MAX_ATTACHMENTS }, (_, i) => att(`p${i}`, 5));
    const { next, rejected } = mergeAttachments(prev, [att("extra", 5)]);
    expect(next).toHaveLength(MAX_ATTACHMENTS);
    expect(rejected).toBe("count");
  });

  it("respeta el presupuesto total de base64", () => {
    const prev = [att("p", MAX_TOTAL_ATTACHMENT_BASE64 - 5)];
    const { next, rejected } = mergeAttachments(prev, [att("n", 10)]);
    expect(next).toHaveLength(1);
    expect(rejected).toBe("size");
  });

  it("reporta el PRIMER motivo cuando hay varios descartes", () => {
    const incoming = [
      att("grande", MAX_ATTACHMENT_BASE64 + 1),
      ...Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => att(`n${i}`, 5)),
    ];
    const { next, rejected } = mergeAttachments([], incoming);
    expect(next).toHaveLength(MAX_ATTACHMENTS);
    expect(rejected).toBe("size");
  });

  it("no muta la lista previa", () => {
    const prev = [att("a", 5)];
    mergeAttachments(prev, [att("b", 5)]);
    expect(prev).toHaveLength(1);
  });
});
