// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// E-08: redirect 307 compartido en `@/pages/_static-asset`.
import { redirectToPanelAsset } from "@/pages/_static-asset";

const serveFaviconRedirect = redirectToPanelAsset("/panel/favicon.ico");

export const GET = serveFaviconRedirect;
export const HEAD = serveFaviconRedirect;
