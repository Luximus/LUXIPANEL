// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal session manager.
 *
 * Tracks active PTY sessions. Enforces:
 *  - Max concurrent sessions (TERMINAL_MAX_SESSIONS)
 *  - Idle timeout (TERMINAL_IDLE_TIMEOUT_MS) — sessions not seen for this
 *    long are killed automatically
 *
 * Cleanup runs every 60 seconds.
 */

import { WebSocket } from "ws";
import { env } from "../../../config/env.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import type { PtyProcess } from "./pty.service.js";

const log = createModuleLogger("terminal:sessions");

export interface TerminalSession {
  sessionId: string;
  userId: number;
  username: string;
  pty: PtyProcess;
  ws: WebSocket;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Map key = `${userId}:${sessionId}`. The `sessionId` is client-controlled
 * (`?sessionId=` on the WS upgrade), so keying the map by it ALONE let one user
 * overwrite another user's live PTY entry (silent channel leak + the victim's
 * `ws.close` destroying the attacker's session, and a trivial bypass of the
 * concurrency cap). Namespacing by `userId` isolates the id space per user.
 */
function sessionKey(userId: number, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

class SessionManagerService {
  private readonly sessions = new Map<string, TerminalSession>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.cleanupTimer = setInterval(() => this._cleanup(), 60_000);
    log.info("Terminal session manager started");
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    // Kill all active sessions
    for (const session of this.sessions.values()) {
      this._destroySession(session, "server-shutdown");
    }
    this.sessions.clear();
    log.info("Terminal session manager stopped");
  }

  /**
   * Register a new terminal session.
   * Throws if the max session limit is reached.
   */
  add(session: TerminalSession): void {
    const key = sessionKey(session.userId, session.sessionId);

    // Same user re-registering the same id (e.g. tmux reattach after a dropped
    // WS): destroy the stale entry first so its PTY/WS are cleaned up instead of
    // silently leaking, and so it doesn't count against the caps below.
    const existing = this.sessions.get(key);
    if (existing) {
      this._destroySession(existing, "replaced");
      this.sessions.delete(key);
    }

    if (this.sessions.size >= env.TERMINAL_MAX_SESSIONS) {
      throw new Error(
        `Maximum terminal sessions (${env.TERMINAL_MAX_SESSIONS}) reached. Close an existing session first.`,
      );
    }
    // Per-user cap so one user can't exhaust the global pool and lock everyone
    // else out of the terminal.
    let perUser = 0;
    for (const s of this.sessions.values()) if (s.userId === session.userId) perUser++;
    if (perUser >= env.TERMINAL_MAX_SESSIONS) {
      throw new Error(
        `Maximum terminal sessions (${env.TERMINAL_MAX_SESSIONS}) reached. Close an existing session first.`,
      );
    }

    this.sessions.set(key, session);
    log.info(
      { sessionId: session.sessionId, userId: session.userId, pid: session.pty.pid },
      "Terminal session created",
    );
  }

  touch(userId: number, sessionId: string): void {
    const session = this.sessions.get(sessionKey(userId, sessionId));
    if (session) session.lastActivityAt = new Date();
  }

  /** Close and remove a session by (userId, sessionId). */
  close(userId: number, sessionId: string, reason = "closed"): boolean {
    const key = sessionKey(userId, sessionId);
    const session = this.sessions.get(key);
    if (!session) return false;
    this._destroySession(session, reason);
    this.sessions.delete(key);
    return true;
  }

  /**
   * Admin force-close by bare `sessionId` (the id shown in the admin list).
   * Sessions are keyed by `${userId}:${sessionId}` internally, so scan for the
   * matching entry regardless of owner.
   */
  closeBySessionId(sessionId: string, reason = "closed"): boolean {
    for (const [key, session] of this.sessions) {
      if (session.sessionId === sessionId) {
        this._destroySession(session, reason);
        this.sessions.delete(key);
        return true;
      }
    }
    return false;
  }

  /** List all active sessions (summary view for admin endpoint). */
  list(): Array<{
    sessionId: string;
    userId: number;
    username: string;
    pid: number;
    createdAt: string;
    lastActivityAt: string;
  }> {
    return [...this.sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      userId: s.userId,
      username: s.username,
      pid: s.pty.pid,
      createdAt: s.createdAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
    }));
  }

  private _destroySession(session: TerminalSession, reason: string): void {
    log.info(
      { sessionId: session.sessionId, userId: session.userId, reason },
      "Destroying terminal session",
    );
    session.pty.kill("SIGHUP");
    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        // For "process-exit" the exit message was already sent by pty.onExit
        // in the controller — skip it here to avoid duplicate messages.
        if (reason !== "process-exit") {
          session.ws.send(JSON.stringify({ type: "exit", code: 0, reason }));
        }
        session.ws.close(1000, reason);
      }
    } catch {
      // WS may already be closed
    }
  }

  private _cleanup(): void {
    const now = Date.now();
    const timeoutMs = env.TERMINAL_IDLE_TIMEOUT_MS;

    for (const [id, session] of this.sessions) {
      const idleMs = now - session.lastActivityAt.getTime();
      if (idleMs > timeoutMs) {
        log.warn({ sessionId: id, idleMs }, "Closing idle terminal session");
        this._destroySession(session, "idle-timeout");
        this.sessions.delete(id);
      }
    }
  }
}

export const sessionManagerService = new SessionManagerService();
