// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Gate del mint cross: una sesión LOCAL sin bridge debe poder acuñar (el
 * endpoint cross resuelve a localExecutor y `servers.*` usa su propio
 * DirectSshExecutor); una sesión con target REMOTO sin bridge no (sin bridge
 * no hay executor válido hacia ese target). Incidente 2026-07-20: el gate
 * incondicional dejaba a los workers de equipo sin `servers.*`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionUser } from "../../../shared/types/index.js";

const signed = vi.hoisted(() => ({ payloads: [] as Record<string, unknown>[] }));
vi.mock("../../auth/services/token.service.js", () => ({
  tokenService: {
    signWithExpiry: vi.fn((payload: Record<string, unknown>) => {
      signed.payloads.push(payload);
      return { token: "tok-firmado" };
    }),
  },
}));

import { mintCrossMcpToken, mintGraphMcpToken, mintModuleMcpToken } from "./mcp-run-tokens.js";

function session(over: Partial<SessionUser> = {}): SessionUser {
  return {
    userId: 1,
    username: "operator",
    displayName: "J",
    role: "admin",
    modules: ["admin"],
    kind: "admin",
    ...over,
  } as SessionUser;
}

beforeEach(() => {
  signed.payloads.length = 0;
});

describe("mintCrossMcpToken", () => {
  it("sin sesión devuelve undefined", () => {
    expect(mintCrossMcpToken(undefined, "c1")).toBeUndefined();
  });

  it("con bridgeSessionId acuña y lo incluye en el payload", () => {
    const tok = mintCrossMcpToken(session({ bridgeSessionId: "b1", targetId: "srv-remoto" }), "c1");
    expect(tok).toBe("tok-firmado");
    expect(signed.payloads[0]).toMatchObject({ mcpScope: "cross", bridgeSessionId: "b1", conversationId: "c1" });
  });

  it("sesión LOCAL sin bridge acuña (payload sin bridgeSessionId)", () => {
    const tok = mintCrossMcpToken(session({ targetId: "local" }), "c1");
    expect(tok).toBe("tok-firmado");
    expect(signed.payloads[0]).not.toHaveProperty("bridgeSessionId");
    expect(signed.payloads[0]).toMatchObject({ mcpScope: "cross", targetId: "local" });
  });

  it("sesión sin bridge NI targetId acuña (instalación no-managed)", () => {
    expect(mintCrossMcpToken(session(), "c1")).toBe("tok-firmado");
  });

  it("target REMOTO sin bridge NO acuña", () => {
    expect(mintCrossMcpToken(session({ targetId: "srv-remoto" }), "c1")).toBeUndefined();
    expect(signed.payloads).toHaveLength(0);
  });
});

describe("mintGraphMcpToken", () => {
  it("exige sesión y conversationId, no bridge", () => {
    expect(mintGraphMcpToken(undefined, "c1")).toBeUndefined();
    expect(mintGraphMcpToken(session(), undefined)).toBeUndefined();
    expect(mintGraphMcpToken(session(), "c1")).toBe("tok-firmado");
  });
});

describe("mintModuleMcpToken", () => {
  it("requires an authenticated conversation on a resolvable target", () => {
    expect(mintModuleMcpToken(undefined, "c1")).toBeUndefined();
    expect(mintModuleMcpToken(session(), undefined)).toBeUndefined();
    expect(mintModuleMcpToken(session({ targetId: "remote" }), "c1")).toBeUndefined();
    expect(mintModuleMcpToken(session({ targetId: "local" }), "c1")).toBe("tok-firmado");
    expect(signed.payloads[0]).toMatchObject({ mcpScope: "modules", conversationId: "c1", targetId: "local" });
  });
  it("preserves original hosting session age, verified MFA and tenant binding", () => {
    mintModuleMcpToken(session({ sessionIssuedAt: 100, mfaAuthenticated: true, tenantId: 9, owner: "tenant-owner" }), "c1");
    expect(signed.payloads[0]).toMatchObject({ authTime: 100, mfaAuthenticated: true, tenantId: 9, owner: "tenant-owner" });
  });
});
