// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Application version SSOT.
 *
 * Reads the version from `package.json` ONCE so the health endpoint, OpenAPI
 * spec, and the boot banner all report the same value (no hand-kept literals).
 *
 * ESM/NodeNext: `import` cannot pull a JSON file as a value module without an
 * import assertion, so we resolve `package.json` via `createRequire`. The
 * relative `../../package.json` resolves to `backend/package.json` from BOTH
 * `src/config/version.ts` (src → config → backend) AND the compiled
 * `dist/config/version.js` (dist mirrors src under `backend/`, so `../../`
 * lands at `backend/` in both cases — `package.json` is copied into `dist/` at
 * build time too, but `../../` reaches the canonical `backend/package.json`).
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

/** Full semver from package.json, e.g. "2.0.0". */
export const APP_VERSION = pkg.version;

/** Short display form (major.minor), e.g. "v2.0". */
export const APP_VERSION_DISPLAY = `v${APP_VERSION.split(".").slice(0, 2).join(".")}`;
