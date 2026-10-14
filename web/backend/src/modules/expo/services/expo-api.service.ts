// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo GraphQL API client — thin typed wrapper over https://api.expo.dev/graphql
 * using the native fetch. Pure HTTP: no executor, no settings access (the
 * orchestration service injects the token). Used for data the CLI does not
 * print, primarily the account build quota / plan. Every request:
 *
 *   - carries `Authorization: Bearer <token>` (the token is never logged),
 *   - is bounded by a 10s AbortController timeout,
 *   - throws AppError(502, "EXPO_API_ERROR") with the first GraphQL error
 *     message when `errors` is present.
 */

import zlib from "node:zlib";
import { promisify } from "node:util";
import { AppError } from "../../../shared/errors/index.js";
import { fetchWithTimeout } from "../../../shared/http/fetch-timeout.js";
import { errMessage } from "../../../shared/utils/err-message.js";

const brotliDecompressAsync = promisify(zlib.brotliDecompress);
const gunzipAsync = promisify(zlib.gunzip);
/** Hard cap on a single EAS log file we'll pull into memory (compressed). A
 *  hostile/huge object is skipped rather than OOMing the box. */
const MAX_LOG_BYTES = 8 * 1024 * 1024;
import {
  EXPO_GRAPHQL_URL,
  type EnvVariable,
  type ExpoAccount,
  type ExpoBuild,
  type ExpoBuildLogs,
  type ExpoBuildLogLine,
  type ExpoQuota,
  type StoreAppleKey,
  type StoreGoogleKey,
} from "../models/index.js";

const REQUEST_TIMEOUT_MS = 10_000;
/** Logs can be large + slow to ship from GCS, so they get their own budget. */
const LOG_FETCH_TIMEOUT_MS = 25_000;
/** Cap parsed lines kept in the response (newest wins) — bounds the payload. */
const LOG_MAX_LINES = 2500;

/**
 * Download one EAS log file. The objects are stored on GCS **brotli-compressed**
 * (`content-encoding: br`) and GCS does not transcode br, so we always get br
 * bytes regardless of Accept-Encoding — decompress with brotli, then fall back
 * to gzip / plain text so a future format change can't blank the viewer.
 */
/** Read a fetch Response body into a Buffer, aborting once it exceeds `cap`
 *  bytes (returns null). Prevents an unbounded log object from filling memory. */
async function readBodyCapped(res: globalThis.Response, cap: number): Promise<Buffer | null> {
  const body = res.body;
  if (!body) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > cap ? null : buf;
  }
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

async function fetchLogFile(url: string): Promise<string> {
  // NOTE: not `fetchWithTimeout` — that clears the timer once the headers
  // arrive, but here the budget must also bound the streamed (multi-MB) body
  // read in `readBodyCapped`, so the timer is kept alive until the read ends.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOG_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return "";
    // Reject early on an oversized declared size, then hard-cap the read.
    const declared = Number(res.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > MAX_LOG_BYTES) return "";
    const buf = await readBodyCapped(res, MAX_LOG_BYTES);
    if (!buf) return "";
    // Async decompression — brotliDecompressSync/gunzipSync blocked the event
    // loop for the whole (multi-MB) buffer on every log view.
    for (const fn of [brotliDecompressAsync, gunzipAsync] as const) {
      try {
        return (await fn(buf)).toString("utf8");
      } catch {
        /* try the next codec */
      }
    }
    return buf.toString("utf8");
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Parse EAS bunyan JSON-lines into structured rows (raw text lines pass through). */
function parseLogText(text: string): ExpoBuildLogLine[] {
  const out: ExpoBuildLogLine[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as {
        phase?: string;
        level?: number;
        msg?: string;
        time?: string;
      };
      out.push({
        phase: o.phase ?? null,
        level: typeof o.level === "number" ? o.level : null,
        msg: String(o.msg ?? ""),
        time: o.time ?? null,
      });
    } catch {
      out.push({ phase: null, level: null, msg: line, time: null });
    }
  }
  return out;
}

/** Panel visibility form value → Expo GraphQL EnvironmentVariableVisibility. */
function mapVisibilityToApi(v: string): string {
  if (v === "plaintext" || v === "public") return "PUBLIC";
  if (v === "secret") return "SECRET";
  return "SENSITIVE";
}

interface GqlError {
  message: string;
}

interface GqlEnvelope<T> {
  data?: T;
  errors?: GqlError[];
}

async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      EXPO_GRAPHQL_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError" ? "timeout de 10s alcanzado" : errMessage(err);
    throw new AppError(`No se pudo contactar la API de Expo: ${reason}`, 502, "EXPO_API_ERROR");
  }

  let body: GqlEnvelope<T>;
  try {
    body = (await res.json()) as GqlEnvelope<T>;
  } catch {
    throw new AppError(
      `Expo respondió HTTP ${res.status} sin un cuerpo JSON válido`,
      502,
      "EXPO_API_ERROR",
      { httpStatus: res.status },
    );
  }

  if (body.errors?.length) {
    throw new AppError(body.errors[0]?.message ?? "Error de la API de Expo", 502, "EXPO_API_ERROR", {
      httpStatus: res.status,
    });
  }
  if (!body.data) {
    throw new AppError("La API de Expo devolvió una respuesta vacía", 502, "EXPO_API_ERROR");
  }
  return body.data;
}

// ── Raw shapes (subset we consume) ───────────────────────────────────────────

interface ViewerData {
  meActor: {
    __typename: string;
    username?: string;
    firstName?: string;
    accounts?: Array<{ name: string }>;
  } | null;
}

interface AccountQuotaData {
  meActor: {
    accounts?: Array<{
      name: string;
      subscription?: {
        name?: string | null;
        planId?: string | null;
        concurrencies?: { total?: number | null } | null;
        /** Plan build allotment (EASTotalPlanEnablement.total). */
        planEnablement?: { total?: number | null } | null;
      } | null;
      usageMetrics?: {
        metricsForServiceMetric?: Array<{ value?: number | null }> | null;
      } | null;
    }>;
  } | null;
}

/** Per-account quota sub-selection (shared by the User / Robot fragments). */
const QUOTA_ACCOUNT_FIELDS = `accounts {
  name
  subscription {
    name
    planId
    concurrencies { total }
    planEnablement(serviceMetric: BUILDS) { ... on EASTotalPlanEnablement { total } }
  }
  usageMetrics {
    metricsForServiceMetric(serviceMetric: BUILDS, granularity: TOTAL, timespan: $s) { value }
  }
}`;

interface BuildsData {
  app: {
    byId: {
      name?: string | null;
      slug?: string | null;
      ownerAccount?: { name?: string | null } | null;
      builds?: Array<{
        id: string;
        status?: string | null;
        platform?: string | null;
        appVersion?: string | null;
        buildProfile?: string | null;
        createdAt?: string | null;
        artifacts?: { applicationArchiveUrl?: string | null; buildUrl?: string | null } | null;
      }> | null;
    } | null;
  } | null;
}

interface EnvVarsData {
  app: {
    byId: {
      environmentVariables?: Array<{
        id?: string | null;
        name?: string | null;
        scope?: string | null;
        visibility?: string | null;
        value?: string | null;
        environments?: string[] | null;
      }> | null;
    } | null;
  } | null;
}

interface StoreCredsData {
  app: {
    byId: {
      ownerAccount?: {
        googleServiceAccountKeys?: Array<{
          clientEmail?: string | null;
          projectIdentifier?: string | null;
          updatedAt?: string | null;
        }> | null;
        appStoreConnectApiKeys?: Array<{
          keyIdentifier?: string | null;
          issuerIdentifier?: string | null;
          name?: string | null;
          updatedAt?: string | null;
        }> | null;
      } | null;
    } | null;
  } | null;
}

export const expoApiService = {
  /**
   * Store-account credentials configured on the EAS account that owns this app
   * (Google Play service-account keys + App Store Connect API keys). Read via
   * GraphQL — no eas-cli required. Secret bodies are never requested.
   */
  async storeCredentials(
    token: string,
    appId: string,
  ): Promise<{ google: StoreGoogleKey[]; apple: StoreAppleKey[] }> {
    const data = await gql<StoreCredsData>(
      token,
      `query AppStoreCreds($id: String!) {
         app { byId(appId: $id) { ownerAccount {
           googleServiceAccountKeys { clientEmail projectIdentifier updatedAt }
           appStoreConnectApiKeys { keyIdentifier issuerIdentifier name updatedAt }
         } } }
       }`,
      { id: appId },
    );
    const acct = data.app?.byId?.ownerAccount ?? null;
    return {
      google: (acct?.googleServiceAccountKeys ?? []).map((k) => ({
        clientEmail: k.clientEmail ?? null,
        projectIdentifier: k.projectIdentifier ?? null,
        updatedAt: k.updatedAt ?? null,
      })),
      apple: (acct?.appStoreConnectApiKeys ?? []).map((k) => ({
        keyIdentifier: k.keyIdentifier ?? null,
        issuerIdentifier: k.issuerIdentifier ?? null,
        name: k.name ?? null,
        updatedAt: k.updatedAt ?? null,
      })),
    };
  },

  /**
   * EAS environment variables for an app via the GraphQL API — authoritative,
   * needs no `eas-cli` on the connected server. `appId` is the EAS projectId.
   * Scope/visibility are lower-cased for display (e.g. `PROJECT` → `project`,
   * `PUBLIC` → `public`).
   */
  async envVars(token: string, appId: string): Promise<EnvVariable[]> {
    const data = await gql<EnvVarsData>(
      token,
      `query AppEnvVars($id: String!) {
         app { byId(appId: $id) {
           environmentVariables { id name scope visibility value environments }
         } }
       }`,
      { id: appId },
    );
    return (data.app?.byId?.environmentVariables ?? []).map((v) => ({
      id: v.id ?? null,
      name: v.name ?? "",
      scope: (v.scope ?? "").toLowerCase(),
      visibility: (v.visibility ?? "").toLowerCase(),
      value: v.value ?? null,
      environments: v.environments ?? [],
    }));
  },

  /**
   * Create an EAS environment variable on an app (project scope) via GraphQL.
   * `visibility` is the panel form value (plaintext|sensitive|secret) and maps
   * to the API's PUBLIC|SENSITIVE|SECRET; `environments` are lowercase names.
   */
  async createEnvVar(
    token: string,
    appId: string,
    input: { name: string; value: string; visibility: string; environments: string[] },
  ): Promise<void> {
    await gql(
      token,
      `mutation CreateEnvVar($appId: ID!, $data: CreateEnvironmentVariableInput!) {
         environmentVariable { createEnvironmentVariableForApp(appId: $appId, environmentVariableData: $data) { id } }
       }`,
      {
        appId,
        data: {
          name: input.name,
          value: input.value,
          visibility: mapVisibilityToApi(input.visibility),
          environments: input.environments,
          overwrite: true,
        },
      },
    );
  },

  /** Update an existing EAS environment variable by id (GraphQL). */
  async updateEnvVar(
    token: string,
    input: { id: string; name?: string; value?: string; visibility?: string; environments?: string[] },
  ): Promise<void> {
    const data: Record<string, unknown> = { id: input.id };
    if (input.name !== undefined) data.name = input.name;
    if (input.value !== undefined) data.value = input.value;
    if (input.visibility !== undefined) data.visibility = mapVisibilityToApi(input.visibility);
    if (input.environments !== undefined) data.environments = input.environments;
    await gql(
      token,
      `mutation UpdateEnvVar($data: UpdateEnvironmentVariableInput!) {
         environmentVariable { updateEnvironmentVariable(environmentVariableData: $data) { id } }
       }`,
      { data },
    );
  },

  /** Delete an EAS environment variable by id (GraphQL). */
  async deleteEnvVar(token: string, id: string): Promise<void> {
    await gql(
      token,
      `mutation DeleteEnvVar($id: ID!) {
         environmentVariable { deleteEnvironmentVariable(id: $id) { id } }
       }`,
      { id },
    );
  },

  /**
   * Recent builds for an EAS app via the GraphQL API — the authoritative source
   * (works regardless of whether `eas-cli` is installed on the connected
   * server). `appId` is the EAS projectId from the app config. Status/platform
   * are normalized to the lower-case, dash-separated form the UI styles by
   * (e.g. `IN_PROGRESS` → `in-progress`).
   */
  async builds(token: string, appId: string, limit = 20, offset = 0): Promise<ExpoBuild[]> {
    const data = await gql<BuildsData>(
      token,
      `query AppBuilds($id: String!, $limit: Int!, $offset: Int!) {
         app { byId(appId: $id) {
           name
           slug
           ownerAccount { name }
           builds(limit: $limit, offset: $offset) {
             id status platform appVersion buildProfile createdAt
             artifacts { applicationArchiveUrl buildUrl }
           }
         } }
       }`,
      { id: appId, limit, offset },
    );
    const node = data.app?.byId ?? null;
    const owner = node?.ownerAccount?.name ?? null;
    const slug = node?.slug ?? null;
    // The app this build belongs to (shown in the history table).
    const appName = node?.name ?? slug ?? null;
    return (node?.builds ?? []).map((b) => ({
      id: b.id,
      platform: (b.platform ?? "").toLowerCase(),
      status: (b.status ?? "").toLowerCase().replace(/_/g, "-"),
      profile: b.buildProfile ?? null,
      createdAt: b.createdAt ?? null,
      url:
        owner && slug
          ? `https://expo.dev/accounts/${owner}/projects/${slug}/builds/${b.id}`
          : (b.artifacts?.buildUrl ?? null),
      artifactUrl: b.artifacts?.applicationArchiveUrl ?? b.artifacts?.buildUrl ?? null,
      appVersion: b.appVersion ?? null,
      appName,
      appSlug: slug,
    }));
  },

  /**
   * Readable logs + structured failure for a single build. Reads the build's
   * `error` and signed `logFiles` URLs via GraphQL, downloads each log file
   * (brotli), parses the bunyan JSON-lines, and returns the (capped) newest
   * lines. Drives the build-history log viewer and the "analyze with AI" button.
   */
  async buildLogs(token: string, buildId: string): Promise<ExpoBuildLogs> {
    const data = await gql<{
      builds?: {
        byId?: {
          id: string;
          status?: string | null;
          error?: { errorCode?: string | null; message?: string | null; docsUrl?: string | null } | null;
          logFiles?: string[] | null;
        } | null;
      };
    }>(
      token,
      `query BuildLogs($id: ID!) {
         builds { byId(buildId: $id) {
           id status
           error { errorCode message docsUrl }
           logFiles
         } }
       }`,
      { id: buildId },
    );
    const node = data.builds?.byId;
    if (!node) throw new AppError("Build no encontrado en EAS.", 404, "EXPO_BUILD_NOT_FOUND");

    const error = node.error
      ? {
          errorCode: node.error.errorCode ?? null,
          message: node.error.message ?? null,
          docsUrl: node.error.docsUrl ?? null,
        }
      : null;

    // Log files are sequential phases; fetch in order and concatenate. Trim
    // progressively to LOG_MAX_LINES so a build with many/huge phases never
    // accumulates the whole history in memory before the final slice.
    let lines: ExpoBuildLogLine[] = [];
    let truncated = false;
    for (const url of node.logFiles ?? []) {
      const text = await fetchLogFile(url);
      if (!text) continue;
      lines = lines.concat(parseLogText(text));
      if (lines.length > LOG_MAX_LINES) {
        lines = lines.slice(-LOG_MAX_LINES);
        truncated = true;
      }
    }

    return {
      buildId: node.id,
      status: (node.status ?? "").toLowerCase().replace(/_/g, "-"),
      error,
      lines,
      truncated,
    };
  },

  /** Resolve the authenticated actor (account + owned account names). */
  async viewer(token: string): Promise<ExpoAccount> {
    const data = await gql<ViewerData>(
      token,
      `query Viewer { meActor { __typename ... on User { username accounts { name } } ... on Robot { firstName accounts { name } } } }`,
    );
    const actor = data.meActor;
    const username = (actor?.username ?? actor?.firstName ?? "").trim() || "desconocido";
    const accounts = (actor?.accounts ?? []).map((a) => a.name);
    return { username, accounts };
  },

  /**
   * Quota / plan via the Account subscription + usage metrics. Reads, all
   * account-level (no project needed):
   *   - plan name (`subscription.name`)
   *   - build concurrency (`subscription.concurrencies.total`)
   *   - this month's builds (`usageMetrics.metricsForServiceMetric(BUILDS)`)
   *   - plan build allotment (`planEnablement(BUILDS).total`) ⇒ remaining
   * Every field is read defensively (the Expo schema evolves); a missing field
   * resolves to null rather than throwing.
   */
  async quota(token: string): Promise<ExpoQuota> {
    // Calendar-month window (UTC) for "builds used this month".
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
    ).toISOString();
    const data = await gql<AccountQuotaData>(
      token,
      `query Quota($s: UsageMetricsTimespan!) { meActor { ... on User { ${QUOTA_ACCOUNT_FIELDS} } ... on Robot { ${QUOTA_ACCOUNT_FIELDS} } } }`,
      { s: { start, end } },
    );
    const first = data.meActor?.accounts?.[0];
    const sub = first?.subscription ?? null;
    const planName = (sub?.name ?? sub?.planId ?? null) || null;
    const concurrencies =
      typeof sub?.concurrencies?.total === "number" ? sub.concurrencies.total : null;
    const allotment = typeof sub?.planEnablement?.total === "number" ? sub.planEnablement.total : null;
    const metrics = first?.usageMetrics?.metricsForServiceMetric ?? [];
    const usedBuilds = metrics.length
      ? metrics.reduce((acc, m) => acc + (typeof m.value === "number" ? m.value : 0), 0)
      : null;
    const remainingBuilds =
      allotment !== null && usedBuilds !== null ? Math.max(0, allotment - usedBuilds) : null;
    return {
      planName,
      concurrencies,
      remainingBuilds,
      usedBuilds,
      buildsThisMonth: usedBuilds,
    };
  },
};
