// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { moduleMcpServer, prepareModuleAdapter } from "./module-channel.js";
/**
 * CLI-mode streaming provider — bridge between the chat UI and an upstream
 * agent CLI installed on the connected TARGET (claude / codex / gemini /
 * deepseek / grok / minimax).
 *
 * Background execution model (v2):
 *   1. Write the prompt to a temp file on the target (SFTP).
 *   2. Launch the CLI with `nohup ... &` — returns the PID in < 1 s, well
 *      within the LP proxy's 30 s HTTP timeout.
 *   3. Register the job in `cliJobTracker`.
 *   4. Poll the log file every 3 s, yield incremental text deltas so the
 *      browser sees live output while the drawer stays open.
 *   5. If the SSE connection drops (drawer closed / tab switched), stop
 *      yielding but let the tracker keep polling. On completion the tracker
 *      emits a push notification so the user knows to come back.
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createModuleLogger } from "../../../../../shared/logger/index.js";
import { requireExecutor } from "../../../../../shared/agent-capability/index.js";
import { cliJobTracker } from "../../cli-job-tracker.service.js";
import { cliSessionsRepository } from "../../../repositories/cli-sessions.repository.js";
import { upstreamSessionResetBytes } from "../../context-window.service.js";
import { cliJobsRepository } from "../../../repositories/cli-jobs.repository.js";
import { captureModuleRunRecovery } from "../../module-run-recovery.service.js";
import { bindOwnerContributionCli } from "../../../../../shared/github/owner-contributions.js";
import { getContextUser } from "../../../../../shared/executor/context.js";
import { extractAskRequest, stripAskBlock } from "../../ask-protocol.js";
import { panelConfigDir } from "../../../../../config/paths.js";
import { env } from "../../../../../config/env.js";
import { quoteArg } from "../../../../../shared/executor/index.js";
import { ANSI_RE, loginShell, sleep } from "./shell.js";
import { cliFailureMessage } from "./failure-message.js";
import { CLI_SPECS, GRAPH_MCP_SERVER_KEY } from "./cli-specs.js";
import { codexContinuationPrompt, codexFailure } from "./codex-recovery.js";
import { setupSudoAskpass } from "./cli-sudo-askpass.js";
import { ensureMinimaxWrapper, minimaxAuthOk } from "./cli-minimax-wrapper.js";
import { cliWorkDir } from "./cli-tmp-paths.js";
import {
  measureClaudeSessionBytes,
  ensureCodexConversationHome,
  captureCodexSessionId,
  codexThreadHasWriter,
  buildPromptWithContext,
  TRANSCRIPT_MAX_CHARS,
} from "./cli-session.js";
import type {
  AgentEvent,
  AgentMessage,
  AgentProvider,
  ProviderRunOptions,
} from "../provider.types.js";
import type { AssistantProviderId } from "../../../models/assistant-config.types.js";

const log = createModuleLogger("provider-cli-bridge");

export function makeCliBridgeProvider(args: {
  id: AssistantProviderId;
  binOverride?: string;
  model?: string;
  /** Stored API key used by CLIs that support non-interactive auth fallback. */
  apiKey?: string;
}): AgentProvider {
  const spec = CLI_SPECS[args.id];
  if (!spec) {
    return {
      id: args.id,
      mode: "cli",
      async ping() {
        return { ok: false, detail: `CLI bridge no soportado para ${args.id} todavía.` };
      },
      async *run(): AsyncGenerator<AgentEvent> {
        yield {
          type: "error",
          message: `Modo CLI no soportado para ${args.id} en esta versión.`,
        };
      },
    };
  }

  return {
    id: args.id,
    mode: "cli",

    async ping() {
      const executor = requireExecutor();
      const bin = args.binOverride ?? spec.bin;
      const r = await executor.exec(loginShell(`command -v ${bin} 2>/dev/null || true`), {
        timeoutMs: 8_000,
      });
      if (!r.stdout.trim()) return { ok: false, detail: `Binario "${bin}" no encontrado en PATH` };
      const v = await executor.exec(loginShell(`${bin} --version 2>/dev/null || true`), {
        timeoutMs: 5_000,
      });
      return { ok: true, detail: `${args.id} CLI · ${v.stdout.trim().split("\n")[0] || "?"}` };
    },

    async *run(messages: AgentMessage[], opts: ProviderRunOptions): AsyncGenerator<AgentEvent> {
      const executor = requireExecutor();
      const serverName = executor.target.name;
      const conversationId = opts.conversationId;

      // MiniMax: ensure the /etc/luxipanel/claude-minimax.env file carries the
      // configured Subscription Key before launching — the wrapper sources it.
      if (args.id === "minimax") {
        await ensureMinimaxWrapper(executor, args.apiKey);
      }

      // ── Session continuity (memory) ───────────────────────────────────
      // Decide whether this turn RESUMES an existing upstream session.
      let session = null as Awaited<ReturnType<typeof cliSessionsRepository.getProvider>>;
      if (conversationId) {
        session = await cliSessionsRepository.getProvider(executor, conversationId, args.id).catch(() => null);
      }
      let resume = false;
      let claudeSessionId: string | undefined;
      let codexSessionId: string | undefined;
      if (args.id === "claude" || args.id === "minimax") {
        // MiniMax runs Claude Code underneath the `claude-minimax` wrapper, so
        // its session-id is the SAME upstream Claude session slot — we persist
        // it under the `claude` key so a future direct-Claude run can also resume
        // the same memory if the user toggles the provider.
        if (session?.claude) { resume = true; claudeSessionId = session.claude; }
        else { claudeSessionId = randomUUID(); }
      } else if (args.id === "codex") {
        if (session?.codex) {
          resume = true;
          codexSessionId = session.codex;
        }
      }
      // gemini: no native resume → always fresh launch (transcript carries memory)

      // Codex still benefits from a per-conversation cwd when there's no
      // linked project, but resume is now driven by the persisted session id.
      let cwd = opts.cwd;
      // File-jail forwarded to the Claude CLI sandbox via repeated `--add-dir`
      // flags (the spec's `buildLaunch` turns it into the actual flag string).
      // Mirrors the BACKEND jail (`setContextFileJail`) — built fresh per turn
      // because the project / agent / ancestor list can change between messages.
      // Empty/undefined list → no `--add-dir`, sandbox stays at the default
      // (cwd + $HOME, which is what project-less chats need).
      // Mutable copy: the attachment block below appends its upload dir so the
      // CLI sandbox can actually READ the files we just wrote (they live under
      // LUXIPANEL_CONFIG_DIR, i.e. outside cwd/$HOME — without this the model is
      // told "puedes leerlos" but every Read is denied → "lo adjunté y no lo viste").
      const jailPaths: string[] = opts.jailPaths ? [...opts.jailPaths] : [];
      // Approval mode: propagate the user's assistant-config choice to the
      // CLI so "auto" / "plan" actually take effect (previously hardcoded to
      // the manual gate regardless of mode).
      const approvalMode = opts.approvalMode ?? "manual";
      if (args.id === "codex" && conversationId && !cwd) {
        cwd = cliWorkDir(conversationId);
        await executor.exec(`mkdir -p ${quoteArg(cwd)}`, { timeoutMs: 5_000 }).catch(() => undefined);
      }
      // Claude scopes its resumable sessions by cwd. For a project-less chat,
      // pin a STABLE per-conversation cwd so every later `--resume` launches
      // from the same dir (otherwise the session can't be found and we self-heal
      // into a fresh one each turn, losing upstream memory).
      //  - new session  → mint /tmp/lxp-cli-<conversationId> and persist it.
      //  - resume        → reuse the cwd persisted with the session. If an OLDER
      //    session has none recorded, leave cwd unset (=$HOME, how it was
      //    originally created) — overriding it now would orphan its .jsonl.
      if ((args.id === "claude" || args.id === "minimax") && conversationId && !cwd) {
        if (resume) {
          cwd = session?.cwd;
        } else {
          cwd = cliWorkDir(conversationId);
          await executor.exec(`mkdir -p ${quoteArg(cwd)}`, { timeoutMs: 5_000 }).catch(() => undefined);
        }
      }
      let codexHome: string | undefined;
      if (args.id === "codex" && conversationId) {
        // graphMcp: the per-conversation config.toml gains/loses the target's
        // codebase-graph MCP depending on whether THIS run has an indexed
        // project (also strips the inherited entry so codex can't auto-index
        // the ephemeral /tmp cwds into the graph).
        codexHome = await ensureCodexConversationHome(executor, conversationId, opts.graphMcp, opts.modulesMcp, opts.crossServerMcp).catch((err) => {
          log.warn({ conversationId, err: (err as Error).message }, "codex conversation home setup failed");
          return undefined;
        });
        if ((opts.modulesMcp || opts.crossServerMcp) && !codexHome) {
          yield { type: "error", message: "No se pudo preparar el canal protegido de la sesión CLI. La ejecución no llegó a iniciarse; no se cambió a API." };
          return;
        }
      }

      // ── Upstream-session overflow guard (claude resume) ────────────────────
      // The panel-side context guard (`assessContext`) measures only the stored
      // transcript (`content` + 32k-capped `cliLog`) and badly UNDER-counts the
      // REAL `.jsonl` a tool-heavy chat balloons — so a runaway session keeps
      // getting `--resume`d until it overruns the model window and the CLI
      // returns an EMPTY answer (observed symptom: replies become just the
      // `$ claude …` banner, the thread looks like it "stops saving"). Before
      // resuming, measure the actual upstream transcript; if it's past budget,
      // start a FRESH session instead — seeded by the recent panel transcript
      // (`freshPrompt`, exactly like the self-heal path) — and drop the marker so
      // later turns resume the new, small session.
      let overflowReseed = false;
      if (resume && conversationId && (args.id === "claude" || args.id === "minimax")) {
        const resetBytes = upstreamSessionResetBytes();
        const sessionBytes = resetBytes > 0 ? await measureClaudeSessionBytes(executor, claudeSessionId ?? "") : 0;
        if (resetBytes > 0 && sessionBytes > resetBytes) {
          log.warn(
            { conversationId, sessionBytes, resetBytes, staleSession: claudeSessionId },
            "upstream claude session past window budget — starting a fresh session",
          );
          resume = false;
          overflowReseed = true;
          claudeSessionId = randomUUID();
          await cliSessionsRepository.clearProvider(executor, conversationId, args.id).catch(() => undefined);
          // A fresh claude session needs a STABLE cwd to stay resumable next turn:
          // keep the project cwd if any, else (re)mint the per-conversation tmp
          // dir — mirrors the brand-new-session branch above.
          if (!cwd) {
            cwd = cliWorkDir(conversationId);
            await executor.exec(`mkdir -p ${quoteArg(cwd)}`, { timeoutMs: 5_000 }).catch(() => undefined);
          }
        }
      }

      // Attachments are written once and their paths appended to whatever
      // prompt we end up sending (resume or fresh, including a self-heal retry).
      let attachmentSuffix = "";
      if (opts.attachments?.length) {
        // Attachment files live under LUXIPANEL_CONFIG_DIR on the connected
        // client server (never inside the project `cwd`/repo): a hidden
        // `.lxp-attachments` dir there would leak user files into the repo and
        // git. Scope by conversation so cleanup/inspection is per-chat.
        const configDir = panelConfigDir();
        const convScope = (conversationId || "shared").replace(/[^A-Za-z0-9._-]/g, "_");
        const dir = `${configDir}/assistant/cli-attachments/${convScope}`;
        const written: string[] = [];
        const failed: string[] = [];
        // Retry transient SFTP/proxy failures (ECONNRESET, socket hang-up, stale
        // channel) so an attachment isn't silently dropped. The old best-effort
        // catch swallowed EVERY error, leaving the model with no image and the
        // user no warning — the cause of "I attached it but you saw nothing".
        const withRetry = async (label: string, fn: () => Promise<unknown>): Promise<boolean> => {
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await fn();
              return true;
            } catch (err) {
              log.warn({ conversationId, label, attempt, err: (err as Error).message }, "attachment write attempt failed");
              if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * attempt));
            }
          }
          return false;
        };
        const dirOk = await withRetry("mkdir", () =>
          executor.exec(`mkdir -p ${quoteArg(dir)} && chmod 700 ${quoteArg(dir)}`, { timeoutMs: 5_000 }),
        );
        if (dirOk) {
          let seq = 0;
          for (const a of opts.attachments) {
            const safe = a.name.replace(/[^A-Za-z0-9._-]/g, "_");
            // Per-file counter avoids two files in the same millisecond colliding.
            const path = `${dir}/${Date.now()}-${seq++}-${safe}`;
            const ok = await withRetry(`writeFile:${safe}`, () =>
              executor.writeFile(path, Buffer.from(a.dataBase64, "base64")),
            );
            if (ok) written.push(path);
            else failed.push(a.name || safe);
          }
        } else {
          for (const a of opts.attachments) failed.push(a.name || "archivo");
          log.error({ conversationId, dir }, "attachment dir could not be created — all attachments dropped");
        }
        if (written.length) {
          attachmentSuffix = `\n\nArchivos adjuntos (rutas en el servidor, puedes leerlos):\n${written.map((p) => `- ${p}`).join("\n")}`;
          // Open the upload dir to the CLI sandbox (`--add-dir`). The files sit
          // under LUXIPANEL_CONFIG_DIR — outside the sandbox default (cwd+$HOME) —
          // so without this Claude Code's OS sandbox denies every Read and the
          // model "no ve" the attachment despite the path being in the prompt.
          if (!jailPaths.includes(dir)) jailPaths.push(dir);
        }
        // Make a failed upload VISIBLE instead of pretending no image was sent:
        // tell the model so it asks the user to retry rather than hallucinating.
        if (failed.length) {
          log.error({ conversationId, failed }, "one or more attachments failed to upload to the target server");
          attachmentSuffix += `\n\n[AVISO] ${failed.length} adjunto(s) NO se pudieron subir al servidor (${failed.join(", ")}). Dile al usuario que vuelva a adjuntarlos; NO inventes su contenido.`;
        }
      }

      // On resume the upstream session already holds the system directive +
      // prior turns, so we send ONLY the latest user message. Otherwise build
      // the full prompt (system + recent transcript + latest).
      const resumePrompt = (messages[messages.length - 1]?.content ?? "") + attachmentSuffix;
      // CLI has no prompt cache (claude resumes its own session); fold the
      // volatile server context back into the system directive.
      // Defensive companion to the `--disallowedTools Workflow` hard guard: the
      // flag can't block the `run_in_background` PARAMETER on Agent/Bash, so tell
      // claude explicitly that this is a one-turn headless run. (claude only — it
      // owns these tools; codex/gemini prompts stay untouched.) Sent on the first
      // turn; it persists in the resumed session.
      const headlessNote =
        (args.id === "claude" || args.id === "minimax")
          ? "\n\n## Ejecución (headless, un turno)\nEste turno corre headless y el proceso TERMINA al final de tu respuesta. NO lances trabajo en segundo plano con TUS herramientas: ni `Workflow`, ni `run_in_background` en Agent/Bash — quedaría interrumpido y se reanudaría a trompicones en el siguiente turno." +
            (opts.teamLeader
              ? "\nEXCEPCIÓN — HERRAMIENTAS DEL EQUIPO: las tools `mcp__luxipanel-servers__team__*` NO cuentan como trabajo en segundo plano tuyo — los chats que crean los gestiona el PANEL y sobreviven a este proceso. Delegar con `team__assign` y esperar con `team__collect` ES el flujo correcto y OBLIGATORIO de este turno (protocolo del líder). NO uses Agent/Task ni tus herramientas locales para hacer el trabajo del pedido: delega en tu equipo."
              : " Completa TODO de forma síncrona ahora; si necesitas paralelizar, usa subagentes en PRIMER PLANO (Agent sin `run_in_background`) y espera sus resultados antes de responder.")
          : "";
      const systemFull =
        (opts.systemContext ? `${opts.systemPrompt}\n\n${opts.systemContext}` : opts.systemPrompt) + headlessNote;
      // Overflow reseed gets the WIDE budget (parity with the self-heal path):
      // with the default 8 turns, a session reset silently shrank the chat's
      // effective memory to its last ~8 turns.
      const freshPrompt =
        buildPromptWithContext(messages, systemFull, overflowReseed ? { maxTurns: 100 } : {}) + attachmentSuffix;
      // On a RESUMED codex turn, re-assert the system directive too. codex keeps
      // its own upstream session (`exec resume`) but — exactly like claude — the
      // project/ancestor context fades after compaction or is absent if the
      // project was attached after turn 1, and codex has NO --append-system-prompt.
      // So for codex we PREPEND systemFull to the prompt body. claude re-injects
      // via --append-system-prompt inside runAttempt (don't prepend → avoid
      // duplication); gemini/grok always launch fresh (freshPrompt already carries
      // it). The self-heal path is claude-only and uses its own prompt.
      const launchResumePrompt =
        args.id === "codex" ? `${systemFull}\n\n---\n\n${resumePrompt}` : resumePrompt;

      if (!resumePrompt.trim() && !freshPrompt.trim()) {
        yield { type: "done" };
        return;
      }

      // Result of one launch+stream attempt. `resumeNotFound` is true when the
      // upstream `--resume` could not locate the session on the target (the
      // session file went missing / wasn't yet resumable) — see self-heal below.
      interface AttemptResult {
        detached: boolean;
        exitCode: number;
        accumulated: string;
        prompt: string;
        pid: string;
        jobId: string;
        resumeNotFound: boolean;
      }

      // Claude prints this to stderr (exit 0!) when `--resume <id>` finds no
      // session. We can only detect it from the captured output, never the code.
      const RESUME_NOT_FOUND = /No conversation found with session ID/i;
      // MiniMax/Claude Code can also return auth failures inside a "successful"
      // stream when the upstream session/wrapper state is stale. Detect the
      // textual login prompt and self-heal with a fresh session.
      const AUTH_LOGIN_REQUIRED = /(?:Not logged in\b|Please run\s+\/login\b|authentication_failed)/i;

      // One full launch → register → live-stream cycle. Yields SSE text/tool_use
      // events and RETURNS the collected state so the caller decides what final
      // events to emit (or whether to self-heal and retry).
      const runAttempt = async function* (
        attemptResume: boolean,
        sessionId: string | undefined,
        prompt: string,
        // When false, no `tool_use` is emitted: this attempt streams into the
        // terminal bubble that a PREVIOUS attempt already opened (used by the
        // self-heal retry so a failed `--resume` doesn't leave a second,
        // orphaned terminal block spinning forever in the chat).
        emitToolUse = true,
        // When false, the synthetic `$ claude …` header line is suppressed —
        // the self-heal retry already printed an explanatory note, so a second
        // command header would just look like a confusing restart.
        emitHeader = true,
      ): AsyncGenerator<AgentEvent, AttemptResult> {
        const jobId = `lxp-cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const promptFile = `/tmp/${jobId}-prompt.txt`;
        const logFile = `/tmp/${jobId}.log`;
        const exitFile = `/tmp/${jobId}.exit`;
        const fail = (): AttemptResult =>
          ({ detached: false, exitCode: 1, accumulated: "", prompt, pid: "", jobId, resumeNotFound: false });

        const adapter = await prepareModuleAdapter(executor, args.id, jobId, opts);
        const runPrompt = adapter.directive ? `${prompt}\n\n${adapter.directive}` : prompt;
        // Write prompt to a temp file on the target (avoids arg-length limits)
        try {
          await executor.writeFile(promptFile, Buffer.from(runPrompt, "utf8"), { mode: 0o600 });
        } catch (err) {
          yield { type: "error", message: `No se pudo escribir el prompt en el servidor: ${(err as Error).message}` };
          return fail();
        }

        // On a RESUMED claude turn, re-inject the system directive (project +
        // ancestor context) via --append-system-prompt: the prompt body holds
        // only the latest user message, so without this the upstream session is
        // the ONLY carrier of the project context and it silently fades once it
        // compacts (or never had it, if the project was set after turn 1). Fresh
        // turns embed it in the prompt body already, so we skip it there.
        const systemFile = `/tmp/${jobId}-system.txt`;
        let appendSystemPromptFile: string | undefined;
        let systemFileCleanup = "";
        if ((args.id === "claude" || args.id === "minimax") && attemptResume) {
          try {
            // 0600 at creation: systemFull carries the (potentially sensitive)
            // project + ancestor context re-injected via --append-system-prompt.
            // Setting the mode on write closes the window where the default umask
            // (0644) would let another user on the target read it before exec.
            await executor.writeFile(systemFile, Buffer.from(systemFull, "utf8"), { mode: 0o600 });
            appendSystemPromptFile = systemFile;
            systemFileCleanup = `rm -f ${quoteArg(systemFile)}`;
          } catch (err) {
            // writeFile may have created the file with the remote umask (0644)
            // before failing to set the mode; tighten it best-effort so the
            // sensitive re-injected context can't be read by another user.
            await executor.exec(`chmod 600 ${quoteArg(systemFile)}`, { timeoutMs: 5_000 }).catch(() => undefined);
            if (opts.modulesMcp) { yield { type: "error", message: "No se pudo preparar el canal protegido de módulos" }; return fail(); }
            log.warn({ jobId, err: (err as Error).message }, "append-system-prompt write failed — resuming without re-injected context");
          }
        }

        // Non-interactive sudo (askpass) so the CLI can run privileged steps.
        const sudo = await setupSudoAskpass(executor, jobId);
        const codexEnv = args.id === "codex" && codexHome
          ? `export CODEX_HOME=${quoteArg(codexHome)};`
          : "";
        let codexAdapterFile: string | undefined;
        let codexConfigFile: string | undefined;
        let codexAdapterCleanup = "";
        if (args.id === "codex") {
          codexAdapterFile = `/tmp/${jobId}-codex-adapter.mjs`;
          codexConfigFile = `/tmp/${jobId}-codex-config.json`;
          const approvalDir = `/tmp/${jobId}-approvals`;
          try {
            const source = await readFile(new URL("./codex-app-server-adapter.mjs", import.meta.url));
            await executor.exec(`mkdir -m 700 ${quoteArg(approvalDir)}`, { timeoutMs: 5_000 });
            await executor.writeFile(codexAdapterFile, source, { mode: 0o600 });
            await executor.writeFile(codexConfigFile, Buffer.from(JSON.stringify({
              promptFile, approvalDir, cwd, model: args.model, effort: opts.effort,
              approvalMode, resume: attemptResume, sessionId,
            })), { mode: 0o600 });
            codexAdapterCleanup = `rm -rf ${quoteArg(codexAdapterFile)} ${quoteArg(codexConfigFile)} ${quoteArg(approvalDir)}`;
          } catch (err) {
            yield { type: "error", message: `No se pudo preparar Codex app-server en el servidor: ${(err as Error).message}` };
            return fail();
          }
        }

        // Grok CLI reads GROK_API_KEY from the env and the model from GROK_MODEL
        // (no model flag). Key goes via a 0600 temp file (never argv) like codex.
        let grokEnv = "";
        let grokApiKeyCleanup = "";
        if (args.id === "grok") {
          const parts: string[] = [];
          if (args.model) parts.push(`export GROK_MODEL=${quoteArg(args.model)};`);
          if (args.apiKey) {
            const keyFile = `/tmp/${jobId}-grok-key`;
            try {
              await executor.writeFile(keyFile, Buffer.from(args.apiKey, "utf8"));
              await executor.exec(`chmod 600 ${quoteArg(keyFile)}`, { timeoutMs: 5_000 }).catch(() => undefined);
              parts.push(`export GROK_API_KEY="$(cat ${quoteArg(keyFile)})";`);
              grokApiKeyCleanup = `rm -f ${quoteArg(keyFile)}`;
            } catch (err) {
              log.warn({ jobId, err: (err as Error).message }, "grok API key setup failed");
            }
          }
          grokEnv = parts.join(" ");
        }

        // MiniMax CLI: the endpoint rejects `--model` on this surface (the
        // wrapper's buildLaunch deliberately ignores ctx.model), but the
        // wrapper only DEFAULTS ANTHROPIC_MODEL when the env doesn't already
        // carry one (`: "${ANTHROPIC_MODEL:=…}"`) — so the per-turn model
        // selection travels as an env export instead of a flag. No model
        // chosen → no export → wrapper default, exactly as before.
        const minimaxEnv =
          args.id === "minimax" && args.model
            ? `export ANTHROPIC_MODEL=${quoteArg(args.model)};`
            : "";

        // Per-run MCP config (claude/minimax only): cross-server channel
        // (panel's servers.* tools, short-lived bearer → 0600 + removed after
        // the run) and/or the target's codebase graph (stdio binary, projects
        // indexed from the assistant UI). `--strict-mcp-config` stays on: only
        // what THIS file lists loads — the user's ~/.claude.json stays ignored.
        let mcpConfigFile: string | undefined;
        let graphMcpAttached = false;
        let mcpCleanup = "";
        if ((opts.crossServerMcp || opts.graphMcp || opts.modulesMcp) && (args.id === "claude" || args.id === "minimax")) {
          const f = `/tmp/${jobId}-mcp.json`;
          const cfg = JSON.stringify({
            mcpServers: {
              ...(opts.modulesMcp ? { "luxipanel-modules": moduleMcpServer(opts.modulesMcp) } : {}),
              ...(opts.crossServerMcp
                ? {
                    "luxipanel-servers": {
                      type: "http",
                      url: opts.crossServerMcp.url,
                      headers: { Authorization: `Bearer ${opts.crossServerMcp.token}` },
                    },
                  }
                : {}),
              // Code graph. This USED to be `{ type: "stdio", command: <binPath> }`
              // — the raw `codebase-memory-mcp` binary handed straight to the
              // model, with an unscoped `list_projects` and a free `project`
              // argument on every query. Any agent could enumerate and read the
              // other agents' graphs. It is now the panel's own HTTP channel,
              // which resolves the caller's agent from the signed token and
              // validates every `project` against that agent's own projects.
              ...(opts.graphMcp
                ? {
                    [GRAPH_MCP_SERVER_KEY]: {
                      type: "http",
                      url: opts.graphMcp.url,
                      headers: { Authorization: `Bearer ${opts.graphMcp.token}` },
                    },
                  }
                : {}),
            },
          });
          try {
            await executor.writeFile(f, Buffer.from(cfg, "utf8"), { mode: 0o600 });
            mcpConfigFile = f;
            graphMcpAttached = Boolean(opts.graphMcp);
            mcpCleanup = `rm -f ${quoteArg(f)}`;
          } catch (err) {
            log.warn({ jobId, err: (err as Error).message }, "per-run MCP config write failed — continuing without it");
          }
        }

        // Live steering (ASSISTANT_LIVE_STEERING, claude/minimax only): run the
        // CLI on a persistent stdin FIFO so the user can inject mid-run addenda.
        // Seed the prompt as the first NDJSON user message; the FIFO holder (fed
        // below, after launch) keeps the pipe open. jobId is `[a-z0-9-]` only, so
        // the derived /tmp paths are shell-safe without quoting.
        const steeringOn =
          env.ASSISTANT_LIVE_STEERING &&
          (args.id === "claude" || args.id === "minimax") &&
          !!conversationId;
        let stdinFifo: string | undefined;
        let steerSeedFile: string | undefined;
        let steerCleanup = "";
        if (steeringOn) {
          const fifo = `/tmp/${jobId}-stdin.fifo`;
          const seedFile = `/tmp/${jobId}-seed.ndjson`;
          const seed = `${JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: runPrompt }] } })}\n`;
          try {
            await executor.exec(`mkfifo ${fifo} 2>/dev/null || true`, { timeoutMs: 8_000 });
            await executor.writeFile(seedFile, Buffer.from(seed, "utf8"));
            stdinFifo = fifo;
            steerSeedFile = seedFile;
            steerCleanup = `rm -f ${fifo} ${seedFile}`;
          } catch (err) {
            log.warn({ jobId, err: (err as Error).message }, "steering FIFO setup failed — falling back to one-shot");
          }
        }

        // Launch detached — returns the PID in < 1 s
        const launchCmd = spec.buildLaunch({
          promptFile, logFile, exitFile, cwd,
          ...(jailPaths ? { jailPaths } : {}),
          approvalMode,
          effort: opts.effort,
          model: args.model, resume: attemptResume, sessionId,
          ...(codexAdapterFile ? { codexAdapterFile } : {}),
          ...(codexConfigFile ? { codexConfigFile } : {}),
          ...(mcpConfigFile ? { mcpConfigFile } : {}),
          ...(graphMcpAttached ? { graphMcpAttached } : {}),
          ...(opts.modulesMcp ? { modulesMcpAttached: true } : {}),
          ...(appendSystemPromptFile ? { appendSystemPromptFile } : {}),
          ...(stdinFifo ? { stdinFifo } : {}),
          // A graph call can BLOCK on the user: reaching a project the agent was
          // not assigned raises an approval prompt in the chat and the tool call
          // waits for the answer (up to 90s). The CLI's default MCP tool timeout
          // is shorter than that, so without this the call would die as a
          // transport error mid-decision instead of coming back allowed/denied.
          // `export …;` — un prefijo `VAR=x` solo aplica al comando que le sigue
          // (aquí, el `export PATH` del askpass), así que NO llegaba al CLI.
          envPrefix: [adapter.env, graphMcpAttached ? "export MCP_TOOL_TIMEOUT=180000;" : "", opts.modulesMcp ? "export MCP_TOOL_TIMEOUT=300000;" : "", codexEnv, grokEnv, minimaxEnv, sudo?.envPrefix ?? ""].filter(Boolean).join(" "),
          cleanup: [adapter.cleanup, sudo?.cleanup, codexAdapterCleanup, grokApiKeyCleanup, mcpCleanup, systemFileCleanup, steerCleanup].filter(Boolean).join("; "),
        });
        log.info({ provider: args.id, jobId, cwd: cwd ?? null, resume: attemptResume, sudo: Boolean(sudo) }, "CLI background job launching");

        let pid: string;
        try {
          const r = await executor.exec(launchCmd, { timeoutMs: 15_000 });
          pid = r.stdout.trim().split("\n").pop() ?? "";
          if (!pid || !/^\d+$/.test(pid)) {
            throw new Error(`launch returned unexpected PID: ${JSON.stringify(pid)}`);
          }
        } catch (err) {
          void executor.exec(`rm -f ${promptFile}${appendSystemPromptFile ? ` ${quoteArg(appendSystemPromptFile)}` : ""}`, { timeoutMs: 5_000 }).catch(() => undefined);
          yield { type: "error", message: `Error lanzando CLI en background: ${(err as Error).message}` };
          return fail();
        }

        // Persist the session marker so the NEXT turn resumes this one. Record
        // the cwd too: claude must --resume from the same dir it was created in.
        // MiniMax uses the same `claude` slot (Claude Code underneath).
        if (conversationId && !attemptResume) {
          const patch = (args.id === "claude" || args.id === "minimax") && sessionId
            ? { claude: sessionId, ...(cwd ? { cwd } : {}) }
            : null;
          if (patch) {
            await cliSessionsRepository.patchProvider(executor, conversationId, args.id, patch).catch(() => undefined);
          }
        }
        // Steering: now that the CLI is opening the FIFO for reading, launch the
        // holder that opens the write end, feeds the seed user message, and holds
        // the pipe open (sleep > the tracker's 30-min eviction). FIFO open blocks
        // until both ends are present, so there's no seed/read race. The holder's
        // PID lets the tracker force EOF (kill it) when the turn's `result` lands.
        let holderPid: string | undefined;
        let steerSeq = 0;
        let steerFn: ((text: string) => Promise<void>) | undefined;
        if (stdinFifo && steerSeedFile) {
          const fifo = stdinFifo;
          try {
            const holder = await executor.exec(
              `nohup bash -c "exec 3>${fifo}; cat ${steerSeedFile} >&3; sleep 2000" >/dev/null 2>&1 & echo $!`,
              { timeoutMs: 10_000 },
            );
            const hp = holder.stdout.trim().split("\n").pop() ?? "";
            if (/^\d+$/.test(hp)) holderPid = hp;
            // Steering channel: write one NDJSON user message to the FIFO. A
            // transient writer (the `cat`) is fine — the holder keeps the reader
            // from EOF-ing. Payload goes via a 0600 temp file (never argv).
            steerFn = async (text: string) => {
              const tmp = `/tmp/${jobId}-steer-${steerSeq++}.ndjson`;
              const ndjson = `${JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text }] } })}\n`;
              await executor.writeFile(tmp, Buffer.from(ndjson, "utf8"));
              await executor.exec(`cat ${tmp} > ${fifo}; rm -f ${tmp}`, { timeoutMs: 10_000 });
            };
          } catch (err) {
            log.warn({ jobId, err: (err as Error).message }, "steering holder launch failed — turn runs without live steering");
          }
        }

        // Register in the tracker so background polling starts. `pid` +
        // `conversationId` let an explicit user stop kill this process tree.
        const job = cliJobTracker.start({
          jobId, logFile, exitFile, executor, serverName, pid, conversationId,
          provider: args.id,
          notificationCtx: { title: `Tarea IA completada en ${serverName}`, link: "/panel/assistant" },
          transform: spec.makeTransform?.(),
          ...(steerFn ? { steer: steerFn, steering: true, ...(holderPid ? { holderPid } : {}) } : {}),
        });

        // Persist a recovery descriptor so this background job survives a panel
        // restart: if the process dies before the run completes, the `nohup`
        // keeps writing its log/exit on the target and a later authenticated
        // request re-attaches via `makeRecoveredCliGen`. Deleted on completion
        // (controller onComplete), stop, or recovery. Self-heal retries reuse
        // the same conversationId key → the latest jobId wins.
        if (conversationId) {
          const descriptor = { conversationId, jobId, logFile, exitFile, provider: args.id,
            serverName, pid, model: args.model, startedAt: job.startedAt };
          const moduleRecovery = captureModuleRunRecovery(executor, descriptor, opts.modulesMcp?.token);
          const recoverable = { ...descriptor, ...(moduleRecovery ? { moduleRecovery } : {}) };
          await cliJobsRepository
            .set(executor, conversationId, recoverable)
            .catch(() => undefined);
          await bindOwnerContributionCli(getContextUser() ?? undefined, recoverable, executor.target.id);
        }

        if (args.id === "codex" && conversationId && codexHome && !attemptResume) {
          void captureCodexSessionId(executor, codexHome, sessionId)
            .then(async (captured) => {
              if (!captured) {
                log.warn({ conversationId, jobId }, "codex session id could not be captured");
                return;
              }
              await cliSessionsRepository.patchProvider(executor, conversationId, args.id, { codex: captured }).catch(() => undefined);
            })
            .catch((err) => {
              log.warn({ conversationId, jobId, err: (err as Error).message }, "codex session id capture failed");
            });
        }

        // tool_use → frontend shows the CLI bubble with spinner + elapsed timer.
        // Skipped on a self-heal retry so its output flows into the existing bubble.
        if (emitToolUse) {
          yield { type: "tool_use", id: jobId, name: `${args.id}.cli`, input: { jobId, pid, startedAt: job.startedAt, resume: attemptResume } };
        }
        // Synthetic command line so the mini-terminal opens with a prompt line.
        if (emitHeader) {
          yield { type: "text", delta: `\x1b[2m$ ${spec.describe({ resume: attemptResume, sessionId, model: args.model })}\x1b[0m\r\n` };
        }

        cliJobTracker.setActiveStream(jobId, true);

        // ── Streaming loop — yield incremental chunks while SSE is alive ──
        let wakeFn: (() => void) | null = null;
        let jobDone = false;
        let jobExitCode = 0;
        const queue: string[] = [];
        const unsubOutput = cliJobTracker.subscribeOutput(jobId, (chunk) => { queue.push(chunk); wakeFn?.(); wakeFn = null; });
        const unsubDone = cliJobTracker.subscribeDone(jobId, (_, code) => { jobDone = true; jobExitCode = code; wakeFn?.(); wakeFn = null; });
        const waitNext = (signal?: AbortSignal): Promise<void> =>
          new Promise<void>((res) => {
            if (signal?.aborted) { res(); return; }
            wakeFn = res;
            if (signal) signal.addEventListener("abort", () => res(), { once: true });
          });

        let detached = false;
        try {
          while (true) {
            while (queue.length > 0) yield { type: "text", delta: queue.shift()! };
            if (jobDone) break;
            if (opts.signal?.aborted) { detached = true; break; }
            await waitNext(opts.signal);
          }
        } finally {
          unsubOutput();
          unsubDone();
          cliJobTracker.setActiveStream(jobId, false);
        }

        return {
          detached,
          exitCode: jobExitCode,
          accumulated: job.accumulated,
          prompt,
          pid,
          jobId,
          resumeNotFound: attemptResume && RESUME_NOT_FOUND.test(job.accumulated),
        };
      };

      // A nohup Codex process can outlive a panel restart even when its
      // recovery descriptor was lost. Starting `exec resume` against that
      // thread fails immediately with "active writer". Wait for the actual
      // target process to exit; keep this run active so later messages queue.
      const waitForCodexWriter = async (id: string): Promise<"free" | "aborted" | "timeout"> => {
        const deadline = Date.now() + 60 * 60_000;
        while (await codexThreadHasWriter(executor, id)) {
          if (opts.signal?.aborted) return "aborted";
          if (Date.now() >= deadline) return "timeout";
          await sleep(5_000);
        }
        return opts.signal?.aborted ? "aborted" : "free";
      };
      if (args.id === "codex" && resume && codexSessionId && await codexThreadHasWriter(executor, codexSessionId)) {
        yield { type: "text", delta: "\x1b[2m(otra ejecución de este chat sigue activa; esperaré a que termine antes de continuar)\x1b[0m\r\n" };
        const ready = await waitForCodexWriter(codexSessionId);
        if (ready !== "free") {
          if (ready === "timeout") yield { type: "error", message: "La ejecución anterior de Codex sigue activa después de una hora. Detén esa tarea antes de reintentar." };
          return;
        }
      }

      // ── Attempt 1 ─────────────────────────────────────────────────────
      let r = yield* runAttempt(
        resume,
        args.id === "claude" || args.id === "minimax" ? claudeSessionId : codexSessionId,
        resume ? launchResumePrompt : freshPrompt,
      );
      // The frontend terminal bubble is keyed by the FIRST attempt's jobId. A
      // self-heal retry reuses this id (and its bubble) instead of opening a
      // second one, so all final events below must reference it — not the
      // (possibly newer) jobId of whichever attempt ran last.
      const streamToolId = r.jobId;

      // A temporarily overloaded model can fail after the agent has already
      // edited files or called tools. Resume the same upstream session with a
      // continuation instruction, so a retry first inspects those side effects.
      // Keep retries bounded: persistent provider outages must remain visible.
      if (args.id === "codex" && conversationId && codexHome) {
        let overloadRetries = 0;
        let writerRetries = 0;
        let missingRecovered = false;
        let lastResumed = resume;
        const lastUserMessage = messages[messages.length - 1]?.content ?? "";
        const continuation = codexContinuationPrompt(lastUserMessage);
        while (!r.detached && !opts.signal?.aborted) {
          const failure = codexFailure(r.accumulated, r.exitCode);
          if (failure === "active-writer" && lastResumed && codexSessionId && writerRetries < 3) {
            writerRetries++;
            yield { type: "text", delta: "\x1b[2m(este hilo Codex está ocupado; esperaré a que termine la ejecución anterior)\x1b[0m\r\n" };
            await sleep(10_000 * writerRetries);
            if (opts.signal?.aborted) break;
            const ready = await waitForCodexWriter(codexSessionId);
            if (ready === "aborted") break;
            if (ready === "timeout") {
              yield { type: "error", message: "La ejecución anterior de Codex sigue activa después de una hora. Detén esa tarea antes de reintentar." };
              return;
            }
            r = yield* runAttempt(true, codexSessionId, launchResumePrompt, false, false);
            continue;
          }
          if (failure === "overloaded" && overloadRetries < 2) {
            const delayMs = overloadRetries === 0 ? 10_000 : 30_000;
            overloadRetries++;
            yield { type: "text", delta: `\x1b[2m(modelo temporalmente saturado — continuaré en ${Math.round(delayMs / 1000)} s, intento ${overloadRetries}/2)\x1b[0m\r\n` };
            await sleep(delayMs);
            if (opts.signal?.aborted) break;
            if (!codexSessionId) {
              codexSessionId = await captureCodexSessionId(executor, codexHome).catch(() => null) ?? undefined;
              if (codexSessionId) {
                await cliSessionsRepository.patchProvider(executor, conversationId, args.id, { codex: codexSessionId }).catch(() => undefined);
              }
            }
            lastResumed = Boolean(codexSessionId);
            r = yield* runAttempt(
              lastResumed,
              codexSessionId,
              lastResumed ? `${systemFull}\n\n---\n\n${continuation}` : `${freshPrompt}\n\n${continuation}`,
              false,
              false,
            );
            continue;
          }
          if (failure === "missing-session" && lastResumed && !missingRecovered) {
            missingRecovered = true;
            codexSessionId = undefined;
            await cliSessionsRepository.patchProvider(executor, conversationId, args.id, { codex: "" }).catch(() => undefined);
            yield { type: "text", delta: "\x1b[2m(sesión Codex no disponible — recuperando la tarea desde el historial)\x1b[0m\r\n" };
            lastResumed = false;
            const recoveryPrompt = buildPromptWithContext(messages, systemFull, { maxTurns: 100, maxChars: TRANSCRIPT_MAX_CHARS })
              + attachmentSuffix + `\n\n${continuation}`;
            r = yield* runAttempt(false, undefined, recoveryPrompt, false, false);
            continue;
          }
          break;
        }
      }

      // ── Self-heal: resume pointed at a session the target can't find ──
      // (claude exits 0 but prints "No conversation found"). Re-mint a fresh
      // session, persist it so future turns resume the NEW one, and relaunch.
      // Because the upstream session memory is gone, replay a GENEROUS transcript
      // (all available turns within the char budget, not just the last 8) so the
      // conversation keeps as much context as possible. Only when the SSE is
      // still attached (we have a live turn to recover into).
      if ((args.id === "claude" || args.id === "minimax") && r.resumeNotFound && !r.detached) {
        log.warn({ conversationId, staleSession: claudeSessionId }, "claude --resume not found on target — self-healing with a fresh session");
        const freshId = randomUUID();
        if (conversationId) {
          // Persist the cwd alongside the fresh id so the NEXT turn resumes the
          // re-minted session from the same dir it's about to be created in.
          await cliSessionsRepository.patchProvider(executor, conversationId, args.id, { claude: freshId, ...(cwd ? { cwd } : {}) }).catch(() => undefined);
        }
        yield { type: "text", delta: `\x1b[2m(sesión previa no disponible — reanudando memoria desde el historial)\x1b[0m\r\n` };
        claudeSessionId = freshId;
        resume = false;
        const selfHealPrompt =
          buildPromptWithContext(messages, systemFull, { maxTurns: 100, maxChars: TRANSCRIPT_MAX_CHARS }) + attachmentSuffix;
        // emitToolUse=false (reuse the open bubble) AND emitHeader=false (the
        // note above already explains the relaunch — no second `$ claude` line).
        r = yield* runAttempt(false, freshId, selfHealPrompt, /* emitToolUse */ false, /* emitHeader */ false);
      }

      // MiniMax-specific self-heal: when the CLI answers with the interactive
      // `/login` prompt, the current upstream session is unusable for chat.
      // Re-sync the wrapper/env, mint a fresh Claude-session id underneath the
      // wrapper, and replay the recent transcript into a clean launch.
      if (args.id === "minimax" && !r.detached && AUTH_LOGIN_REQUIRED.test(r.accumulated)) {
        const cacheKey = executor.target.id || executor.target.name || "default";
        minimaxAuthOk.delete(cacheKey);
        await ensureMinimaxWrapper(executor, args.apiKey);
        const freshId = randomUUID();
        if (conversationId) {
          await cliSessionsRepository.patchProvider(executor, conversationId, args.id, { claude: freshId, ...(cwd ? { cwd } : {}) }).catch(() => undefined);
        }
        yield { type: "text", delta: `\x1b[2m(auth de MiniMax rearmada — relanzando sesión limpia)\x1b[0m\r\n` };
        claudeSessionId = freshId;
        resume = false;
        const authHealPrompt =
          buildPromptWithContext(messages, systemFull, { maxTurns: 100, maxChars: TRANSCRIPT_MAX_CHARS }) + attachmentSuffix;
        r = yield* runAttempt(false, freshId, authHealPrompt, /* emitToolUse */ false, /* emitHeader */ false);
      }

      if (r.detached) {
        // SSE dropped before the job finished. Close the turn cleanly; the
        // tracker keeps polling and notifies on completion.
        yield {
          type: "tool_result",
          id: streamToolId,
          success: true,
          output: `[corriendo en background — PID ${r.pid} en ${serverName}]`,
        };
        yield { type: "done", pending: true };
        return;
      }

      // Job finished while streaming. Parse the clean final answer from the raw
      // log via the provider's structured parser (claude stream-json / codex
      // --json / gemini stream-json). Plain-output providers have no parser.
      const finalAnswer = r.exitCode === 0 ? spec.parseFinalAnswer ? spec.parseFinalAnswer(r.accumulated) : r.accumulated.replace(ANSI_RE, "") : "";
      const success = r.exitCode === 0 && !!finalAnswer.trim() && !(args.id === "codex" && codexFailure(r.accumulated, r.exitCode));
      const failureMessage = cliFailureMessage(r.accumulated, r.exitCode);

      // Did the agent stop to ask the user a decision? Scan the finished output
      // for the ask sentinel block (structured providers: the parsed final
      // answer; others: the ANSI-stripped terminal log). Only on a clean exit —
      // a crash isn't a question. When present, strip the block from the answer
      // text so the bubble shows just the agent's preamble and controls below.
      const askSource = spec.parseFinalAnswer ? finalAnswer : r.accumulated.replace(ANSI_RE, "");
      const ask = success ? extractAskRequest(askSource) : null;
      const cleanAnswer = ask ? stripAskBlock(finalAnswer) : finalAnswer;

      yield {
        type: "tool_result",
        id: streamToolId,
        success,
        output: success ? cleanAnswer : failureMessage,
      };

      if (ask) {
        yield { type: "ask", id: streamToolId, questions: ask.questions, ...(ask.kind ? { kind: ask.kind } : {}) };
      }

      // Usage: prefer the provider's real token counts from its structured log
      // (claude `result` / codex `turn.completed`); estimate otherwise.
      const realUsage = spec.parseUsage?.(r.accumulated) ?? null;
      yield realUsage
        ? {
            type: "usage",
            model: args.model ?? `${args.id}-cli`,
            inputTokens: realUsage.inputTokens,
            outputTokens: realUsage.outputTokens,
            estimated: false,
          }
        : {
            type: "usage",
            model: args.model ?? `${args.id}-cli`,
            inputTokens: Math.ceil(r.prompt.length / 4),
            outputTokens: Math.ceil(r.accumulated.length / 4),
            estimated: true,
          };

      yield success ? { type: "done" } : { type: "error", message: failureMessage };
    },
  };
}
