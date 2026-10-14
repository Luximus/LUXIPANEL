const buildWindowSnapshots = new Map<string,{at:number;items:Awaited<ReturnType<typeof expoService.buildList>>}>();
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Expo controller — REST endpoints for the /panel/expo view.
 *
 * Every handler resolves the per-request executor via getExecutor(req) so all
 * EAS CLI work runs on the CONNECTED server. Token storage resolves its own
 * per-request executor through the settings repository context (ALS), like
 * every other settings consumer. Errors travel as typed AppError — never
 * res.status(500).
 */

import type { Request, Response } from "express";
import { asyncHandler } from "../../../shared/types/index.js";
import { getExecutor } from "../../../shared/executor/index.js";
import {
  appleCredentialSchema,
  buildCancelSchema,
  buildListSchema,
  buildLogsSchema,
  buildSchema,
  buildViewSchema,
  deviceCreateSchema,
  devClientSchema,
  envDeleteSchema,
  envListSchema,
  envSetSchema,
  envUpdateSchema,
  googleCredentialSchema,
  createAppSchema,
  createStatusSchema,
  initProjectSchema,
  linkProjectSchema,
  projectPathSchema,
  saveConfigSchema,
  scanProjectsSchema,
  storeCredentialsSchema,
  submitSchema,
  updatePublishSchema,
  webhookCreateSchema,
} from "../models/index.js";
import { expoConfigService } from "../services/expo-config.service.js";
import { expoService } from "../services/expo.service.js";
import { localizeExpoCreateMessage } from "./expo-create-i18n.js";

export const expoController = {
  /** GET /api/expo/config — token presence + masked preview only. */
  getConfig: asyncHandler(async (_req: Request, res: Response) => {
    const config = await expoConfigService.getConfig();
    res.json({ ok: true, data: config });
  }),

  /** PUT /api/expo/config — store the access token. */
  saveConfig: asyncHandler(async (req: Request, res: Response) => {
    const { token } = saveConfigSchema.parse(req.body);
    await expoConfigService.saveToken(token);
    const config = await expoConfigService.getConfig();
    res.json({ ok: true, data: config });
  }),

  /** DELETE /api/expo/config — remove the stored token. */
  clearConfig: asyncHandler(async (req: Request, res: Response) => {
    await expoConfigService.clearToken(getExecutor(req));
    res.json({ ok: true });
  }),

  /** GET /api/expo/whoami — logged-in Expo account on the connected server. */
  whoami: asyncHandler(async (req: Request, res: Response) => {
    const executor = getExecutor(req);
    const me = await expoService.whoami(executor);
    res.json({ ok: true, data: me });
  }),

  /** GET /api/expo/account — account + owned accounts via GraphQL. */
  account: asyncHandler(async (_req: Request, res: Response) => {
    const account = await expoService.account();
    res.json({ ok: true, data: account });
  }),

  /** GET /api/expo/projects?root=… — scan the connected server for projects. */
  listProjects: asyncHandler(async (req: Request, res: Response) => {
    const { root } = scanProjectsSchema.parse(req.query);
    const executor = getExecutor(req);
    const projects = await expoService.listProjects(executor, root);
    res.json({ ok: true, data: projects });
  }),

  /** POST /api/expo/project-info — full info for one project path. */
  projectInfo: asyncHandler(async (req: Request, res: Response) => {
    const { path } = projectPathSchema.parse(req.body);
    const executor = getExecutor(req);
    const info = await expoService.projectInfo(executor, path);
    res.json({ ok: true, data: info });
  }),

  /** POST /api/expo/init — create-expo-app + eas init. */
  initProject: asyncHandler(async (req: Request, res: Response) => {
    const input = initProjectSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.initProject(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/link — link existing project to EAS. */
  linkProject: asyncHandler(async (req: Request, res: Response) => {
    const input = linkProjectSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.linkProject(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/create-app — scaffold a new app, detached (poll create-status). */
  createApp: asyncHandler(async (req: Request, res: Response) => {
    const input = createAppSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.startCreateApp(executor, input);
    res.json({ ok: true, data: { ...result, message: localizeExpoCreateMessage(res.locals.locale, result.message) } });
  }),

  /** POST /api/expo/create-status — poll a detached create job. */
  createAppStatus: asyncHandler(async (req: Request, res: Response) => {
    const input = createStatusSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.createAppStatus(executor, input);
    res.json({ ok: true, data: { ...result, message: localizeExpoCreateMessage(res.locals.locale, result.message) } });
  }),

  /** POST /api/expo/build — start an EAS build. */
  build: asyncHandler(async (req: Request, res: Response) => {
    const input = buildSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.build(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/build-list — recent builds (json). */
  buildList: asyncHandler(async (req: Request, res: Response) => {
    const input = buildListSchema.parse(req.body);
    const executor = getExecutor(req);
    if (req.query.tableWindow) {
      const key=JSON.stringify([res.locals.user?.userId,executor.target.id,input.path,input.projectId]);
      let snapshot=buildWindowSnapshots.get(key);
      if (!snapshot || Date.now()-snapshot.at>15000) {
        const items: Awaited<ReturnType<typeof expoService.buildList>>=[];let offset=0;
        for (;;) {
          const page=await expoService.buildList(executor,{...input,limit:50,offset});
          const known=new Set(items.map(build=>build.id));const next=page.filter(build=>!known.has(build.id));
          items.push(...next);offset+=page.length;
          if(page.length<50 || !next.length)break;
        }
        snapshot={at:Date.now(),items};
        for(const [cacheKey,value] of buildWindowSnapshots)if(Date.now()-value.at>15000)buildWindowSnapshots.delete(cacheKey);
        buildWindowSnapshots.set(key,snapshot);
      }
      res.json({ok:true,data:snapshot.items});
    } else {
      const builds = await expoService.buildList(executor, input);
      res.json({ ok: true, data: builds });
    }
  }),

  /** POST /api/expo/build-view — one build's status. */
  buildView: asyncHandler(async (req: Request, res: Response) => {
    const { path, buildId } = buildViewSchema.parse(req.body);
    const executor = getExecutor(req);
    const build = await expoService.buildView(executor, path, buildId);
    res.json({ ok: true, data: build });
  }),

  /** POST /api/expo/build-logs — readable logs + structured failure for a build. */
  buildLogs: asyncHandler(async (req: Request, res: Response) => {
    const { buildId } = buildLogsSchema.parse(req.body);
    const logs = await expoService.buildLogs(buildId);
    res.json({ ok: true, data: logs });
  }),

  /** POST /api/expo/build-cancel — cancel a build. */
  buildCancel: asyncHandler(async (req: Request, res: Response) => {
    const { path, buildId } = buildCancelSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.buildCancel(executor, path, buildId);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/submit — submit to a store. */
  submit: asyncHandler(async (req: Request, res: Response) => {
    const input = submitSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.submit(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/dev-client — start Metro tunnel + capture exp:// URL. */
  installDependencies: asyncHandler(async (req: Request, res: Response) => {
    const { path } = projectPathSchema.parse(req.body);
    const result = await expoService.install(getExecutor(req), path);
    res.json({ ok: true, data: result });
  }),

  installDependenciesStatus: asyncHandler(async (req: Request, res: Response) => {
    const { path } = projectPathSchema.parse(req.body);
    const result = await expoService.status(getExecutor(req), path);
    res.json({ ok: true, data: result });
  }),

  startDevClient: asyncHandler(async (req: Request, res: Response) => {
    const input = devClientSchema.parse(req.body);
    const executor = getExecutor(req);
    const session = await expoService.startDevClient(executor, input);
    res.json({ ok: true, data: session });
  }),

  devClientStatus: asyncHandler(async (req: Request, res: Response) => {
    const input = devClientSchema.parse(req.query);
    const session = await expoService.devClientStatus(getExecutor(req), input);
    res.json({ ok: true, data: session });
  }),

  /** POST /api/expo/dev-client/stop — tear down the Metro tunnel for a project. */
  stopDevClient: asyncHandler(async (req: Request, res: Response) => {
    const input = devClientSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.stopDevClient(executor, input);
    res.json({ ok: true, data: result });
  }),

  /**
   * POST /api/expo/quota — build quota / plan. Account-level (resolved via the
   * Expo GraphQL API from the token), so `path` is OPTIONAL: when a project
   * path is provided we additionally count this month's builds from the CLI as
   * a fallback; without it the plan/concurrency still resolve. This lets the
   * Expo view show the plan before any project exists on the connected server.
   */
  quota: asyncHandler(async (req: Request, res: Response) => {
    const { path } = projectPathSchema.partial().parse(req.body ?? {});
    const executor = getExecutor(req);
    const quota = await expoService.getQuota(executor, path);
    res.json({ ok: true, data: quota });
  }),

  /** POST /api/expo/update — publish an OTA update. */
  updatePublish: asyncHandler(async (req: Request, res: Response) => {
    const input = updatePublishSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.updatePublish(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/env-list — list EAS env variables. */
  envList: asyncHandler(async (req: Request, res: Response) => {
    const input = envListSchema.parse(req.body);
    const executor = getExecutor(req);
    const vars = await expoService.envList(executor, input);
    res.json({ ok: true, data: vars });
  }),

  /** POST /api/expo/env-set — create an EAS env variable. */
  envSet: asyncHandler(async (req: Request, res: Response) => {
    const input = envSetSchema.parse(req.body);
    const executor = getExecutor(req);
    await expoService.envSet(executor, input);
    res.json({ ok: true });
  }),

  /** POST /api/expo/env-update — update an EAS env variable by id. */
  envUpdate: asyncHandler(async (req: Request, res: Response) => {
    const input = envUpdateSchema.parse(req.body);
    await expoService.envUpdate(input);
    res.json({ ok: true });
  }),

  /** POST /api/expo/env-delete — delete an EAS env variable by id. */
  envDelete: asyncHandler(async (req: Request, res: Response) => {
    const input = envDeleteSchema.parse(req.body);
    await expoService.envDelete(input);
    res.json({ ok: true });
  }),

  /** POST /api/expo/store-credentials — current store-account credential state. */
  storeCredentials: asyncHandler(async (req: Request, res: Response) => {
    const input = storeCredentialsSchema.parse(req.body);
    const executor = getExecutor(req);
    const data = await expoService.storeCredentials(executor, input);
    res.json({ ok: true, data });
  }),

  /** POST /api/expo/credentials/google — store Play service-account JSON. */
  setGoogleCredential: asyncHandler(async (req: Request, res: Response) => {
    const input = googleCredentialSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.setGoogleCredential(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/credentials/apple — store Apple ASC API key. */
  setAppleCredential: asyncHandler(async (req: Request, res: Response) => {
    const input = appleCredentialSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.setAppleCredential(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/webhook — register an EAS webhook. */
  webhookCreate: asyncHandler(async (req: Request, res: Response) => {
    const input = webhookCreateSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.webhookCreate(executor, input);
    res.json({ ok: true, data: result });
  }),

  /** POST /api/expo/device — register an iOS device (internal distribution). */
  deviceCreate: asyncHandler(async (req: Request, res: Response) => {
    const { path } = deviceCreateSchema.parse(req.body);
    const executor = getExecutor(req);
    const result = await expoService.deviceCreate(executor, path);
    res.json({ ok: true, data: result });
  }),
};
