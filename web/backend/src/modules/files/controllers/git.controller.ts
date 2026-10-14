// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Git controller — phase 1 local work-tree operations (#14).
 */

import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import type { AuthenticatedLocals } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { quoteCmd } from "../../../shared/executor/index.js";
import { gitService, gitCredentialsService, gitSshService } from "../services/index.js";
import { apiModuleMessage, localizeGitServiceMessage } from "../../../shared/i18n/module-messages.js";
import { apiErrorMessage } from "../../../shared/i18n/errors.js";

function gitMessage(res: Response, source: string): string {
  return localizeGitServiceMessage(res.locals.locale, source);
}

// ── Git SSH manager (#14) — validated, shell-injection-safe inputs ──
const userField = z.string().regex(/^[a-z_][a-z0-9_-]{0,31}$/i, "usuario inválido").optional();
const hostField = z.string().regex(/^[a-z0-9.-]{1,253}$/i, "host inválido").optional();
const idFileField = z.string().regex(/^[~/][\w.@/-]{0,255}$/, "ruta de llave inválida");
const repoField = z.string().min(1).max(4096).regex(/^\//, "ruta de repo inválida (absoluta)");

const sshTestSchema = z.object({ user: userField, identityFile: idFileField.optional(), host: hostField, verbose: z.boolean().optional() });
const sshConfigSetSchema = z.object({ user: userField, host: hostField, hostName: hostField, identityFile: idFileField, identitiesOnly: z.boolean().optional() });
const sshFixSchema = z.object({ user: userField });
const sshRepoSetSchema = z.object({ path: repoField, identityFile: idFileField.optional(), unset: z.boolean().optional(), user: userField });

const commitSchema = z.object({ path: z.string().min(1), message: z.string().min(1), all: z.boolean().default(true) });
const discardSchema = z.object({ path: z.string().min(1), paths: z.array(z.string()).optional(), clean: z.boolean().default(false) });
const branchSchema = z.object({ path: z.string().min(1), branch: z.string().min(1).max(200) });
const syncSchema = z.object({ path: z.string().min(1), credentialId: z.string().optional() });
const cloneSchema = z.object({ url: z.string().min(1).max(2048), dest: z.string().min(1), branch: z.string().max(200).optional(), credentialId: z.string().optional() });
const deploySchema = z.object({ path: z.string().min(1), branch: z.string().min(1).max(200), credentialId: z.string().optional() });
const credCreateSchema = z.object({
  label: z.string().min(1).max(120),
  type: z.enum(["https", "ssh"]),
  host: z.string().min(1).max(255),
  username: z.string().max(255).optional(),
  secret: z.string().min(1),
});

// Update: campos opcionales. `secret` solo se re-cifra si llega un valor no
// vacío (en blanco = conservar el secreto guardado — nunca se vuelve a mostrar).
const credUpdateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  type: z.enum(["https", "ssh"]).optional(),
  host: z.string().min(1).max(255).optional(),
  username: z.string().max(255).optional(),
  secret: z.string().min(1).optional(),
});

// Server-side detected auth (modifies the connected server's real files/config).
const srvHttpsSaveSchema = z.object({
  host: z.string().min(1).max(255),
  username: z.string().min(1).max(255),
  secret: z.string().min(1),
  matchHost: z.string().max(255).optional(),
  matchUser: z.string().max(255).optional(),
});
const srvHttpsDeleteSchema = z.object({ host: z.string().min(1).max(255), username: z.string().max(255).optional() });
const srvSshDeleteSchema = z.object({ name: z.string().min(1).max(128) });
const srvGhLogoutSchema = z.object({ host: z.string().min(1).max(255) });
const srvGitConfigSchema = z.object({ userName: z.string().max(255).optional(), userEmail: z.string().max(320).optional() });

function authorOf(res: Response): { name: string; email: string } {
  const user = (res.locals as AuthenticatedLocals).user;
  const name = user?.displayName || user?.username || "LUXIPANEL";
  const email = `${user?.username || "panel"}@luxipanel.local`;
  return { name, email };
}

export const gitController = {
  /** GET /api/files/git/status?path= */
  status: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const data = await gitService.status(getExecutor(req), path);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/git/in-repo?path= — lightweight repo membership check. */
  inRepo: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const data = await gitService.inRepo(getExecutor(req), path);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/git/commit */
  commit: asyncHandler(async (req: Request, res: Response) => {
    const body = commitSchema.parse(req.body);
    const result = await gitService.commit(getExecutor(req), body.path, body.message, body.all, authorOf(res));
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/discard */
  discard: asyncHandler(async (req: Request, res: Response) => {
    const body = discardSchema.parse(req.body);
    const result = await gitService.discard(getExecutor(req), body.path, body.paths, body.clean);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/checkout — switch to an existing branch. */
  checkout: asyncHandler(async (req: Request, res: Response) => {
    const body = branchSchema.parse(req.body);
    const result = await gitService.switchBranch(getExecutor(req), body.path, body.branch);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/branch — create and switch to a new branch. */
  branch: asyncHandler(async (req: Request, res: Response) => {
    const body = branchSchema.parse(req.body);
    const result = await gitService.createBranch(getExecutor(req), body.path, body.branch);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/pull — fast-forward pull (uses a matching credential). */
  pull: asyncHandler(async (req: Request, res: Response) => {
    const body = syncSchema.parse(req.body);
    const result = await gitService.pull(getExecutor(req), body.path, body.credentialId);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/push — push current branch (uses a matching credential). */
  push: asyncHandler(async (req: Request, res: Response) => {
    const body = syncSchema.parse(req.body);
    const result = await gitService.push(getExecutor(req), body.path, body.credentialId);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/clone — clone a repo into dest (uses a credential). */
  clone: asyncHandler(async (req: Request, res: Response) => {
    const body = cloneSchema.parse(req.body);
    const result = await gitService.clone(getExecutor(req), body.url, body.dest, body.branch, body.credentialId);
    res.status(result.ok ? 201 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message), dest: result.dest }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  /** POST /api/files/git/deploy — checkout branch + fast-forward pull. */
  deploy: asyncHandler(async (req: Request, res: Response) => {
    const body = deploySchema.parse(req.body);
    const result = await gitService.deploy(getExecutor(req), body.path, body.branch, body.credentialId);
    res.status(result.ok ? 200 : 400).json({ ok: result.ok, data: { message: gitMessage(res, result.message) }, error: result.ok ? undefined : gitMessage(res, result.message) });
  }),

  // ── Credentials (encrypted at rest, never returned in clear) ──
  /** GET /api/files/git/credentials */
  listCredentials: asyncHandler(async (req: Request, res: Response) => {
    if (!gitCredentialsService.enabled()) {
      res.json({ ok: true, data: { enabled: false, credentials: [] } });
      return;
    }
    const credentials = await gitCredentialsService.list(getExecutor(req));
    res.json({ ok: true, data: { enabled: true, credentials } });
  }),

  /** POST /api/files/git/credentials */
  createCredential: asyncHandler(async (req: Request, res: Response) => {
    if (!gitCredentialsService.enabled()) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "gitKeyMissing") });
      return;
    }
    const body = credCreateSchema.parse(req.body);
    const cred = await gitCredentialsService.create(getExecutor(req), body);
    res.status(201).json({ ok: true, data: cred });
  }),

  /** PUT /api/files/git/credentials/:id */
  updateCredential: asyncHandler(async (req: Request, res: Response) => {
    if (!gitCredentialsService.enabled()) {
      res.status(400).json({ ok: false, error: apiModuleMessage(res.locals.locale, "gitKeyMissing") });
      return;
    }
    const id = String(req.params["id"]);
    const body = credUpdateSchema.parse(req.body);
    const cred = await gitCredentialsService.update(getExecutor(req), id, body);
    if (!cred) {
      res.status(404).json({ ok: false, error: apiErrorMessage(res.locals.locale, "notFound") });
      return;
    }
    res.json({ ok: true, data: cred });
  }),

  /** DELETE /api/files/git/credentials/:id */
  deleteCredential: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params["id"]);
    const ok = await gitCredentialsService.remove(getExecutor(req), id);
    res.status(ok ? 200 : 404).json({ ok, error: ok ? undefined : apiErrorMessage(res.locals.locale, "notFound") });
  }),

  /** GET /api/files/git/detect — git/GitHub auth already on the client server. */
  detectCredentials: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const [data, version] = await Promise.all([
      gitCredentialsService.detectServerCredentials(executor),
      executor.exec(quoteCmd("git", ["--version"]), { timeoutMs: 8_000 }).catch(() => null),
    ]);
    res.json({ ok: true, data: { ...data, git: { installed: version?.exitCode === 0, version: version?.exitCode === 0 ? version.stdout.trim() : null } } });
  }),

  // ── Manage the DETECTED server-side auth (edits real files/config) ──────────
  /** POST /api/files/git/server/https — add/edit an HTTPS ~/.git-credentials entry. */
  saveServerHttps: asyncHandler(async (req: Request, res: Response) => {
    const body = srvHttpsSaveSchema.parse(req.body);
    await gitCredentialsService.saveServerHttps(getExecutor(req), body);
    res.json({ ok: true });
  }),
  /** POST /api/files/git/server/https/delete — remove an HTTPS entry. */
  deleteServerHttps: asyncHandler(async (req: Request, res: Response) => {
    const body = srvHttpsDeleteSchema.parse(req.body);
    await gitCredentialsService.deleteServerHttps(getExecutor(req), body);
    res.json({ ok: true });
  }),
  /** POST /api/files/git/server/ssh/delete — delete a private key (+ .pub). */
  deleteServerSshKey: asyncHandler(async (req: Request, res: Response) => {
    const body = srvSshDeleteSchema.parse(req.body);
    await gitCredentialsService.deleteServerSshKey(getExecutor(req), body);
    res.json({ ok: true });
  }),
  /** POST /api/files/git/server/gh/logout — gh auth logout --hostname <host>. */
  ghLogout: asyncHandler(async (req: Request, res: Response) => {
    const body = srvGhLogoutSchema.parse(req.body);
    await gitCredentialsService.ghLogout(getExecutor(req), body);
    res.json({ ok: true });
  }),
  /** POST /api/files/git/server/config — set global git identity. */
  setGitConfig: asyncHandler(async (req: Request, res: Response) => {
    const body = srvGitConfigSchema.parse(req.body);
    await gitCredentialsService.setGitConfig(getExecutor(req), body);
    res.json({ ok: true });
  }),

  // ── SSH manager (diagnose & configure the SSH key a Linux user uses for git) ──
  /** GET /api/files/git/ssh/env?user= — whoami, ~/.ssh listing, detected keys. */
  sshEnv: asyncHandler(async (req: Request, res: Response) => {
    const user = userField.parse(req.query["user"] || undefined);
    const data = await gitSshService.inspectEnvironment(getExecutor(req), { user });
    res.json({ ok: true, data });
  }),

  /** GET /api/files/git/ssh/users — Linux users for the target selector. */
  sshUsers: asyncHandler(async (req: Request, res: Response) => {
    const data = await gitSshService.listUsers(getExecutor(req));
    res.json({ ok: true, data });
  }),

  /** POST /api/files/git/ssh/test — `ssh -T git@host` (optionally as user / key). */
  sshTest: asyncHandler(async (req: Request, res: Response) => {
    const body = sshTestSchema.parse(req.body);
    const data = await gitSshService.testGithub(getExecutor(req), body);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/git/ssh/config?user= — read a user's ~/.ssh/config. */
  sshConfigGet: asyncHandler(async (req: Request, res: Response) => {
    const user = userField.parse(req.query["user"] || undefined);
    const data = await gitSshService.readConfig(getExecutor(req), { user });
    res.json({ ok: true, data });
  }),

  /** POST /api/files/git/ssh/config — upsert the Host block + fix perms. */
  sshConfigSet: asyncHandler(async (req: Request, res: Response) => {
    const body = sshConfigSetSchema.parse(req.body);
    const data = await gitSshService.writeGithubConfig(getExecutor(req), body);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/git/ssh/fix-permissions — chmod ~/.ssh tree. */
  sshFixPermissions: asyncHandler(async (req: Request, res: Response) => {
    const body = sshFixSchema.parse(req.body);
    const data = await gitSshService.fixPermissions(getExecutor(req), body);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/git/ssh/repo-key?path= — read a repo's core.sshCommand. */
  sshRepoGet: asyncHandler(async (req: Request, res: Response) => {
    const repo = repoField.parse(req.query["path"]);
    const user = userField.parse(req.query["user"] || undefined);
    const data = await gitSshService.getRepoSshCommand(getExecutor(req), { repo, user });
    res.json({ ok: true, data });
  }),

  /** POST /api/files/git/ssh/repo-key — set/unset a repo's core.sshCommand. */
  sshRepoSet: asyncHandler(async (req: Request, res: Response) => {
    const body = sshRepoSetSchema.parse(req.body);
    const data = await gitSshService.setRepoSshCommand(getExecutor(req), {
      repo: body.path,
      identityFile: body.identityFile,
      unset: body.unset,
      user: body.user,
    });
    res.json({ ok: true, data });
  }),
};
