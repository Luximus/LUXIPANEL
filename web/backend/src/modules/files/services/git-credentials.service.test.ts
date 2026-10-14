// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";

// Provide a valid AES key BEFORE env.ts is first evaluated in this file's graph.
process.env.GIT_ENCRYPTION_KEY = "ab".repeat(32);

const records = new Map<string, Record<string, unknown>>();
vi.mock("../../../shared/data-store/index.js", () => ({
  dataStore: () => ({
    list: async () => [...records.values()],
    get: async (id: string) => records.get(String(id)) ?? null,
    create: async (d: Record<string, unknown>) => {
      const id = d.id && d.id !== "" ? String(d.id) : `id-${records.size + 1}`;
      const rec = { ...d, id };
      records.set(id, rec);
      return rec;
    },
    delete: async (id: string) => records.delete(String(id)),
  }),
}));

const { gitCredentialsService, hostFromRemote, gitCredentialsEnabled } = await import("./git-credentials.service.js");
const { ValidationError, NotFoundError } = await import("../../../shared/errors/index.js");

const exec = { target: { id: "r", name: "R" } } as never;

describe("hostFromRemote", () => {
  it("parses https and scp-like and ssh URLs", () => {
    expect(hostFromRemote("https://github.com/owner/repo.git")).toBe("github.com");
    expect(hostFromRemote("git@github.com:owner/repo.git")).toBe("github.com");
    expect(hostFromRemote("ssh://git@gitlab.example.com:22/owner/repo.git")).toBe("gitlab.example.com");
    expect(hostFromRemote("not a url")).toBeNull();
  });
});

describe("gitCredentialsService", () => {
  beforeEach(() => records.clear());

  it("is enabled with a valid key", () => {
    expect(gitCredentialsEnabled()).toBe(true);
  });

  it("encrypts the secret at rest and never exposes it via list", async () => {
    const safe = await gitCredentialsService.create(exec, { label: "GH", type: "https", host: "GitHub.com", username: "x", secret: "ghp_TOPSECRET" });
    expect(safe).not.toHaveProperty("secret");
    expect(safe).not.toHaveProperty("secretEnc");
    expect(safe.host).toBe("github.com"); // normalized

    const stored = [...records.values()][0] as Record<string, string>;
    expect(stored.secretEnc).toBeTruthy();
    expect(stored.secretEnc).not.toContain("ghp_TOPSECRET"); // ciphertext

    const list = await gitCredentialsService.list(exec);
    expect(JSON.stringify(list)).not.toContain("ghp_TOPSECRET");

    const dec = await gitCredentialsService.getDecrypted(exec, safe.id);
    expect(dec?.secret).toBe("ghp_TOPSECRET"); // round-trips on the panel host
  });

  it("resolves a credential by remote host + scheme", async () => {
    await gitCredentialsService.create(exec, { label: "GH https", type: "https", host: "github.com", secret: "tok" });
    await gitCredentialsService.create(exec, { label: "GH ssh", type: "ssh", host: "github.com", secret: "KEY" });
    const https = await gitCredentialsService.resolveForRemote(exec, "https://github.com/o/r.git");
    expect(https?.cred.type).toBe("https");
    const ssh = await gitCredentialsService.resolveForRemote(exec, "git@github.com:o/r.git");
    expect(ssh?.cred.type).toBe("ssh");
    const none = await gitCredentialsService.resolveForRemote(exec, "https://gitlab.com/o/r.git");
    expect(none).toBeNull();
  });
});

describe("typed errors (C2) — server-side git auth mutations", () => {
  it("saveServerHttps → ValidationError on missing host/user/token", async () => {
    await expect(
      gitCredentialsService.saveServerHttps(exec, { host: "", username: "u", secret: "t" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      gitCredentialsService.saveServerHttps(exec, { host: "github.com", username: "u", secret: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("saveServerHttps → NotFoundError when $HOME cannot be resolved", async () => {
    const executor = {
      target: { id: "r", name: "R" },
      exec: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0, durationMs: 1 })),
    } as never;
    await expect(
      gitCredentialsService.saveServerHttps(executor, { host: "github.com", username: "u", secret: "t" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("deleteServerSshKey → ValidationError on a traversal/invalid name", async () => {
    await expect(gitCredentialsService.deleteServerSshKey(exec, { name: "../evil" })).rejects.toBeInstanceOf(ValidationError);
    await expect(gitCredentialsService.deleteServerSshKey(exec, { name: "a b" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("deleteServerSshKey → NotFoundError when the key does not exist", async () => {
    const executor = {
      target: { id: "r", name: "R" },
      exec: vi.fn(async (cmd: string) => {
        if (cmd.includes("$HOME")) return { stdout: "/home/u", stderr: "", exitCode: 0, durationMs: 1 };
        return { stdout: "NO", stderr: "", exitCode: 0, durationMs: 1 };
      }),
    } as never;
    await expect(gitCredentialsService.deleteServerSshKey(executor, { name: "id_ed25519" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("ghLogout → ValidationError on an invalid host", async () => {
    await expect(gitCredentialsService.ghLogout(exec, { host: "bad host!" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("setGitConfig → ValidationError when the remote apply fails", async () => {
    const executor = {
      target: { id: "r", name: "R" },
      exec: vi.fn(async () => ({ stdout: "nope", stderr: "", exitCode: 1, durationMs: 1 })),
    } as never;
    await expect(gitCredentialsService.setGitConfig(executor, { userName: "X" })).rejects.toBeInstanceOf(ValidationError);
  });
});
