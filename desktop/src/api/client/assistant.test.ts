import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestRawMock } = vi.hoisted(() => ({ requestRawMock: vi.fn() }));

vi.mock("./request", () => ({ requestRaw: requestRawMock }));

import { getServerAssistantProviderDetails, luxAssistantProxy } from "./assistant";

describe("desktop assistant tunnel client", () => {
  beforeEach(() => requestRawMock.mockReset());

  it("accepts box payloads propagated at the response root", async () => {
    requestRawMock.mockResolvedValue({ ok: true, status: 200, data: { ok: true, agents: [{ id: "a1" }] } });

    await expect(luxAssistantProxy("panel-1", "token", "GET", "agents")).resolves.toEqual({
      ok: true,
      agents: [{ id: "a1" }],
    });
  });

  it("continues to unwrap legacy data envelopes", async () => {
    requestRawMock.mockResolvedValue({ ok: true, status: 200, data: { ok: true, data: { roles: [] } } });

    await expect(luxAssistantProxy("panel-1", "token", "GET", "agent-roles")).resolves.toEqual({ roles: [] });
  });

  it("reads only redacted provider fields from the dedicated endpoint", async () => {
    requestRawMock.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        ok: true,
        providers: [{ id: "claude", mode: "api", hasApiKey: true, apiKeyHint: "••••1234" }],
        defaultProvider: "claude",
        defaultModel: "claude-sonnet-4-6",
      },
    });

    const details = await getServerAssistantProviderDetails("panel-1", "token");
    expect(details?.providers[0]).toEqual(expect.objectContaining({ id: "claude", apiKeyHint: "••••1234" }));
    expect(details?.providers[0]).not.toHaveProperty("apiKey");
  });
});
