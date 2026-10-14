import { Router } from "express";
import { z } from "zod";
import { optionalAuth } from "../../modules/auth/middlewares/session.middleware.js";
import { asyncHandler } from "../types/index.js";
import { diagnosticsStore } from "./store.js";
import { diagnosticScope } from "./context.js";

const router = Router();
const eventSchema = z.object({
  severity: z.enum(["warn", "error", "fatal"]), source: z.enum(["frontend", "frontend-resource", "frontend-api", "frontend-react"]),
  message: z.string().max(8192), stack: z.string().max(16000).optional(), url: z.string().max(2048).optional(),
  module: z.string().max(128).optional(), requestId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(), status: z.number().int().min(100).max(599).optional(),
});
const buckets = new Map<string, { at: number; count: number }>();
router.post("/api/telemetry/errors", optionalAuth, asyncHandler(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  // This is a write-only diagnostic sink, also usable on login. It cannot read logs or launch jobs.
  if (req.headers["sec-fetch-site"] !== "same-origin") { res.status(403).json({ ok: false, error: "Origen no permitido" }); return; }
  const key = req.ip || "unknown"; const now = Date.now();
  const bucket = buckets.get(key) || { at: now, count: 0 };
  if (now - bucket.at > 60_000) { bucket.at = now; bucket.count = 0; }
  if (++bucket.count > 60) { res.status(429).json({ ok: false, error: "Límite de telemetría" }); return; }
  buckets.set(key, bucket);
  if (buckets.size > 10_000) for (const [id, value] of buckets) if (now - value.at > 60_000) buckets.delete(id);
  const { events } = z.object({ events: z.array(eventSchema).max(20) }).parse(req.body);
  const scope = diagnosticScope(res.locals.authBaseUser || res.locals.user); await diagnosticsStore.config(scope);
  const base = res.locals.authBaseUser || res.locals.user;
  const administratorId = base?.kind === "admin" && !base.tenantId && !base.direct && (!base.targetId || base.targetId === "local") ? base.userId : undefined;
  let accepted = 0;
  for (const event of events) if (diagnosticsStore.capture({ ...event, scope, administratorId, details: { reportedBy: "browser", authenticated: Boolean(res.locals.user) } })) accepted++;
  res.status(202).json({ ok: true, data: { accepted } });
}));
export { router as telemetryRouter };
