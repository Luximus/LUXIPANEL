// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter } from "express";
import { serversController } from "../controllers/servers.controller.js";
import { targetSwitchController } from "../controllers/target-switch.controller.js";
import { requireAuth, requireAuthNoExecutor } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireViewPermission } from "../../auth/middlewares/require-permission.middleware.js";

const router: ExpressRouter = Router();

// ESCAPE HATCH — return to the connected (local) server. Registered BEFORE the
// `requireAuth` gate below so it uses `requireAuthNoExecutor`: a session pinned
// to a remote target whose SSH material EXPIRED would otherwise 500 here
// (getExecutorAsync throws fail-closed) and trap the user on the dead bridge.
// This literal path has NO `:id` param, so it needs its own handler
// (`switchLocal`) — routing it through `switch` made `req.params.id` undefined
// and the vault lookup answered 404 "Servidor" (users stuck on the remote box).
router.post(
  "/api/servers/local/switch",
  requireAuthNoExecutor,
  requireViewPermission("panel.server-switcher"),
  csrfProtection,
  targetSwitchController.switchLocal,
);

// Any authenticated control-plane user: admins manage the shared (global)
// registry, non-admins manage their own private targets. Per-record
// authorization is enforced in the service (userMayUseTarget/assertMayManage).
router.use("/api/servers", requireAuth, requireViewPermission("panel.server-switcher"));

router.get("/api/servers", serversController.list);
router.post("/api/servers", csrfProtection, serversController.create);
router.put("/api/servers/:id", csrfProtection, serversController.update);
router.delete("/api/servers/:id", csrfProtection, serversController.remove);

// TOFU: first contact captures the fingerprint (409), approve pins it.
router.post("/api/servers/:id/test", csrfProtection, serversController.test);
router.post("/api/servers/:id/fingerprint/approve", csrfProtection, serversController.approveFingerprint);

// Establish a direct bridge to a local target (fills sshCredentialsCache).
router.post("/api/servers/:id/switch", csrfProtection, targetSwitchController.switch);

export { router as serversRouter };
