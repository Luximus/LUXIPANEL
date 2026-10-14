// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it } from "vitest";
import { embedWatchUrl } from "./embed-url";

describe("embedWatchUrl", () => {
  it("convierte embeds de YouTube a la URL de watch", () => {
    expect(embedWatchUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(embedWatchUrl("https://www.youtube-nocookie.com/embed/abc_-123?rel=0")).toBe(
      "https://www.youtube.com/watch?v=abc_-123",
    );
  });

  it("convierte embeds de Vimeo públicos a vimeo.com/{id}", () => {
    expect(embedWatchUrl("https://player.vimeo.com/video/76979871")).toBe("https://vimeo.com/76979871");
    expect(embedWatchUrl("https://player.vimeo.com/video/76979871?title=0&byline=0")).toBe(
      "https://vimeo.com/76979871",
    );
  });

  it("conserva el hash `h` de los Vimeo unlisted (vimeo.com/{id}/{h})", () => {
    expect(embedWatchUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")).toBe(
      "https://vimeo.com/76979871/8272103f6e",
    );
    // `h` no tiene que ser el primer parámetro del query.
    expect(embedWatchUrl("https://player.vimeo.com/video/76979871?title=0&h=8272103f6e&byline=0")).toBe(
      "https://vimeo.com/76979871/8272103f6e",
    );
  });

  it("devuelve el src intacto si no es un embed conocido", () => {
    expect(embedWatchUrl("https://example.com/video/123")).toBe("https://example.com/video/123");
  });
});
