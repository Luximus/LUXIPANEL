import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { getExecutor } from "../../../shared/executor/index.js";
import { asyncHandler } from "../../../shared/types/index.js";
import { hostingTemplateService } from "../services/hosting-template.service.js";
import { hostingRuntimeService } from "../services/hosting-runtime.service.js";

export const templateRouter = Router();
templateRouter.use("/api/roles/templates", requireAuth, requireModule("admin"));
templateRouter.get("/api/roles/templates/capabilities", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await hostingRuntimeService.capabilities(getExecutor(req)) });
}));
templateRouter.get("/api/roles/templates", asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await hostingTemplateService.list(getExecutor(req)) });
}));
templateRouter.post("/api/roles/templates", csrfProtection, asyncHandler(async (req, res) => {
  res.status(201).json({ ok: true, data: await hostingTemplateService.create(getExecutor(req), req.body) });
}));
templateRouter.put("/api/roles/templates/:id", csrfProtection, asyncHandler(async (req, res) => {
  const { expectedRevision, ...input } = z.object({ expectedRevision: z.number().int().positive() }).passthrough().parse(req.body);
  res.json({ ok: true, data: await hostingTemplateService.update(getExecutor(req), String(req.params.id), expectedRevision, input) });
}));
templateRouter.delete("/api/roles/templates/:id", csrfProtection, asyncHandler(async (req, res) => {
  res.json({ ok: true, data: await hostingTemplateService.remove(getExecutor(req), String(req.params.id)) });
}));
