// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared bodies for the tiny static-asset endpoints under `src/pages/` (E-08).
 *
 * The underscore prefix keeps Astro from routing this module.
 *
 * Four routes (`panel/favicon.ico.ts`, `panel/logo_{50,150,300}.webp.ts`) were
 * byte-for-byte identical except for the file path and the `Content-Type`, and
 * three more (`favicon.ico.ts`, `logo_{50,150}.webp.ts`) were the same 307
 * redirect except for the target.
 *
 * IMPORTANT — path resolution stays at the CALL SITE. Each route keeps its own
 * `resolve(dirname(fileURLToPath(import.meta.url)), "../../../public/<file>")`
 * because that expression is evaluated against the BUILT chunk's location
 * (`dist/server/chunks/`), which is what makes the `../../../public` prefix land
 * on `frontend/public` both in dev and in the Node build. Moving it into this
 * module would change the base directory and break one of the two.
 */
import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";

/** Serve a file from disk with a fixed mime + the shared 5-minute cache policy. */
export function serveStaticAsset(
  filePath: string,
  contentType: string,
  cacheControl = "public, max-age=300",
): APIRoute {
  return async () => {
    const body = await readFile(filePath);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  };
}

/** 307-redirect a root-level asset path to its `/panel/…` twin. */
export function redirectToPanelAsset(target: string): APIRoute {
  return ({ url }) => Response.redirect(new URL(target, url), 307);
}
