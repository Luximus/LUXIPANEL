import { beforeEach, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";
const scope = vi.hoisted(() => ({ executor: { target: { id: "selected-target" } }, owned: true, mime: "audio/webm;codecs=opus" }));
vi.mock("../../../shared/executor/index.js", () => ({ getExecutor: () => scope.executor, quoteArg: (x: string) => x }));
vi.mock("../repositories/attachments.repository.js", () => ({ attachmentsRepository: {
  get: vi.fn(async () => ({ path: "/private/clip", convId: "owned-conversation", name: "audio.webm", mimeType: scope.mime })),
  read: vi.fn(async () => Buffer.from("audio")),
} }));
vi.mock("../repositories/audio.repository.js", () => ({ audioRepository: {} }));
vi.mock("../repositories/conversations.repository.js", () => ({ conversationsRepository: { listIds: vi.fn(async () => new Set(scope.owned ? ["owned-conversation"] : [])) } }));
const { storageController } = await import("./storage.controller.js");
const { attachmentsRepository } = await import("../repositories/attachments.repository.js");
beforeEach(() => { scope.owned = true;scope.mime = "audio/webm;codecs=opus";vi.clearAllMocks(); });
async function serve() {
  const headers: Record<string, string> = {};
  return new Promise<{ headers: typeof headers; error?: any; body?: Buffer }>(resolve => {
    const res = { locals: { locale: "es" }, setHeader: (key: string, value: string) => { headers[key] = value; }, end: (body: Buffer) => resolve({ headers, body }) };
    storageController.serve({ params: { id: "clip" } } as unknown as Request, res as unknown as Response, ((error: unknown) => resolve({ headers, error })) as NextFunction);
  });
}
it("serves an owned recording as inline audio on its selected target", async () => {
  const result = await serve();
  expect(result.error).toBeUndefined();expect(result.body).toEqual(Buffer.from("audio"));
  expect(result.headers["Content-Type"]).toBe("audio/webm");
  expect(result.headers["Content-Disposition"]).toContain("inline");
  expect(attachmentsRepository.get).toHaveBeenCalledWith(scope.executor, "clip");
});
it("does not read or expose audio from another user's conversation", async () => {
  scope.owned = false;
  expect((await serve()).error?.statusCode).toBe(404);
  expect(attachmentsRepository.read).not.toHaveBeenCalled();
});
it("continues to force active document types to download", async () => {
  scope.mime = "text/html";
  const result = await serve();
  expect(result.headers["Content-Type"]).toBe("application/octet-stream");
  expect(result.headers["Content-Disposition"]).toContain("attachment;");
});
