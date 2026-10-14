// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * System-prompt assembler — `buildSystemPrompt` assembles an agent run's STABLE
 * system prompt (base layers → ask/CLI directives → approval mode → role/agent
 * persona → project context & hierarchy → marketplace block → agent projects →
 * delegation/team roster → skill prompt blocks → LANGUAGE OVERRIDE) plus the
 * separate VOLATILE `systemContext`, the run-scoped tool additions
 * (lxp_ask / agents.delegate / chats.create / team.*), the resolved cwd and
 * the file-jail paths. Code moved verbatim from `agentService.run`.
 *
 * STABILITY INVARIANT (prompt cache): for the same inputs the stable prompt
 * must stay byte-identical — stable blocks go BEFORE the LANGUAGE OVERRIDE
 * and the volatile snapshot lives in `systemContext`, placed after the cache
 * breakpoint by the provider. Do NOT reorder blocks or change
 * separators/whitespace.
 */

import { projectsRepository, type AssistantProject, type AssistantProjectServer } from "../../repositories/projects.repository.js";
import { agentsRepository } from "../../repositories/agents.repository.js";
import { agentRolesRepository } from "../../repositories/agent-roles.repository.js";
import type { AssistantRole } from "../../models/assistant-role.types.js";
import { projectContextVaultService } from "../project-context-vault.service.js";
import { ASK_PROTOCOL_PROMPT, ASK_TOOL_PROMPT, PLAN_APPROVED_PROMPT, buildPlanModeBlock } from "../ask-protocol.js";
import { askTool } from "../ask-tool.js";
import { assistantSkillsService } from "../assistant-skills.service.js";
import { assistantSkillsRepository } from "../../repositories/assistant-skills.repository.js";
import type { AssistantSkillsMap } from "../../models/assistant-skills.types.js";
import { buildMarketplacePromptBlock } from "../marketplace-prompt.js";
import { marketplaceLinkRepository } from "../../../../shared/marketplace-link/index.js";
import { buildTeamTools, TEAM_TOOL_WIRE_NAMES } from "../team-tools.js";
import {
  buildAgentMessagePromptBlock,
  buildSendMessageTool,
  SEND_MESSAGE_TOOL_WIRE_NAME,
} from "../agent-messages.service.js";
import { graphIndexService } from "../graph-index.service.js";
import { env } from "../../../../config/env.js";
import { hasSudoCredential } from "../providers/cli/cli-sudo-askpass.js";
import { createModuleLogger } from "../../../../shared/logger/index.js";
import { MAX_DELEGATION_DEPTH } from "../agent-targets.js";
import type { SystemPromptBuildInput, SystemPromptBuildResult } from "./types.js";
import {
  BASE_SYSTEM_PROMPT,
  PROJECT_LEAF_INSTRUCTIONS_MAX,
  PROJECT_ANCESTOR_INSTRUCTIONS_MAX,
  buildCliModeBlock,
  buildGraphPromptBlock,
  buildAssociatedServersBlock,
  collectGraphProjects,
  collectSystemContext,
  mergeProjectServers,
  capText,
} from "./blocks.js";
import { buildDelegateTool, buildSpawnChatsTool } from "./delegation-tools.js";

const log = createModuleLogger("ai-agent");

/**
 * Assemble the system prompt + volatile context for one agent run. Body moved
 * verbatim from `agentService.run` — behavior and prompt bytes are identical.
 */
export async function buildSystemPrompt(
  input: SystemPromptBuildInput,
): Promise<SystemPromptBuildResult> {
  const {
    executor,
    user,
    userId,
    config,
    provider,
    agent,
    role,
    projectId,
    cwdOverride,
    forcedCwd,
    conversationId,
    withContext,
    outputEnglish,
    panelOrigin,
    crossMcpToken,
    delegationDepth,
    signal,
    runAgent,
  } = input;
  // Run-scoped tools are appended to a COPY of the caller's set (returned in
  // the result) so the input array is never mutated.
  const tools = [...input.tools];

  // Skills/métodos activables por target (ponytail, ask-protocol, contexto de
  // proyecto…). Resuelto una vez: gatea comportamientos existentes por su
  // switch e inyecta los bloques de los skills tipo prompt habilitados.
  // (`tools` was resolved above, before the auto-router.)
  // Load the global per-target skills map once; the early behavioral gates
  // (ask-protocol, project-context-vault) use it. The agent/project skill
  // OVERRIDE (layered on top) is applied to the prompt-block injection below.
  const globalSkillsMap = await assistantSkillsRepository.load(executor);
  const skills = assistantSkillsService.resolveFromMap(globalSkillsMap);
  // Per-project skill override captured inside the project block (below).
  let projectSkillsOverride: AssistantSkillsMap | undefined;
  // Stable base prompt (everything except the volatile server snapshot) +
  // a separate volatile context block so the base can be prompt-cached.
  let systemPrompt = BASE_SYSTEM_PROMPT;
  // Set when the CLI team-leader block gets injected (see the CLI branch of
  // the delegation section) — the bridge adapts its headless note to it.
  let cliTeamLeader = false;
  let systemContext = await collectSystemContext(withContext);

  // Approval mode efectivo de este run (override por turno > persistido).
  const approvalMode = input.effectiveApprovalMode ?? config.approval.mode;
  // En modo plan el ask-protocol se inyecta AUNQUE la skill esté desactivada:
  // sin mecanismo de pregunta no hay forma de aprobar el plan (la skill sigue
  // gobernando el "preguntar ante ambigüedad" en manual/auto).
  const askProtocolActive = skills.isEnabled("ask-protocol") || approvalMode === "plan";

  // API mode: expose the special `lxp_ask` (assistant.ask) tool so the agent
  // can stop and ask the user a decision via the tool_use loop (the CLI
  // sentinel path doesn't apply here). Injected directly — NOT through the
  // capability registry/allowedTools — so it stays available to every role
  // without coupling to module/sidebar permissions. Its handler runs no
  // server-side work; the provider turns the tool_result into an `ask` event.
  if (provider.mode === "api" && askProtocolActive && !tools.some((t) => t.name === askTool.name)) {
    tools.push(askTool);
    systemPrompt += "\n\n" + ASK_TOOL_PROMPT;
  }

  // CLI mode: the subprocess has full shell access but NO MCP tools are
  // registered in its session. Override any tool-name references in the
  // conversation with a clear directive to use bash/python directly.
  if (provider.mode === "cli") {
    // La promesa de sudo se gatea por la MISMA detección que usa el runtime
    // (setupSudoAskpass): prometer askpass sin credencial hacía que el agente
    // insistiera con `sudo` fallando ("a password is required") y quemara
    // turnos en vez de reportar lo no verificable.
    const sudoAvailable = executor ? await hasSudoCredential(executor) : false;
    systemPrompt += "\n\n" + buildCliModeBlock({ sudoAvailable });
    if (askProtocolActive) {
      systemPrompt += "\n\n" + ASK_PROTOCOL_PROMPT;
    }
  }

  // Approval mode shapes HOW the agent conducts mutating actions. "manual" is
  // the default and needs no prompt change (the permission gate asks per
  // action). "plan" forces a plan-first protocol; "auto" tells the agent to
  // run uninterrupted (the gate already auto-allows under this mode).
  if (approvalMode === "plan") {
    systemPrompt += "\n\n" + buildPlanModeBlock(provider.mode);
  } else if (approvalMode === "manual" && config.approval.mode === "plan") {
    // Compatibilidad con clientes que reanudan un plan con override manual.
    systemPrompt += "\n\n" + PLAN_APPROVED_PROMPT;
  } else if (approvalMode === "auto") {
    systemPrompt +=
      "\n\nMODO APROBACIÓN AUTOMÁTICA: el usuario activó la aprobación automática de acciones. " +
      "Ejecuta las tareas solicitadas de principio a fin sin pedir confirmaciones intermedias. " +
      "Aun así, para acciones claramente destructivas e irreversibles (borrado masivo de datos, " +
      "formateo, eliminación de usuarios o de configuraciones críticas) avisa brevemente antes de proceder.";
  }

  // Assigned role (base persona/policy): injected BEFORE the agent's own prompt
  // so the agent refines the role. Stable block → cacheable.
  if (role) {
    systemPrompt +=
      `\n\n## Rol: ${role.name}` +
      (role.description.trim() ? `\n${role.description.trim()}` : "") +
      (role.systemPrompt.trim() ? `\n\n${role.systemPrompt.trim()}` : "");
  }

  // Custom agent persona: its system prompt is an authoritative, stable block
  // (goes in the cacheable prompt, before the per-project context). The tool
  // subset + provider/model were already applied above.
  if (agent) {
    systemPrompt +=
      `\n\n## Agente activo: ${agent.name}` +
      (agent.description.trim() ? `\n${agent.description.trim()}` : "") +
      (agent.systemPrompt.trim() ? `\n\n${agent.systemPrompt.trim()}` : "");

    // Credencial de PRUEBAS del agente (una sola, definida por el usuario en
    // el editor): para flujos QA que exigen iniciar sesión en la app bajo
    // prueba antes de verificar. Va en el prompt ESTABLE (cacheable) con
    // reglas duras de no-filtración — es el único punto donde el secret sale
    // del sidecar (la API HTTP siempre lo redacta).
    if (agent.credential?.username && agent.credential.secret) {
      const cred = agent.credential;
      systemPrompt +=
        "\n\n## Credencial de pruebas (definida por el usuario" +
        (cred.label ? `: ${cred.label}` : "") +
        ")\n" +
        `Cuando una prueba requiera INICIAR SESIÓN en la aplicación bajo prueba, usa exactamente — usuario: ${cred.username} · contraseña: ${cred.secret}\n` +
        "Reglas estrictas: (1) es una credencial DE PRUEBAS: úsala SOLO para autenticarte contra la aplicación que " +
        "estás verificando (p. ej. POST al endpoint de login con curl -c /tmp/qa-cookies.txt y reutiliza la cookie " +
        "en las comprobaciones autenticadas; borra el cookie-jar al terminar). (2) NUNCA la incluyas en tus " +
        "respuestas, resúmenes, notas, commits ni logs — si necesitas referirte a ella di «la credencial de " +
        "pruebas». (3) NUNCA la envíes a un dominio distinto del que estás probando.";
    }
  }

  // Project context: prepend instructions + use its path as the CLI cwd.
  // An explicit cwd (e.g. a git project path picked in a scheduled agent)
  // applies first; a resolved Assistant project path overrides it below.
  let cwd: string | undefined;
  // Accumulated working directories from every source (cwd override, project
  // tree, agent). Doubles as the FILE-ACCESS JAIL allowlist for the run when
  // non-empty: the file tools may only touch paths under these.
  const jailPaths: string[] = [];
  if (cwdOverride) {
    cwd = cwdOverride;
    jailPaths.push(cwdOverride);
    systemPrompt += `\n\n## Proyecto\nDirectorio de trabajo: ${cwdOverride}\nTrabaja sobre el proyecto ubicado en esa ruta.`;
  }
  // Proyectos del árbol indexados en el grafo de código del target (se llena
  // dentro del bloque de proyecto; decide el bloque de prompt + graphMcp).
  let graphProjects: { name: string; path: string }[] = [];
  let graphMcp: { command: string; projects: string[] } | undefined;
  if (projectId) {
    try {
      const project = await projectsRepository.get(executor, projectId);
      if (project) {
        if (project.path) { cwd = project.path; jailPaths.push(project.path); }
        // Load all projects once so we can resolve the FULL ancestor chain AND
        // the direct children without N SSH round-trips. Best-effort: on failure
        // the leaf project's own context (already loaded above) still applies.
        let allProjects: AssistantProject[] = [];
        try {
          allProjects = await projectsRepository.list(executor);
        } catch (err) {
          log.warn({ err, projectId }, "Failed to list projects for hierarchy");
        }
        const byId = new Map<string, AssistantProject>();
        for (const p of allProjects) if (p.id) byId.set(p.id, p);
        // Full ancestor chain (root → immediate parent), mirroring the frontend
        // breadcrumb. A nested project inherits EVERY ancestor's context, not
        // only its direct parent: e.g. LUXIPANEL → PLATAFORMA → "Módulo X" all
        // apply, each refined by the next, with the leaf winning on conflicts.
        const ancestors: AssistantProject[] = [];
        {
          const seenIds = new Set<string>(project.id ? [project.id] : []);
          let pid = project.parentId ?? null;
          while (pid && !seenIds.has(pid)) {
            seenIds.add(pid);
            const anc = byId.get(pid);
            if (!anc) break;
            ancestors.unshift(anc); // root ends up first
            pid = anc.parentId ?? null;
          }
        }
        // Inherit instructions (root → parent) + file-jail paths from the chain.
        // Each ancestor block is capped: a deep tree with long instructions
        // otherwise multiplies the stable prompt (and re-bills the cache prefix
        // whenever ANY ancestor is edited).
        for (const anc of ancestors) {
          if (anc.instructions.trim()) {
            systemPrompt += `\n\n## Contexto del proyecto padre "${anc.title}"\n${capText(anc.instructions, PROJECT_ANCESTOR_INSTRUCTIONS_MAX)}`;
          }
          if (anc.path) jailPaths.push(anc.path);
        }
        // Inherit per-project skills from the whole chain (root first → leaf last,
        // so the nearest project wins on conflicts).
        const mergedSkills: AssistantSkillsMap = {};
        for (const anc of ancestors) Object.assign(mergedSkills, anc.skills ?? {});
        if (project.skills) Object.assign(mergedSkills, project.skills);
        if (Object.keys(mergedSkills).length) projectSkillsOverride = mergedSkills;
        if (project.instructions.trim()) {
          systemPrompt =
            `${systemPrompt}\n\n## Contexto del proyecto "${project.title}"\n${capText(project.instructions, PROJECT_LEAF_INSTRUCTIONS_MAX)}` +
            (project.path ? `\n\nDirectorio de trabajo: ${project.path}` : "");
        }
        // Child projects of THIS project: list them by title+path (so the chat
        // knows they exist and can reach their files via the jail), WITHOUT
        // inlining their full instructions — that made the prompt grow linearly
        // with the subtree. The agent can read a subproject's vault/notes on
        // demand when a task actually lands there.
        const children = allProjects.filter((p) => p.parentId === project.id);
        if (children.length) {
          const lines = children.map((c) => `- ${c.title}${c.path ? ` · ${c.path}` : ""}`);
          systemPrompt +=
            `\n\n## Subproyectos de "${project.title}"\n` +
            lines.join("\n") +
            "\nSi una tarea cae en un subproyecto, consulta su detalle bajo demanda (vault/notas/archivos) en vez de asumirlo.";
        }
        for (const child of children) {
          if (child.path) jailPaths.push(child.path);
        }
        // Grafo de código: todo proyecto del árbol (hoja + ancestros + hijos)
        // con `graphIndex` listo se anuncia al agente (bloque + MCP más abajo).
        graphProjects = collectGraphProjects([project, ...ancestors, ...children]);
        // Associated server connections (merge the whole ancestor chain + leaf,
        // dedup by id; nearer projects win): tell every chat in this project
        // which OTHER servers it may act on, and how (the servers.* tools). The
        // agent runs its shell on the connected server; these tools reach the
        // associated ones via direct SSH from the single vault (ownership
        // re-checked per call). See servers-agent-capability.ts.
        let associatedServers: AssistantProjectServer[] = project.servers ?? [];
        for (const anc of [...ancestors].reverse()) {
          associatedServers = mergeProjectServers(associatedServers, anc.servers);
        }
        if (associatedServers.length > 0) {
          // The cross-server MCP channel is attached only for the Claude CLI on
          // a managed session (panelOrigin + token present). Tell the agent the
          // truth about whether servers.* will be loaded.
          const channelAttached =
            provider.id === "claude" && provider.mode === "cli" && Boolean(panelOrigin) && Boolean(crossMcpToken);
          systemPrompt += buildAssociatedServersBlock(
            associatedServers,
            provider.mode === "cli",
            channelAttached,
          );
        }
      }
    } catch (err) {
      log.warn({ err, projectId }, "Failed to load project context");
    }

    // Proyecto vinculado a un módulo del marketplace → bloque marketplace
    // (reglas del manifest/SDK + guion de asks + tools module-dev.*).
    // SIEMPRE antes del LANGUAGE OVERRIDE; fallo de lectura → sin bloque.
    try {
      const link = await marketplaceLinkRepository.getByProjectId(executor, projectId);
      if (link) {
        systemPrompt +=
          "\n\n" + buildMarketplacePromptBlock(link, { cliMode: provider.mode === "cli" });
      }
    } catch (err) {
      log.warn({ err, projectId }, "Failed to load marketplace link — running without marketplace block");
    }

    // Grafo de código: la EMISIÓN del bloque + graphMcp se hace en un paso
    // común más abajo (tras el bloque del agente), sobre la UNIÓN de los
    // grafos del árbol del proyecto y los del agente (adjuntos + índices
    // seleccionados). `graphProjects` ya quedó poblado arriba.

    // B1 — inyectar el vault de contexto Obsidian del proyecto (Contexto.md +
    // Errores.md) como contexto VOLÁTIL: son notas mutables que el usuario
    // mantiene, así que van tras el breakpoint de cache (no en el prompt
    // estable). Acotado a ≤4KB y fail-open: si no hay contenedor/notas o la
    // lectura falla, el run sigue sin bloque. Usa el executor de contexto
    // (aislamiento per-server). No duplica las instrucciones del proyecto:
    // son notas independientes y el helper descarta el scaffolding vacío.
    if (executor && skills.isEnabled("project-context-vault")) {
      try {
        const vaultBlock = await projectContextVaultService.buildContextBlock(executor, projectId);
        if (vaultBlock) {
          systemContext = systemContext ? `${systemContext}\n\n${vaultBlock}` : vaultBlock;
        }
      } catch (err) {
        log.warn({ err, projectId }, "Failed to load project context vault — running without it");
      }
    }

    // B3-light — guía de búsqueda en el vault: si las tools obsidian.* están
    // disponibles para este run (gateadas por rol arriba), avisamos al agente
    // de que puede buscar MÁS contexto del proyecto en su vault por su cuenta.
    // Barato (una línea, sin búsqueda activa por turno); va en el bloque
    // volátil junto al contexto del vault. Solo si la tool existe en el set.
    if (skills.isEnabled("project-context-vault") && tools.some((t) => t.name === "obsidian.search_notes")) {
      const hint =
        "Este proyecto tiene un vault Obsidian de contexto. Si necesitas más " +
        "detalle (decisiones, errores conocidos, comandos), usa la herramienta " +
        "obsidian.search_notes para buscar notas relevantes del proyecto antes de responder.";
      systemPrompt += "\n\n" + hint;
    }
  }

  // Aislamiento de tarea de equipo: el forcedCwd (worktree) GANA sobre el
  // project.path recién resuelto, manteniendo todo el contexto del proyecto
  // (instrucciones/vault/grafo, ya inyectados arriba). Jail ADITIVO: el
  // project.path se queda en jailPaths (lecturas de referencia + el worktree
  // necesita el .git del checkout principal); el confinamiento de escritura al
  // worktree se refuerza por prompt + captura de diff + verificación.
  if (forcedCwd) {
    cwd = forcedCwd;
    jailPaths.push(forcedCwd);
    systemPrompt +=
      "\n\n## Aislamiento de tarea (copia de trabajo)\n" +
      `Trabajas en una COPIA aislada del proyecto: ${forcedCwd}\n` +
      "Haz TODOS los cambios dentro de esa ruta (es un git worktree con rama propia). " +
      "Al terminar tu trabajo, haz commit de los cambios (git add -A && git commit -m \"<resumen>\").";
  }

  // Custom-agent context: attached PARENT projects + ALL their child/related
  // projects (instructions/path/servers), extra working directories, and
  // associated servers — merged into the prompt. The agent sees the full
  // project tree under each attached parent, not just the parent itself.
  if (agent) {
    let agentServers: AssistantProjectServer[] = agent.servers ?? [];
    const agentPaths = [...(agent.projectPaths ?? [])];
    const agentGraphIds = [...new Set(agent.graphProjectIds ?? [])];
    if ((agent.projectIds ?? []).length > 0 || agentGraphIds.length > 0) {
      // Load the whole project set once so we can walk each attached parent's
      // descendants (children, grandchildren) via a parentId index.
      const allProjects = await projectsRepository.list(executor).catch(() => []);
      const byId = new Map(allProjects.map((p) => [p.id, p] as const));
      const childrenOf = new Map<string, typeof allProjects>();
      for (const p of allProjects) {
        if (!p.parentId) continue;
        const arr = childrenOf.get(p.parentId) ?? [];
        arr.push(p);
        childrenOf.set(p.parentId, arr);
      }
      // Candidatos a grafo del agente: proyectos visitados del árbol adjunto +
      // los proyectos de sus índices seleccionados (graphProjectIds).
      const graphCandidates: AssistantProject[] = [];
      // BFS from each attached parent over its descendants, deduped. Only the
      // DIRECTLY attached projects get their instructions inlined (capped);
      // descendants are listed by title+path — inlining a whole subtree made
      // the stable prompt grow linearly with the tree.
      const seen = new Set<string>();
      const queue = [...new Set(agent.projectIds ?? [])];
      const descendantLines: string[] = [];
      while (queue.length > 0) {
        const pid = queue.shift()!;
        if (!pid || seen.has(pid)) continue;
        seen.add(pid);
        const proj = pid === undefined ? undefined : byId.get(pid) ?? (await projectsRepository.get(executor, pid).catch(() => null));
        if (!proj) continue;
        graphCandidates.push(proj);
        const isAttached = (agent.projectIds ?? []).includes(pid);
        if (isAttached && proj.instructions?.trim()) {
          systemPrompt += `\n\n## Contexto del proyecto adjunto "${proj.title}"\n${capText(proj.instructions, PROJECT_ANCESTOR_INSTRUCTIONS_MAX)}`;
        } else if (!isAttached) {
          descendantLines.push(`- ${proj.title}${proj.path ? ` · ${proj.path}` : ""}`);
        }
        if (proj.path && !agentPaths.includes(proj.path)) agentPaths.push(proj.path);
        if (proj.servers?.length) agentServers = mergeProjectServers(agentServers, proj.servers);
        // Enqueue this project's children so the whole subtree is included.
        for (const child of (proj.id ? childrenOf.get(proj.id) : undefined) ?? []) if (child.id && !seen.has(child.id)) queue.push(child.id);
      }
      if (descendantLines.length) {
        systemPrompt +=
          "\n\n## Subproyectos relacionados\n" +
          descendantLines.join("\n") +
          "\nSi una tarea cae en uno de ellos, consulta su detalle bajo demanda (vault/notas/archivos).";
      }
      // Índices de grafo seleccionados explícitamente en el editor del agente
      // (pueden apuntar a proyectos FUERA del árbol adjunto).
      for (const gid of agentGraphIds) {
        if (seen.has(gid)) continue;
        const proj = byId.get(gid) ?? (await projectsRepository.get(executor, gid).catch(() => null));
        if (proj) graphCandidates.push(proj);
      }
      // Unión con los grafos del proyecto del chat, dedupe por nombre de grafo.
      for (const g of collectGraphProjects(graphCandidates)) {
        if (!graphProjects.some((x) => x.name === g.name)) graphProjects.push(g);
      }
    }
    if (agentPaths.length > 0) {
      if (!cwd) cwd = agentPaths[0];
      jailPaths.push(...agentPaths);
      systemPrompt +=
        "\n\n## Directorios de trabajo del agente\n" +
        agentPaths.map((p) => `- ${p}`).join("\n") +
        `\nTrabaja sobre estos directorios; el directorio activo inicial es ${cwd}.\n` +
        "IMPORTANTE: solo puedes consultar y modificar archivos DENTRO de estas rutas (y sus subcarpetas).";
    }
    if (agentServers.length > 0) {
      const channelAttached =
        provider.id === "claude" && provider.mode === "cli" && Boolean(panelOrigin) && Boolean(crossMcpToken);
      systemPrompt += buildAssociatedServersBlock(agentServers, provider.mode === "cli", channelAttached);
    }
  }

  // Grafo de código — bloque en el prompt ESTABLE (determinista por proyecto/
  // agente + target: el probe está cacheado, así que el prefijo cacheable no
  // varía entre turnos) y resolución del MCP para el bridge. Opera sobre la
  // UNIÓN de grafos: árbol del proyecto del chat + árbol adjunto del agente +
  // índices seleccionados en el editor del agente (graphProjectIds).
  //  • CLI claude/minimax → segundo server en el mcp.json per-run;
  //  • CLI codex → tabla [mcp_servers.codebase-graph] en su config.toml;
  //  • API → solo el bloque, si las tools codebase-graph.* están permitidas.
  // Fail-open: sin binario / probe fallido → sin bloque ni MCP (cero coste
  // para chats sin proyecto indexado: sin grafo listo no hay probe).
  if (graphProjects.length > 0 && env.ASSISTANT_GRAPH_MCP_ENABLED) {
    if (
      executor &&
      provider.mode === "cli" &&
      (provider.id === "claude" || provider.id === "minimax" || provider.id === "codex")
    ) {
      try {
        const avail = await graphIndexService.probeAvailability(executor);
        if (avail.available && avail.binPath) {
          graphMcp = { command: avail.binPath, projects: graphProjects.map((p) => p.name) };
          systemPrompt += buildGraphPromptBlock(graphProjects, true);
        }
      } catch (err) {
        log.warn({ err, projectId, agentId: agent?.id }, "graph MCP probe failed — running without the graph");
      }
    } else if (provider.mode === "api" && tools.some((t) => t.name.startsWith("codebase-graph."))) {
      systemPrompt += buildGraphPromptBlock(graphProjects, false);
    }
  }

  // Verificación visual (browser.*): si el run puede capturar screenshots y
  // tiene jail activo, abre el dir de capturas al sandbox (mismo patrón que
  // uploads en el bridge → --add-dir). NUNCA con jail vacío: un jail vacío =
  // sin restricción, y añadir una ruta lo convertiría en restrictivo.
  if (tools.some((t) => t.name === "browser.screenshot")) {
    if (jailPaths.length > 0 && !jailPaths.includes(env.ASSISTANT_BROWSER_SHOT_DIR)) {
      jailPaths.push(env.ASSISTANT_BROWSER_SHOT_DIR);
    }
    systemPrompt +=
      "\n\n## Verificación visual disponible\n" +
      "Tienes browser.discover_urls, browser.check y browser.screenshot (Chromium headless en este servidor). " +
      "Úsalas SOLO cuando la tarea requiera verificar una página web renderizada. Si no conoces la URL, " +
      "descúbrela con browser.discover_urls (pásale tu directorio de trabajo) — NUNCA se la preguntes al usuario. " +
      "Tras browser.screenshot, " +
      (provider.mode === "cli"
        ? "LEE el PNG devuelto con tu herramienta Read para verlo de verdad (si la ruta cae fuera de tu sandbox, pasa `outPath` dentro de tu directorio de trabajo)."
        : "usa browser.check para las señales textuales (status, título, errores de consola).");
  }

  // Inter-agent delegation: when this agent has subordinates or connected peers
  // and we're in API mode (the tool_use loop) and not too deep in a delegation
  // chain, expose the `agents.delegate` tool + list its valid targets in the
  // prompt. This is how a superior coordinates its team and how connected agents
  // exchange information at run time. CLI mode is excluded (no MCP tool loop).
  if (agent && provider.mode === "api" && delegationDepth < MAX_DELEGATION_DEPTH) {
    try {
      const allAgents = await agentsRepository.list();
      const built = buildDelegateTool({ agent, allAgents, executor, user, userId, depth: delegationDepth, signal, runAgent });
      if (built) {
        tools.push(built.tool);
        const lines = built.targets.map((a) => {
          const rel = a.parentAgentId === agent.id ? "subordinado" : "conexión";
          return `- id: ${a.id} · ${a.name}${a.description?.trim() ? ` — ${a.description.trim()}` : ""} (${rel})`;
        });
        systemPrompt +=
          "\n\n## Agentes a los que puedes delegar\n" +
          "Coordina el trabajo delegando subtareas en estos agentes con la herramienta `agents.delegate` " +
          "(pasa su `id` exacto y una `task` autocontenida con todo el contexto necesario). " +
          "Cada agente responde con su propio rol, prompt y herramientas, y te devuelve su resultado:\n" +
          lines.join("\n");
      }
      // Supervisor permission (agent flag OR its role grants it).
      // @deprecated `chats.create`: la tool se mantiene REGISTRADA (equipos
      // viejos y transcripciones que ya la citan siguen funcionando) pero YA NO
      // se anuncia en el prompt — `team.assign` la reemplaza con tablero,
      // recolección y aislamiento. No añadir bloques de prompt nuevos para ella.
      if (agent.canSpawnChats || role?.canSpawnChats) {
        const spawn = buildSpawnChatsTool({ agent, allAgents, executor, user, userId, depth: delegationDepth, runAgent, ...(panelOrigin ? { panelOrigin } : {}) });
        if (spawn) {
          tools.push(spawn.tool);
        }

        // Team toolkit (assign/status/collect): background delegation WITH
        // result collection over the persistent task board. Needs a persisted
        // leader conversation to anchor tasks to and a live executor to spawn
        // the worker chats — delegated sub-runs (no conversationId) don't get
        // it, so a leader-inside-a-leader can't fan out through this path.
        if (conversationId && executor) {
          const roles = await agentRolesRepository.list().catch(() => [] as AssistantRole[]);
          const team = await buildTeamTools({
            agent,
            allAgents,
            roles,
            executor,
            user,
            userId,
            depth: delegationDepth,
            maxDepth: MAX_DELEGATION_DEPTH,
            conversationId,
            ...(panelOrigin ? { panelOrigin } : {}),
            signal,
            runAgent,
          });
          if (team) {
            tools.push(...team.tools);
            systemPrompt += team.promptBlock;
          }
        }
      }
    } catch (err) {
      log.warn({ err }, "Failed to wire inter-agent delegation — running without it");
    }
  } else if (
    agent &&
    provider.mode === "cli" &&
    provider.id === "claude" &&
    Boolean(panelOrigin) &&
    Boolean(crossMcpToken) &&
    delegationDepth < MAX_DELEGATION_DEPTH &&
    conversationId &&
    executor &&
    (agent.canSpawnChats || role?.canSpawnChats)
  ) {
    // CLI LEADERS: the team.* tools are served over the per-run cross MCP
    // channel (mcp-server.service resolves them from this conversation's
    // agent), so the CLI discovers them via tools/list on its own. Here we
    // only inject the roster + coordination protocol, with the MCP WIRE
    // names the CLI must call. Tools built here are discarded.
    try {
      const allAgents = await agentsRepository.list();
      const roles = await agentRolesRepository.list().catch(() => [] as AssistantRole[]);
      const team = await buildTeamTools({
        agent,
        allAgents,
        roles,
        executor,
        user,
        userId,
        depth: delegationDepth,
        maxDepth: MAX_DELEGATION_DEPTH,
        conversationId,
        ...(panelOrigin ? { panelOrigin } : {}),
        signal,
        runAgent,
        promptToolNames: TEAM_TOOL_WIRE_NAMES,
        cliPrompt: true,
      });
      if (team) {
        systemPrompt += team.promptBlock;
        cliTeamLeader = true;
        log.info(
          { agentId: agent.id, conversationId, blockChars: team.promptBlock.length },
          "CLI team leader: roster + protocol injected",
        );
      } else {
        log.warn(
          { agentId: agent.id, conversationId },
          "CLI team leader gate passed but buildTeamTools returned null (no subordinates?)",
        );
      }
    } catch (err) {
      log.warn({ err }, "Failed to build CLI team prompt block — running without it");
    }
  } else if (agent && provider.mode === "cli" && (agent.canSpawnChats || role?.canSpawnChats)) {
    // Diagnostic: a CLI supervisor run that did NOT qualify for the team
    // block — log which sub-gate failed so a silent misconfiguration (missing
    // cross token, ephemeral chat, non-claude CLI…) is visible in pm2 logs.
    log.warn(
      {
        agentId: agent.id,
        providerId: provider.id,
        hasPanelOrigin: Boolean(panelOrigin),
        hasCrossToken: Boolean(crossMcpToken),
        delegationDepth,
        hasConversationId: Boolean(conversationId),
        hasExecutor: Boolean(executor),
      },
      "CLI supervisor run WITHOUT team block — gate failed",
    );
  }

  // Canal de mensajería asíncrona (`agents.send_message`): handoff PERSISTENTE a
  // un agente relacionado sin pasar por el líder y sin bloquear el turno; el
  // destinatario se despierta aunque estuviera apagado. Gate PROPIO (basta con
  // tener relacionados): a diferencia de team.*, NO exige ser líder — cualquier
  // agente relacionado puede hacer un handoff. Va después del bloque de
  // delegación y antes del LANGUAGE OVERRIDE, dentro del prompt estable.
  //   • API → tool en el tool_use loop + bloque de prompt (nombre plano).
  //   • CLI claude con canal cross → la tool la sirve mcp-server.service por el
  //     canal per-run (tools/list la descubre); aquí solo el bloque, con el wire
  //     name que el CLI debe invocar.
  if (agent && executor && delegationDepth < MAX_DELEGATION_DEPTH) {
    const cliCrossChannel =
      provider.mode === "cli" &&
      provider.id === "claude" &&
      Boolean(panelOrigin) &&
      Boolean(crossMcpToken) &&
      Boolean(conversationId);
    if (provider.mode === "api" || cliCrossChannel) {
      try {
        const allAgents = await agentsRepository.list();
        const built = buildSendMessageTool({
          agent,
          allAgents,
          executor,
          user,
          userId,
          depth: delegationDepth,
          conversationId,
        });
        if (built) {
          if (provider.mode === "api") tools.push(built.tool);
          systemPrompt += buildAgentMessagePromptBlock(
            agent,
            built.targets,
            provider.mode === "api" ? built.tool.name : SEND_MESSAGE_TOOL_WIRE_NAME,
          );
        }
      } catch (err) {
        log.warn({ err }, "Failed to wire the agent message channel — running without it");
      }
    }
  }

  // Skills/métodos tipo prompt habilitados (ponytail, …): bloque estable por
  // config → va en el prompt cacheable, después del contexto de proyecto y
  // antes del LANGUAGE OVERRIDE. Vacío si no hay ninguno habilitado.
  // Per-project / per-agent skill OVERRIDE (only in this agent's/project's
  // chats): layered over the global map (agent most specific). Empty → global.
  const skillsOverride = { ...(projectSkillsOverride ?? {}), ...(agent?.skills ?? {}) };
  const effectiveSkills = Object.keys(skillsOverride).length
    ? assistantSkillsService.resolveFromMap({ ...globalSkillsMap, ...skillsOverride })
    : skills;
  const skillBlocks = effectiveSkills.promptBlocks({ cliMode: provider.mode === "cli" });
  if (skillBlocks) systemPrompt += "\n\n" + skillBlocks;

  // Background translation: the user's turn arrived already translated to
  // English and the final answer is translated back to their language. Make
  // this the LAST directive so it overrides the base "Responde en español"
  // rule and the ASK protocol's "idioma del usuario" line — the agent must
  // work and answer in English; the translation layer localizes the result.
  if (outputEnglish) {
    systemPrompt +=
      "\n\nLANGUAGE OVERRIDE (HIGHEST PRIORITY): This conversation runs through " +
      "background translation. The user's messages have ALREADY been translated " +
      "into English for you, and your reply will be translated back to their " +
      "language automatically. Therefore: think, narrate your tool usage, and " +
      "write your ENTIRE final answer in ENGLISH. Ignore any earlier instruction " +
      "to respond in Spanish (\"Responde en español\") or in \"el idioma del " +
      "usuario\" — for this run, English is the required output language.";
  }

  return { systemPrompt, systemContext, tools, cwd, jailPaths, cliTeamLeader, ...(graphMcp ? { graphMcp } : {}) };
}
