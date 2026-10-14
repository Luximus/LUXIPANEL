import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";

const state = vi.hoisted(() => ({
  files: new Map<string, Record<string, any>>(),
}));
vi.mock("../../../shared/kv-store/index.js", () => ({
  kv: (executor?: { target?: { id: string } }) => ({
    module: (module: string) => ({
      collection: (collection: string) => {
        const key = (executor?.target?.id ?? "local") + "/" + module + "/" + collection;
        const read = () => structuredClone(state.files.get(key) ?? {});
        return {
          transaction: async (fn: (map: Record<string, any>) => Promise<any>) => {
            const {next, result} = await fn(read());
            state.files.set(key, JSON.parse(JSON.stringify(next)));
            return structuredClone(result);
          },
          get: async (id: string) => read()[id] ?? null,
          list: async () => Object.values(read()),
          query: async (pred: (doc: any) => boolean) => Object.values(read()).filter(pred),
          find: async (pred: (doc: any) => boolean) => Object.values(read()).find(pred) ?? null,
        };
      },
    }),
  }),
}));
vi.mock("../../../shared/remote-cache/read-through.js", () => ({
  listCached: async (_executor: unknown, _module: string, _collection: string, loader: () => unknown) => loader(),
}));
vi.mock("../../../shared/remote-cache/refresh.js", () => ({
  scheduleRefresh: vi.fn(), refreshSync: vi.fn(),
}));
vi.mock("../../../shared/cache/cacheable-modules.js", () => ({ cachePolicyFor: () => undefined }));

// Keep the real repository, makeKvStore and dataStore: mocking create would
// hide the empty-string timestamp bug that occurred in production.
import { passkeyRepository } from "./passkey.repository.js";
const registeredAt = "2026-10-14T04:00:00.000Z";
const credential = { id: "test-only", userId: 7, label: "Test", credentialId: "fake-credential", publicKeyB64url: "fake-public-key" };
beforeEach(() => { state.files.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(registeredAt)); });
afterEach(() => vi.useRealTimers());

describe("passkey registration timestamp persistence", () => {
  it("persists a real creation timestamp and returns it through the list", async () => {
    const created = await passkeyRepository.create(credential);
    const stored = state.files.get("local/auth/passkeys")![credential.id];
    expect(stored.createdAt).toBe(registeredAt);
    expect(created.createdAt.toISOString()).toBe(registeredAt);
    const listed = await passkeyRepository.findActiveByUser(7);
    expect(JSON.parse(JSON.stringify(listed))[0].createdAt).toBe(registeredAt);
    expect(await passkeyRepository.findActiveByUser(8)).toEqual([]);
  });
  it("preserves registration time when the passkey is used and revoked", async () => {
    await passkeyRepository.create(credential);
    vi.setSystemTime(new Date("2026-10-15T04:00:00.000Z"));
    await passkeyRepository.updateCounter(credential.credentialId, 2);
    const used = await passkeyRepository.findById(credential.id);
    expect(used!.createdAt.toISOString()).toBe(registeredAt);
    expect(used!.lastUsedAt?.toISOString()).toBe("2026-10-15T04:00:00.000Z");
    await passkeyRepository.revoke(credential.id);
    expect((await passkeyRepository.findById(credential.id))!.createdAt.toISOString()).toBe(registeredAt);
    expect(await passkeyRepository.findActiveByUser(7)).toEqual([]);
  });
  it("keeps dates and credentials isolated by target", async () => {
    const a = {target: {id: "a"}} as Executor, b = {target: {id: "b"}} as Executor;
    await passkeyRepository.create(credential, a);
    vi.setSystemTime(new Date("2026-10-16T04:00:00.000Z"));
    await passkeyRepository.create(credential, b);
    expect((await passkeyRepository.findActiveByUser(7, a))[0]!.createdAt.toISOString()).toBe(registeredAt);
    expect((await passkeyRepository.findActiveByUser(7, b))[0]!.createdAt.toISOString()).toBe("2026-10-16T04:00:00.000Z");
    expect(await passkeyRepository.findActiveByUser(7)).toEqual([]);
  });
});


describe("owned passkey names", () => {
  it("renames only the label and modification time, preserving the credential and registration date", async () => {
    await passkeyRepository.create(credential);
    const before = structuredClone(state.files.get("local/auth/passkeys")![credential.id]);
    vi.setSystemTime(new Date("2026-10-15T04:00:00.000Z"));
    const result = await passkeyRepository.rename(7, credential.id, "Personal laptop");
    expect(result?.label).toBe("Personal laptop");
    const after = state.files.get("local/auth/passkeys")![credential.id];
    expect(after).toEqual({...before, label: "Personal laptop", updatedAt: "2026-10-15T04:00:00.000Z"});
    expect((await passkeyRepository.findActiveByUser(7))[0]!.label).toBe("Personal laptop");
  });
  it("rejects another account, a missing credential and a revoked credential", async () => {
    await passkeyRepository.create(credential);
    const before = structuredClone(state.files.get("local/auth/passkeys"));
    expect(await passkeyRepository.rename(8, credential.id, "Wrong owner")).toBeNull();
    expect(await passkeyRepository.rename(7, "missing", "Missing")).toBeNull();
    expect(state.files.get("local/auth/passkeys")).toEqual(before);
    await passkeyRepository.revoke(credential.id);
    expect(await passkeyRepository.rename(7, credential.id, "Revoked")).toBeNull();
  });
  it("does not rename the same id on another target", async () => {
    const a = {target: {id: "a"}} as Executor, b = {target: {id: "b"}} as Executor;
    await passkeyRepository.create(credential, a);
    await passkeyRepository.create(credential, b);
    await passkeyRepository.rename(7, credential.id, "Server A", a);
    expect((await passkeyRepository.findById(credential.id, a))!.label).toBe("Server A");
    expect((await passkeyRepository.findById(credential.id, b))!.label).toBe("Test");
  });
});

