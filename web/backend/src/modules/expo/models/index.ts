// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo module — domain types and request schemas.
 *
 * The module manages Expo / React Native applications of the CONNECTED server
 * through the EAS CLI (`eas`) and the Expo GraphQL API. The only persisted
 * secret is the Expo access token, stored via `settingsRepository` (category
 * "expo", key "expo_token") on the connected server's sidecar — never on the
 * panel host, never returned to the browser. Store-account credential FILES
 * (Google service-account JSON, Apple ASC .p8) live under the LUXIPANEL config
 * dir on the connected server and are referenced from `eas.json` submit
 * profiles.
 */

import { z } from "zod";

// ── Constants ───────────────────────────────────────────────────────────────

export const EXPO_GRAPHQL_URL = "https://api.expo.dev/graphql";

export const PLATFORM_VALUES = ["android", "ios", "all"] as const;
export const SUBMIT_PLATFORM_VALUES = ["android", "ios"] as const;
export const BUILD_PROFILE_VALUES = ["development", "preview", "production"] as const;

// ── Domain types ──────────────────────────────────────────────────────────────

export interface ExpoAccount {
  username: string;
  accounts: string[];
}

export interface ExpoProject {
  /** Absolute path of the project on the connected server. */
  path: string;
  /** Directory/app name. */
  name: string;
  /** Expo app slug, from app config. */
  slug: string | null;
  /** EAS project id (extra.eas.projectId), null when not linked yet. */
  projectId: string | null;
  /** Bundle/package identifiers, when present in the config. */
  androidPackage: string | null;
  iosBundleIdentifier: string | null;
  /** Local packages resolvable by Node from this project on the connected server. */
  runtime?: { expoInstalled: boolean; ngrokInstalled: boolean };
}

export interface ExpoInstallStatus {
  status: "running" | "done" | "error";
  done: boolean;
  ok: boolean;
  log: string;
  message: string;
}

export interface ExpoProjectInfo extends ExpoProject {
  /** Raw, parsed app config (app.json / app.config.js evaluated). */
  config: Record<string, unknown> | null;
  /** Whether an eas.json exists at the project root. */
  hasEasJson: boolean;
}

export interface ExpoBuild {
  id: string;
  platform: string;
  status: string;
  profile: string | null;
  createdAt: string | null;
  /** expo.dev dashboard URL for the build. */
  url: string | null;
  artifactUrl: string | null;
  appVersion: string | null;
  /** EAS app this build belongs to (name + slug), for the history table. */
  appName?: string | null;
  appSlug?: string | null;
}

/** One parsed line of an EAS build log (bunyan JSON-lines: phase/level/msg). */
export interface ExpoBuildLogLine {
  /** EAS build phase, e.g. SPIN_UP_BUILDER / RUN_GRADLE / FAIL. */
  phase: string | null;
  /** bunyan level (30 info, 40 warn, 50 error) — null for non-JSON lines. */
  level: number | null;
  msg: string;
  time: string | null;
}

/** Readable build logs + the structured EAS failure, for the history viewer. */
export interface ExpoBuildLogs {
  buildId: string;
  status: string;
  /** Structured EAS error (present when the build failed). */
  error: { errorCode: string | null; message: string | null; docsUrl: string | null } | null;
  /** Parsed log lines (capped — see `truncated`). */
  lines: ExpoBuildLogLine[];
  /** True when older lines were dropped to bound the payload. */
  truncated: boolean;
}

export interface DevClientSession {
  /** EAS install-page URL of the latest dev build — encoded in the QR. */
  url: string | null;
  /** Direct artifact (APK/IPA) download URL, when the build is finished. */
  artifactUrl: string | null;
  /** The build the QR points to, when one was found. */
  buildId: string | null;
  platform: string | null;
  profile: string | null;
  status: string | null;
  createdAt: string | null;
  /** Legacy ASCII QR slot (always null now; the panel renders the QR client-side). */
  qr: string | null;
  /** Human-readable status / diagnostics for the UI (Spanish fallback). */
  raw: string;
  /** Stable code the UI maps to a localized message; `detail` carries the dynamic part. */
  messageCode?: DevClientMessageCode | null;
  /** Dynamic technical detail (stderr / log tail) appended after the localized message. */
  detail?: string;
}

/** UI-localizable outcomes of starting the dev-client tunnel. */
export type DevClientMessageCode =
  | "alreadyRunning"
  | "started"
  | "startFailed"
  | "expoMissing"
  | "ngrokMissing"
  | "exitedBeforeUrl"
  | "exitedBeforeUrlNgrok"
  /** El túnel de ngrok falló de forma TRANSITORIA en todos los reintentos (su
   *  API tiene hipos y su status page los reconoce). No es culpa del proyecto:
   *  el mensaje debe invitar a reintentar, no a instalar nada. */
  | "exitedBeforeUrlTunnel"
  | "timeout";

export interface ExpoQuota {
  planName: string | null;
  /** Concurrent build slots available on the plan. */
  concurrencies: number | null;
  /** Builds remaining this billing period, when the API exposes it. */
  remainingBuilds: number | null;
  /** Builds already consumed this billing period. */
  usedBuilds: number | null;
  /** Fallback: builds counted this month via `eas build:list`. */
  buildsThisMonth: number | null;
}

export interface EnvVariable {
  /** EAS variable id (GraphQL) — needed to edit/delete. Null from the CLI path. */
  id?: string | null;
  name: string;
  scope: string;
  visibility: string;
  value: string | null;
  /** Environments the variable applies to (e.g. ["production","development"]). */
  environments?: string[];
}

/** A Google Play service-account key configured on the EAS account. */
export interface StoreGoogleKey {
  clientEmail: string | null;
  projectIdentifier: string | null;
  updatedAt: string | null;
}

/** An App Store Connect API key configured on the EAS account. */
export interface StoreAppleKey {
  keyIdentifier: string | null;
  issuerIdentifier: string | null;
  name: string | null;
  updatedAt: string | null;
}

/** A Google service-account key referenced by eas.json submit (file-based). */
export interface StoreGoogleProjectFile {
  /** Absolute path of the key file on the connected server. */
  path: string;
  /** service-account client_email (non-secret), when readable. */
  clientEmail: string | null;
}

/** An ASC API key referenced by eas.json submit (file-based). */
export interface StoreAppleProjectFile {
  path: string;
  /** Null when the eas.json value is a placeholder. */
  keyId: string | null;
  issuerId: string | null;
}

/**
 * Current store-account credential state for the UI. Three independent sources:
 *   - `cloudKeys`: keys EAS holds on the owning account (eas-managed),
 *   - `projectFile`: a file referenced by the project's eas.json `submit`
 *     profile (the file-based method — the credential lives in the repo),
 *   - `localFile`: a credential file the PANEL staged under its config dir.
 */
export interface ExpoStoreCredentials {
  google: {
    cloudKeys: StoreGoogleKey[];
    projectFile: StoreGoogleProjectFile | null;
    localFile: boolean;
  };
  apple: {
    cloudKeys: StoreAppleKey[];
    projectFile: StoreAppleProjectFile | null;
    localFile: boolean;
  };
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Accept absolute POSIX paths only; reject traversal segments. */
function isSafeAbsolutePath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.includes("\0")) return false;
  return !value.split("/").some((seg) => seg === "..");
}

// ── Request schemas ─────────────────────────────────────────────────────────

export const saveConfigSchema = z.object({
  token: z.string().trim().min(10, "El token de Expo es demasiado corto").max(512),
});

const absolutePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(4096)
  .refine(isSafeAbsolutePath, { message: "Se espera una ruta absoluta válida (sin '..')" });

/**
 * EAS project id (B-30). Declared ONCE here and reused by every schema that
 * accepts one (`linkProject`, `buildList`, `envList`/`envSet`,
 * `storeCredentials`) — the literal used to be inlined four more times, so a
 * tightened bound only reached one endpoint.
 */
const easProjectIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[a-z0-9-]+$/i, "EAS project id inválido");

/** App/folder name (npm-package-safe) — shared by `initProject` and `createApp`. */
const appNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Nombre de app inválido");

export const platformSchema = z.enum(PLATFORM_VALUES);

export const submitPlatformSchema = z.enum(SUBMIT_PLATFORM_VALUES);

export const buildProfileSchema = z.enum(BUILD_PROFILE_VALUES);

/** Where to scan for projects (a repos/home root on the connected server). */
export const scanProjectsSchema = z.object({
  root: absolutePathSchema.optional(),
});

export const projectPathSchema = z.object({
  path: absolutePathSchema,
});

/** create-expo-app + eas init in a parent directory. */
export const initProjectSchema = z.object({
  /** Parent directory the new app folder is created under. */
  root: absolutePathSchema,
  /** App/folder name (npm-package-safe). */
  name: appNameSchema,
  /** Expo template (e.g. "blank", "tabs", "default"). */
  template: z.string().trim().max(120).optional(),
});
export type InitProjectInput = z.infer<typeof initProjectSchema>;

/** Link an existing project to an EAS project id. */
export const linkProjectSchema = z.object({
  path: absolutePathSchema,
  projectId: easProjectIdSchema.optional(),
});
export type LinkProjectInput = z.infer<typeof linkProjectSchema>;

/**
 * Detached app scaffolding (create-expo-app + best-effort `eas init`). Unlike
 * `initProjectSchema` (synchronous), this is run as a transient systemd unit so
 * it survives the request — a fresh RN `npm install` takes minutes, past the
 * panel's proxy/Cloudflare timeout. Progress is polled via `createStatusSchema`.
 */
export const createAppSchema = z.object({
  /** Parent directory the new app folder is created under. */
  root: absolutePathSchema,
  /** App/folder name (npm-package-safe). */
  name: appNameSchema,
  /** Expo template (e.g. "default", "blank", "blank-typescript", "tabs"). */
  template: z.string().trim().max(120).optional(),
});
export type CreateAppInput = z.infer<typeof createAppSchema>;

/** Poll a detached create job by the NEW project folder path. */
export const createStatusSchema = z.object({
  path: absolutePathSchema,
});
export type CreateStatusInput = z.infer<typeof createStatusSchema>;

export const buildSchema = z.object({
  path: absolutePathSchema,
  platform: platformSchema,
  profile: buildProfileSchema.default("production"),
});
export type BuildInput = z.infer<typeof buildSchema>;

export const buildListSchema = z.object({
  path: absolutePathSchema,
  /** EAS projectId — when present, builds are read from the cloud GraphQL API. */
  projectId: easProjectIdSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
  offset: z.number().int().min(0).max(1000000).optional(),
});
export type BuildListInput = z.infer<typeof buildListSchema>;

/** eas build ids are uuids. */
const buildIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9-]{8,64}$/i, "Build id inválido");

export const buildViewSchema = z.object({
  path: absolutePathSchema,
  buildId: buildIdSchema,
});

export const buildCancelSchema = buildViewSchema;

// Logs are fetched from the cloud GraphQL API by global buildId — no path.
export const buildLogsSchema = z.object({
  buildId: buildIdSchema,
});

export const submitSchema = z.object({
  path: absolutePathSchema,
  platform: submitPlatformSchema,
  profile: z.string().trim().min(1).max(80).default("production"),
});
export type SubmitInput = z.infer<typeof submitSchema>;

export const devClientSchema = z.object({
  path: absolutePathSchema,
  /** Tunnel mode for cross-network testing (defaults to lan). */
  tunnel: z.boolean().optional(),
});
export type DevClientInput = z.infer<typeof devClientSchema>;

export const updatePublishSchema = z.object({
  path: absolutePathSchema,
  branch: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._/-]+$/, "Nombre de rama/canal inválido"),
  message: z.string().trim().min(1).max(280).optional(),
});
export type UpdatePublishInput = z.infer<typeof updatePublishSchema>;

export const envListSchema = z.object({
  path: absolutePathSchema,
  /** EAS projectId — when present, vars are read from the cloud GraphQL API. */
  projectId: easProjectIdSchema.optional(),
  scope: z.enum(["project", "account"]).optional(),
});
export type EnvListInput = z.infer<typeof envListSchema>;

const envVarNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Nombre de variable inválido");

const envEnvironmentsSchema = z
  .array(z.enum(["production", "preview", "development"]))
  .min(1, "Selecciona al menos un entorno");

export const envSetSchema = z.object({
  path: absolutePathSchema,
  /** EAS projectId — when present, the variable is created via the GraphQL API. */
  projectId: easProjectIdSchema.optional(),
  name: envVarNameSchema,
  value: z.string().max(8192),
  scope: z.enum(["project", "account"]).default("project"),
  visibility: z.enum(["plaintext", "sensitive", "secret"]).default("sensitive"),
  environments: envEnvironmentsSchema.optional(),
});
export type EnvSetInput = z.infer<typeof envSetSchema>;

/** Update an existing EAS env variable (by GraphQL id). */
export const envUpdateSchema = z.object({
  path: absolutePathSchema,
  projectId: easProjectIdSchema.optional(),
  id: z.string().trim().min(1).max(128),
  name: envVarNameSchema.optional(),
  value: z.string().max(8192).optional(),
  visibility: z.enum(["plaintext", "sensitive", "secret"]).optional(),
  environments: envEnvironmentsSchema.optional(),
});
export type EnvUpdateInput = z.infer<typeof envUpdateSchema>;

/** Delete an EAS env variable (by GraphQL id). */
export const envDeleteSchema = z.object({
  path: absolutePathSchema,
  projectId: easProjectIdSchema.optional(),
  id: z.string().trim().min(1).max(128),
});
export type EnvDeleteInput = z.infer<typeof envDeleteSchema>;

// ── Store credentials ─────────────────────────────────────────────────────────

/** Google Play service-account JSON, written to the client config dir. */
export const googleCredentialSchema = z.object({
  path: absolutePathSchema,
  /** Raw service-account JSON body. */
  serviceAccountJson: z.string().min(2).max(64_000),
});
export type GoogleCredentialInput = z.infer<typeof googleCredentialSchema>;

/** Apple App Store Connect API key (.p8 + identifiers). */
export const appleCredentialSchema = z.object({
  path: absolutePathSchema,
  issuerId: z.string().trim().min(8).max(64),
  keyId: z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9]+$/, "Key id inválido"),
  /** Raw contents of the AuthKey_XXXX.p8 file. */
  p8: z.string().min(20).max(16_000),
});
export type AppleCredentialInput = z.infer<typeof appleCredentialSchema>;

/** Read the current store-account credential state for a project. */
export const storeCredentialsSchema = z.object({
  path: absolutePathSchema,
  projectId: easProjectIdSchema.optional(),
});
export type StoreCredentialsInput = z.infer<typeof storeCredentialsSchema>;

// ── Webhooks & devices ────────────────────────────────────────────────────────

export const webhookCreateSchema = z.object({
  path: absolutePathSchema,
  // https-only + public host: the URL is persisted and forwarded to
  // `eas webhook:create`. The runtime SSRF check (resolved address) runs in
  // `expoService.webhookCreate`; here we enforce scheme/format up front.
  url: z
    .string()
    .trim()
    .url("URL de webhook inválida")
    .max(2048)
    .refine((v) => new URL(v).protocol === "https:", "El webhook debe usar https"),
  event: z.enum(["BUILD", "SUBMIT"]).default("BUILD"),
});
export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;

export const deviceCreateSchema = z.object({
  path: absolutePathSchema,
});

// ── Generic CLI result ────────────────────────────────────────────────────────

export interface CliResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** First expo.dev URL found in the output, when any. */
  url: string | null;
}

/** Result of launching a detached app-creation job. */
export interface CreateAppStart {
  /** Absolute path of the app folder being created. */
  projectPath: string;
  /** "running" once the unit is launched; "error" if it couldn't start. */
  status: "running" | "error";
  message: string;
}

/** Progress snapshot of a detached app-creation job. */
export interface CreateAppStatus {
  status: "running" | "done" | "error";
  done: boolean;
  /** True only when the scaffold finished with exit code 0. */
  ok: boolean;
  projectPath: string;
  /** Tail of the create log (create-expo-app + eas init output). */
  log: string;
  message: string;
}
