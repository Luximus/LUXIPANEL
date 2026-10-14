// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureMock = vi.fn(async () => null);
vi.mock("./snapshot.service.js", () => ({ snapshotService: { capture: (...a: unknown[]) => captureMock(...a) } }));
vi.mock("../../../shared/files-cache/index.js", () => ({ invalidateDir: vi.fn(), invalidateFile: vi.fn(), invalidateStat: vi.fn() }));

const { imageOptimService } = await import("./image-optim.service.js");
const { ALLOWED_BASES, setAllowedBases } = await import("./filesystem.service.js");

let originalBases: string[] = [];
beforeEach(() => { captureMock.mockClear(); originalBases = [...ALLOWED_BASES]; setAllowedBases(["/srv"]); });
afterEach(() => setAllowedBases(originalBases));

/** Executor where `have` = set of available commands; statSize = file size. */
function makeExecutor(have: string[], opts: { calls?: string[]; statSize?: number } = {}) {
  const calls = opts.calls ?? [];
  const exec = vi.fn(async (cmd: string) => {
    calls.push(cmd);
    if (cmd.startsWith("command -v ")) {
      const bin = cmd.slice("command -v ".length).trim();
      return { stdout: have.includes(bin) ? `/usr/bin/${bin}` : "", stderr: "", exitCode: have.includes(bin) ? 0 : 1, durationMs: 1 };
    }
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
  });
  const stat = vi.fn(async () => ({ size: opts.statSize ?? 1000 }));
  return { executor: { target: { id: "r", name: "R" }, exec, stat } as never, calls };
}

describe("imageOptimService.capabilities", () => {
  it("resolves magick vs convert and the helpers", async () => {
    const { executor } = makeExecutor(["convert", "cwebp"]);
    const caps = await imageOptimService.capabilities(executor);
    expect(caps.magick).toBe(true);
    expect(caps.magickCmd).toBe("convert");
    expect(caps.cwebp).toBe(true);
    expect(caps.jpegoptim).toBe(false);
  });
});

describe("imageOptimService.toWebp", () => {
  it("uses cwebp when available, writing a .webp next to the source", async () => {
    const { executor, calls } = makeExecutor(["cwebp"]);
    const caps = await imageOptimService.capabilities(executor);
    const r = await imageOptimService.toWebp(executor, "/srv/app/pic.jpg", 75, caps);
    expect(r.ok).toBe(true);
    expect(r.dest).toBe("/srv/app/pic.webp");
    expect(calls.some((c) => c.startsWith("cwebp ") && c.includes("'-q' '75'") && c.includes("pic.webp"))).toBe(true);
  });

  it("fails clearly when no webp tool exists", async () => {
    const { executor } = makeExecutor([]);
    const caps = await imageOptimService.capabilities(executor);
    const r = await imageOptimService.toWebp(executor, "/srv/app/pic.jpg", 75, caps);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/cwebp|ImageMagick/);
  });
});

describe("imageOptimService.compress", () => {
  it("snapshots then compresses a jpg with jpegoptim", async () => {
    const { executor, calls } = makeExecutor(["jpegoptim"]);
    const caps = await imageOptimService.capabilities(executor);
    const r = await imageOptimService.compress(executor, "/srv/app/pic.jpg", 80, caps);
    expect(r.ok).toBe(true);
    expect(captureMock).toHaveBeenCalledWith(executor, "/srv/app/pic.jpg", "edit");
    expect(calls.some((c) => c.startsWith("jpegoptim ") && c.includes("--max=80"))).toBe(true);
  });

  it("falls back to ImageMagick in place for other types", async () => {
    const { executor, calls } = makeExecutor(["magick"]);
    const caps = await imageOptimService.capabilities(executor);
    const r = await imageOptimService.compress(executor, "/srv/app/pic.png", 80, caps);
    expect(r.ok).toBe(true);
    expect(calls.some((c) => c.startsWith("magick ") && c.includes("'-quality' '80'"))).toBe(true);
  });
});

describe("imageOptimService.resize", () => {
  it("writes a -<w>w file via magick", async () => {
    const { executor, calls } = makeExecutor(["magick"]);
    const caps = await imageOptimService.capabilities(executor);
    const r = await imageOptimService.resize(executor, "/srv/app/pic.jpg", 768, caps);
    expect(r.dest).toBe("/srv/app/pic-768w.jpg");
    expect(calls.some((c) => c.includes("'-resize' '768x'"))).toBe(true);
  });
});
