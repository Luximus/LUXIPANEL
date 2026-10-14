// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// E-08: redirect 307 compartido en `@/pages/_static-asset`.
import { redirectToPanelAsset } from "@/pages/_static-asset";

const serveLogo50Redirect = redirectToPanelAsset("/panel/logo_50.webp");

export const GET = serveLogo50Redirect;
export const HEAD = serveLogo50Redirect;
