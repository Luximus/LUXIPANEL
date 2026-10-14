/**
 * build-policy.ts — refresh the static `cache-policy.json` shipped with the
 * client-side cache-engine bundle from the TypeScript registry (the single
 * source of truth).
 *
 * Runs via `pnpm run build:cache-policy` (also wired into `pnpm build` so a
 * normal backend build keeps the bundle in sync). LP-LICENSE-SERVER ships
 * this file verbatim to the client server during provisioning — it never
 * imports the TS source.
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { exportCachePolicy } from "../../src/shared/cache/cacheable-modules.js";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "cache-policy.json");
const policy = exportCachePolicy();
writeFileSync(target, JSON.stringify(policy, null, 2) + "\n", { mode: 0o644 });
process.stdout.write(
  `cache-policy.json written (${policy.collections.length} collections) -> ${target}\n`,
);
