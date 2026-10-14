import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../shared/errors/index.js";
import { cloudflareApiService } from "./cloudflare-api.service.js";

function cfResponse(body: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response;
}

function envelope(result: unknown, extra: Record<string, unknown> = {}) {
  return { success: true, errors: [], result, ...extra };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cloudflareApiService — success path", () => {
  it("verifyToken sends the Bearer header and reports an active token", async () => {
    const fetchMock = vi.fn(async () => cfResponse(envelope({ id: "t1", status: "active" })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await cloudflareApiService.verifyToken("test-token-1234567890");

    expect(result.valid).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/user/tokens/verify");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token-1234567890",
    );
  });

  it("createDnsRecord posts the body and maps the result", async () => {
    const raw = {
      id: "a".repeat(32),
      type: "A",
      name: "www.example.com",
      content: "1.2.3.4",
      ttl: 1,
      proxied: true,
    };
    const fetchMock = vi.fn(async () => cfResponse(envelope(raw)));
    vi.stubGlobal("fetch", fetchMock);

    const record = await cloudflareApiService.createDnsRecord("tok", "z".repeat(32), {
      type: "A",
      name: "www.example.com",
      content: "1.2.3.4",
      proxied: true,
    });

    expect(record).toEqual({
      id: "a".repeat(32),
      type: "A",
      name: "www.example.com",
      content: "1.2.3.4",
      ttl: 1,
      proxied: true,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      type: "A",
      name: "www.example.com",
      content: "1.2.3.4",
      proxied: true,
    });
  });
});

describe("cloudflareApiService — Cloudflare error envelope", () => {
  it("throws AppError 502 CLOUDFLARE_API_ERROR with the first CF error message", async () => {
    const fetchMock = vi.fn(async () =>
      cfResponse(
        {
          success: false,
          errors: [{ code: 7003, message: "Could not route to /zones/bad" }],
          result: null,
        },
        404,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const err = await cloudflareApiService
      .listDnsRecords("tok", "b".repeat(32))
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(502);
    expect((err as AppError).code).toBe("CLOUDFLARE_API_ERROR");
    expect((err as AppError).message).toBe("Could not route to /zones/bad");
  });

  it("verifyToken converts the CF error into { valid:false } instead of throwing", async () => {
    const fetchMock = vi.fn(async () =>
      cfResponse(
        { success: false, errors: [{ code: 1000, message: "Invalid API Token" }], result: null },
        401,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await cloudflareApiService.verifyToken("bad-token");

    expect(result.valid).toBe(false);
    expect(result.status).toBe(401);
    expect(result.message).toBe("Invalid API Token");
  });
});

describe("cloudflareApiService — zone pagination", () => {
  it("walks every page (per_page=50) and concatenates the zones", async () => {
    const zone = (id: string, name: string) => ({
      id,
      name,
      status: "active",
      paused: false,
      plan: { name: "Free" },
      name_servers: ["a.ns.cloudflare.com"],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        cfResponse(
          envelope([zone("1".repeat(32), "one.com")], {
            result_info: { page: 1, total_pages: 2 },
          }),
        ),
      )
      .mockResolvedValueOnce(
        cfResponse(
          envelope([zone("2".repeat(32), "two.com")], {
            result_info: { page: 2, total_pages: 2 },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const zones = await cloudflareApiService.listZones("tok");

    expect(zones.map((z) => z.name)).toEqual(["one.com", "two.com"]);
    expect(zones[0]).toEqual({
      id: "1".repeat(32),
      name: "one.com",
      status: "active",
      paused: false,
      planName: "Free",
      nameServers: ["a.ns.cloudflare.com"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls[0]).toContain("/zones?page=1&per_page=50");
    expect(urls[1]).toContain("/zones?page=2&per_page=50");
  });

  it("stops after a single page when total_pages is 1", async () => {
    const fetchMock = vi.fn(async () =>
      cfResponse(envelope([], { result_info: { page: 1, total_pages: 1 } })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const zones = await cloudflareApiService.listZones("tok");

    expect(zones).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("hard-caps pagination at 10 pages even when total_pages is larger", async () => {
    const fetchMock = vi.fn(async () =>
      cfResponse(envelope([], { result_info: { page: 1, total_pages: 999 } })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cloudflareApiService.listZones("tok");

    expect(fetchMock).toHaveBeenCalledTimes(10);
  });
});

describe("cloudflareApiService — DNS list pagination (per_page=300)", () => {
  it("requests the DNS endpoint with per_page=300 and maps records", async () => {
    const rec = {
      id: "d".repeat(32),
      type: "CNAME",
      name: "www.example.com",
      content: "example.com",
      ttl: 3600,
      proxied: false,
    };
    const fetchMock = vi.fn(async () =>
      cfResponse(envelope([rec], { result_info: { page: 1, total_pages: 1 } })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const records = await cloudflareApiService.listDnsRecords("tok", "z".repeat(32));

    expect(records).toEqual([
      { id: "d".repeat(32), type: "CNAME", name: "www.example.com", content: "example.com", ttl: 3600, proxied: false },
    ]);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain(`/zones/${"z".repeat(32)}/dns_records?page=1&per_page=300`);
  });
});

describe("cloudflareApiService — zone settings", () => {
  it("getZoneSettings fetches the four settings in parallel and unwraps values", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const setting = String(url).split("/settings/")[1];
      const valueBySetting: Record<string, string> = {
        ssl: "full",
        always_use_https: "on",
        security_level: "medium",
        development_mode: "off",
      };
      return cfResponse(envelope({ id: setting, value: valueBySetting[setting ?? ""] ?? "" }));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const settings = await cloudflareApiService.getZoneSettings("tok", "z".repeat(32));

    expect(settings).toEqual({
      ssl: "full",
      alwaysUseHttps: "on",
      securityLevel: "medium",
      developmentMode: "off",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("setZoneSetting PATCHes the value to the setting endpoint", async () => {
    const fetchMock = vi.fn(async () => cfResponse(envelope({ id: "ssl", value: "strict" })));
    vi.stubGlobal("fetch", fetchMock);

    await cloudflareApiService.setZoneSetting("tok", "z".repeat(32), "ssl", "strict");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`/zones/${"z".repeat(32)}/settings/ssl`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ value: "strict" });
  });
});

describe("cloudflareApiService — purge + access rules", () => {
  it("purgeCache sends purge_everything for everything:true", async () => {
    const fetchMock = vi.fn(async () => cfResponse(envelope({ id: "z" })));
    vi.stubGlobal("fetch", fetchMock);

    await cloudflareApiService.purgeCache("tok", "z".repeat(32), { everything: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/purge_cache");
    expect(JSON.parse(String(init.body))).toEqual({ purge_everything: true });
  });

  it("purgeCache sends the files array when not everything", async () => {
    const fetchMock = vi.fn(async () => cfResponse(envelope({ id: "z" })));
    vi.stubGlobal("fetch", fetchMock);

    await cloudflareApiService.purgeCache("tok", "z".repeat(32), { files: ["https://x/a.js"] });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ files: ["https://x/a.js"] });
  });

  it("createAccessRule picks target 'ip' for a plain IP", async () => {
    const fetchMock = vi.fn(async () =>
      cfResponse(envelope({ id: "r", mode: "block", configuration: { target: "ip", value: "1.2.3.4" } })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cloudflareApiService.createAccessRule("tok", "z".repeat(32), { mode: "block", ip: "1.2.3.4" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).configuration).toEqual({ target: "ip", value: "1.2.3.4" });
  });

  it("createAccessRule picks target 'ip_range' for a CIDR", async () => {
    const fetchMock = vi.fn(async () =>
      cfResponse(envelope({ id: "r", mode: "block", configuration: { target: "ip_range", value: "1.2.3.0/24" } })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cloudflareApiService.createAccessRule("tok", "z".repeat(32), { mode: "block", ip: "1.2.3.0/24" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).configuration).toEqual({ target: "ip_range", value: "1.2.3.0/24" });
  });
});

describe("cloudflareApiService — transport failures", () => {
  it("wraps a non-JSON body as AppError 502 CLOUDFLARE_API_ERROR", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const err = await cloudflareApiService
      .listZones("tok")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(502);
    expect((err as AppError).code).toBe("CLOUDFLARE_API_ERROR");
  });

  it("wraps a fetch/network rejection as AppError 502 CLOUDFLARE_API_ERROR", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    vi.stubGlobal("fetch", fetchMock);

    const err = await cloudflareApiService
      .listZones("tok")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(502);
    expect((err as AppError).message).toContain("ECONNREFUSED");
  });
});
