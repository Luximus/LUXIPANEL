import { describe, it, expect, vi } from "vitest";
import { createRequestCache } from "./request-cache";
import { resetAllStores } from "./store-reset";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("createRequestCache — single-flight", () => {
  it("colapsa N llamadas concurrentes a la misma clave en UNA petición", async () => {
    const cache = createRequestCache({ resetOnLogout: false });
    const d = deferred<string>();
    const fetcher = vi.fn(() => d.promise);

    const a = cache.fetch("k", fetcher);
    const b = cache.fetch("k", fetcher);
    const c = cache.fetch("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    d.resolve("v");
    expect(await Promise.all([a, b, c])).toEqual(["v", "v", "v"]);
  });

  it("claves distintas NO se colapsan entre sí", async () => {
    const cache = createRequestCache({ resetOnLogout: false });
    const fetcher = vi.fn(async (v: string) => v);
    await Promise.all([cache.fetch("a", () => fetcher("a")), cache.fetch("b", () => fetcher("b"))]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("un rechazo se propaga a todos los que esperan y NO se cachea", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 10_000 });
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");

    const a = cache.fetch("k", fetcher as () => Promise<string>);
    const b = cache.fetch("k", fetcher as () => Promise<string>);
    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
    expect(fetcher).toHaveBeenCalledTimes(1);

    // El fallo no dejó entrada: la siguiente llamada REINTENTA.
    expect(await cache.fetch("k", fetcher as () => Promise<string>)).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("la petición en vuelo se libera al terminar (la siguiente vuelve a pedir si no hay TTL)", async () => {
    const cache = createRequestCache({ resetOnLogout: false });
    const fetcher = vi.fn(async () => "v");
    await cache.fetch("k", fetcher);
    await cache.fetch("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); // ttl 0 = solo dedupe
  });
});

describe("createRequestCache — TTL", () => {
  it("sirve de memoria dentro del TTL y vuelve a pedir al vencer", async () => {
    let clock = 1000;
    const cache = createRequestCache({ resetOnLogout: false, now: () => clock, defaultTtlMs: 100 });
    let n = 0;
    const fetcher = vi.fn(async () => ({ n: n++ }));

    expect(await cache.fetch("k", fetcher)).toEqual({ n: 0 });
    clock += 99;
    expect(await cache.fetch("k", fetcher)).toEqual({ n: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    clock += 1; // TTL vencido
    expect(await cache.fetch("k", fetcher)).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("el TTL por llamada gana al TTL por defecto", async () => {
    let clock = 0;
    const cache = createRequestCache({ resetOnLogout: false, now: () => clock, defaultTtlMs: 100_000 });
    const fetcher = vi.fn(async () => "v");
    await cache.fetch("k", fetcher, { ttlMs: 10 });
    clock += 20;
    await cache.fetch("k", fetcher, { ttlMs: 10 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("`force` ignora el valor cacheado pero SÍ se une a la petición en vuelo", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 100_000 });
    const fetcher = vi.fn(async () => "v1");
    await cache.fetch("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Refresco explícito: salta la caché.
    await cache.fetch("k", fetcher, { force: true });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Doble pull-to-refresh simultáneo: una sola petición.
    const d = deferred<string>();
    const slow = vi.fn(() => d.promise);
    const p1 = cache.fetch("k", slow, { force: true });
    const p2 = cache.fetch("k", slow, { force: true });
    expect(slow).toHaveBeenCalledTimes(1);
    d.resolve("v2");
    expect(await Promise.all([p1, p2])).toEqual(["v2", "v2"]);
  });

  it("peek devuelve el valor fresco y undefined al vencer", async () => {
    let clock = 0;
    const cache = createRequestCache({ resetOnLogout: false, now: () => clock, defaultTtlMs: 50 });
    expect(cache.peek("k")).toBeUndefined();
    await cache.fetch("k", async () => "v");
    expect(cache.peek<string>("k")).toBe("v");
    clock += 50;
    expect(cache.peek<string>("k")).toBeUndefined();
  });

  it("set siembra el caché sin red", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 1000 });
    cache.set("k", 42);
    const fetcher = vi.fn(async () => 0);
    expect(await cache.fetch("k", fetcher)).toBe(42);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("createRequestCache — invalidación", () => {
  it("invalidate tira el valor y la siguiente lectura vuelve a pedir", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 100_000 });
    const fetcher = vi.fn(async () => "v");
    await cache.fetch("k", fetcher);
    cache.invalidate("k");
    await cache.fetch("k", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("una invalidación DURANTE el vuelo descarta ese resultado (no se cachea viejo)", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 100_000 });
    const d = deferred<string>();
    const p = cache.fetch("k", () => d.promise);
    cache.invalidate("k"); // p. ej. una mutación mientras el GET volaba
    d.resolve("stale");
    expect(await p).toBe("stale"); // el que pidió recibe su respuesta…
    expect(cache.peek<string>("k", 100_000)).toBeUndefined(); // …pero NO queda cacheada
  });

  it("invalidatePrefix tira el espacio de claves de un panel", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 100_000 });
    await cache.fetch("p1|/api/users", async () => 1);
    await cache.fetch("p1|/api/roles", async () => 2);
    await cache.fetch("p2|/api/users", async () => 3);
    expect(cache.size()).toBe(3);
    cache.invalidatePrefix("p1|");
    expect(cache.size()).toBe(1);
    expect(cache.peek("p2|/api/users", 100_000)).toBe(3);
  });

  it("invalidateWhere acepta un predicado", async () => {
    const cache = createRequestCache({ resetOnLogout: false, defaultTtlMs: 100_000 });
    await cache.fetch("a:1", async () => 1);
    await cache.fetch("b:1", async () => 2);
    cache.invalidateWhere((k) => k.startsWith("a"));
    expect(cache.peek("a:1", 100_000)).toBeUndefined();
    expect(cache.peek("b:1", 100_000)).toBe(2);
  });
});

describe("createRequestCache — higiene de sesión", () => {
  it("resetAllStores vacía el caché registrado (logout / cambio de cuenta)", async () => {
    const cache = createRequestCache({ defaultTtlMs: 100_000 });
    await cache.fetch("me", async () => ({ id: "u1" }));
    expect(cache.size()).toBe(1);
    resetAllStores();
    expect(cache.size()).toBe(0);
  });
});
