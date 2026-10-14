// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Conversión de URLs de embed (iframes YouTube/Vimeo del blog) a su URL "de
 * ver" equivalente para abrir el video fuera de la app. Lógica PURA (sin
 * imports de RN) — testeable en vitest; el renderer (`components/HtmlView`)
 * solo la consume.
 */

/** URL "de ver" equivalente para abrir el embed fuera de la app. */
export function embedWatchUrl(src: string): string {
  const yt = src.match(/youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]+)/i);
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
  const vimeo = src.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (vimeo) {
    // Vídeos "unlisted": el embed lleva `?h=<hash>` y la URL de watch lo
    // necesita como segundo segmento de la ruta (vimeo.com/{id}/{h});
    // descartarlo devuelve 404.
    const h = src.match(/[?&]h=([A-Za-z0-9]+)/i);
    return h ? `https://vimeo.com/${vimeo[1]}/${h[1]}` : `https://vimeo.com/${vimeo[1]}`;
  }
  return src;
}
