// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Auth helpers — used in Astro SSR pages and middleware.
 *
 * Server-side: call getSession(request) to read the JWT from cookies.
 * Client-side: redirectToLogin() / redirectToDashboard() helpers.
 */

import { getBackendUrl } from "@/lib/server-env";
import { initialsFrom } from "@/lib/format";

// MUST match backend SessionUser (shared/types/index.ts)
export interface SessionUser {
  github?: { required: boolean; connected: boolean; login?: string; canEditCore: boolean; canContribute: boolean; deviceFlowAvailable: boolean };
  hostingPolicy?: { capabilities?: { php: boolean }; runtime: boolean; state: "ready" | "pending"; security?: { shell: "disabled" | "jailed" } };
  userId: number;
  username: string;
  displayName: string;
  role: string;
  modules: string[];
  kind: "admin" | "user" | "hosting" | "mfa_pending" | "external-guest";
  /** External-panel guest session (WHM/cPanel enmascarado por subdominio).
   *  Sin executor SSH; los FABs sólo si `external.hasSsh`. */
  external?: {
    accessCode: string;
    entryUrl: string;
    displayName: string;
    category?: string | null;
    tag?: string | null;
    hasSsh: boolean;
  };
  permissions?: {
    sidebar: string[];
    views: string[];
    actions: string[];
    fileAccess: {
      allowAll: boolean;
      allowPaths: string[];
      denyPaths: string[];
      readOnlyPaths: string[];
    };
    commandPolicy: {
      allowAll: boolean;
      groups: string[];
      allowCommands: string[];
      denyCommands: string[];
    };
  };
  /** Tenant ID — only set for hosting account sessions */
  tenantId?: number;
  /** Hosting-only: dueño primario del tenant (= username del owner Linux). */
  owner?: string;
  /** Hosting-only: grupo Linux que une a los sub-usuarios (h-<owner>). */
  tenantGroup?: string;
  /** Hosting-only: raíz del tenant (= permissions.fileAccess.allowPaths[0]). */
  homeRoot?: string;
  /** Hosting-only: cupo máximo de sub-usuarios que la cuenta puede crear. */
  maxSubUsers?: number;
  /** Hosting-only (Fase 6): cupos de recursos del tenant, llevados en el JWT. */
  maxDomains?: number;
  maxEmailAccounts?: number;
  maxDatabases?: number;
  diskQuotaMb?: number;
  /** Bandwidth cap (dormant — enforcement diferido a Fase 7). */
  bandwidthQuotaMb?: number;
  /** Hosting-only (Fase 5): la cuenta tiene el chroot/jail previsto. */
  jailEnabled?: boolean;
  bridgeSessionId?: string;
  /** Remote LP-LS agent session identifier (sid). */
  remoteSessionId?: string;
  /** LP customer id (owner of the bridged session). With SSO_IDENTITY=linux the
   *  panel `userId` is the per-server Linux user, so the server switcher uses
   *  this to list the customer's other servers. */
  remoteUserId?: number;
  targetId?: string;
  targetName?: string;
  /** Stable display host of the connected panel (verified custom domain or
   *  `<accessSubdomain>.<managed-domain>`), from LP's SSO `thost` claim. The
   *  sidebar server switcher shows its subdomain instead of the cryptic dynamic
   *  login host. Absent when the backend/LP is older. */
  targetHost?: string;
  /** True when the session was issued by the SSH-based /login flow (direct
   *  bridge), as opposed to coming through the LP-LICENSE-SERVER SSO. */
  direct?: boolean;
}

/**
 * Read session from the backend.
 * Called server-side in Astro pages (SSR) or middleware.
 * Returns null if not authenticated.
 */
export async function getSession(request: Request): Promise<SessionUser | null> {
  const backendUrl = getBackendUrl();
  const cookie = request.headers.get("cookie") ?? "";


  try {
    const res = await fetch(`${backendUrl}/api/session`, {
      headers: {
        // Forward cookies from the original request
        cookie,
      },
      // The middleware calls this on EVERY /panel/* navigation. Without a bound,
      // a hung backend holds each SSR render open until the worker pool drains.
      // On timeout the catch returns null → treated as unauthenticated (the
      // middleware's fail-closed redirect to /login), never a hang.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const json = await res.json() as { ok: boolean; user?: SessionUser };
    if (json.ok && json.user) {
      return json.user;
    }
    return null;
  } catch {
    return null;
  }
}

/** Check if user is an admin. */
export function isAdmin(user: SessionUser): boolean {
  return user.kind === "admin";
}

/** True for an external-panel guest session (WHM proxied via subdomain). */
export function isExternalGuest(user: SessionUser): boolean {
  return user.kind === "external-guest";
}

export function hasAction(user: SessionUser, action: string): boolean {
  if (user.kind === "admin") return true;
  const actions = user.permissions?.actions ?? [];
  if (actions.includes(action) || actions.includes("*")) return true;
  const prefix = action.split(".")[0];
  return Boolean(prefix && actions.includes(`${prefix}.*`));
}

export function canSeeSidebar(user: SessionUser, item: string): boolean {
  if (user.kind === "admin") return true;
  const sidebar = user.permissions?.sidebar ?? [];
  return sidebar.includes(item) || sidebar.includes("*");
}

/** Build the initials string for the avatar (max 2 chars). Pure part shared
 *  with the messenger / agents-tab avatars in `@/lib/format` (F-21). */
export function getInitials(user: SessionUser): string {
  return initialsFrom(user.displayName || user.username, { empty: "" });
}
