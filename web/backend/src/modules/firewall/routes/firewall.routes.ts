// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { rulesController } from "../controllers/rules.controller.js";
import { statusController } from "../controllers/status.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { requireActionPermission } from "../../auth/middlewares/require-permission.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/firewall", requireAuth, requireModule("firewall"));

// Destructive firewall operations require a granular action permission on top
// of the module (audit §5): otherwise ANY role with the `firewall` module could
// disable the firewall, delete rules or ban IPs. Admin sessions bypass the
// permission check (kind === "admin"), so behaviour is unchanged for them.

// ---- Status + toggle ----
router.get("/api/firewall/status", statusController.overview);
router.post("/api/firewall/install", requireActionPermission("firewall.manage"), csrfProtection, statusController.install);
router.post("/api/firewall/enable", requireActionPermission("firewall.manage"), csrfProtection, statusController.enable);
router.post("/api/firewall/disable", requireActionPermission("firewall.disable"), csrfProtection, statusController.disable);
router.put("/api/firewall/logging", requireActionPermission("firewall.manage"), csrfProtection, statusController.logging);

// ---- UFW rules ----
router.get("/api/firewall/rules", rulesController.list);
router.post("/api/firewall/rules", requireActionPermission("firewall.rules.create"), csrfProtection, rulesController.add);
router.delete("/api/firewall/rules/:number", requireActionPermission("firewall.rules.delete"), csrfProtection, rulesController.remove);
// Preset: allow Cloudflare's published IP ranges on 80,443 (public ips-v4/v6 lists).
router.post("/api/firewall/cloudflare-allow", requireActionPermission("firewall.rules.create"), csrfProtection, rulesController.cloudflareAllow);

// ---- Fail2ban ----
router.get("/api/firewall/fail2ban/jails", statusController.jails);
router.post("/api/firewall/fail2ban/unban", requireActionPermission("firewall.ban"), csrfProtection, statusController.unban);
router.post("/api/firewall/fail2ban/ban", requireActionPermission("firewall.ban"), csrfProtection, statusController.ban);

export { router as firewallRouter };
