// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — attachment serving policy (Block D).
 *
 * These assertions ARE the security contract: what may render inline, what is
 * forced to download, which CSP each inline type carries, and that a
 * mislabelled payload can never be rendered.
 */

import { describe, expect, it } from "vitest";
import { resolveInlinePolicy } from "./attachment-headers.js";

const pdf = () => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20)]);
const mp4 = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(32)]);
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)]);
const ogg = () => Buffer.concat([Buffer.from("OggS"), Buffer.alloc(32)]);
const wav = () =>
  Buffer.concat([Buffer.from("RIFF"), Buffer.from([36, 0, 0, 0]), Buffer.from("WAVEfmt "), Buffer.alloc(16)]);
const mp3Id3 = () => Buffer.concat([Buffer.from("ID3"), Buffer.alloc(32)]);
const mp3Sync = () => Buffer.concat([Buffer.from([0xff, 0xfb]), Buffer.alloc(32)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(16)]);

describe("resolveInlinePolicy — inline allowlist", () => {
  it("serves a real PDF inline with the PDFium-compatible sandbox CSP", () => {
    const out = resolveInlinePolicy({ mimeType: "application/pdf", name: "doc.pdf", buf: pdf() });

    expect(out.status).toBe(200);
    expect(out.inline).toBe(true);
    expect(out.contentType).toBe("application/pdf");
    expect(out.headers["Content-Security-Policy"]).toBe("sandbox allow-scripts");
    expect(out.headers["Content-Disposition"]).toMatch(/^inline;/);
    expect(out.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(out.headers["Accept-Ranges"]).toBe("bytes");
    expect(out.headers["Cache-Control"]).toBe("private, max-age=86400");
  });

  it("serves raster images inline with no CSP (not scriptable)", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "a.png", buf: png() });

    expect(out.inline).toBe(true);
    expect(out.contentType).toBe("image/png");
    expect(out.headers["Content-Security-Policy"]).toBeUndefined();
  });

  it.each([
    ["video/mp4", mp4()],
    ["video/webm", webm()],
    ["audio/ogg", ogg()],
    ["audio/wav", wav()],
    ["audio/x-wav", wav()],
    ["audio/mpeg", mp3Id3()],
  ])("serves %s inline with a bare sandbox CSP when the signature matches", (mime, buf) => {
    const out = resolveInlinePolicy({ mimeType: mime, name: `f.${mime.split("/")[1]}`, buf });

    expect(out.inline).toBe(true);
    expect(out.contentType).toBe(mime);
    expect(out.headers["Content-Security-Policy"]).toBe("sandbox");
  });

  it("accepts a raw MPEG frame sync as mp3 (no ID3 tag)", () => {
    const out = resolveInlinePolicy({ mimeType: "audio/mpeg", name: "a.mp3", buf: mp3Sync() });
    expect(out.inline).toBe(true);
  });

  it("tolerates a MIME with parameters (image/png; charset=binary)", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png; charset=binary", name: "a.png", buf: png() });
    expect(out.contentType).toBe("image/png");
  });
});

describe("resolveInlinePolicy — forced download", () => {
  it.each([
    ["image/svg+xml", "<svg onload=alert(1)></svg>"],
    ["text/html", "<html><script>alert(1)</script></html>"],
    ["text/plain", "hello"],
    ["application/x-sh", "#!/bin/sh\nrm -rf /"],
  ])("forces %s to octet-stream + attachment", (mime, content) => {
    const out = resolveInlinePolicy({ mimeType: mime, name: "x", buf: Buffer.from(content) });

    expect(out.inline).toBe(false);
    expect(out.contentType).toBe("application/octet-stream");
    expect(out.headers["Content-Disposition"]).toMatch(/^attachment;/);
    expect(out.headers["Content-Security-Policy"]).toBeUndefined();
    expect(out.headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("demotes an allowlisted MIME whose bytes are NOT that container", () => {
    const out = resolveInlinePolicy({
      mimeType: "video/mp4",
      name: "evil.mp4",
      buf: Buffer.from("<html><script>alert(1)</script></html>"),
    });

    expect(out.inline).toBe(false);
    expect(out.contentType).toBe("application/octet-stream");
    expect(out.headers["Content-Disposition"]).toMatch(/^attachment;/);
  });

  it("demotes a PDF MIME with no %PDF- marker", () => {
    const out = resolveInlinePolicy({
      mimeType: "application/pdf",
      name: "fake.pdf",
      buf: Buffer.from("not a pdf at all"),
    });
    expect(out.inline).toBe(false);
  });
});

describe("resolveInlinePolicy — Range", () => {
  const buf = Buffer.from("0123456789"); // 10 bytes

  it("returns the whole body with Content-Length when there is no Range", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "a.png", buf });
    expect(out.status).toBe(200);
    expect(out.headers["Content-Length"]).toBe("10");
    expect(out.body.toString()).toBe("0123456789");
  });

  it("answers 206 with Content-Range for bytes=2-5", () => {
    const out = resolveInlinePolicy({ mimeType: "video/mp4", name: "v.mp4", buf: mp4(), rangeHeader: "bytes=2-5" });

    expect(out.status).toBe(206);
    expect(out.headers["Content-Range"]).toBe(`bytes 2-5/${mp4().length}`);
    expect(out.headers["Content-Length"]).toBe("4");
    expect(out.body.length).toBe(4);
  });

  it("clamps an open-ended range (bytes=8-) to the end of the buffer", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "a.png", buf, rangeHeader: "bytes=8-" });
    expect(out.status).toBe(206);
    expect(out.headers["Content-Range"]).toBe("bytes 8-9/10");
    expect(out.body.toString()).toBe("89");
  });

  it("supports a suffix range (bytes=-3)", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "a.png", buf, rangeHeader: "bytes=-3" });
    expect(out.status).toBe(206);
    expect(out.body.toString()).toBe("789");
  });

  it.each(["bytes=20-30", "bytes=5-2", "bytes=abc", "items=0-1", "bytes=-0"])(
    "answers 416 with `bytes */size` for the invalid range %s",
    (rangeHeader) => {
      const out = resolveInlinePolicy({ mimeType: "image/png", name: "a.png", buf, rangeHeader });

      expect(out.status).toBe(416);
      expect(out.headers["Content-Range"]).toBe("bytes */10");
      expect(out.body.length).toBe(0);
    },
  );
});

describe("resolveInlinePolicy — filename sanitisation", () => {
  it("strips quotes so the uploader cannot inject extra directives", () => {
    const out = resolveInlinePolicy({
      mimeType: "image/png",
      name: 'a".png"; download="evil.exe',
      buf: png(),
    });

    const cd = out.headers["Content-Disposition"] ?? "";
    // Exactly one quoted `filename=` parameter, and no injected directive.
    expect(cd.match(/filename="/g)).toHaveLength(1);
    expect(cd).not.toMatch(/download=/);
  });

  it("keeps the UTF-8 name in filename* and an ASCII fallback in filename", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "informe año ñ.png", buf: png() });

    const cd = out.headers["Content-Disposition"] ?? "";
    expect(cd).toContain("filename*=UTF-8''");
    expect(cd).toContain(encodeURIComponent("informe año ñ.png"));
    expect(/filename="([^"]*)"/.exec(cd)?.[1]).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("falls back to `file` for an empty name", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "", buf: png() });
    expect(out.headers["Content-Disposition"]).toContain('filename="file"');
  });

  it("drops CR/LF so no header can be split", () => {
    const out = resolveInlinePolicy({ mimeType: "image/png", name: "a\r\nX-Evil: 1.png", buf: png() });
    expect(out.headers["Content-Disposition"]).not.toMatch(/[\r\n]/);
  });
});
