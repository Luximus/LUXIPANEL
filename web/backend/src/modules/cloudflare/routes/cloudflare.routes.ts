import { Router, type Router as ExpressRouter } from "express";
import { cloudflareController } from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

// Path-scoped guards: only enforce auth + module gate on the cloudflare URL
// space, not on every request that falls through this router (same rationale
// as openclaw.routes.ts — a disabled module must not eat downstream routes).
router.use("/api/cloudflare", requireAuth, requireModule("cloudflare"));

// ── Config (the token is write-only; reads return a masked preview) ──
router.get("/api/cloudflare/config", cloudflareController.getConfig);
router.put("/api/cloudflare/config", csrfProtection, cloudflareController.saveConfig);
router.delete("/api/cloudflare/config", csrfProtection, cloudflareController.clearConfig);
router.post("/api/cloudflare/test", csrfProtection, cloudflareController.testConnection);

// ── Connected-server probe ──
router.get("/api/cloudflare/server-ip", cloudflareController.serverIp);

// ── Zones & settings ──
router.get("/api/cloudflare/zones", cloudflareController.listZones);
router.get("/api/cloudflare/zones/:zoneId/settings", cloudflareController.getZoneSettings);
router.patch(
  "/api/cloudflare/zones/:zoneId/settings",
  csrfProtection,
  cloudflareController.setZoneSetting,
);

// ── DNS records ──
router.get("/api/cloudflare/zones/:zoneId/dns", cloudflareController.listDnsRecords);
router.post("/api/cloudflare/zones/:zoneId/dns", csrfProtection, cloudflareController.createDnsRecord);
router.patch(
  "/api/cloudflare/zones/:zoneId/dns/:recordId",
  csrfProtection,
  cloudflareController.updateDnsRecord,
);
router.delete(
  "/api/cloudflare/zones/:zoneId/dns/:recordId",
  csrfProtection,
  cloudflareController.deleteDnsRecord,
);

// ── Cache purge ──
router.post("/api/cloudflare/zones/:zoneId/purge", csrfProtection, cloudflareController.purgeCache);

// ── IP access rules ──
router.get("/api/cloudflare/zones/:zoneId/access-rules", cloudflareController.listAccessRules);
router.post(
  "/api/cloudflare/zones/:zoneId/access-rules",
  csrfProtection,
  cloudflareController.createAccessRule,
);
router.delete(
  "/api/cloudflare/zones/:zoneId/access-rules/:ruleId",
  csrfProtection,
  cloudflareController.deleteAccessRule,
);

export { router as cloudflareRouter };
