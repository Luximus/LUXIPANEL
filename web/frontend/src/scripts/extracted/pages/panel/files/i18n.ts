// Files page — i18n helpers (reads the SSR-embedded `#files-i18n` JSON blob).
// LEAF module: imports only the shared page-i18n lib (F-03/T-08).
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";

export const { loadI18n, t, fmt } = createPageI18n("files-i18n");
