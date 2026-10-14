import {afterEach, expect, it, vi} from "vitest";
const mock = vi.hoisted(() => ({clients: [] as any[]}));
vi.mock("../../config/env.js", () => ({env: {REMOTE_CACHE_EXEC_TIMEOUT_MS: 1000}}));
vi.mock("ioredis", () => ({Redis: class {
  status = "wait";
  on = vi.fn();
  disconnect = vi.fn();
  connect = vi.fn(async () => { this.status = "connecting"; await Promise.resolve(); this.status = "ready"; });
  mget = vi.fn(async () => ["value"]);
  constructor() { mock.clients.push(this); }
}}));
import {closeLocalCacheClient, localCacheMget} from "./local-client.js";
const conn = {host: "127.0.0.1", port: 7379, password: "test"};
afterEach(() => { closeLocalCacheClient(); mock.clients.length = 0; });
it("shares the first connection across concurrent cache reads", async () => {
  expect(await Promise.all([localCacheMget(conn, ["a"]), localCacheMget(conn, ["b"])]))
    .toEqual([["value"], ["value"]]);
  expect(mock.clients).toHaveLength(1);
  expect(mock.clients[0].connect).toHaveBeenCalledTimes(1);
  expect(mock.clients[0].mget).toHaveBeenCalledTimes(2);
});
it("closes a failed connection and permits a fresh read after recovery", async () => {
  await localCacheMget(conn, ["a"]);
  const failed = mock.clients[0];
  failed.mget.mockRejectedValueOnce(new Error("unavailable"));
  await expect(localCacheMget(conn, ["b"])).rejects.toThrow("unavailable");
  expect(failed.disconnect).toHaveBeenCalledTimes(1);
  await expect(localCacheMget(conn, ["c"])).resolves.toEqual(["value"]);
  expect(mock.clients).toHaveLength(2);
});
