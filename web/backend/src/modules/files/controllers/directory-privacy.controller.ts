// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Directory Privacy controller — password-protect a directory (Basic auth via
 * .htaccess + .htpasswd). Surfaced inside the Permissions modal of the files
 * manager. Everything runs on the connected client server via the Executor.
 */

import { z } from "zod";

import { pathOnlySchema } from "../../../shared/validators/index.js";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { directoryPrivacyService } from "../services/index.js";

const protectSchema = z.object({
  path: z.string().min(1),
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  realm: z.string().max(128).optional(),
});

const removeUserSchema = z.object({
  path: z.string().min(1),
  username: z.string().min(1).max(64),
});


const publishSchema = z.object({
  path: z.string().min(1),
  domain: z.string().min(1).max(255),
  site: z.string().max(255).optional(),
  urlPath: z.string().max(255).optional(),
  tls: z.boolean().optional(),
  // intentional max 254 (RFC 5321); see emailSchema (max 320) in shared/validators
  email: z.string().email().max(254).optional(),
});

export const directoryPrivacyController = {
  /** GET /api/files/privacy?path= — current protection state of a directory. */
  status: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse({ path: req.query["path"] });
    const executor = getExecutor(req);
    const data = await directoryPrivacyService.getStatus(executor, path);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/privacy/protect — enable/update protection (upsert user). */
  protect: asyncHandler(async (req: Request, res: Response) => {
    const body = protectSchema.parse(req.body);
    const executor = getExecutor(req);
    try {
      const data = await directoryPrivacyService.protect(executor, body.path, {
        username: body.username,
        password: body.password,
        realm: body.realm,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }),

  /** POST /api/files/privacy/user/remove — drop a user (last one → unprotect). */
  removeUser: asyncHandler(async (req: Request, res: Response) => {
    const body = removeUserSchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await directoryPrivacyService.removeUser(executor, body.path, body.username);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/privacy/unprotect — remove protection from a directory. */
  unprotect: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await directoryPrivacyService.unprotect(executor, path);
    res.json({ ok: true, data });
  }),

  /** GET /api/files/privacy/sites — enabled nginx sites a folder can publish under. */
  sites: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const data = await directoryPrivacyService.listPublishSites(executor);
    res.json({ ok: true, data });
  }),

  /** POST /api/files/privacy/publish — expose the folder under a chosen nginx site. */
  publish: asyncHandler(async (req: Request, res: Response) => {
    const body = publishSchema.parse(req.body);
    const executor = getExecutor(req);
    try {
      const data = await directoryPrivacyService.publish(executor, body.path, {
        domain: body.domain,
        site: body.site,
        urlPath: body.urlPath,
        tls: body.tls,
        email: body.email,
      });
      res.json({ ok: true, data });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }),

  /** POST /api/files/privacy/unpublish — remove the published exposure. */
  unpublish: asyncHandler(async (req: Request, res: Response) => {
    const { path } = pathOnlySchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await directoryPrivacyService.unpublish(executor, path);
    res.json({ ok: true, data });
  }),
};
