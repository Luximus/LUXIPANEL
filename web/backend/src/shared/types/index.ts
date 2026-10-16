// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared TypeScript types used across modules.
 */

import type { Request, Response, NextFunction } from "express";

/** Authenticated session data attached to res.locals. */
export interface SessionUser {
  githubIdentityTargetId?: string;
  githubIdentityDirect?: boolean;
  github?: import("../github/user-connection.js").GithubConnectionStatus;
  sessionIssuedAt?: number;
  mfaAuthenticated?: boolean;
  direct?: boolean;
  local?: boolean;
  authorizationRevision?: string;
  hostingPolicy?: { capabilities?: { php: boolean }; expiresAt?: string | null; revision: number; state: "ready" | "pending"; runtime: boolean; security?: import("../../modules/hosting/models/hosting-template.model.js").HostingSecurity };
  userId: number;
  username: string;
  displayName: string;
  role: string;
  modules: string[];
  kind: "admin" | "user" | "hosting" | "mfa_pending" | "external-guest";
  /** External-panel guest session (WHM/cPanel enmascarado por subdominio).
   *  NO hay executor SSH; los FABs sólo si `external.hasSsh` + permisos. */
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
      defaultPath?: string | null;
      grants?: import("../auth/group-policy.types.js").FileAccessGrant[];
    };
    commandPolicy: {
      allowAll: boolean;
      groups: string[];
      allowCommands: string[];
      denyCommands: string[];
      grants?: import("../auth/group-policy.types.js").CommandGrant[];
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
  /** Hosting-only (Fase 6): cupos de recursos del tenant, llevados en el JWT
   *  igual que maxSubUsers (el owner dropped no puede leer el sidecar root).
   *  Ausentes en tokens pre-Fase-6 → getTenantEnvelope cae a Infinity. */
  maxDomains?: number;
  maxEmailAccounts?: number;
  maxDatabases?: number;
  diskQuotaMb?: number;
  /** Bandwidth cap (dormant — enforcement diferido a Fase 7). */
  bandwidthQuotaMb?: number;
  /** Hosting-only (Fase 5): la cuenta tiene el chroot/jail previsto. El Terminal
   *  lo usa para decidir (fail-closed) si una sesión hosting debe abrir SOLO una
   *  shell enjaulada. Ausente en tokens pre-Fase-5 → el Terminal cae a
   *  `env.JAIL_SHELL_ENABLED` (señal de "jaula esperada" del servidor). */
  jailEnabled?: boolean;
  /** Local bridged-session identifier when managed by LP-LS. */
  bridgeSessionId?: string;
  /** Remote LP-LS agent session identifier (sid). */
  remoteSessionId?: string;
  /** Bridged session metadata when the panel is opened from LP-LS. */
  targetId?: string;
  targetName?: string;
  /** Host público CONFIABLE del panel de esta sesión. Origen: claim `thost`
   *  del SSO de LP (JWT firmado) o, en sesiones direct-SSH, el host de la
   *  request validado contra el subdominio con el que se autenticaron las
   *  credenciales (resolveSessionPanelHost). NUNCA un header sin validar:
   *  es la identidad del panel ante LP (service routes host→panel→customer). */
  targetHost?: string;
}

/** Express request with typed locals. */
export interface AuthenticatedLocals {
  user: SessionUser;
  authBaseUser?: SessionUser;
  logsUser?: SessionUser;
  requestId: string;
  locale: string;
  bridgedSession?: Record<string, unknown>;
  deploymentProvider?: import("../../modules/hosting/models/provider.model.js").HostingProvider;
}

/** Handler type for route handlers that may throw. */
export type AsyncHandler = (
  req: Request,
  res: Response<unknown, AuthenticatedLocals>,
  next: NextFunction,
) => Promise<void>;

/** Wraps an async handler so thrown errors are forwarded to Express error middleware. */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res as Response<unknown, AuthenticatedLocals>, next)).catch(next);
  };
}

/** Module registration function signature. */
export type ModuleRegistrar = (app: import("express").Express) => void;
