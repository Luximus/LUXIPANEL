// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";

const state = vi.hoisted(() => ({
  project: { id: "realityos", title: "RealityOS", ownerId: 1, path: "/var/www/realityos", icon: "folder", instructions: "", provider: "codex" } as Record<string, unknown>,
  share: vi.fn(),
}));

vi.mock("../repositories/projects.repository.js", () => ({
  projectsRepository: {
    get: vi.fn(async () => state.project),
    list: vi.fn(async () => [state.project]),
  },
  STRUCTURE_PROVIDER_IDS: ["claude", "codex", "gemini"],
}));
vi.mock("../services/project-workspace.service.js", () => ({
  projectWorkspaceService: { shareWithAdministrators: state.share },
}));
vi.mock("../services/project-suggestions.service.js", () => ({
  projectSuggestionsService: { generateAndStore: vi.fn() },
}));
vi.mock("../services/project-document.service.js", () => ({
  projectDocumentService: { read: vi.fn(), save: vi.fn() },
}));
vi.mock("../services/project-storage.service.js", () => ({
  ensureProjectStorage: vi.fn(), projectStorageRoot: vi.fn(() => ""),
}));
vi.mock("../../auth/repositories/panel-user.repository.js", () => ({
  panelUserRepository: { findAll: vi.fn(async () => []) },
}));
vi.mock("../../../shared/executor/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/executor/index.js")>();
  return { ...actual, getExecutor: vi.fn(() => ({ target: { id: "local" } }) as never), getContextUserId: vi.fn(() => 1) };
});

const { projectsController } = await import("./projects.controller.js");

async function invoke(user: Record<string, unknown>) {
  let body: Record<string, unknown> | undefined;
  let error: { statusCode?: number; message: string } | undefined;
  const res = {
    locals: { locale: "es", user },
    json: (value: Record<string, unknown>) => {
      body = value;
      return res;
    },
  };
  projectsController.shareWithAdministrators(
    { params: { id: "realityos" } } as never,
    res as never,
    ((value: { statusCode?: number; message: string }) => { error = value; }) as never,
  );
  await new Promise((resolve) => setImmediate(resolve));
  return { body, error };
}

const admin = { userId: 1, username: "owner", displayName: "Owner", role: "admin", kind: "admin", modules: ["admin"] };

beforeEach(() => {
  state.project = { id: "realityos", title: "RealityOS", ownerId: 1, path: "/var/www/realityos", icon: "folder", instructions: "", provider: "codex" };
  state.share.mockReset().mockResolvedValue({ ...state.project, ownerId: null });
});

describe("projectsController.shareWithAdministrators", () => {
  it("shares an owned workspace through the bounded workspace service", async () => {
    const { body, error } = await invoke(admin);
    expect(error).toBeUndefined();
    expect(state.share).toHaveBeenCalledWith(expect.anything(), state.project);
    expect(body).toMatchObject({ ok: true, project: { ownerId: null } });
  });

  it("rejects an ordinary user before invoking the sharing service", async () => {
    const { error } = await invoke({ ...admin, userId: 2, role: "user", kind: "user" });
    expect(error?.statusCode).toBe(403);
    expect(state.share).not.toHaveBeenCalled();
  });

  it("does not let another administrator share a privately owned workspace", async () => {
    const { error } = await invoke({ ...admin, userId: 9, username: "other" });
    expect(error?.statusCode).toBe(403);
    expect(state.share).not.toHaveBeenCalled();
  });
});
