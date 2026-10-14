// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Repository-store controller — server-side proxy for the GitHub catalog.
 *
 * The /panel/repository-store UI used to call api.github.com directly from
 * the browser. An optional GitHub PAT is kept in panel settings and all
 * catalogue reads are proxied here; the token never reaches the client.
 *
 *   GET    /api/admin/repository-store/config   → { tokenConfigured, rateLimit }
 *   PUT    /api/admin/repository-store/config   { token }
 *   DELETE /api/admin/repository-store/config   → clears the token
 *   GET    /api/admin/repository-store/search?q=...&sort=...&order=...&per_page=...
 */

import type { Request, Response } from "express";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

import { asyncHandler } from "../../../shared/types/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { settingsRepository } from "../repositories/settings.repository.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { GITHUB_API } from "../../../shared/constants.js";
import { env } from "../../../config/env.js";
import { apiModuleMessage, localizeRepoCloneStatus } from "../../../shared/i18n/module-messages.js";
import { authConfig } from "../../../config/auth.js";
import { encrypt, decrypt, sha256 } from "../../../shared/utils/crypto.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { assertCanonicalFilePathPermission } from "../../files/middlewares/role-file-permissions.middleware.js";
import { gitService } from "../../files/services/git.service.js";
import { repositoryStoreState } from "../services/repository-store-state.service.js";
import type { SessionUser } from "../../../shared/types/index.js";
import { hasActionPermission } from "../../auth/services/role-permissions.service.js";
import { apiResponseMessage } from "../../../shared/i18n/responses.js";

const log = createModuleLogger("repository-store");
function localizedClone<T extends { statusError?: string }>(locale: unknown, clone: T): T {
  return clone.statusError ? { ...clone, statusError: localizeRepoCloneStatus(locale, clone.statusError) } : clone;
}
/** Timeout (ms) for GitHub REST API calls (repo contents/README). */
const GITHUB_API_TIMEOUT_MS = 15_000;
/** Shorter timeout (ms) for the GitHub rate-limit probe. */
const GITHUB_RL_PROBE_TIMEOUT_MS = 8_000;

// README HTML comes rendered from GitHub; GitHub sanitizes, but the panel must
// not trust it blindly (the frontend renders it into the DOM). Re-sanitize with
// a conservative allowlist so an upstream change can't become stored XSS in an
// admin session. `img`/`a` allowed but scripts, styles, iframes, event handlers
// and `javascript:` URLs are stripped.
const README_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "blockquote", "pre",
    "code", "span", "div", "a", "img", "ul", "ol", "li", "table", "thead",
    "tbody", "tr", "th", "td", "b", "i", "strong", "em", "del", "sup", "sub",
    "kbd", "details", "summary", "dl", "dt", "dd",
  ],
  allowedAttributes: {
    a: ["href", "name", "title"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["align"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }, true),
  },
};

const TOKEN_KEY = "repository_store.github_token";
const TOKEN_CATEGORY = "repository-store";
const TOKEN_PREFIX = "enc:v1:";
function tokenKey(): string {
  return env.CREDENTIAL_VAULT_KEY || sha256(`repository-store:${authConfig.jwt.secret}`);
}

const tokenSchema = z.object({
  token: z.string().min(20).max(255),
});

const searchSchema = z.object({
  q: z.string().min(1).max(512).refine((query) => !/\b(?:is|visibility):(?:private|internal)\b/i.test(query), "Solo se permiten búsquedas públicas"),
  sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  per_page: z.coerce.number().int().min(1).max(100).default(36),
  page: z.coerce.number().int().min(1).max(100).default(1),
});

const readmeSchema = z.object({
  owner: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/).refine((value) => value !== "." && value !== ".."),
  name:  z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/).refine((value) => value !== "." && value !== ".."),
});
const fullNameSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/)
  .refine((value) => value.split("/").every((segment) => segment !== "." && segment !== ".."));
const savedSchema = z.object({ fullNames: z.array(fullNameSchema).min(1).max(500), saved: z.boolean() });
const prefsSchema = z.object({
  defaultTab: z.enum(["all", "saved", "cloned", "update"]).optional(),
  sort: z.enum(["relevance", "stars_desc", "stars_asc", "updated_desc", "name_asc"]).optional(),
  pageSize: z.union([z.literal(24), z.literal(36), z.literal(60)]).optional(),
  showArchived: z.boolean().optional(),
  cloneParent: z.string().max(4096).regex(/^\//).optional(),
  transport: z.enum(["https", "ssh"]).optional(),
});
const cloneSchema = z.object({ fullName: fullNameSchema, dest: z.string().min(2).max(4096).regex(/^\//), transport: z.enum(["https", "ssh"]), credentialId: z.string().optional() });
const linkSchema = z.object({ fullName: fullNameSchema, path: z.string().min(2).max(4096).regex(/^\//) });
const checkSchema = z.object({ credentialId: z.string().optional() });

function userOf(res: Response): SessionUser { return res.locals.user as SessionUser; }
export function remoteFullName(url: string): string | null {
  const match = url.match(/^(?:https:\/\/github\.com\/|ssh:\/\/git@github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
  return match?.[1]?.toLowerCase() ?? null;
}
async function visibleClone(req: Request, res: Response, id: string) {
  const executor = getExecutor(req);
  const clone = await repositoryStoreState.clone(executor, id);
  if (!clone) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoCloneUnregistered"));
  await assertCanonicalFilePathPermission(executor, userOf(res), clone.path, "read");
  return clone;
}
async function verifiedClone(req: Request, res: Response, id: string, operation: "read" | "write") {
  const clone = await visibleClone(req, res, id);
  const executor = getExecutor(req);
  await assertCanonicalFilePathPermission(executor, userOf(res), clone.path, operation);
  const status = await gitService.status(executor, clone.path);
  if (!status.isRepo || status.root !== clone.path) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoCloneRootChanged"));
  const remote = await gitService.remote(executor, clone.path);
  if (!remote || remoteFullName(remote.url) !== clone.fullName.toLowerCase()) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoCloneRemoteChanged"));
  return clone;
}

async function readToken(): Promise<string | null> {
  const value = await settingsRepository.get(TOKEN_KEY);
  if (!value) return null;
  if (value.startsWith(TOKEN_PREFIX)) {
    try { return decrypt(value.slice(TOKEN_PREFIX.length), tokenKey()); }
    catch { log.warn("GitHub token could not be decrypted"); return null; }
  }
  // Migrate the legacy cleartext value on first use. Never return it to HTTP.
  await settingsRepository.set(TOKEN_KEY, TOKEN_PREFIX + encrypt(value, tokenKey()), TOKEN_CATEGORY);
  return value;
}

async function fetchFromGithub(path: string, params: URLSearchParams): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
  rateLimit: { remaining: number | null; limit: number | null; resetAt: number | null };
  error?: string;
}> {
  const token = await readToken();
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "luxipanel-repository-store",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${GITHUB_API}${path}?${params.toString()}`;

  let ghRes: globalThis.Response;
  try {
    ghRes = await fetch(url, { headers, signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS) });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      rateLimit: { remaining: null, limit: null, resetAt: null },
      error: err instanceof Error ? err.message : "GitHub fetch failed",
    };
  }

  const numberHeader = (name: string) => {
    const value = ghRes.headers.get(name);
    return value === null ? null : Number(value);
  };
  const remaining = numberHeader("x-ratelimit-remaining");
  const limit = numberHeader("x-ratelimit-limit");
  const reset = numberHeader("x-ratelimit-reset");
  const rateLimit = {
    remaining: remaining !== null && Number.isFinite(remaining) ? remaining : null,
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    resetAt: reset !== null && Number.isFinite(reset) ? reset * 1000 : null,
  };

  let body: unknown = null;
  try { body = await ghRes.json(); } catch { /* ignore */ }

  return { ok: ghRes.ok, status: ghRes.status, body, rateLimit };
}

async function publicRepoAccess(owner: string, name: string): Promise<{ allowed: boolean; status: number }> {
  const result = await fetchFromGithub(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, new URLSearchParams());
  if (!result.ok) return { allowed: false, status: result.status || 502 };
  if (!isPublicRepoBody(result.body)) return { allowed: false, status: 404 };
  return { allowed: true, status: 200 };
}
export function isPublicRepoBody(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && (body as { private?: boolean }).private === false);
}
export function publicSearchBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return null;
  const response = body as { items?: unknown[] };
  return { ...response, items: Array.isArray(response.items) ? response.items.filter(isPublicRepoBody) : [] };
}

export const repositoryStoreController = {
  /** Public catalogue state for the current user and connected server. */
  getState: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const user = userOf(res);
    const [own, allClones] = await Promise.all([
      repositoryStoreState.user(executor, user.userId), repositoryStoreState.listClones(executor),
    ]);
    const clones = (await Promise.all(allClones.map(async (clone) => {
      try { await assertCanonicalFilePathPermission(executor, user, clone.path, "read"); return clone; }
      catch { return null; }
    }))).filter((clone) => clone !== null);
    res.json({ ok: true, data: { saved: own.saved, preferences: own.preferences, clones: clones.map((clone) => localizedClone(res.locals.locale, clone)) } });
  }),
  patchPreferences: asyncHandler(async (req: Request, res: Response) => {
    const patch = prefsSchema.parse(req.body);
    const executor = getExecutor(req);
    const user = userOf(res);
    const previous = await repositoryStoreState.user(executor, user.userId);
    if (patch.cloneParent && patch.cloneParent !== previous.preferences.cloneParent) {
      if (!hasActionPermission(user, "files.git")) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoGitPermissionRequired"));
      await assertCanonicalFilePathPermission(executor, user, patch.cloneParent, "write");
    }
    const own = await repositoryStoreState.patchUser(executor, user.userId, { preferences: patch });
    res.json({ ok: true, data: own.preferences });
  }),
  changeSaved: asyncHandler(async (req: Request, res: Response) => {
    const body = savedSchema.parse(req.body);
    const own = await repositoryStoreState.changeSaved(getExecutor(req), userOf(res).userId, body.fullNames, body.saved);
    res.json({ ok: true, data: { saved: own.saved } });
  }),
  getRepo: asyncHandler(async (req: Request, res: Response) => {
    const parsed = readmeSchema.parse(req.params);
    const result = await fetchFromGithub(`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`, new URLSearchParams());
    if (result.ok && !isPublicRepoBody(result.body)) {
      res.status(404).json({ ok: false, error: apiModuleMessage(res.locals.locale, "repoPublicNotFound") }); return;
    }
    res.status(result.ok ? 200 : (result.status || 502)).json({ ok: result.ok, data: result.ok ? result.body : null, status: result.status, rateLimit: result.rateLimit, error: result.ok ? undefined : "No se pudo cargar el repositorio" });
  }),
  clone: asyncHandler(async (req: Request, res: Response) => {
    const body = cloneSchema.parse(req.body);
    const [owner, name] = body.fullName.split("/") as [string, string];
    const access = await publicRepoAccess(owner, name);
    if (!access.allowed) { res.status(access.status === 404 ? 404 : 503).json({ ok: false, error: apiModuleMessage(res.locals.locale, access.status === 404 ? "repoPublicNotFound" : "repoValidationUnavailable") }); return; }
    const executor = getExecutor(req);
    await assertCanonicalFilePathPermission(executor, userOf(res), body.dest, "write");
    const clones = await repositoryStoreState.listClones(executor);
    if (clones.some((record) => record.path === body.dest)) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoFolderRegistered"));
    const url = body.transport === "ssh" ? `git@github.com:${body.fullName}.git` : `https://github.com/${body.fullName}.git`;
    const result = await gitService.clone(executor, url, body.dest, undefined, body.credentialId);
    if (!result.ok || !result.dest) { res.status(400).json({ ok: false, error: localizeRepoCloneStatus(res.locals.locale, result.message) }); return; }
    const status = await gitService.status(executor, result.dest);
    const clone = await repositoryStoreState.register(executor, { fullName: body.fullName, path: result.dest, branch: status.branch || "" });
    res.status(201).json({ ok: true, data: clone });
  }),
  linkClone: asyncHandler(async (req: Request, res: Response) => {
    const body = linkSchema.parse(req.body);
    const [owner, name] = body.fullName.split("/") as [string, string];
    const access = await publicRepoAccess(owner, name);
    if (!access.allowed) { res.status(access.status === 404 ? 404 : 503).json({ ok: false, error: apiModuleMessage(res.locals.locale, access.status === 404 ? "repoPublicNotFound" : "repoValidationUnavailable") }); return; }
    const executor = getExecutor(req);
    await assertCanonicalFilePathPermission(executor, userOf(res), body.path, "read");
    const status = await gitService.status(executor, body.path);
    if (!status.isRepo || status.root !== body.path) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoSelectRoot"));
    const remote = await gitService.remote(executor, body.path);
    if (!remote || remoteFullName(remote.url) !== body.fullName.toLowerCase()) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoRemoteMismatch"));
    const clones = await repositoryStoreState.listClones(executor);
    if (clones.some((record) => record.path === body.path)) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoFolderRegistered"));
    const clone = await repositoryStoreState.register(executor, { fullName: body.fullName, path: body.path, branch: status.branch || "" });
    res.status(201).json({ ok: true, data: clone });
  }),
  unlinkClone: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    await visibleClone(req, res, id);
    await repositoryStoreState.unlink(getExecutor(req), id);
    res.json({ ok: true });
  }),
  checkClone: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const body = checkSchema.parse(req.body ?? {});
    const clone = await verifiedClone(req, res, id, "write");
    const result = await gitService.checkRemote(getExecutor(req), clone.path, body.credentialId);
    const branchChanged = result.ok && result.branch !== clone.branch;
    const updated = { ...clone, checkedAt: new Date().toISOString(), ahead: result.ahead, behind: result.behind, dirty: result.dirty,
      statusError: branchChanged ? `La rama actual (${result.branch}) difiere de la registrada (${clone.branch})` : result.ok ? undefined : result.message };
    await repositoryStoreState.updateClone(getExecutor(req), updated);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: localizedClone(res.locals.locale, updated), error: result.ok ? undefined : localizeRepoCloneStatus(res.locals.locale, result.message) });
  }),
  updateClone: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const body = checkSchema.parse(req.body ?? {});
    const clone = await verifiedClone(req, res, id, "write");
    const executor = getExecutor(req);
    const check = await gitService.checkRemote(executor, clone.path, body.credentialId);
    if (!check.ok || check.dirty || check.ahead > 0 || !check.branch || check.branch !== clone.branch) {
      res.status(409).json({ ok: false, error: check.message ? localizeRepoCloneStatus(res.locals.locale, check.message) : apiModuleMessage(res.locals.locale, "repoNeedsReview") }); return;
    }
    if (check.behind === 0) {
      const updated = { ...clone, checkedAt: new Date().toISOString(), ahead: 0, behind: 0, dirty: false, statusError: undefined };
      await repositoryStoreState.updateClone(executor, updated);
      res.json({ ok: true, data: { message: apiResponseMessage(res.locals.locale, "alreadyUpToDate"), clone: updated } }); return;
    }
    const pulled = await gitService.pull(executor, clone.path, body.credentialId);
    if (!pulled.ok) { res.status(409).json({ ok: false, error: localizeRepoCloneStatus(res.locals.locale, pulled.message) }); return; }
    const updated = { ...clone, checkedAt: new Date().toISOString(), ahead: 0, behind: 0, dirty: false, statusError: undefined };
    await repositoryStoreState.updateClone(executor, updated);
    res.json({ ok: true, data: { message: pulled.message, clone: updated } });
  }),
  /** GET /api/admin/repository-store/config — token state + current rate-limit window. */
  getConfig: asyncHandler(async (_req: Request, res: Response) => {
    const token = await readToken();
    let tokenValid: boolean | null = null;
    let rateLimit: { remaining: number | null; limit: number | null; resetAt: number | null; authenticated: boolean } = {
      remaining: null,
      limit: null,
      resetAt: null,
      authenticated: Boolean(token),
    };
    // Best-effort: hit /rate_limit so the UI shows the current state.
    try {
      const headers: Record<string, string> = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "luxipanel-repository-store",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${GITHUB_API}/rate_limit`, { headers, signal: AbortSignal.timeout(GITHUB_RL_PROBE_TIMEOUT_MS) });
      if (token) tokenValid = r.status === 401 ? false : r.ok ? true : null;
      if (r.ok) {
        const json = (await r.json()) as { resources?: { search?: { limit: number; remaining: number; reset: number } } };
        const search = json.resources?.search;
        if (search) {
          rateLimit = {
            limit: search.limit,
            remaining: search.remaining,
            resetAt: search.reset * 1000,
            authenticated: Boolean(token),
          };
        }
      }
    } catch {
      // The UI reports an unavailable value until GitHub responds.
    }

    res.json({
      ok: true,
      data: {
        tokenConfigured: Boolean(token),
        tokenValid,
        rateLimit,
      },
    });
  }),

  /** PUT /api/admin/repository-store/config — save a GitHub PAT. */
  setConfig: asyncHandler(async (req: Request, res: Response) => {
    const body = tokenSchema.parse(req.body);
    const trimmed = body.token.trim();
    if (!trimmed) throw new ValidationError(apiModuleMessage(res.locals.locale, "repoTokenRequired"));
    await settingsRepository.set(
      TOKEN_KEY,
      TOKEN_PREFIX + encrypt(trimmed, tokenKey()),
      TOKEN_CATEGORY,
      "GitHub Personal Access Token (used by /panel/repository-store)",
    );
    log.info("GitHub token updated");
    res.json({ ok: true, data: { tokenConfigured: true } });
  }),

  /** DELETE /api/admin/repository-store/config — clear the token. */
  clearConfig: asyncHandler(async (_req: Request, res: Response) => {
    await settingsRepository.delete(TOKEN_KEY);
    log.info("GitHub token cleared");
    res.json({ ok: true, data: { tokenConfigured: false } });
  }),

  /**
   * GET /api/admin/repository-store/readme?owner=X&name=Y — fetch the
   * rendered HTML of a repo's README. Uses the stored token if available.
   * Returns `{ ok, html }` or `{ ok: false, error, status }`.
   */
  getReadme: asyncHandler(async (req: Request, res: Response) => {
    const parsed = readmeSchema.parse(req.query);
    const access = await publicRepoAccess(parsed.owner, parsed.name);
    if (!access.allowed) {
      res.status(access.status).json({ ok: false, status: access.status, error: apiModuleMessage(res.locals.locale, access.status === 404 ? "repoPublicNotFound" : "repoReadmeUnavailable") }); return;
    }
    const token = await readToken();
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.html",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "luxipanel-repository-store",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${GITHUB_API}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}/readme`;
    let ghRes: globalThis.Response;
    try {
      ghRes = await fetch(url, { headers, signal: AbortSignal.timeout(GITHUB_API_TIMEOUT_MS) });
    } catch (err) {
      res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "GitHub fetch failed" });
      return;
    }

    if (!ghRes.ok) {
      const status = ghRes.status;
      let detail = "";
      try {
        const errJson = await ghRes.json() as { message?: string };
        detail = errJson?.message ?? "";
      } catch { /* ignore */ }
      res.status(status).json({
        ok: false,
        status,
        error: status === 404 ? "Este repositorio no tiene README." : (detail || `GitHub respondió ${status}`),
      });
      return;
    }

    const rawHtml = await ghRes.text();
    const html = sanitizeHtml(rawHtml, README_SANITIZE_OPTIONS);
    res.json({ ok: true, html });
  }),

  /**
   * GET /api/admin/repository-store/search — proxy to GitHub's repositories
   * search. GitHub reports its search-specific limit in the response headers.
   */
  search: asyncHandler(async (req: Request, res: Response) => {
    const parsed = searchSchema.parse(req.query);
    const params = new URLSearchParams();
    params.set("q", `${parsed.q} is:public`);
    params.set("per_page", String(parsed.per_page));
    params.set("page", String(parsed.page));
    if (parsed.sort) params.set("sort", parsed.sort);
    if (parsed.order) params.set("order", parsed.order);

    const result = await fetchFromGithub("/search/repositories", params);

    res.status(result.ok ? 200 : (result.status || 502)).json({
      ok: result.ok,
      data: result.ok ? publicSearchBody(result.body) : null,
      error: result.ok ? undefined : result.error,
      status: result.status,
      rateLimit: result.rateLimit,
      githubBody: result.ok ? undefined : result.body,
    });
  }),
};
