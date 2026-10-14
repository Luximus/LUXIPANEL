import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const env = vi.hoisted(() => ({
  LP_PANEL_CREDENTIAL: "",
  LICENSE_SERVER_URL: "https://lp.example.test",
}));
vi.mock("../config/env.js", () => ({ env }));
const config = vi.hoisted(() => ({ dir: `/tmp/lp-api-key-test-${process.pid}` }));
vi.mock("../config/paths.js", () => ({ CONFIG_DIR: config.dir }));

import { lpApiKey, saveLpApiKey, validateLpApiKey } from "./lp-api-key.js";

const key = `lxp_live_${"a".repeat(64)}`;

describe("per-installation LP API key", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    env.LP_PANEL_CREDENTIAL = "";
    await fs.rm(config.dir, { recursive: true, force: true });
  });
  afterAll(async () => { await fs.rm(config.dir, { recursive: true, force: true }); });

  it("rejects a missing or malformed key without contacting LP", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await validateLpApiKey()).toBe("missing");
    env.LP_PANEL_CREDENTIAL = "wrong-key";
    expect(await validateLpApiKey()).toBe("invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts only an active panel bound to the key", async () => {
    env.LP_PANEL_CREDENTIAL = key;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, serverKeys: [{ isActive: true }] }), { status: 200 }));
    expect(await validateLpApiKey()).toBe("valid");
    expect(fetchMock).toHaveBeenCalledWith("https://lp.example.test/panel-api/server-key", expect.objectContaining({
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    }));
  });

  it("fails closed after revocation or when LP becomes unreachable", async () => {
    env.LP_PANEL_CREDENTIAL = key;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, serverKeys: [{ isActive: true }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockRejectedValueOnce(new Error("network down"));
    expect(await validateLpApiKey()).toBe("valid");
    expect(await validateLpApiKey()).toBe("invalid");
    expect(await validateLpApiKey()).toBe("unavailable");
  });

  it("persists the web-configured key with mode 0600 and uses it after env fallback", async () => {
    env.LP_PANEL_CREDENTIAL = `lxp_live_${"b".repeat(64)}`;
    await saveLpApiKey(key);
    expect(lpApiKey()).toBe(key);
    expect((await fs.stat(path.join(config.dir, "installation-api-key"))).mode & 0o777).toBe(0o600);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, serverKeys: [{ isActive: true }] }), { status: 200 }));
    expect(await validateLpApiKey()).toBe("valid");
  });
});
