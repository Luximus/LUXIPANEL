import { Router, type Router as ExpressRouter } from "express";
import { obsidianController } from "../controllers/index.js";
import { obsidianPreferencesController } from "../controllers/preferences.controller.js";
import { requireObsidianAdmin } from "../middlewares/admin.middleware.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";

const router: ExpressRouter = Router();

router.use("/api/obsidian", requireAuth, requireModule("obsidian"));

router.get("/api/obsidian/preferences", obsidianPreferencesController.get);
router.patch("/api/obsidian/preferences", csrfProtection, obsidianPreferencesController.patch);

router.post("/api/obsidian/projects/:id/context-document", csrfProtection, requireObsidianAdmin, obsidianController.projectDocument);

// ── Vault registry ──
router.get("/api/obsidian/vaults", obsidianController.listVaults);
router.post("/api/obsidian/vaults", csrfProtection, requireObsidianAdmin, obsidianController.createVault);
router.delete("/api/obsidian/vaults/:id", csrfProtection, requireObsidianAdmin, obsidianController.deleteVault);

// ── Context containers (per repo / assistant project / loose chat) ──
router.get("/api/obsidian/containers", requireObsidianAdmin, obsidianController.listContainers);
router.post("/api/obsidian/containers/sync", csrfProtection, requireObsidianAdmin, obsidianController.syncContainers);

// ── Tree & notes ──
router.get("/api/obsidian/vaults/:id/tree", obsidianController.tree);
router.get("/api/obsidian/vaults/:id/note", obsidianController.readNote);
router.put("/api/obsidian/vaults/:id/note", csrfProtection, obsidianController.writeNote);
router.post("/api/obsidian/vaults/:id/note/append", csrfProtection, obsidianController.appendNote);
router.post("/api/obsidian/vaults/:id/daily", csrfProtection, obsidianController.dailyNote);
router.get("/api/obsidian/vaults/:id/daily/today", obsidianController.today);
router.post("/api/obsidian/vaults/:id/note/rename", csrfProtection, obsidianController.renameNote);
router.delete("/api/obsidian/vaults/:id/note", csrfProtection, obsidianController.deleteNote);
router.post("/api/obsidian/vaults/:id/folders", csrfProtection, obsidianController.createFolder);

// ── Search & wikilink graph ──
router.get("/api/obsidian/vaults/:id/search", obsidianController.search);
router.get("/api/obsidian/vaults/:id/links", obsidianController.links);

// ── AI assistant context files (CLAUDE.md / AGENTS.md / GEMINI.md) ──
router.post(
  "/api/obsidian/vaults/:id/assistant-context",
  csrfProtection,
  requireObsidianAdmin,
  obsidianController.assistantContext,
);

export { router as obsidianRouter };
