// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// E-08: cuerpo compartido en `@/pages/_static-asset`. La resolución de ruta se
// queda aquí a propósito (depende de la ubicación del chunk construido).
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { serveStaticAsset } from "@/pages/_static-asset";

const __dirname = dirname(fileURLToPath(import.meta.url));
const servePanelFavicon = serveStaticAsset(
  resolve(__dirname, "../../../public/favicon.ico"),
  "image/x-icon",
);

export const GET = servePanelFavicon;
export const HEAD = servePanelFavicon;
