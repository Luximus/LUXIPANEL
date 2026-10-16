// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { registerModuleOperations } from "../../../shared/module-operations/registry.js";
import { Router, type Router as ExpressRouter } from "express";
import { chatController } from "../controllers/chat.controller.js";
import { diagnosticsController } from "../controllers/diagnostics.controller.js";
import { agentController } from "../controllers/agent.controller.js";
import { assistantConfigController } from "../controllers/config.controller.js";
import { assistantIntegrationsController } from "../controllers/integrations.controller.js";
import { assistantModulesController } from "../controllers/modules.controller.js";
import { assistantSkillsController } from "../controllers/skills.controller.js";
import { cliController } from "../controllers/cli.controller.js";
import { auditController } from "../controllers/audit.controller.js";
import { conversationsController } from "../controllers/conversations.controller.js";
import { projectsController } from "../controllers/projects.controller.js";
import { graphIndexController } from "../controllers/graph-index.controller.js";
import { agentsController } from "../controllers/agents.controller.js";
import { assistantBootstrap } from "../controllers/bootstrap.controller.js";
import { agentRolesController } from "../controllers/agent-roles.controller.js";
import { agentTeamsController } from "../controllers/agent-teams.controller.js";
import { agentMessagesController } from "../controllers/agent-messages.controller.js";
import { projectStructureController } from "../controllers/project-structure.controller.js";
import { statsController } from "../controllers/stats.controller.js";
import { mcpController } from "../controllers/mcp.controller.js";
import { mcpPeerController } from "../controllers/mcp-peer.controller.js";
import { panelPairingController } from "../controllers/panel-pairing.controller.js";
import { officeConnectorsController } from "../controllers/office-connectors.controller.js";
import { notifyPrefsController } from "../controllers/notify-prefs.controller.js";
import { storageController } from "../controllers/storage.controller.js";
import { realtimeController, rejectTextDuringLiveVoice } from "../controllers/realtime.controller.js";
import { voiceController } from "../controllers/voice.controller.js";
import { projectMapController } from "../controllers/project-map.controller.js";
import { teamTemplatesController } from "../controllers/team-templates.controller.js";
import { teamController } from "../controllers/team.controller.js";
import { filesEditorChatController } from "../controllers/files-editor-chat.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { lpPanelCredentialAuth, skipIfPanelCredential } from "../../auth/middlewares/lp-panel-credential.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { requireActionPermission } from "../../auth/middlewares/require-permission.middleware.js";

/**
 * IMPORTANT: middlewares on this router MUST be scoped to `/api/ai` paths.
 * If you mount `router.use(requireAuth)` (no path), the middleware runs for
 * EVERY request the router sees — including paths like `/api/admin/modules`
 * or `/api/notifications/stream` from other modules. That would let
 * `requireModule("assistant")` 404 the whole panel just because someone
 * toggled the assistant module off in /panel/modules. We did exactly that
 * once; don't undo this path-scope.
 *
 * Routes are split into:
 *   - `router`              public-ish: only `POST /api/ai/mcp` (Bearer auth in handler)
 *   - `protected` sub-router under `/api/ai` with `requireAuth` + `requireModule("assistant")`
 */

const router: ExpressRouter = Router();

// MCP loopback (own Bearer auth, not session-authed). Path-specific route
// — does NOT pass through requireAuth/requireModule.
router.post("/api/ai/mcp/modules", (req, res) => mcpController.handleModules(req, res));
router.post("/api/ai/mcp", (req, res) => mcpController.handle(req, res));
// Per-run cross-server MCP channel (servers.* only). Own Bearer auth (a
// cross-scoped token), like /api/ai/mcp — NOT session-authed.
router.post("/api/ai/mcp/cross", (req, res) => mcpController.handleCross(req, res));
// Per-run code-graph channel (graph-scoped token) — same Bearer model, NOT
// session-authed. Replaces attaching the graph binary to the CLI over stdio.
router.post("/api/ai/mcp/graph", (req, res) => mcpController.handleGraph(req, res));
// Panel-to-panel MCP (inbound) — another LUXIPANEL that manages this box calls
// peer.* tools here with a paired `lxp_peer_…` credential. Own auth (NOT
// session-authed); gated by PANEL_PEER_MCP_ENABLED. See mcp-peer.controller.
router.post("/api/ai/mcp/peer", (req, res) => mcpPeerController.handle(req, res));

// Everything else lives behind requireAuth + requireModule("assistant"),
// mounted explicitly under `/api/ai` so it only fires for our paths.
// El túnel del portal LP entra ANTES con su credencial por-panel
// (`Bearer lxp_live_…`, LP_PANEL_CREDENTIAL): si autentica, requireAuth se
// salta; un JWT de sesión normal sigue el flujo de siempre. SOLO este router.
const protectedRouter: ExpressRouter = Router();
protectedRouter.use(lpPanelCredentialAuth);
protectedRouter.use(skipIfPanelCredential(requireAuth));
protectedRouter.use(requireModule("assistant"));

// Mint a long-lived MCP token + config snippet for a CLI on the target.
// GET (idempotent enough — issues a new JWT per call but no side effects on
// the panel; safer through restrictive WAFs that block ad-hoc POSTs).
protectedRouter.get("/mcp/tokens", mcpController.mintToken);

// One-click recovery for the persistent «Sesión MCP expirada» banner: re-mint
// the MCP token bound to the session's LIVE bridge, reinstall it into the
// target CLI config, and stamp the conversation repaired. Session-authed.
protectedRouter.post("/mcp/repair", mcpController.repair);

// Panel-to-panel MCP pairing (outbound): provision a peer credential on a
// target that runs LUXIPANEL, over SSH. Authorization re-checked per target.
protectedRouter.post("/servers/:id/pair", panelPairingController.pair);

protectedRouter.get("/status", chatController.status);
protectedRouter.post("/chat", rejectTextDuringLiveVoice, chatController.chat);
protectedRouter.post("/agent", rejectTextDuringLiveVoice, (req, res) => agentController.run(req, res));
protectedRouter.get("/agent/stream", (req, res) => agentController.attach(req, res));
protectedRouter.get("/agent/active", (req, res) => agentController.activeRuns(req, res));
protectedRouter.post("/agent/stop", (req, res) => agentController.stop(req, res));
protectedRouter.post("/agent/input", rejectTextDuringLiveVoice, (req, res) => agentController.input(req, res));
protectedRouter.post("/agent/permission", (req, res) => agentController.permission(req, res));
protectedRouter.post("/agent/resume", (req, res) => agentController.resume(req, res));
protectedRouter.post("/agent/enqueue", rejectTextDuringLiveVoice, (req, res) => agentController.enqueue(req, res));
protectedRouter.get("/agent/queue", (req, res) => agentController.queueList(req, res));
protectedRouter.get("/agent/queue/:id", (req, res) => agentController.queueGet(req, res));
protectedRouter.delete("/agent/queue/:id", (req, res) => agentController.queueCancel(req, res));

// Per-target configuration (provider keys, mode, active provider).
protectedRouter.get("/bootstrap", assistantBootstrap);
protectedRouter.get("/config", assistantConfigController.get);
protectedRouter.put("/config", assistantConfigController.patch);
protectedRouter.put("/config/auto-routing", assistantConfigController.setAutoRouting);
protectedRouter.put("/config/providers/:id", assistantConfigController.setProvider);
protectedRouter.post("/config/providers/:id/test", assistantConfigController.testProvider);

// Third-party integration credentials (ElevenLabs). Same gate as
// `PUT /config` — this router already carries requireAuth + requireModule.
protectedRouter.get("/integrations/elevenlabs", assistantIntegrationsController.getElevenLabs);
protectedRouter.put("/integrations/elevenlabs", assistantIntegrationsController.setElevenLabs);
protectedRouter.delete("/integrations/elevenlabs", assistantIntegrationsController.clearElevenLabs);
protectedRouter.post("/integrations/elevenlabs/test", assistantIntegrationsController.testElevenLabs);

// Per-target module capability gating.
protectedRouter.get("/modules", assistantModulesController.list);
protectedRouter.put("/modules/:id", assistantModulesController.setModule);
protectedRouter.put("/modules/:id/tools/:tool", assistantModulesController.setTool);

// Per-target skills/methods toggles (ponytail, ask-protocol, project vault…).
protectedRouter.get("/skills", assistantSkillsController.list);
protectedRouter.put("/skills/:id", assistantSkillsController.setSkill);

// Notification preferences (instance-level): "avisarme cuando un chat termine".
protectedRouter.get("/notify-prefs", notifyPrefsController.get);
protectedRouter.put("/notify-prefs", notifyPrefsController.set);

// CLI status (read-only). Install + login live in the Terminal module.
protectedRouter.get("/cli/specs", cliController.specs);
protectedRouter.get("/cli/:provider/status", cliController.status);

// Voice (audio in/out): STT transcribe + TTS speak, gated by configured engine.
protectedRouter.get("/voice/capabilities", voiceController.capabilities);
protectedRouter.post("/voice/transcribe", voiceController.transcribe);
protectedRouter.post("/voice/speak", voiceController.speak);
protectedRouter.get("/realtime/conversations/:conversationId", realtimeController.conversation);
protectedRouter.get("/realtime/capabilities", realtimeController.capabilities);
protectedRouter.post("/realtime/sessions", realtimeController.start);
protectedRouter.get("/realtime/sessions/:id", realtimeController.snapshot);
protectedRouter.delete("/realtime/sessions/:id", realtimeController.stop);
protectedRouter.post("/realtime/sessions/:id/answer", realtimeController.answer);


// Conversation history (ChatGPT-style threads, per-target).
protectedRouter.get("/conversations", conversationsController.list);
protectedRouter.post("/conversations", conversationsController.create);
protectedRouter.get("/conversations/:id/messages", conversationsController.messages);
// Rehydration snapshot of a leader chat's delegated team-tasks (rebuild the
// "Equipo trabajando" process block from history after a reload).
protectedRouter.get("/conversations/:id/team-tasks", teamController.conversationSnapshot);
protectedRouter.get("/conversations/:id", conversationsController.get);
protectedRouter.get("/conversations/:id/session", conversationsController.session);
protectedRouter.get("/conversations/:id/context", conversationsController.context);
protectedRouter.post("/conversations/:id/compact", conversationsController.compact);
protectedRouter.post("/conversations/:id/reviewed", conversationsController.markReviewed);
protectedRouter.patch("/conversations/:id", conversationsController.rename);
protectedRouter.delete("/conversations/:id", conversationsController.remove);

// (Cross-server SSH credentials are managed in the single vault at
// Ajustes → Servidores / `GET /api/servers`; the assistant's own registry was
// retired — the agent's servers.* tools resolve targets from that vault.)

// Projects (group conversations + working dir + instructions).
protectedRouter.get("/projects", projectsController.list);
protectedRouter.post("/projects", projectsController.create);
protectedRouter.post("/projects/repair-workspace", projectsController.repairWorkspace);
protectedRouter.patch("/projects/:id", projectsController.update);
protectedRouter.delete("/projects/:id", projectsController.remove);

// Codebase-graph indexing (solo si el target trae codebase-memory-mcp; la UI
// se oculta cuando /graph/status devuelve available:false).
protectedRouter.get("/graph/status", graphIndexController.availability);
protectedRouter.post("/projects/:id/graph-index", graphIndexController.start);
protectedRouter.get("/projects/:id/graph-index", graphIndexController.status);
protectedRouter.delete("/projects/:id/graph-index", graphIndexController.disable);

// Custom agents (CLI-subagent style): system prompt + tool subset + provider/model.
protectedRouter.get("/agents", agentsController.list);
protectedRouter.post("/agents/suggest", agentsController.suggest);
protectedRouter.post("/agents/propose-from-folder", agentsController.proposeFromFolder);
protectedRouter.get("/agents/:id", agentsController.get);
protectedRouter.post("/agents", agentsController.create);
protectedRouter.put("/agents/:id", agentsController.update);
protectedRouter.delete("/agents/:id", agentsController.remove);

// Agent ROLES (reusable profile assigned to agents: prompt + default tools).
protectedRouter.get("/agent-roles", agentRolesController.list);
protectedRouter.get("/agent-roles/:id", agentRolesController.get);
protectedRouter.post("/agent-roles", agentRolesController.create);
protectedRouter.put("/agent-roles/:id", agentRolesController.update);
protectedRouter.delete("/agent-roles/:id", agentRolesController.remove);

// Agent TEAMS (first-class grouping of agents: name + icon/color + members).
// The list endpoint runs a lazy, idempotent backfill from the legacy name-prefix
// convention ("LUXIPANEL · Rol") and annotates each team's memberCount.
protectedRouter.get("/agent-teams", agentTeamsController.list);
protectedRouter.get("/agent-teams/:id", agentTeamsController.get);
protectedRouter.post("/agent-teams", agentTeamsController.create);
protectedRouter.put("/agent-teams/:id", agentTeamsController.update);
protectedRouter.delete("/agent-teams/:id", agentTeamsController.remove);

// Team templates ("Grupos rápidos de agentes"): curated blueprints of agent
// hierarchies the user can materialise with one click. Templates are seed-only
// (read-only); the apply endpoint creates real agents in the per-server
// `assistant/agents.json` sidecar via `agentsRepository`.
protectedRouter.get("/team-templates", teamTemplatesController.list);
protectedRouter.get("/team-templates/:id", teamTemplatesController.get);
protectedRouter.post("/team-templates/:id/apply", teamTemplatesController.apply);
protectedRouter.post("/team-templates/:id/resync", teamTemplatesController.resync);
protectedRouter.post("/team-templates/:id/apply-missing", teamTemplatesController.applyMissing);
protectedRouter.get("/team-templates/:id/feedback-stats", teamTemplatesController.feedbackStats);

// Team task board (leader→workers delegation): read + cancel. Written by the
// leader's team.* tools; the UI rehydrates progress cards from here.
protectedRouter.get("/team/tasks/active", teamController.active);
protectedRouter.get("/team/tasks/by-worker", teamController.byWorker);
protectedRouter.get("/team/tasks", teamController.tasks);
protectedRouter.get("/team/plan", teamController.plan);
protectedRouter.get("/team/summary", teamController.summary);
protectedRouter.get("/team/tasks/:id/diff", teamController.diff);
protectedRouter.post("/team/tasks", teamController.assign);
protectedRouter.post("/team/tasks/cancel-all", teamController.cancelAll);
protectedRouter.post("/team/tasks/:id/cancel", teamController.cancel);
protectedRouter.post("/team/tasks/:id/feedback", teamController.feedback);
protectedRouter.get("/team/feedback", teamController.feedbackList);

// Mensajería asíncrona agente↔agente (`agents.send_message`): SOLO lectura. Los
// mensajes los escribe la tool del agente emisor por el canal MCP cross; aquí
// solo se consultan (por agente, o por par emisor→destinatario).
protectedRouter.get("/agent-messages", agentMessagesController.list);

// Per-project provider structure (CLAUDE.md, .claude/, AGENTS.md, GEMINI.md…)
// managed as REAL files in the project's working dir on the target.
protectedRouter.get("/projects/:id/structure", projectStructureController.scan);
protectedRouter.post("/projects/:id/structure/scaffold", projectStructureController.scaffold);
protectedRouter.get("/projects/:id/structure/file", projectStructureController.readFile);
protectedRouter.put("/projects/:id/structure/file", projectStructureController.writeFile);
protectedRouter.post("/projects/:id/structure/improve", projectStructureController.improve);

// Office connectors (external MCP tools: Google Drive, etc.). Instance-level;
// connection state + encrypted secrets live on the panel host.
protectedRouter.get("/connectors", officeConnectorsController.list);
protectedRouter.post("/connectors/:id/connect", officeConnectorsController.connect);
protectedRouter.post("/connectors/:id/disconnect", officeConnectorsController.disconnect);
protectedRouter.put("/connectors/:id/active", officeConnectorsController.setActive);
protectedRouter.get("/connectors/:id/files", officeConnectorsController.browse);
protectedRouter.post("/connectors/:id/files/fetch", officeConnectorsController.fetchFile);

// Attachment serving + storage manager.
protectedRouter.get("/attachments/:id", storageController.serve);
protectedRouter.get("/audio/:id", storageController.serveAudio);
protectedRouter.get("/storage", storageController.usage);
protectedRouter.delete("/storage/images", storageController.clearImages);
protectedRouter.delete("/storage/chats", storageController.clearChats);

// Token usage statistics.
protectedRouter.get("/stats/usage", statsController.usage);
protectedRouter.get("/stats/daily", statsController.daily);
protectedRouter.get("/stats/models", statsController.models);
protectedRouter.get("/stats/users", statsController.users);
protectedRouter.get("/stats/savings", statsController.savings);
protectedRouter.get("/stats/cost", statsController.cost);
protectedRouter.get("/stats/usage-summary", statsController.summary);
protectedRouter.get("/stats/cli-quota", statsController.cliQuota);

// Audit log + provider health.
protectedRouter.get("/audit", auditController.list);
protectedRouter.get("/health", auditController.health);

protectedRouter.get("/diagnostics/:domain", diagnosticsController.run);
protectedRouter.post("/diagnostics/:domain/analyze", diagnosticsController.analyze);

// AI Project Map (files module's "Mapa" button): friendly, diagram-based map of
// a project generated by a chosen provider. Gated by the same action as the
// button (files.projects); cached per path under LUXIPANEL_CONFIG_DIR.
protectedRouter.get("/project-map", requireActionPermission("files.projects"), projectMapController.get);
protectedRouter.post("/project-map/generate", requireActionPermission("files.projects"), projectMapController.generate);
protectedRouter.get("/project-map/status", requireActionPermission("files.projects"), projectMapController.status);

// Files editor AI bar: conversational help + structured edits for the file open
// in the Monaco editor. Gated by `files.read` (you must be able to view files);
// the frontend applies any `edit` to the buffer (never writes to disk here).
protectedRouter.post("/files/editor-chat", requireActionPermission("files.read"), filesEditorChatController.editorChat);

router.use("/api/ai", protectedRouter);

export { router as aiRouter };

registerModuleOperations("assistant", protectedRouter, { prefix: "/api/ai", include: path => !path.startsWith("/api/ai/realtime/") });

for (const id of ["google-drive", "onedrive", "dropbox", "notion"]) registerModuleOperations(id, protectedRouter, { prefix: "/api/ai", include: path => path.startsWith("/api/ai/connectors/"), fixedParams: { id } });
