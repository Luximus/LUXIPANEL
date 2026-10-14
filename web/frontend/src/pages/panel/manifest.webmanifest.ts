// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { APIRoute } from "astro";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, "../../../public/manifest.webmanifest");

const servePanelManifest: APIRoute = async () => {
  const body = await readFile(manifestPath, "utf8");
  return new Response(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};

export const GET = servePanelManifest;
export const HEAD = servePanelManifest;
