# AI Assistant Module

### Errores de servidores asociados

Las herramientas `servers.exec`, `servers.read_file` y `servers.list_dir`
devuelven fallos estructurados con `code`, `serverId`, `serverName` (cuando
el acceso ya fue autorizado), `message`, `operationStatus` y `nextStep`.
`services/server-tool-error.ts` distingue conexión, autenticación, identidad,
permisos y errores de archivo; los mensajes externos no incluyen excepciones
crudas, comandos ni credenciales. Los códigos quedan en el log del panel.

`not_started` identifica un fallo anterior a la ejecución. `unconfirmed`
obliga a comprobar el estado antes de repetir una mutación, incluso cuando
hubo un intento mediante el panel remoto antes de fallar SSH. La salida de
comandos con un código de salida distinto de cero mantiene su contrato previo.
El prompt pide explicar servidor afectado, tarea pendiente y siguiente paso;
un timeout no demuestra que esté apagado ni que falten permisos o herramientas
MCP. El descubrimiento de `servers.*` incluye el canal `modules.*`.

Drawer-based AI agent that bridges chat UI ↔ LLM provider ↔ the panel's
`AgentCapability` registry. Lives as a global floating drawer in the
frontend (`components/floating-assistant/*`); this module owns the
backend half: configuration, providers, capability gating, CLI install/
login, audit, and the MCP loopback that exposes the registry back to
upstream CLIs running on the connected target.

## Modelos API (verificados el 2026-09-26)

El selector de agentes vive en `frontend/src/components/floating-assistant/assistant-api/providers.ts`;
los modelos iniciales y niveles del enrutador están en
`models/assistant-config.types.ts`. Las listas incluyen solo modelos de chat
con herramientas compatibles con los proveedores implementados:

| Proveedor | Modelos ofrecidos | Modelo inicial |
|---|---|---|
| Anthropic | `claude-opus-5-5`, `claude-sonnet-5`, `claude-fable-5-1`, `claude-haiku-4-5` | `claude-sonnet-5` |
| OpenAI | `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna` | `gpt-6-sol` |
| Google | `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3.7-flash` | `gemini-3.8-flash` |
| DeepSeek | `deepseek-flash`, `deepseek-v4-pro` | `deepseek-flash` |
| xAI | `grok-4.7` | `grok-4.7` |
| MiniMax | `MiniMax-M3`, `MiniMax-M2.7`, `MiniMax-M2.7-highspeed` | `MiniMax-M3` |

OpenAI GPT-6 usa Responses API para conservar razonamiento y llamadas a herramientas;
los modelos OpenAI anteriores siguen por Chat Completions. Gemini 3.8 devuelve
un identificador por llamada de función que el proveedor debe copiar en la
respuesta. DeepSeek Flash y MiniMax M3 aceptan imágenes; DeepSeek V4 Pro y
MiniMax M2.7 no. Los alias guardados `deepseek-chat`, `deepseek-reasoner` y
`MiniMax-M3[1m]` se resuelven a sus modelos vigentes al ejecutar, sin reescribir
automáticamente la configuración del usuario.

Fuentes: [modelos OpenAI](https://developers.openai.com/api/docs/models),
[compatibilidad de GPT-6](https://developers.openai.com/api/docs/guides/latest-model),
[Anthropic](https://platform.claude.com/docs/en/models/overview),
[modelos Google](https://ai.google.dev/gemini-api/docs/models),
[funciones Gemini 3](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5),
[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/),
[visión DeepSeek](https://api-docs.deepseek.com/guides/vision/),
[xAI](https://docs.x.ai/developers/models),
[MiniMax](https://platform.minimax.io/docs/api-reference/text-anthropic-api).

## Layout (post-refactor 2026-07-01)

Big pieces were split for maintainability — behaviour unchanged:

- `services/providers/cli/` — the CLI bridge's building blocks:
  `shell.ts` (loginShell/quoteArg/nohup helpers — import shell utilities from
  HERE, don't re-copy them), `cli-specs.ts` (per-provider launch specs +
  parsers), `cli-sudo-askpass.ts`, `cli-minimax-wrapper.ts`, `cli-session.ts`
  (resume/self-heal/codex homes/`buildPromptWithContext`).
  `cli-bridge.provider.ts` is the runner/orchestrator on top.
- `services/system-prompt-builder.ts` — ALL system-prompt assembly
  (`buildSystemPrompt`); keeps the prompt-cache stability invariant (stable
  blocks before LANGUAGE OVERRIDE, volatile `systemContext` separate).
- `services/turn-queue.service.ts` — connection-independent turn pipeline
  (persist/translate/run/drain + team-nudge listener); the controller keeps
  SSE/transport only.
- `seed/templates/*.ts` — team-template data split per category;
  `team-templates.seed.ts` re-assembles `TEAM_TEMPLATES` in the original order.
- Cross-module coupling goes through `shared/` bridges (fail-open provider
  callbacks registered at boot): `shared/system-stats` (monitor),
  `shared/module-state` + `shared/panel-settings` (admin).
- `services/graph-index.service.ts` + `controllers/graph-index.controller.ts` —
  codebase-graph indexing per project (see §Codebase graph below).

## Architecture (request lifecycle)

```
POST /api/ai/agent ──────► agentService.run()
                                │
                                ├─► assistantConfigRepository.load(executor)
                                ├─► assistantModulesService.allowedTools(executor)
                                ├─► buildProvider(config) ──► one of:
                                │   • claude-api / openai-api(codex|deepseek) / gemini-api
                                │   • cli-bridge.provider  ← spawns CLI on target via SSH
                                └─► provider.run(messages, { systemPrompt, tools, signal })
                                       │
                                       ├─► yields {text,tool_use,tool_result,done,error}
                                       └─► capability handlers run inside runWithExecutor
```

Every per-target state lives in sidecars under
`${LUXIPANEL_CONFIG_DIR}/assistant/` on the connected server:

| Sidecar | Purpose |
|---|---|
| `config.json` | Active provider + API key / model + CLI install/login status per provider, plus general-settings prefs: `uiMode`, `voice`, `approval`, `autoRouting`, `translation`, and the default-tab selects `defaultAgentsTab`/`defaultConversationsTab` (per-user namespaced `config-u<uid>.json`; persisted so the Settings-modal selects survive a reconnect — they are NOT localStorage-only) |
| `modules.json` | Per-target module/tool enable + `requireConfirm` toggles |
| `audit.json` | Last ~200 tool invocations (timestamp, tool, success, duration, userId) |

**Per-turn model override**: the chat's model selector travels as `body.model`
→ `agent.service` patches the provider slot **in-memory only** (never persisted
to the sidecar) for BOTH modes: `slot.api.model` (API) and `slot.cli.model`
(CLI → claude/codex `--model`, gemini `-m`, grok `GROK_MODEL` env, minimax
`ANTHROPIC_MODEL` env — the MiniMax endpoint rejects `--model` on this surface,
so the wrapper reads the env instead; no selection → wrapper default). An
agent-bound run stays LOCKED to the agent's provider/model (overrides ignored);
with no override and API mode, the auto-router picks the tier.

## Market interno y perfiles multiproyecto

Contrato de backend: [agent-market-contract.md](docs/agent-market-contract.md).
Se reutilizan agents/projectIds del target conectado: specialty/technologies en
el perfil, profile/technologies declarados en el proyecto y assignments dentro
del mismo agente. No hay publicación, pagos, copias de agentes ni migración de
datos al host del panel.

agent-context.service resuelve un proyecto y su asignación para chat, equipo,
delegación, mensajes, voz, cola y recuperación. Nunca une otros projectIds raíz:
rutas/grafos del proyecto activo y sus descendientes; instrucciones/skills y
servidores de sus ancestros autorizados. Las restricciones intersectan la sesión,
el perfil y la asignación. Varios vínculos sin selección devuelven
ASSISTANT_PROJECT_REQUIRED; herencia y campos exactos están en el contrato.

agent-market.service serializa retirada/admisión por target/agente y bloquea
con ASSISTANT_ASSIGNMENT_BUSY ante runs, tareas, colas, preguntas/aprobaciones
o mensajes pendientes. agent-activity.repository comprueba estado durable en el
mismo target sin exponer otros historiales. Retirar conserva id e historial;
el projectIds antiguo pasa por el mismo guard. La reparación del workspace no
reasigna perfiles multiproyecto ni revive vínculos retirados, y borrar un
proyecto requiere retirar sus miembros efectivos primero.

El mutex presupone el backend de una instancia configurado en el ecosystem;
no coordina dos procesos/nodos. Los controles de rutas/herramientas del panel
no son un sandbox Linux: no inspeccionan shell libre ni accesos nativos del CLI.
No cambia el contrato de login, SSO, SSH o Executor; no requiere cambios en
LP-LICENSE-SERVER ni variables de entorno nuevas.

## Endpoints

### Chat / agent
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/ai/status` | Admin | enabled + active provider snapshot (no secrets) |
| POST | `/api/ai/chat` | Admin | single-turn, non-streaming |
| POST | `/api/ai/agent` | Admin | SSE stream of `AgentEvent`s. With a `conversationId` the run is **decoupled** from the connection (see below) |
| GET | `/api/ai/agent/stream` | Admin | SSE: attach to an EXISTING run (`?conversationId=&fromSeq=`) without starting one; `204` when none buffered → reload history |
| POST | `/api/ai/agent/stop` | Admin | abort an in-flight run (`{conversationId}`) |
| GET | `/api/ai/diagnostics/:domain` | Admin | DNS / mail diagnostics |
| POST | `/api/ai/diagnostics/:domain/analyze` | Admin | runs diagnostics + asks the agent to explain |

### Team task board (leader → subordinate delegation)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/ai/conversations/:id/team-tasks` | Admin | **rehydration snapshot** by leader `conversationId`: ALL delegated tasks (running + terminal, reconciled) in assignee-first shape (`taskId`, `assigneeAgentId`, `assigneeName`, `state`, `childConversationId`, `planId`, `stepIndex`, timestamps) + the plan header + `total`/`completed`/`terminal` counters. Lets the frontend rebuild the "Equipo trabajando" process block from history after a reload (one fetch on thread load). |
| GET | `/api/ai/team/tasks?conversationId=` | Admin | board of a leader chat (reconciled: stale orphans get closed from the worker chat) |
| GET | `/api/ai/team/tasks/active` | Admin | every non-terminal task (Dashboard "equipos trabajando") |
| GET | `/api/ai/team/plan?conversationId=` | Admin | latest `team.plan` of a leader chat |
| GET | `/api/ai/team/summary?conversationId=` | Admin | tokens/duración del líder + cada worker (por tarea y total) |
| GET | `/api/ai/team/tasks/:id/diff` | Admin | diff completo de la rama de la tarea (vivo) o preview persistido |
| POST | `/api/ai/team/tasks` | Admin | alta MANUAL de tarea (mismas validaciones que team.assign) |
| POST | `/api/ai/team/tasks/cancel-all?conversationId=` | Admin | cancela todas las no-terminales + cierra el plan activo |
| POST | `/api/ai/team/tasks/:id/cancel` | Admin | stop the worker run + close the task as canceled |
| POST | `/api/ai/team/tasks/:id/feedback` | Admin | 👍/👎 del usuario sobre una tarea terminada (upsert) |
| GET | `/api/ai/team/feedback?conversationId=` | Admin | votos del board (rehidratación) |
| POST | `/api/ai/team-templates/:id/apply-missing` | Admin | materializa SOLO los slots faltantes aceptados tras un resync |
| GET | `/api/ai/team-templates/:id/feedback-stats` | Admin | calidad agregada por plantilla/slot (per-server) |

## Team delegation (leader agents: plan → assign → collect → synthesize)

A **leader** agent (has subordinates via `parentAgentId` + supervisor
permission `canSpawnChats` on the agent or its role), running **API-mode in a
persisted conversation**, gets the `team.*` toolkit on top of the pre-existing
`agents.delegate` (synchronous Q&A) and `chats.create` (fire-and-forget):

- `team.plan` — persists a `TeamPlan` (title/goal/steps) shown as a live
  checklist in the leader's chat.
- `team.assign` — spawns a REAL background chat for a subordinate (same
  mechanics as `chats.create`, shared `spawnWorker()` helper in
  `team-tasks.service.ts`) and anchors a persistent `TeamTask` on the board
  (`${LUXIPANEL_CONFIG_DIR}/assistant/team-tasks.json`, per-server). Returns a
  `taskId` immediately.
- `team.status` — compact snapshot, no wait.
- `team.collect` — waits (bounded: default 300 s, cap 1800 s) for the listed
  tasks to reach a terminal state and returns their results (budgeted:
  ≤4000 chars/task, ≤16000 total). Marks them `collected`.

The leader's system prompt gains an enriched roster (role, provider/model,
tools, projects per subordinate) + a coordination protocol (plan → assign the
right specialist → parallelize → collect → synthesize, never paste raw worker
output). Live progress reaches the leader's open SSE stream as
`team_task_update` events (`agentRunRegistry.inject`, same mechanism as the
permission broker); the UI renders progress cards (`TeamTaskBoard.tsx`) and
rehydrates from `GET /api/ai/team/tasks` after a reload.

**Wake-up (hybrid delivery).** If the leader's turn ends while tasks are still
running (collect timed out), `team-tasks.service` watches the closes: when the
last un-collected task of the conversation settles with no live leader run and
no collect waiting, it emits `AI_TEAM_LEADER_NUDGE`; `agent.controller`'s
listener enqueues an **automatic follow-up turn** (`QueuedTurn.auto`, skips
background translation, rendered as a system chip) with the **results inlined**
(budgeted: ≤3000 chars/task, ≤12000 total; tasks marked `collected`) and drains
it — the leader wakes up, synthesizes and delivers in its own chat. Results are
inlined rather than "call team.collect" because a drained turn has no HTTP
request → a CLI leader would have no cross MCP channel to call tools through;
inlining is mode-agnostic. Tasks are marked `nudged` before emitting so a model
that ignores the nudge can't loop. Task closes are idempotent (`running →
terminal` only,
atomic sidecar transaction) because three paths may race: the spawn's
`onComplete`, the `AI_CHAT_FINISHED` listener (covers CLI runs recovered after
a restart, whose `onComplete` isn't ours), and the lazy reconciliation in
`listForLeaderConversation` (closes stale orphans from the persisted worker
chat — no background loop). `AI_TEAM_PLAN_COMPLETED` fires when every plan
step settles → bell notification (modules/notifications).

Safety rails: team tools require the leader's own `conversationId` (delegated
sub-runs never get them → no leader-inside-leader fan-out via this path),
`delegationDepth < 3`, ≤12 assigns/run AND ≤12 non-terminal tasks per leader
conversation (board-enforced — covers the MCP channel where the per-run
counter resets per call), worker `projectId` validated against the worker's
project closure, and the SNAPSHOTTED `SessionUser` of the assignment rides on
the task so the nudge/re-wake keeps the exact tool/CLI gating. The user's stop
only releases the collect wait (workers keep running; cards offer per-task
cancel).

### CLI leaders (team tools over the per-run cross MCP channel)

A CLI run using Claude, Minimax or Codex with `panelOrigin` and a signed
`crossMcpToken` attaches the per-run cross MCP channel
(`/api/ai/mcp/cross`, registered as `luxipanel-servers`). When that channel's
conversation is bound to a LEADER agent, `mcp-server.service` resolves the
`team.*` toolkit per call via `buildTeamToolsForConversation` (team-tools.ts)
and lists/dispatches it next to `permissions.approve` — channel-scoped, NOT in
the capability registry (the tools are run-scoped: they anchor to that
conversation and enforce that leader's subordinate set). The CLI addresses
them by wire name (`mcp__luxipanel-servers__team__assign`, …,
`TEAM_TOOL_WIRE_NAMES`); agent.service injects the roster + protocol block
with those names into the CLI leader's prompt (`cliPrompt: true` variant, no
`agents.delegate`/`chats.create` notes — those don't exist on this channel).
`team.collect` is capped at **240 s** on this channel (a tools/call blocks one
HTTP request end-to-end; proxies cut long-idle requests) — longer work is
delivered by the nudge, which is mode-agnostic (the drained auto turn goes
back through the CLI bridge with session resume). Local sessions can mint the
token without a bridge; remote targets still require their valid session.
Without the channel, the prompt reports unavailable coordination and keeps
the configured mode instead of switching to API.
Live `team_task_update` events can't reach a CLI leader (its loop is the
upstream CLI's), so in-chat progress comes from the board REST rehydration;
the model polls with `team.status`.

Every agent, including leaders and delegated workers, uses the CLI/API mode
saved for its selected provider in Settings → Credentials → AI agents. An
explicit provider selection takes precedence over the agent's assigned
provider; otherwise that assignment applies. The global default's mode never
overrides another provider's mode. Each new turn reloads the saved settings,
including follow-ups in an existing chat; a running turn keeps its transport.
A saved API key does not authorize an automatic API fallback, and an API
failure does not authorize a CLI fallback.
Codex receives the team channel in its private conversation `config.toml`,
with fresh credentials and a 300-second tool timeout. Inherited team entries
are stripped before attaching the current channel, alongside the existing
graph and module channels. Failed setup prevents launch. Codex CLI uses its
own login; the panel no longer injects its saved OpenAI API key into CLI runs.

## Mensajes agente↔agente (`agents.send_message`) — destino de entrega (2026-08-25)

`agent-messages.service.send` persiste el mensaje (`pending`) y emite
`AI_AGENT_MESSAGE`; `turn-queue.service.initAgentMessageListener` lo ENTREGA.
`resolveAgentMessageDelivery(executor, message)` decide el chat destino, en
este orden — un mensaje **nunca abre un chat nuevo** mientras haya relación de
equipo o run en curso (antes, un worker escribiendo a su líder en mitad de
`team.collect` creaba un "Handoff de …" + sesión CLI nueva):

1. **worker → líder**: la tarea del emisor (`findByWorkerConversation`) apunta al
   destinatario como `leaderAgentId` → `task.leaderConversationId` (aunque la
   tarea ya haya terminado: ese chat es el contexto del equipo).
2. **líder → worker**: tareas del chat emisor con `workerAgentId` = destinatario →
   `workerConversationId` de la más reciente no terminada (si no, la más reciente).
3. **destinatario con run activo** (`agentRunRegistry.activeRuns()` + meta.agentId).
4. **buzón existente** del par (entrega previa cuyo chat sobrevive).
5. Solo si nada aplica: se crea el buzón (`mailboxTitle`).

Entrega: si el destino tiene run activo → `cliJobTracker.steerConversation`
(FIFO de steering de la CLI); si entra, NO se encola (se persiste como mensaje
`user` `auto:true` para el historial) y el mensaje pasa a `delivered`. Si no hay
steering (run API / steering off) → turno `auto` encolado en ESE chat; el
`onComplete` del run en curso drena la cola (agent.controller). Sin run → encolar
+ `drainConversationQueue` (despierta al destinatario). La coletilla del turno
cambia en chats de equipo ("Este mensaje llega a tu chat de equipo…").

Cierre `delivered → read` (`agent-messages.service.init`, `AI_CHAT_FINISHED`):
se omite mientras el texto del mensaje siga en la cola de ese chat (turno auto
aún no drenado), para que el run que acaba de terminar no lo marque leído sin
haberlo visto. Limitación: un mensaje *steered* en un run que luego el usuario
detiene (abort) no dispara `AI_CHAT_FINISHED` y queda `delivered`.

## Team v2 — aislamiento, verificación, presupuestos (2026-07-02)

La capa de equipos pasó de "coordinación de prompts" a pipeline de desarrollo:

- **Aislamiento por worktree** (`team-isolation.service.ts`): cada tarea con
  proyecto git corre en `<repoRoot>/.lxp/worktrees/<taskId>` + rama
  `lxp/task-<taskId>` (cwd forzado vía `AgentRunOptions.forcedCwd`, que GANA a
  `project.path` conservando el contexto del proyecto). Al cerrar: auto-commit
  + captura de artefactos (`TeamTask.artifacts`: filesChanged/numstat/
  diffPreview) + `worktree remove` (la rama sobrevive en done/failed). Paths
  no-git → **lease** in-process que serializa escritores del mismo path (la
  tarea difiere: `pending` + turno inicial persistido en agent-queue, despacha
  vía `AI_TEAM_TASK_DISPATCH` al liberarse; sobrevive reinicios porque
  `recoverServerRuns` re-drena). Jail ADITIVO: el project.path queda en
  jailPaths (vault/grafo/lecturas + el worktree necesita el `.git` padre);
  el confinamiento de escritura al worktree es por prompt + diff + verify.
  Kill-switch `ASSISTANT_TEAM_ISOLATION_ENABLED`. Huérfanos: sweep perezoso en
  cada assign.
- **`team.integrate`** (5ª tool del líder): mergea la rama de una tarea `done`
  al checkout principal (ff-only → --no-ff → conflictos devueltos al líder,
  merge abortado; checkout sucio → rechaza). OK → borra rama+worktree. REST:
  `GET /api/ai/team/tasks/:id/diff` (rama viva o preview persistido).
- **Verificación ejecutable** (`team-verify.service.ts`): receta por proyecto
  (`AssistantProject.verify {commands ≤10, timeoutMs}`) que corre ANTES de
  cerrar una tarea `done` (cwd = worktree). Falla con intentos restantes → la
  tarea SIGUE `running` y `AI_TEAM_TASK_VERIFY_RETRY` encola un turno AUTO de
  corrección en el chat del WORKER (log + forcedCwd + user snapshot); su cierre
  re-entra por `AI_CHAT_FINISHED` → el gate converge (pasa / reintenta /
  `failed` tras `ASSISTANT_TEAM_VERIFY_MAX_RETRIES`). Overrides del modelo
  (`team.assign.verifyCommands`) rechazados salvo
  `ASSISTANT_TEAM_VERIFY_ALLOW_OVERRIDE` (+ sin sudo + auditado). Cancel y
  reconciliación cierran con `skipVerify`.
- **Cierre único** `finalizeTask` (mutex in-process por task): serializa
  onDone vs `AI_CHAT_FINISHED`, aplica gate → artefactos → cleanup → patch
  terminal → nudge/plan → `dispatchNext()`.
- **Presupuestos de tokens**: por tarea (`ASSISTANT_TEAM_TASK_TOKEN_BUDGET`,
  override `team.assign.maxTokens`) y por plan
  (`ASSISTANT_TEAM_PLAN_TOKEN_BUDGET`); enforcement en el loop de
  `waitForTasks` + sweeper (`ASSISTANT_TEAM_BUDGET_CHECK_MS`) sobre
  `agentRunRegistry.activeRuns()`; excedido → stop + `failed`. Los workers API
  ahora SÍ registran uso (`makeUsageRecorder` en `startWorkerRun`, extraído a
  `usage-recorder.ts`) y `artifacts.tokens` se sella al cerrar.
- **Cupo de workers** `ASSISTANT_MAX_WORKER_RUNS` (por usuario, aparte del cap
  HTTP): sin hueco → tarea diferida (no falla). Contador in-process (se
  repuebla con runs nuevos tras reinicio; CLI recuperados no cuentan).
- **Memoria compartida del plan**: `TeamPlan.sharedNotes` (≤4000; param
  `notes` de `team.plan` + tool **`team.note`**) se prependa SOLO-LECTURA al
  texto de cada worker del plan (≤2000). El board guarda la tarea original.
- **Allowlists validadas** (`tool-allowlist.ts`): agentes/roles/overrides de
  plantilla validan contra el registro (aliases legacy migran: `files.list→
  files.list_dir`, `terminal.run→admin.bash`, …; desconocidos → 400 con
  sugerencias); el read-path de runtime normaliza sidecars viejos. Seeds
  reescritos con sets canónicos (`seed/templates/tool-sets.ts`) + test guardia
  (`seed/team-templates.seed.test.ts`).
- **Limpiezas**: el orquestador multi-copias se degrada a run único si el
  toolset tiene herramientas mutantes (`hasMutatingTools`, gate de
  solo-lectura — el trabajo paralelo con escritura es de team.assign);
  `chats.create` queda **deprecated** (tool registrada para equipos viejos,
  sin bloque de prompt nuevo).
- Env nuevas: ver bloque "Equipos v2" en `config/env.ts`.

### Verificación visual (browser.*) — 2026-07-02

Capability `browser` (`browser-agent-capability.ts`, registrada en `index.ts`
tras `serversAgentCapability`, kill-switch `ASSISTANT_BROWSER_TOOLS_ENABLED`):
Chromium **headless en el servidor conectado** para que un QA compruebe el
resultado RENDERIZADO de trabajo web — solo cuando la tarea lo requiera (las
descripciones lo imponen; toggle por módulo en la pestaña Modules).

- `browser.discover_urls` (read): descubre QUÉ sirve el servidor SIN preguntar
  al usuario — parsea vhosts nginx (`server_name`/`root`/`proxy_pass`, sin
  sudo) + puertos web en escucha (`ss -ltn`; `http://127.0.0.1:<p>` funciona
  porque Chromium corre EN el target). `path` opcional (worktrees normalizados
  a la raíz del repo) prioriza los vhosts que sirven el proyecto
  (`matchesPath`). Prompts de QA/builder ordenan usarla antes que preguntar.
- `browser.check` (read): HTTP status + URL final (curl) + título/DOM/errores
  de consola (`--dump-dom --enable-logging=stderr`).
- `browser.screenshot` (read): PNG en el target (`--screenshot`,
  `--window-size`, default `${ASSISTANT_BROWSER_SHOT_DIR}`; `outPath` opcional
  validado contra el jail). Un agente **CLI** lo LEE con su tool Read nativa
  (visión real); API-mode recibe la ruta + señales de check. El base64 NUNCA
  va en el output (headroom).
- **Instalación por el agente**: probe fail-open con TTL 10 min (patrón
  graph-index); sin chromium las tools devuelven el comando `apt-get install
  -y chromium` para que el agente lo ejecute vía `admin.bash` (broker de
  permisos en modo manual). Sin endpoint de instalación.
- Jail: si el run permite `browser.screenshot` y tiene jail activo,
  `system-prompt-builder` añade `ASSISTANT_BROWSER_SHOT_DIR` a jailPaths
  (→ `--add-dir` del CLI); con jail vacío NO se toca (vacío = sin restricción)
  y el agente usa `outPath` bajo su cwd.
- `moduleId:"browser"` sin mapeo de sidebar ⇒ admin-only para no-admins
  (intencional). `TOOLS_QA` de los seeds incluye ambas tools; QA_PROMPT las
  menciona (las `translations` de los seeds quedan un punto por detrás hasta
  la próxima pasada offline de traducción — el español es la fuente de verdad).
- Fuera de alcance: navegación interactiva (click/type), imagen en tool_result
  API-mode.
- **Credencial de pruebas por agente (login QA)**: `AssistantAgent.credential`
  — UNA sola `{label?, username, secret}` definida por el usuario en el editor
  (Recursos). La API HTTP SIEMPRE la redacta (`{username, hasSecret:true}` —
  reemplazar/quitar, nunca releer); el único consumidor del secret es
  `system-prompt-builder`, que la inyecta en el prompt estable del agente con
  reglas duras: solo contra la app bajo prueba, cookie-jar temporal, NUNCA en
  respuestas/commits/logs ni hacia otros dominios. Sanitizado en
  `sanitizeAgentCredential` (sin \n/\r, caps 120/240).

### Configuration (per target)
| Method | Path | Description |
|---|---|---|
| GET | `/api/ai/config` | redacted config |
| PUT | `/api/ai/config` | toggle `enabled` / `activeProvider` |
| PUT | `/api/ai/config/providers/:id` | set `mode`, `api.{apiKey,model,baseUrl}`, `cli.*` |
| POST | `/api/ai/config/providers/:id/test` | quick `ping()` (no tokens spent) |

### Modules gating
| Method | Path | Description |
|---|---|---|
| GET | `/api/ai/modules` | resolved capability list (registry × sidecar) |
| PUT | `/api/ai/modules/:id` | enable/disable a module |
| PUT | `/api/ai/modules/:id/tools/:tool` | toggle `enabled` / `requireConfirm` per tool |

### CLI install / login (each provider runs on the **target**)
| Method | Path | Description |
|---|---|---|
| GET | `/api/ai/cli/specs` | per-provider bin / installCmd / loginCmd / supported |
| GET | `/api/ai/cli/:provider/status` | `which` + `--version` + login-file probe |
| POST | `/api/ai/cli/:provider/install` | SSE stream of `npm i -g …` running on target |
| WS | `/api/ai/cli/:provider/login/ws` | interactive PTY for the login flow |

### Audit + health
| Method | Path | Description |
|---|---|---|
| GET | `/api/ai/audit?limit=N` | last N invocations |
| GET | `/api/ai/health` | `provider.ping()` of the active provider |

### MCP loopback (Bearer-authed, not session-authed)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/mcp` | `Authorization: Bearer <jwt>` | JSON-RPC 2.0 — `initialize`, `tools/list`, `tools/call` |
| POST | `/api/ai/mcp/tokens?provider=<id>` | Admin session | mints a 30-day JWT + the CLI-specific config snippet |

The MCP route **must stay mounted before** any other module that does
`router.use(requireAuth)` on the root path — otherwise the upstream auth
middleware swallows the request before the Bearer handler runs. See the
order in `server.ts` (`registerAiModule` sits right after auth / bridge /
secret-rotation).

## Decoupled runs (survive a dropped connection)

A run started **with a `conversationId`** is owned by `agent-run-registry.ts`,
not by the HTTP request. It executes inside an explicit
`runWithExecutor(executor, …)` scope (per-server ALS survives the request
ending), buffers every event with a `seq`, and **persists the turn on
completion regardless of whether a client is still listening**.

Why: the assistant streams over one long-lived SSE/`fetch` connection that, on
mobile, lives inside the app's WebView renderer. Switching apps freezes the
renderer and tears down the socket — *not* a loss of internet. The old code
wired `req.on("close") → ac.abort()`, so that transport drop cancelled the run
and the bubble showed "Network error". Now `POST /api/ai/agent` just *attaches*
to the registry run; a dropped connection detaches without aborting. The client
(`chat-engine.ts`) resumes on `visibilitychange`:

- `GET /api/ai/agent/stream?conversationId=&fromSeq=` → replays only events
  after `fromSeq` (via `Last-Event-ID`) and streams the rest live;
- `204` → the run already finished + persisted (or was GC'd after ~2 min) →
  the client reloads the conversation history instead.

Explicit user "stop" no longer relies on dropping the socket: the client calls
`POST /api/ai/agent/stop` which aborts the registry run's `AbortController`.

Runs **without** a `conversationId` (only when conversation-create failed —
nothing to persist/reconcile) keep the legacy request-bound behaviour
(abort-on-close).

## CLI session continuity + resume self-heal

In **cli mode** each conversation keeps upstream memory by resuming the agent
CLI session instead of resending everything. `repositories/cli-sessions.repository.ts`
stores per-conversation markers (`claude` session UUID / `codex` session UUID) in the
per-server sidecar `${LUXIPANEL_CONFIG_DIR}/assistant/cli-sessions.json`. Turn 1
mints a UUID and launches `claude -p --session-id <uuid>`; later turns launch
`claude -p --resume <uuid>`. Codex now persists the session id created by
`codex exec` and resumes with `codex exec resume <session-id>` instead of
`--last`, so each LUXIPANEL conversation binds to its own upstream Codex thread.

**Trap:** `claude --resume <id>` can return `No conversation found with session ID`
(it prints to stderr but **exits 0**) — transiently even for an on-disk session,
and always when run from a cwd whose project dir differs from where the session
was created. Because every later turn resumes the stored marker, a single such
failure used to wedge the chat permanently (the raw error reached the user).

`cli-bridge.provider.ts` now **self-heals**: each launch+stream is one
`runAttempt()`; if a resume attempt's captured output matches
`/No conversation found with session ID/i` (and the SSE is still attached), it
re-mints a fresh session UUID, persists it (so future turns resume the *new*
session), and relaunches once with the full transcript prompt
(`buildPromptWithContext`) so memory survives. Detection is output-string based
because the exit code is unreliable here.

Codex CLI also retries a failed `server_overloaded` turn at most twice (after
10 and 30 seconds). The retry resumes the same thread with a continuation
prompt that first checks completed side effects, rather than repeating the
original request. If a resumed thread is genuinely unavailable, one fresh
session replays the bounded conversation transcript. Exhausted retries remain
visible as a failed turn; external model capacity cannot be guaranteed.

Codex permits only one writer per thread. Before resuming, the bridge checks
for a live writer on the connected target and waits for it to finish. New jobs
sharing a conversation `CODEX_HOME` also use `flock`. If a backend restart or
failed duplicate resume loses the job descriptor, drawer-open recovery matches
the live writer to this user's saved CLI session and reattaches its original
log. The job tracker keeps runs older than 30 minutes while their process lives.

## Provider modes

```
                ┌──────────┐
                │ activeProvider in sidecar
                ├────┬─────┬────────┬──────────┐
                │ claude  │ codex  │ gemini   │ deepseek │
                └────┴─────┴────────┴──────────┘
                  ▲       ▲          ▲           ▲
                  │       │          │           │
   per-provider mode ∈ { "api", "cli" }
                  │
   ┌──────────────┴──────────────┐
   │                              │
 api mode                       cli mode
 ──────────────                 ──────────────
 fetch upstream API,            spawn `<bin> -p <prompt>`
 use capability tools           on target via SSH executor,
 via Anthropic / OpenAI         stream stdout back as
 / Gemini wire format.          AgentEvents. CLI brings its
                                own tools; loopback MCP can
                                additionally expose the
                                panel's capability registry.
```

Adapter helpers (`shared/agent-capability/adapters/*`) translate
capability names with dots (`monitor.cpu_top`) to provider-safe wire
names (`monitor__cpu_top`) and back.

## Capability registry

Every module registers its capability from `index.ts`:

```ts
import { agentCapabilityRegistry } from "../../shared/agent-capability/index.js";
import { fooAgentCapability } from "./agent-capability.js";

export function registerFooModule(app: Express): void {
  app.use(fooRouter);
  agentCapabilityRegistry.register(fooAgentCapability);
}
```

Handlers run inside `runWithExecutor(executor, …)` so they resolve the
right per-target executor via `requireExecutor()` (helper in
`shared/agent-capability/context.ts`).

Capabilities currently shipping (16 modules registered at boot; `hosting`
ships a capability too but only loads if `registerHostingModule` is added
to `server.ts`):

| Module | Tools | DataPanels |
|---|---|---|
| admin | `admin.bash`, `admin.restart_service` | `admin.health` |
| monitor | `monitor.cpu_top` | `monitor.snapshot` |
| nginx | `nginx.list_sites`, `nginx.tail_access_log` | — |
| mail | `mail.list_domains` | — |
| firewall | `firewall.ufw_status`, `firewall.fail2ban_status` | — |
| ssl | `ssl.list_certs` | — |
| cron | `cron.list` | — |
| files | `files.read`, `files.list_dir` | — |
| webhooks | `webhooks.list` | — |
| backup | `backup.list_jobs` | — |
| security-audit | `security-audit.last_report`, `security-audit.ssh_posture` | — |
| users | `users.list` | — |
| hosting | `hosting.list_accounts` | — |
| openclaw | `openclaw.config`, `openclaw.test_connection` | — |
| dashboard | `dashboard.overview` | `dashboard.snapshot` |
| module-dev | 12 tools `module-dev.*` (validate_manifest, run_checks, run_tests, list/status, submit/resubmit, unpublish/republish, preview_install/uninstall, link_project) | — |
| browser | `browser.discover_urls`, `browser.check`, `browser.screenshot` (Chromium headless en el target; QA visual) | — |

## Marketplace orchestration (module-dev, F1b)

The assistant orchestrates the AI-guided marketplace module flow on top of
the `module-dev` module (which owns the tools/API):

- **Project ↔ module link** — `shared/marketplace-link` sidecar
  (`${LUXIPANEL_CONFIG_DIR}/marketplace-link/links.json`, per target) maps an
  assistant project to a marketplace module slug. Written by `/mod vincular`.
- **`/mod` slash command** (`slash-commands.service.ts`) — subcomandos
  `ayuda | vincular <slug> | estado | enviar <prUrl> | reenviar <prUrl> |
  probar | preview | despublicar | republicar`. `vincular` is handled locally;
  the rest return a `SlashResult.rewrite` that instructs the provider to call
  the matching `module-dev.*` tool. `agent.service.run` is the only call-site
  (signature: `handle(message, { executor, projectId, user })`). Slash turns
  skip background translation (guard in `agent.controller.ts`).
- **Marketplace system prompt** (`marketplace-prompt.ts`) —
  `buildMarketplacePromptBlock(link, { cliMode })` is injected in
  `agent.service.run` after the project block (always before the LANGUAGE
  OVERRIDE) when the active project has a marketplace link. It carries the
  manifest/SDK hard rules and the onboarding ask-protocol script (CLI-mode).
- **Architecture pack** (`project-structure/structure-templates.ts`) — when a
  project is linked, `getProviderStructure(provider, { marketplace })` adds
  `modules/<slug>/` (draft `module.manifest.json` without AUTO fields,
  `backend/index.js` defineModule skeleton, `frontend/`, README) plus provider
  rules (`.claude/rules/marketplace.md` or root `MARKETPLACE.md`).
  `TemplateContext` gains `moduleSlug`/`moduleName`/`sdkVersion` (from
  `shared/module-sdk` `SDK_VERSION`).
- **Preview visibility filter** (`assistant-modules.service.ts`) — community
  modules installed as PREVIEW (`shared/community-preview` registry) are only
  visible/usable by their owner (`String(user.userId) === meta.ownerUserId`);
  no user in scope → hidden (fail-closed). `allowedDataPanels` always excludes
  previews. Known v1 limit: `mcp-server.service.ts` calls `allowedTools(null)`
  without a user, so PREVIEW tools are not exposed over MCP even to the owner
  (core `module-dev.*` tools ARE exposed); the test dispatch path is
  `POST /api/module-dev/preview/:moduleId/tool/:name`.

## Skills / métodos activables (Access tab)

Registro extensible de "skills/métodos" que afinan el comportamiento del
asistente, cada uno con un **switch** en la pestaña **Access** del drawer. Estado
por-target en el sidecar `${LUXIPANEL_CONFIG_DIR}/assistant/skills.json`
(`load`/`setSkill`, doc `current`).

- Registro: `services/skills/registry.ts` (`assistantSkills[]`, `getSkill`,
  `defaultAssistantSkillsMap`). Cada skill implementa `AssistantSkill`
  (`services/skills/skill.types.ts`) y es `kind:"prompt-block"` (aporta
  `systemPromptBlock(state, ctx)`) o `kind:"behavior"` (su `enabled` gatea lógica
  ya existente en `agent.service.ts`).
- **Agrupación por categoría:** cada skill tiene `category` (id de
  `services/skills/categories.ts` → `SKILL_CATEGORIES`, ordenadas con
  `defaultOpen`). La Access tab agrupa los switches por `categoryLabel` en
  secciones colapsables (los grupos "Métodos del asistente" y "Calidad de código"
  abiertos; el catálogo grande colapsado). El registry se ordena para casar con
  `SKILL_CATEGORIES` (orden de primera aparición = orden de grupos en la UI).
- **Catálogo (`services/skills/catalog/`):** set grande **opt-in** (1 archivo por
  categoría, ~67 skills) construido con el factory `catalogSkill(spec)`
  (`catalog/factory.ts`): todos `prompt-block`, `defaultEnabled:false`, bloque
  corto (`### <nombre>` + guía terse en español). Para añadir más: una entrada
  `catalogSkill({...})` en el archivo de su categoría; el switch en la UI es
  automático. Categorías: web-fullstack, mobile, code-agents, reusable-skills,
  ui-ux, security, token-savings, ai-prod, devops, testing, data-rag, automation.
- Resolución: `assistantSkillsService.resolve(executor)` mezcla defaults del
  registro con el estado guardado → `{ list, isEnabled(id), optionOf(id,key),
  promptBlocks(ctx) }`. `agent.service.run` lo llama una vez y: inyecta
  `promptBlocks({cliMode})` en el `systemPrompt` estable (cacheable, antes del
  LANGUAGE OVERRIDE); gatea `ask-protocol` (tool `lxp_ask`/ASK_PROTOCOL_PROMPT) y
  `project-context-vault` (bloque Obsidian + hint `obsidian.search_notes`) por su
  switch (ambos default ON → sin cambio de comportamiento).
- Skills sembrados: **`ponytail`** (minimalismo, `kind:"prompt-block"`, opción
  `mode` ∈ off/lite/full/ultra, default OFF; escalera de decisión + guardrails
  portados de github.com/DietrichGebert/ponytail, MIT), **`ui-ux-pro-max`**
  (calidad UI/UX, `prompt-block`, opción `detalle` ∈ breve/completo, default OFF;
  distilado de github.com/nextlevelbuilder/ui-ux-pro-max-skill, MIT),
  **`ask-protocol`** y **`project-context-vault`** (ambos `behavior`, default ON).

### Coste de tokens y conflictos (diseño)

Activar un skill debe **abaratar**, no encarecer. Reglas seguidas:
- Los bloques `prompt-block` (ponytail, ui-ux) se añaden al `systemPrompt`
  **estable** → caen en el prefijo prompt-cacheado (claude provider, breakpoint
  en `claude-api.provider.ts`); repiten a ~0.1× por turno.
- El **hint** estático de obsidian se inyecta en `systemPrompt` (cacheado), no en
  `systemContext` volátil. El bloque de vault está acotado a `MAX_CONTEXT_BYTES =
  2000` (antes 4096) y el agente pide más bajo demanda con `obsidian.search_notes`.
- ui-ux opción `detalle=breve` (default) = pointer de ~25 palabras; `completo` =
  ~150. El usuario controla el gasto desde el switch.
- **Sin conflictos de directivas:** ponytail ya NO repite la concisión de
  respuesta (la posee `BASE_SYSTEM_PROMPT`), su comprobación va al código del
  proyecto (no al chat), y sus modos lite/ultra ya no inducen "detenerse a
  preguntar" (evita choque con `ask-protocol`). ui-ux declara que a11y/contraste/
  táctil/foco son un PISO de correctitud y, por encima, manda el minimalismo si
  está activo → coexiste con ponytail sin contradecirlo.
- Endpoints: `GET /api/ai/skills` (lista resuelta) · `PUT /api/ai/skills/:id`
  (`{enabled?, options?}`). Controller `skills.controller.ts`, repo
  `assistant-skills.repository.ts`.
- Slash: `/ponytail [off|lite|full|ultra]` persiste el toggle/modo del skill;
  `/ponytail-review|audit|debt` devuelven un `rewrite` para que el modelo ejecute
  la revisión anti sobre-ingeniería (no tocan el toggle). Ver
  `slash-commands.service.ts`.

Para añadir un skill nuevo: implementa `AssistantSkill`, agrégalo a
`assistantSkills[]`; si es prompt-block aparece solo en el prompt al activarse; si
es behavior, lee `skills.isEnabled("<id>")` donde corresponda. El switch en la UI
es automático (la Access tab lista lo que devuelve `/api/ai/skills`).

## Frontend

`/panel/assistant` route is a backward-compat stub that dispatches
`lxp:assistant:open` and returns the user to `/panel`. The real UI lives
in `components/floating-assistant/` — a global FAB stacked above the
terminal FAB, with a Drawer containing 5 tabs (Chat · Providers ·
Modules · Access · Diagnostics). Shortcut: `Ctrl/Cmd+J`.

Persistence between SPA navigations is handled via Astro's
`transition:persist="lxp-assistant-pocket"` — the React island survives,
including chat state and any open SSE stream.

## Codebase graph (per-project indexing + fewer tokens per CLI turn)

Only active when the connected target ships the `codebase-memory-mcp` binary
(fail-open probe, TTL-cached; the UI hides itself otherwise). Kill-switch:
`ASSISTANT_GRAPH_MCP_ENABLED`.

- **Indexing from the project modal** (General tab, under the working dir):
  toggle "Indexar en el grafo de código" + estado (indexando/indexado/error) +
  botón (re)indexar. Endpoints: `GET /api/ai/graph/status` (availability),
  `POST|GET|DELETE /api/ai/projects/:id/graph-index`. The index run launches
  with nohup + exit-file polling (LP-proxy safe) and persists
  `project.graphIndex {enabled, project, status, nodes, edges, lastIndexedAt,
  indexedPath}` (only `enabled` is client-writable, via `graphIndexEnabled`).
- **CLI runs get the graph**: when the project tree has an indexed project,
  `system-prompt-builder` resolves `graphMcp {command, projects}` and the
  bridge adds a `codebase-graph` stdio server to the per-run
  `/tmp/<jobId>-mcp.json` (claude/minimax — `--strict-mcp-config` stays on) or
  to the per-conversation codex `config.toml`. Read-only graph tools are
  pre-allowed (`--allowedTools mcp__codebase-graph__…`) so manual mode doesn't
  prompt per lookup; mutating ones stay gated.
- **Prompt block (stable/cacheable)**: tells the agent to prefer
  `search_graph`/`get_code_snippet`/`trace_path`/`search_code` over grep/sed/
  full-file reads — the lever against 200k+-token CLI turns. API mode gets the
  `codebase-graph.*` variant when those capability tools are allowed.
- **Hygiene**: `graphIndexService.sweepEphemeralProjects` deletes the junk
  `tmp-lxp-cli-*` graph projects auto_index mints from ephemeral cwds; the
  codex per-conversation config strips inherited `[mcp_servers.codebase-*]`
  tables when the run carries no indexed project (stops new junk at the source).

## Security / isolation

- API keys + CLI tokens never leave the target (sidecar `0600`).
- Project listing is per-user: non-admin users only see their OWN projects
  (`ownerId`); legacy ownerless projects are admin-only. Paths/instructions no
  longer leak between panel users of the same server.
- Per-user concurrency cap: `ASSISTANT_MAX_CONCURRENT_RUNS_PER_USER` (default
  3) live runs across all of a user's conversations → typed 409. Queued turns
  on a live conversation don't count (they drain serially).
- The MiniMax wrapper resolves the sudo user's HOME via `$SUDO_USER` (no
  hardcoded usernames) and the Subscription Key is written once, to the user's
  HOME only (the legacy `/root` duplicate is purged).
- Every capability handler resolves its executor via AsyncLocalStorage —
  no fallback to the panel host. **Fail-closed** by contract.
- `dangerous` tools (and all `kind: "action"` by default) start with
  `requireConfirm=true` in the sidecar.
- MCP tokens inherit `bridgeSessionId` from the minting session, so the
  CLI's loopback calls always run against the same target the admin was
  on when they generated the config. When that session no longer resolves
  (TTL / re-login / logout) the endpoint is **fail-closed**
  (`MCP_SESSION_EXPIRED`, never `localExecutor`), with ONE narrow heal: a
  cross token whose `conversationId` maps to a still-ACTIVE run re-resolves to
  that run's pinned executor (strict owner match; dies with the run) — so a
  session rotating MID-RUN doesn't kill the run's own tool calls.
- **Repair endpoint (`POST /api/ai/mcp/repair`)** — one-click recovery for the
  sticky «Sesión MCP expirada» banner. The banner is derived from the PERSISTED
  transcript (frontend scans turns for the `MCP_SESSION_EXPIRED` marker), so it
  survives the session being healed; and «regenerar token MCP» in the provider
  config only mints a JWT + shows a snippet — it never reinstalls it where the
  runtime reads it nor clears the marker. The repair does the real fix:
  (1) re-resolves the connected server fail-closed (`getExecutor` → 428
  `BRIDGE_SESSION_REQUIRED` if not connected); (2) re-mints a token bound to the
  session's LIVE bridge (`mcp-repair.service.ts` → `mintLongLivedMcpToken`,
  shared with `mintToken`); (3) reinstalls it into the target CLI config
  (`mcpConfigWriterService.install`, skipped for API-only providers via
  `supportsMcpAutoInstall`); (4) with `conversationId`, stamps the conversation
  `mcpRepairedAt` (`conversationsRepository.markMcpRepaired`) as the durable
  banner-dismiss signal. Body (JSON, all optional) `{ provider?, conversationId? }`;
  response `{ ok, detail, provider, reinstalled, expiresAt, install?, mcpRepairedAt? }`.
- Panel-launched claude/minimax runs are **hermetic**: `--strict-mcp-config`
  is ALWAYS passed (chat + one-shots), even without a per-run `--mcp-config`
  file — the CLI never inherits the user's installed `~/.claude.json` servers
  (a STALE installed `luxipanel` token used to fail runs mid-answer with
  `MCP_SESSION_EXPIRED`). Panel tools arrive only via the per-run channels
  (cross + graph), which carry fresh tokens. Codex gets the same via its
  per-conversation `CODEX_HOME` filtering: it removes the inherited
  `[mcp_servers.luxipanel]` entry and its subtables before attaching the fresh,
  scoped channels. Codex's manual MCP installer and snippet use `url` plus
  `http_headers` (not `transport` or `headers`, which Codex ignores and would
  cause `AuthRequired`).
- Audit log is bounded to 200 entries per target; tool invocations are
  persisted regardless of whether they originated from the chat, the MCP
  loopback, or the agent dispatcher.

## Testing

```
npx vitest run src/shared/agent-capability src/modules/ai-assistant
```

Market/contexto: agent-market.service.test.ts cubre perfil compartido X/Y,
herencia, permisos, legado, idempotencia, retirada y carreras de admisión.
agent-activity.repository.test.ts prueba estado durable per-target/per-user.
Los tests de module-tools, team-tools, turn-queue, realtime, agent-messages,
agents.controller y project-workspace cubren los puntos de entrada y despacho.
Verificar con pnpm run typecheck y pnpm exec vitest run
src/modules/ai-assistant --pool=threads --maxWorkers=2 --minWorkers=1.
Build/restart y QA desplegado se realizan en la fase de despliegue autorizada.

## Approval modes (manual / auto / plan)

The assistant has three approval modes that govern how the CLI provider
launches `claude` / `claude-minimax` and how the MCP `permissions.approve`
gate behaves. The user picks one in the floating chat panel; cron jobs, the
security-audit analyzer and the plan-approval resume (see "Plan mode UX")
can override it per-call (`approvalModeOverride` on `AgentRunOptions`). The
permission-gate snapshot, the system prompt and the CLI flags all read the
EFFECTIVE mode (`approvalModeOverride ?? config.approval.mode`).

| Mode | CLI flag (claude + claude-minimax) | MCP `permissions.approve` behavior | Use case |
|---|---|---|---|
| `manual` | `--permission-prompt-tool mcp__luxipanel-servers__permissions__approve` | Asks the user via SSE for every mutating tool. Read-only tools auto-allow. | Default. User stays in the loop. |
| `auto`   | `--dangerously-skip-permissions` (and the `permissions.approve` tool is **omitted** from `tools/list` so nothing routes through the broker) | Never called. | User explicitly opted in to "let the agent run." |
| `plan`   | `--permission-mode plan` (native Claude Code: blocks mutations, presents a plan) | The handler DENIES any mutating tool that reaches it (defense in depth — the native flag should already have blocked it). | Agent must propose a plan and stop until the user says "go." |

**Provider coverage:** the table above is the *native* behavior of
`claude` / `claude-minimax` (both delegate to Claude Code, which supports
all three flags). For the other CLI providers:

- **codex:** runs through the native `codex app-server` JSON-RPC protocol.
  `plan` selects Codex's built-in Plan collaboration mode with a read-only
  sandbox; its complete `plan` item becomes the chat's expandable plan plus
  approval question. `manual` uses read-only sandbox + `on-request` and relays
  Codex command/file approval callbacks through the panel's permission broker.
  `auto` selects Default mode with `never` approval and full access. Existing
  Codex threads resume through `thread/resume`.
- **gemini:** uses `--yolo` (one-shot trust). Same caveat as codex.
- **grok:** no approval flag. Same caveat.

For Gemini and Grok CLI, approval mode remains advisory. In API mode the
shared tool dispatcher blocks actions in Plan, requests panel approval for
direct actions in Manual, and executes allowed actions in Auto. Module actions
also request approval in Manual after resolving the exact operation; their
existing permissions and confirmation checks remain active.

### Plan mode UX (plan-approval flow)

When the user selects `plan`, the agent should:

1. **Read freely** (files, logs, git history, etc.) — these are read-only
   tools and pass the policy gate.
2. **Present a one-line summary and a detailed numbered plan** (concrete
   changes and verification) and then **ask for approval through the ask
   protocol** — NOT through Claude Code's native `ExitPlanMode` /
   `AskUserQuestion`, which are DISABLED in headless `-p` mode (calling them
   fails with "No such tool available"). The system prompt block is built by
   `buildPlanModeBlock(mode)` in `ask-protocol.ts`: CLI mode emits a
   `<<<LXP_ASK>>>` sentinel with `"kind":"plan-approval"` and ONE `single`
   question whose FIRST option approves; API mode calls `lxp_ask` with the
   same shape. In plan mode the ask protocol is injected even when the
   `ask-protocol` skill is disabled (without it there'd be no way to approve).
3. The chat shows the summary with a "Ver plan completo" disclosure when the
   agent follows that format; the full text stays in the persisted message.
   It renders the ask as buttons ("Aprobar plan" / "Pedir cambios").
   Clicking the FIRST option immediately persists automatic approval and sends
   the structured flag
   `planDecision: "approve"` (never text-matching — answers may be
   translated). The controller validates it server-side (the LAST persisted
   assistant turn must carry `askKind: "plan-approval"`) and resumes the run
   after persisting `approval.mode: "auto"`. The validated turn uses
   `approvalModeOverride: "auto"` and executes without a per-action prompt;
   the composer also switches to automatic approval.

### Background callers must opt-in to non-manual

- **Cron AI-agent jobs** (`modules/cron/services/ai-cron-scheduler.service.ts`):
  default to `manual` regardless of the user's global setting. The job can
  set `approvalModeOverride: "auto"` (or `"plan"`) explicitly per-job; the
  UI's AI-agent job editor should require the choice for non-manual.
- **Security-audit analyzer** (`modules/security-audit/services/ai-analyzer.service.ts`):
  hardcoded to `manual` via `approvalModeOverride: "manual"` and a
  stable `audit-<id>` conversationId so the broker has a snapshot.
- **Ephemeral / project-less chats** (no `conversationId`): the broker
  falls safe to deny for any tool routed through it. The CLI provider
  itself runs with whatever mode the user has set globally.
