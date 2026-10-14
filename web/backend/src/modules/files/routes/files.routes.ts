// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * File manager routes.
 */

import express, { Router, type Router as ExpressRouter } from "express";
import { browserController } from "../controllers/browser.controller.js";
import { operationsController } from "../controllers/operations.controller.js";
import { editorController } from "../controllers/editor.controller.js";
import { uploadController } from "../controllers/upload.controller.js";
import { projectsController } from "../controllers/projects.controller.js";
import { snapshotController } from "../controllers/snapshot.controller.js";
import { contentSearchController } from "../controllers/content-search.controller.js";
import { nameSearchController } from "../controllers/name-search.controller.js";
import { replaceController } from "../controllers/replace.controller.js";
import { projectInfoController } from "../controllers/project-info.controller.js";
import { folderSnippetsController } from "../controllers/folder-snippets.controller.js";
import { exposureController } from "../controllers/exposure.controller.js";
import { directoryPrivacyController } from "../controllers/directory-privacy.controller.js";
import { validationController } from "../controllers/validation.controller.js";
import { dirCompareController } from "../controllers/dir-compare.controller.js";
import { fileHistoryController } from "../controllers/file-history.controller.js";
import { gitController } from "../controllers/git.controller.js";
import { malwareController } from "../controllers/malware.controller.js";
import { cleanupController } from "../controllers/cleanup.controller.js";
import { imageOptimController } from "../controllers/image-optim.controller.js";
import { fileMetaController } from "../controllers/file-meta.controller.js";
import { filesPrefsController } from "../controllers/files-prefs.controller.js";
import { filesConfigController } from "../controllers/files-config.controller.js";
import { filesConfigService } from "../services/files-config.service.js";
import { shareController } from "../controllers/share.controller.js";
import { pathSandbox } from "../middlewares/path-sandbox.middleware.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { requireActionPermission, requireViewPermission } from "../../auth/middlewares/require-permission.middleware.js";
import { enforceFilePathPermission } from "../middlewares/role-file-permissions.middleware.js";
import { assertCanonicalFilePathPermission } from "../middlewares/role-file-permissions.middleware.js";
import { gitRoot } from "../services/git.service.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import path from "node:path";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { getExecutor } from "../../../shared/executor/index.js";

const router: ExpressRouter = Router();

function enforceGitRoot(operation: "read" | "write"): express.RequestHandler {
  return (req, res, next) => {
    void (async () => {
      const target = String(req.query["path"] ?? req.body?.path ?? "");
      if (!target) return;
      const executor = getExecutor(req);
      const root = await gitRoot(executor, target) ?? await gitRoot(executor, path.posix.dirname(target));
      if (!root) return;
      const user = res.locals.user;
      if (!user || !canAccessPath(user, root, operation)) throw new ForbiddenError("No tienes permiso sobre la raíz Git");
      await assertCanonicalFilePathPermission(executor, user, root, operation);
    })().then(() => next(), next);
  };
}

// Path-scoped: avoid running the files module guard for requests that fall
// through this router on their way to later modules (terminal, notifications…).
router.use("/api/files", requireAuth, requireModule("files"), requireViewPermission("panel.files"), pathSandbox);

// ---- Browser ----
router.get("/api/files/list", requireActionPermission("files.view"), enforceFilePathPermission("read"), browserController.list);
// Subdirectory listing for the sidebar tree — per-server via the request's
// executor (replaces the old anonymous host-FS route that used to live in app.ts).
router.get("/api/files/tree", requireActionPermission("files.view"), enforceFilePathPermission("read"), browserController.tree);
router.get("/api/files/stat", requireActionPermission("files.read"), enforceFilePathPermission("read"), browserController.stat);
// Two handlers, one route: `?base=&q=&limit=` (tree search, recursive by name,
// contract {items,truncated,base}) is served by nameSearchController; the legacy
// `?path=&q=` form falls through to browserController.search via next().
router.get("/api/files/search", requireActionPermission("files.search"), enforceFilePathPermission("read"), nameSearchController.search, browserController.search);
router.get("/api/files/grep", requireActionPermission("files.search"), enforceFilePathPermission("read"), contentSearchController.grep);
router.get("/api/files/compare", requireActionPermission("files.compare"), enforceFilePathPermission("read"), dirCompareController.compare);
router.get("/api/files/history", requireActionPermission("files.history"), enforceFilePathPermission("read"), fileHistoryController.history);
router.get("/api/files/history/git-show", requireActionPermission("files.history"), enforceFilePathPermission("read"), fileHistoryController.gitShow);
router.get("/api/files/dir-size", requireActionPermission("files.read"), enforceFilePathPermission("read"), browserController.dirSize);
// NOTE: no enforceFilePathPermission here — the batch is per-path tolerant
// (denied paths return null instead of 403ing the whole request); the filter
// lives in browserController.dirSizes via canAccessPath.
router.post("/api/files/dir-sizes", requireActionPermission("files.read"), browserController.dirSizes);
router.get("/api/files/path-suggest", requireActionPermission("files.read"), enforceFilePathPermission("read"), browserController.pathSuggest);
router.post("/api/files/visit", requireActionPermission("files.view"), enforceFilePathPermission("read"), browserController.visit);
router.get("/api/files/allowed-bases", requireActionPermission("files.view"), browserController.allowedBases);

// ---- Tags (#23) + comments (#24) ----
router.get("/api/files/meta", requireActionPermission("files.read"), enforceFilePathPermission("read"), fileMetaController.get);
router.get("/api/files/meta/all", requireActionPermission("files.read"), fileMetaController.all);
router.put("/api/files/meta", requireActionPermission("files.tags"), enforceFilePathPermission("write"), csrfProtection, fileMetaController.set);

// ---- Client/dev UI mode (#25) — UX guardrail, not access control ----
router.get("/api/files/mode", requireActionPermission("files.view"), filesPrefsController.get);
router.put("/api/files/mode", requireActionPermission("files.view"), csrfProtection, filesPrefsController.set);
router.get("/api/files/preferences", requireActionPermission("files.view"), filesPrefsController.preferences);
router.patch("/api/files/preferences", requireActionPermission("files.view"), csrfProtection, filesPrefsController.patchPreferences);
router.get("/api/files/config/effective", requireActionPermission("files.view"), filesConfigController.effective);
router.get("/api/files/config", requireActionPermission("files.config"), filesConfigController.get);
router.patch("/api/files/config", requireActionPermission("files.config"), csrfProtection, filesConfigController.patch);
router.get("/api/files/config/prune-preview", requireActionPermission("files.config"), filesConfigController.prunePreview);
router.post("/api/files/config/prune", requireActionPermission("files.config"), csrfProtection, filesConfigController.prune);

// ---- Temporary share links (#17) — served by the client's nginx/PHP ----
router.get("/api/files/share/roots", requireActionPermission("files.share"), shareController.roots);
router.get("/api/files/share", requireActionPermission("files.share"), shareController.list);
router.post("/api/files/share", requireActionPermission("files.share"), enforceFilePathPermission("read"), csrfProtection, shareController.create);
router.post("/api/files/share/:token/revoke", requireActionPermission("files.share"), csrfProtection, shareController.revoke);

// ---- Projects ----
router.post("/api/files/scan-projects", requireActionPermission("files.projects"), enforceFilePathPermission("read"), projectsController.scan);
router.get("/api/files/projects", requireActionPermission("files.projects"), projectsController.list);
// Analyze a folder and propose terminal snippets (cd/git/github/build) for it.
// Read-only; the proposal is registered via POST /api/terminal/snippets/import.
router.get("/api/files/snippets/suggest", requireActionPermission("files.projects"), enforceFilePathPermission("read"), folderSnippetsController.suggest);

// ---- Git (phase 1: local work-tree ops, #14) ----
router.get("/api/files/git/status", requireActionPermission("files.git"), enforceFilePathPermission("read"), enforceGitRoot("read"), gitController.status);
router.get("/api/files/git/in-repo", requireActionPermission("files.git"), enforceFilePathPermission("read"), enforceGitRoot("read"), gitController.inRepo);
router.post("/api/files/git/commit", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.commit);
router.post("/api/files/git/discard", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.discard);
router.post("/api/files/git/checkout", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.checkout);
router.post("/api/files/git/branch", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.branch);
// Phase 2: pull/push + per-project credentials (encrypted at rest).
router.post("/api/files/git/pull", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.pull);
router.post("/api/files/git/push", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.push);
router.get("/api/files/git/credentials", requireActionPermission("files.git"), gitController.listCredentials);
router.post("/api/files/git/credentials", requireActionPermission("files.git"), csrfProtection, gitController.createCredential);
router.put("/api/files/git/credentials/:id", requireActionPermission("files.git"), csrfProtection, gitController.updateCredential);
router.delete("/api/files/git/credentials/:id", requireActionPermission("files.git"), csrfProtection, gitController.deleteCredential);
router.get("/api/files/git/detect", requireActionPermission("files.git"), gitController.detectCredentials);
// Manage DETECTED server-side auth (edits real files/config on the target).
router.post("/api/files/git/server/https", requireActionPermission("files.git"), csrfProtection, gitController.saveServerHttps);
router.post("/api/files/git/server/https/delete", requireActionPermission("files.git"), csrfProtection, gitController.deleteServerHttps);
router.post("/api/files/git/server/ssh/delete", requireActionPermission("files.git"), csrfProtection, gitController.deleteServerSshKey);
router.post("/api/files/git/server/gh/logout", requireActionPermission("files.git"), csrfProtection, gitController.ghLogout);
router.post("/api/files/git/server/config", requireActionPermission("files.git"), csrfProtection, gitController.setGitConfig);
// SSH manager: diagnose/configure the SSH key a Linux user (or sudo'd user) uses for git.
router.get("/api/files/git/ssh/env", requireActionPermission("files.git"), gitController.sshEnv);
router.get("/api/files/git/ssh/users", requireActionPermission("files.git"), gitController.sshUsers);
router.post("/api/files/git/ssh/test", requireActionPermission("files.git"), csrfProtection, gitController.sshTest);
router.get("/api/files/git/ssh/config", requireActionPermission("files.git"), gitController.sshConfigGet);
router.post("/api/files/git/ssh/config", requireActionPermission("files.git"), csrfProtection, gitController.sshConfigSet);
router.post("/api/files/git/ssh/fix-permissions", requireActionPermission("files.git"), csrfProtection, gitController.sshFixPermissions);
router.get("/api/files/git/ssh/repo-key", requireActionPermission("files.git"), enforceFilePathPermission("read"), enforceGitRoot("read"), gitController.sshRepoGet);
router.post("/api/files/git/ssh/repo-key", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.sshRepoSet);
// Phase 3: clone (dest sandboxed in-service, like upload) + deploy from branch.
router.post("/api/files/git/clone", requireActionPermission("files.git"), enforceFilePathPermission("write"), csrfProtection, gitController.clone);
router.post("/api/files/git/deploy", requireActionPermission("files.git"), enforceFilePathPermission("write"), enforceGitRoot("write"), csrfProtection, gitController.deploy);
router.get("/api/files/project-info", requireActionPermission("files.projects"), enforceFilePathPermission("read"), projectInfoController.detect);

// ---- Web exposure scanner (#3 / #16) ----
router.get("/api/files/exposure/scan", requireActionPermission("files.security"), exposureController.scan);
router.get("/api/files/exposure/probe", requireActionPermission("files.security"), enforceFilePathPermission("read"), exposureController.probe);
router.post("/api/files/exposure/block", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, exposureController.block);

// ---- Directory Privacy (Basic auth via .htaccess + .htpasswd) — in the Permissions modal ----
router.get("/api/files/privacy", requireActionPermission("files.security"), enforceFilePathPermission("read"), directoryPrivacyController.status);
router.post("/api/files/privacy/protect", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, directoryPrivacyController.protect);
router.post("/api/files/privacy/user/remove", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, directoryPrivacyController.removeUser);
router.post("/api/files/privacy/unprotect", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, directoryPrivacyController.unprotect);
router.get("/api/files/privacy/sites", requireActionPermission("files.security"), directoryPrivacyController.sites);
router.post("/api/files/privacy/publish", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, directoryPrivacyController.publish);
router.post("/api/files/privacy/unpublish", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, directoryPrivacyController.unpublish);

// ---- Snapshots ("Modo cambios seguros") ----
// Operate by snapshot id (the captured path is internal), so they are gated by
// action permission only; the actual fs path was already writable by the user
// at capture time. Restore re-writes the original path → files.write.
router.get("/api/files/snapshots", requireActionPermission("files.history"), snapshotController.list);
router.get("/api/files/snapshots/:id/diff", requireActionPermission("files.history"), snapshotController.diff);
router.get("/api/files/snapshots/:id/download", requireActionPermission("files.history"), snapshotController.download);
router.post("/api/files/snapshots/:id/restore", requireActionPermission("files.history"), csrfProtection, snapshotController.restore);
router.delete("/api/files/snapshots/:id", requireActionPermission("files.history"), csrfProtection, snapshotController.remove);

// ---- Mass replace (#10): preview is read-only, apply mutates + snapshots ----
router.post("/api/files/replace/preview", requireActionPermission("files.read"), enforceFilePathPermission("read"), csrfProtection, replaceController.preview);
router.post("/api/files/replace/apply", requireActionPermission("files.write"), enforceFilePathPermission("write"), csrfProtection, replaceController.apply);

// ---- Malware detector (#12) + quarantine (#13) ----
router.get("/api/files/malware/scan", requireActionPermission("files.security"), enforceFilePathPermission("read"), malwareController.scan);
router.get("/api/files/cleanup/scan", requireActionPermission("files.security"), enforceFilePathPermission("read"), cleanupController.scan);

// ---- Image optimization (#22) ----
router.get("/api/files/images/capabilities", requireActionPermission("files.images"), imageOptimController.capabilities);
router.get("/api/files/images/scan", requireActionPermission("files.images"), enforceFilePathPermission("read"), imageOptimController.scan);
router.post("/api/files/images/process", requireActionPermission("files.images"), enforceFilePathPermission("write"), csrfProtection, imageOptimController.process);
router.get("/api/files/malware/quarantine", requireActionPermission("files.security"), malwareController.listQuarantine);
router.post("/api/files/malware/quarantine", requireActionPermission("files.security"), enforceFilePathPermission("write"), csrfProtection, malwareController.quarantine);
router.post("/api/files/malware/quarantine/:id/restore", requireActionPermission("files.security"), csrfProtection, malwareController.restoreQuarantine);
router.delete("/api/files/malware/quarantine/:id", requireActionPermission("files.security"), csrfProtection, malwareController.deleteQuarantine);

// ---- Editor (text files) ----
router.get("/api/files/read", requireActionPermission("files.read"), enforceFilePathPermission("read"), editorController.read);
router.post("/api/files/validate", requireActionPermission("files.read"), enforceFilePathPermission("read"), csrfProtection, validationController.validate);
router.put("/api/files/write", requireActionPermission("files.write"), enforceFilePathPermission("write"), csrfProtection, editorController.write);

// ---- Download (streams file) ----
router.get("/api/files/download", requireActionPermission("files.download"), enforceFilePathPermission("read"), uploadController.download);
// Inline view of raw bytes (image/video/audio preview, etc.). Gated by READ, not
// download — viewing a resource inline is reading it, not saving it to disk.
router.get("/api/files/raw", requireActionPermission("files.read"), enforceFilePathPermission("read"), uploadController.download);

// ---- Upload (raw binary, FILES_UPLOAD_MAX_BYTES limit — 512 MiB default) ----
// The raw-body limit here is the FIRST line of defense: it aborts the request
// with a 413 (mapped to PAYLOAD_TOO_LARGE) before buffering more than the cap.
// The controller re-checks the same env value as belt-and-suspenders.
router.post(
  "/api/files/upload",
  requireActionPermission("files.upload"),
  enforceFilePathPermission("write"),
  csrfProtection,
  async (req, res, next) => {
    try {
      const config = await filesConfigService.get(getExecutor(req));
      express.raw({ type: "application/octet-stream", limit: config.uploadMaxBytes })(req, res, next);
    } catch (error) { next(error); }
  },
  uploadController.upload,
);

// ---- Operations (mutating) ----
router.post("/api/files/mkdir", requireActionPermission("files.create"), enforceFilePathPermission("write"), csrfProtection, operationsController.mkdir);
router.delete("/api/files", requireActionPermission("files.delete"), enforceFilePathPermission("write"), csrfProtection, operationsController.delete);
router.put("/api/files/rename", requireActionPermission("files.rename"), enforceFilePathPermission("write"), csrfProtection, operationsController.rename);
router.post("/api/files/copy", requireActionPermission("files.copy"), enforceFilePathPermission("write"), csrfProtection, operationsController.copy);
router.get("/api/files/permissions/recommend", requireActionPermission("files.read"), enforceFilePathPermission("read"), operationsController.recommendPermissions);
router.put("/api/files/chmod", requireActionPermission("files.chmod"), enforceFilePathPermission("write"), csrfProtection, operationsController.chmod);
router.put("/api/files/chmod-recursive", requireActionPermission("files.chmod"), enforceFilePathPermission("write"), csrfProtection, operationsController.chmodRecursive);
router.put("/api/files/chown", requireActionPermission("files.chown"), enforceFilePathPermission("write"), csrfProtection, operationsController.chown);

// ---- Archive ----
// enforceFilePathPermission reads `sources`/`dest` (compress) and `archive`/
// `destDir` (extract) via its explicit PATH_KEYS whitelist — keep new payload
// keys in sync with role-file-permissions.middleware.ts.
router.post("/api/files/compress", requireActionPermission("files.compress"), enforceFilePathPermission("write"), csrfProtection, operationsController.compress);
router.post("/api/files/extract", requireActionPermission("files.compress"), enforceFilePathPermission("write"), csrfProtection, operationsController.extract);
router.get("/api/files/archive-contents", requireActionPermission("files.read"), enforceFilePathPermission("read"), operationsController.archiveContents);

export { router as filesRouter };
