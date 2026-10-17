import { listOwnerContributions, retryOwnerContribution } from "../../../shared/github/owner-contributions.js";
import { previewContributionRecovery, reviewContributionRecovery } from "../../../shared/github/contribution-review.js";
// SPDX-License-Identifier: AGPL-3.0-only
import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../shared/types/index.js";
import { githubStatus, linkGithub, disconnectGithub, startGithubDevice, pollGithubDevice } from "../../../shared/github/user-connection.js";
const principal = (res:Response) => res.locals.authBaseUser ?? res.locals.user;
export const githubController = {
  recoveryPreview: asyncHandler(async (req:Request,res:Response) => { const {id}=z.object({id:z.string().uuid()}).parse(req.params);res.setHeader("Cache-Control","private, no-store");res.json({ok:true,data:await previewContributionRecovery(principal(res),id)}); }),
  recover: asyncHandler(async (req:Request,res:Response) => { const {id,snapshotHash}=z.object({id:z.string().uuid(),snapshotHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);res.json({ok:true,data:await reviewContributionRecovery(principal(res),id,snapshotHash)}); }),
  retry: asyncHandler(async (req:Request,res:Response) => {const {id}=z.object({id:z.string().uuid()}).strict().parse(req.body);await retryOwnerContribution(principal(res),id);res.json({ok:true});}),
  contributions: asyncHandler(async (_req:Request,res:Response) => { res.setHeader("Cache-Control","no-store");res.json({ok:true,data:await listOwnerContributions(principal(res))}); }),
  status: asyncHandler(async (_req:Request,res:Response) => { res.setHeader("Cache-Control","no-store"); res.json({ok:true,data:await githubStatus(principal(res))}); }),
  connect: asyncHandler(async (req:Request,res:Response) => { const {token}=z.object({token:z.string().min(1).max(4096)}).strict().parse(req.body); res.json({ok:true,data:await linkGithub(principal(res),token.trim())}); }),
  disconnect: asyncHandler(async (_req:Request,res:Response) => { await disconnectGithub(principal(res)); res.json({ok:true}); }),
  start: asyncHandler(async (_req:Request,res:Response) => { res.json({ok:true,data:await startGithubDevice(principal(res))}); }),
  poll: asyncHandler(async (req:Request,res:Response) => { const {id}=z.object({id:z.string().uuid()}).strict().parse(req.body); res.json({ok:true,data:await pollGithubDevice(principal(res),id)}); }),
};
