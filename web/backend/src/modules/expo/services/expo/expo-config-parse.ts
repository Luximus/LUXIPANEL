// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo project-config + eas.json parsing helpers. Read (never mutate) a
 * project's app config / package.json / eas.json on the connected server to
 * derive its ExpoProject shape, EAS projectId and file-based submit
 * credentials. Never throws on parse failure — returns null / empties.
 */

import type { Executor } from "../../../../shared/executor/index.js";
import { quoteArg } from "../../../../shared/executor/index.js";
import type {
  ExpoBuild,
  ExpoProject,
  StoreAppleProjectFile,
  StoreGoogleProjectFile,
} from "../../models/index.js";
import { ValidationError } from "../../../../shared/errors/index.js";
import { safeJsonParse, sh } from "./expo-shell.js";

// ── App-config extraction ─────────────────────────────────────────────────────

export interface RawAppConfig {
  expo?: {
    name?: string;
    slug?: string;
    android?: { package?: string };
    ios?: { bundleIdentifier?: string };
    extra?: { eas?: { projectId?: string } };
  };
  name?: string;
  slug?: string;
  android?: { package?: string };
  ios?: { bundleIdentifier?: string };
  extra?: { eas?: { projectId?: string } };
}

export function flattenConfig(raw: RawAppConfig): RawAppConfig["expo"] & Record<string, unknown> {
  // app.json wraps under "expo"; app.config.js evaluated output may not.
  const expo = raw.expo ?? raw;
  return expo as RawAppConfig["expo"] & Record<string, unknown>;
}

/**
 * Read and parse a project's app config on the connected server by reading
 * `app.json` STATICALLY (one `cat`, never throws — returns null on failure).
 *
 * SECURITY: we deliberately do NOT run `npx --yes expo config --json` here.
 * That evaluates the project's `app.config.js`/`.ts` (arbitrary code) and
 * `npx --yes` can download+run npm packages — reachable by any user with the
 * `expo` module via `POST /api/expo/project-info` with an arbitrary path, i.e.
 * remote code execution as the SSH user. Static parsing loses dynamic-config
 * evaluation (name/slug/projectId from app.config.js), which is an acceptable
 * trade for closing the RCE; `extra.eas.projectId` is still read from app.json.
 */
export async function readAppConfig(executor: Executor, projectPath: string): Promise<RawAppConfig | null> {
  const raw = await sh(
    executor,
    `cat ${quoteArg(`${projectPath}/app.json`)} 2>/dev/null || true`,
    15_000,
  ).catch(() => null);
  if (raw?.stdout) {
    const parsed = safeJsonParse<RawAppConfig>(raw.stdout.trim());
    if (parsed) return parsed;
  }
  return null;
}

export function projectFromConfig(projectPath: string, raw: RawAppConfig | null): ExpoProject {
  const name = projectPath.split("/").filter(Boolean).pop() ?? projectPath;
  const cfg = raw ? flattenConfig(raw) : null;
  return {
    path: projectPath,
    name,
    slug: cfg?.slug ?? null,
    projectId: cfg?.extra?.eas?.projectId ?? null,
    androidPackage: cfg?.android?.package ?? null,
    iosBundleIdentifier: cfg?.ios?.bundleIdentifier ?? null,
  };
}

/** Resolve installed packages without importing project code or downloading anything. */
function runtimeProbeCommand(dir: string): string {
  const probe = `const path=process.argv[1]; for (const name of ['expo/package.json','@expo/ngrok/package.json']) { try { require.resolve(name,{paths:[path]}); process.stdout.write('1'); } catch { process.stdout.write('0'); } }`;
  return `node -e ${quoteArg(probe)} ${quoteArg(dir)} 2>/dev/null || echo 00`;
}

export async function readExpoRuntime(executor: Executor, dir: string): Promise<NonNullable<ExpoProject["runtime"]>> {
  const result = await sh(executor, runtimeProbeCommand(dir), 10_000).catch(() => null);
  const flags = (result?.stdout ?? "").trim();
  return { expoInstalled: flags === "11" || flags === "10", ngrokInstalled: flags === "11" || flags === "01" };
}

/** Require a real Expo project before running or installing its local packages. */
export async function requireExpoProject(executor: Executor, dir: string): Promise<ExpoProject> {
  const project = await detectExpoProject(executor, dir);
  if (!project) throw new ValidationError("La ruta no contiene un proyecto Expo válido.");
  return project;
}

interface RawPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Decide — in ONE round-trip, without `npx` — whether `dir` is a genuine Expo
 * project, and if so build its ExpoProject from the raw app.json.
 *
 * The gate is the `expo` (or `expo-router`) **dependency in package.json**: it's
 * the defining marker of a real Expo app and is present whether the config is a
 * static app.json or a dynamic app.config.js/ts. An `expo` block in app.json is
 * NOT sufficient on its own — non-RN repos sometimes carry a bare app.json that
 * only holds `extra.eas.projectId` for EAS submit (e.g. a backend with a
 * companion app), which must not be listed as a buildable project. This also
 * rejects unrelated `app.json` files (Obsidian's `.obsidian/app.json`, etc.) and
 * stays cheap (the old per-dir `expo config --json` could trigger a full install).
 */
export async function detectExpoProject(executor: Executor, dir: string): Promise<ExpoProject | null> {
  const script =
    `echo '<<APPJSON>>'; cat ${quoteArg(`${dir}/app.json`)} 2>/dev/null; ` +
    `echo '<<PKGJSON>>'; cat ${quoteArg(`${dir}/package.json`)} 2>/dev/null; ` +
    `echo '<<RUNTIME>>'; ${runtimeProbeCommand(dir)}; echo '<<END>>'`;
  const res = await sh(executor, script, 15_000).catch(() => null);
  const out = res?.stdout ?? "";
  const section = (from: string, to: string): string => {
    const i = out.indexOf(from);
    const j = out.indexOf(to);
    return i >= 0 && j > i ? out.slice(i + from.length, j).trim() : "";
  };
  const appJsonText = section("<<APPJSON>>", "<<PKGJSON>>");
  const rawAppJson = appJsonText ? safeJsonParse<RawAppConfig>(appJsonText) : null;
  const pkgText = section("<<PKGJSON>>", "<<RUNTIME>>");
  const pkg = pkgText ? safeJsonParse<RawPackageJson>(pkgText) : null;

  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const isExpoApp = Boolean(deps.expo ?? deps["expo-router"]);
  if (!isExpoApp) return null;
  const flags = section("<<RUNTIME>>", "<<END>>");
  return {
    ...projectFromConfig(dir, rawAppJson),
    runtime: { expoInstalled: flags === "11" || flags === "10", ngrokInstalled: flags === "11" || flags === "01" },
  };
}

/**
 * Resolve the EAS projectId from a project's static app.json on the connected
 * server (cheap: one `cat`, no `npx`). Returns null when the project has no
 * app.json or isn't linked yet. Used to drive the cloud build/quota lookups
 * even when the caller didn't pass an explicit projectId.
 */
export async function readProjectIdFromPath(executor: Executor, dir: string): Promise<string | null> {
  const res = await sh(executor, `cat ${quoteArg(`${dir}/app.json`)} 2>/dev/null || true`, 10_000).catch(
    () => null,
  );
  if (!res?.stdout) return null;
  const raw = safeJsonParse<RawAppConfig>(res.stdout.trim());
  return raw ? projectFromConfig(dir, raw).projectId : null;
}

interface EasJsonSubmitProfile {
  android?: { serviceAccountKeyPath?: string };
  ios?: { ascApiKeyPath?: string; ascApiKeyId?: string; ascApiKeyIssuerId?: string };
}
interface EasJson {
  submit?: Record<string, EasJsonSubmitProfile>;
}

/** A value that's an eas.json placeholder (e.g. "REEMPLAZAR_...") counts as unset. */
function isPlaceholder(v: string | undefined | null): boolean {
  return !v || /^(REEMPLAZAR|REPLACE|TODO|XXXX)/i.test(v.trim());
}

/** Resolve a possibly-relative eas.json path against the project directory. */
function resolveAgainst(projectPath: string, p: string): string {
  if (p.startsWith("/")) return p;
  return `${projectPath.replace(/\/$/, "")}/${p.replace(/^\.\//, "")}`;
}

/**
 * Detect file-based submit credentials referenced by the project's eas.json
 * (`submit.<profile>.android.serviceAccountKeyPath` / `ios.ascApiKeyPath`) and
 * confirm the referenced files exist on the connected server. This is how many
 * projects publish — the credential lives in the repo, not in EAS. The Google
 * key's non-secret `client_email` is surfaced; the private key is never read out.
 */
export async function readEasSubmitCredentials(
  executor: Executor,
  projectPath: string,
): Promise<{ google: StoreGoogleProjectFile | null; apple: StoreAppleProjectFile | null }> {
  const easRes = await sh(
    executor,
    `cat ${quoteArg(`${projectPath}/eas.json`)} 2>/dev/null || true`,
    10_000,
  ).catch(() => null);
  const eas = easRes?.stdout ? safeJsonParse<EasJson>(easRes.stdout.trim()) : null;
  if (!eas?.submit) return { google: null, apple: null };

  let saPath: string | null = null;
  let ascPath: string | null = null;
  let ascKeyId: string | undefined;
  let ascIssuerId: string | undefined;
  for (const profile of Object.values(eas.submit)) {
    if (!saPath && profile?.android?.serviceAccountKeyPath) {
      saPath = profile.android.serviceAccountKeyPath;
    }
    if (!ascPath && profile?.ios?.ascApiKeyPath) {
      ascPath = profile.ios.ascApiKeyPath;
      ascKeyId = profile.ios.ascApiKeyId;
      ascIssuerId = profile.ios.ascApiKeyIssuerId;
    }
  }

  let google: StoreGoogleProjectFile | null = null;
  if (saPath) {
    const abs = resolveAgainst(projectPath, saPath);
    const j = await sh(executor, `cat ${quoteArg(abs)} 2>/dev/null || true`, 10_000).catch(() => null);
    const parsed = j?.stdout?.trim() ? safeJsonParse<{ client_email?: string }>(j.stdout.trim()) : null;
    if (parsed) google = { path: abs, clientEmail: parsed.client_email ?? null };
  }

  let apple: StoreAppleProjectFile | null = null;
  if (ascPath) {
    const abs = resolveAgainst(projectPath, ascPath);
    const t = await sh(executor, `test -f ${quoteArg(abs)} && echo yes || echo no`, 8_000).catch(
      () => null,
    );
    if ((t?.stdout.trim() ?? "no") === "yes") {
      apple = {
        path: abs,
        keyId: isPlaceholder(ascKeyId) ? null : (ascKeyId ?? null),
        issuerId: isPlaceholder(ascIssuerId) ? null : (ascIssuerId ?? null),
      };
    }
  }
  return { google, apple };
}

// ── Build list parsing ─────────────────────────────────────────────────────────

export interface RawBuild {
  id: string;
  platform?: string;
  status?: string;
  buildProfile?: string;
  createdAt?: string;
  appVersion?: string;
  artifacts?: { buildUrl?: string; applicationArchiveUrl?: string };
}

export function mapBuild(raw: RawBuild): ExpoBuild {
  return {
    id: raw.id,
    platform: (raw.platform ?? "").toLowerCase(),
    status: (raw.status ?? "").toLowerCase(),
    profile: raw.buildProfile ?? null,
    createdAt: raw.createdAt ?? null,
    url: raw.id ? `https://expo.dev/builds/${raw.id}` : null,
    artifactUrl: raw.artifacts?.applicationArchiveUrl ?? raw.artifacts?.buildUrl ?? null,
    appVersion: raw.appVersion ?? null,
  };
}
