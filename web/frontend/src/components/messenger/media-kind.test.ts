// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { extensionOf, formatBytes, isInlineViewable, mediaIcon, mediaKindOf } from "./media-kind";

describe("mediaKindOf", () => {
  it("classifies by MIME first", () => {
    expect(mediaKindOf("a.bin", "image/png")).toBe("image");
    expect(mediaKindOf("a.bin", "video/mp4")).toBe("video");
    expect(mediaKindOf("a.bin", "audio/mpeg")).toBe("audio");
    expect(mediaKindOf("a.bin", "application/pdf")).toBe("pdf");
    expect(mediaKindOf("a.bin", "text/plain")).toBe("document");
  });
  it("falls back to the extension when the MIME is generic", () => {
    expect(mediaKindOf("report.pdf", "application/octet-stream")).toBe("pdf");
    expect(mediaKindOf("sheet.xlsx", "application/octet-stream")).toBe("document");
    expect(mediaKindOf("backup.tar.gz", "application/octet-stream")).toBe("other");
  });
  it("ignores MIME parameters", () => {
    expect(mediaKindOf("a", "application/pdf; charset=binary")).toBe("pdf");
  });
  it("returns other for unknowns", () => {
    expect(mediaKindOf("thing", "")).toBe("other");
    expect(mediaKindOf(null, null)).toBe("other");
  });
});

describe("isInlineViewable (mirror of the backend allowlist)", () => {
  it("allows the raster images, pdf, mp4/webm and the audio set", () => {
    for (const m of [
      "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp",
      "application/pdf", "video/mp4", "video/webm",
      "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm", "audio/mp4",
    ]) {
      expect(isInlineViewable(m), m).toBe(true);
    }
  });
  it("refuses SVG, HTML and everything else", () => {
    for (const m of ["image/svg+xml", "text/html", "application/zip", "video/quicktime", "audio/flac", "", null]) {
      expect(isInlineViewable(m), String(m)).toBe(false);
    }
  });
  it("normalizes case and parameters", () => {
    expect(isInlineViewable("IMAGE/PNG")).toBe(true);
    expect(isInlineViewable("video/mp4; codecs=avc1")).toBe(true);
  });
});

describe("mediaIcon", () => {
  it("maps the buckets", () => {
    expect(mediaIcon("a.png", "image/png")).toBe("ti-photo");
    expect(mediaIcon("a.mp4", "video/mp4")).toBe("ti-video");
    expect(mediaIcon("a.mp3", "audio/mpeg")).toBe("ti-music");
    expect(mediaIcon("a.pdf", "application/pdf")).toBe("ti-file-type-pdf");
    expect(mediaIcon("a.zip", "application/zip")).toBe("ti-file-zip");
    expect(mediaIcon("a.xlsx", "application/octet-stream")).toBe("ti-file-type-xls");
    expect(mediaIcon("a.unknown", "")).toBe("ti-file");
  });
});

describe("extensionOf / formatBytes", () => {
  it("extracts extensions", () => {
    expect(extensionOf("dir/name.TXT")).toBe("txt");
    expect(extensionOf(".hidden")).toBe("");
    expect(extensionOf("noext")).toBe("");
  });
  it("formats sizes and tolerates null", () => {
    expect(formatBytes(0, "en")).toBe("0 B");
    expect(formatBytes(1023, "en")).toBe("1023 B");
    expect(formatBytes(1024, "en")).toBe("1 KB");
    expect(formatBytes(1536, "en")).toBe("1.5 KB");
    expect(formatBytes(null)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });
});
