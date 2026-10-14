import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api: { get }, resolvePanelApiPath: (path: string) => path, resolveTargetScope: () => "local", scopeHeaders: () => ({}) }));
import { loadServerEntryContext } from "./server-entry-context";

beforeEach(() => get.mockReset());

describe("selected server entries for assistant context", () => {
  it("includes a folder listing and readable file contents", async () => {
    get.mockImplementation(async (url: string, options: { params: { path: string } }) => {
      if (url === "/api/files/list") return { ok: true, data: [{ name: "app.ts", path: "/srv/app/app.ts", isDir: false }] };
      return { ok: true, data: { content: `contenido de ${options?.params?.path ?? "/srv/app/app.ts"}` } };
    });
    const result = await loadServerEntryContext([
      { path: "/srv/app", isDir: true },
      { path: "/srv/app/app.ts", isDir: false },
    ], () => false);
    expect(result.context).toContain("Carpeta: /srv/app");
    expect(result.context).toContain("Contenido de /srv/app/app.ts");
    expect(result.context).toContain("contenido de /srv/app/app.ts");
    expect(result.errors).toEqual([]);
  });

  it("reports a denied read without claiming the content was attached", async () => {
    get.mockResolvedValue({ ok: false, error: "Sin permiso" });
    const result = await loadServerEntryContext([{ path: "/etc/secret.txt", isDir: false }], () => false);
    expect(result.context).toContain("No se pudo leer este elemento");
    expect(result.errors[0]).toContain("Sin permiso");
    expect(result.attachments).toEqual([]);
  });
});
