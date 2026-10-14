// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { Router, type Router as ExpressRouter, type RequestHandler } from "express";
import { expoController } from "../controllers/index.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { ForbiddenError } from "../../../shared/errors/index.js";

const router: ExpressRouter = Router();

// Scaffolding endpoints run `npx --yes create-expo-app@latest` (downloads + runs
// an npm package), so restrict them to admins — a plain module grant must not
// be enough to trigger arbitrary package execution as the SSH user.
const requireAdmin: RequestHandler = (_req, res, next) => {
  if ((res.locals.user as { kind?: string } | undefined)?.kind !== "admin") {
    next(new ForbiddenError("Solo un administrador puede ejecutar esta acción"));
    return;
  }
  next();
};

// Path-scoped guards: only enforce auth + module gate on the expo URL space,
// not on every request that falls through this router (same rationale as
// cloudflare/openclaw — a disabled module must not eat downstream routes).
router.use("/api/expo", requireAuth, requireModule("expo"));

// ── Config (the token is write-only; reads return a masked preview) ──
router.get("/api/expo/config", expoController.getConfig);
router.put("/api/expo/config", csrfProtection, expoController.saveConfig);
router.delete("/api/expo/config", csrfProtection, expoController.clearConfig);

// ── Account ──
router.get("/api/expo/whoami", expoController.whoami);
router.get("/api/expo/account", expoController.account);

// ── Projects ──
router.get("/api/expo/projects", expoController.listProjects);
router.post("/api/expo/project-info", csrfProtection, expoController.projectInfo);
router.post("/api/expo/init", csrfProtection, requireAdmin, expoController.initProject);
router.post("/api/expo/link", csrfProtection, expoController.linkProject);
// Detached scaffold (create-expo-app + eas init) + status polling — used by the
// Files module's "Create Expo app here" action and survives long npm installs.
router.post("/api/expo/create-app", csrfProtection, requireAdmin, expoController.createApp);
router.post("/api/expo/create-status", csrfProtection, expoController.createAppStatus);

// ── Builds ──
router.post("/api/expo/build", csrfProtection, expoController.build);
router.post("/api/expo/build-list", csrfProtection, expoController.buildList);
router.post("/api/expo/build-view", csrfProtection, expoController.buildView);
router.post("/api/expo/build-logs", csrfProtection, expoController.buildLogs);
router.post("/api/expo/build-cancel", csrfProtection, expoController.buildCancel);

// ── Store submission ──
router.post("/api/expo/submit", csrfProtection, expoController.submit);

// ── Dev client / QR ──
router.get("/api/expo/dev-client/status", expoController.devClientStatus);
router.post("/api/expo/dependencies/install", csrfProtection, requireAdmin, expoController.installDependencies);
router.post("/api/expo/dependencies/status", csrfProtection, expoController.installDependenciesStatus);
router.post("/api/expo/dev-client", csrfProtection, expoController.startDevClient);
router.post("/api/expo/dev-client/stop", csrfProtection, expoController.stopDevClient);

// ── Quota ──
router.post("/api/expo/quota", csrfProtection, expoController.quota);

// ── OTA updates ──
router.post("/api/expo/update", csrfProtection, expoController.updatePublish);

// ── Env / secrets ──
router.post("/api/expo/env-list", csrfProtection, expoController.envList);
router.post("/api/expo/env-set", csrfProtection, expoController.envSet);
router.post("/api/expo/env-update", csrfProtection, expoController.envUpdate);
router.post("/api/expo/env-delete", csrfProtection, expoController.envDelete);

// ── Store-account credentials ──
router.post("/api/expo/store-credentials", csrfProtection, expoController.storeCredentials);
router.post("/api/expo/credentials/google", csrfProtection, expoController.setGoogleCredential);
router.post("/api/expo/credentials/apple", csrfProtection, expoController.setAppleCredential);

// ── Webhooks & devices ──
router.post("/api/expo/webhook", csrfProtection, expoController.webhookCreate);
router.post("/api/expo/device", csrfProtection, expoController.deviceCreate);

export { router as expoRouter };
