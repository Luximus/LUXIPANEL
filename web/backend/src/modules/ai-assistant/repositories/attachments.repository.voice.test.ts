import { expect, it, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
process.env.JWT_SECRET ??= "x".repeat(40);
process.env.LICENSE_SERVER_URL ??= "http://127.0.0.1:3300";
const memory = vi.hoisted(() => ({ rows: {} as Record<string, any> }));
vi.mock("../../../shared/data-store/index.js", () => ({ dataStore: vi.fn(() => ({
  transaction: async (callback: any) => { memory.rows = (await callback(memory.rows)).next; },
  get: async (id: string) => memory.rows[id],
})) }));
const { attachmentsRepository } = await import("./attachments.repository.js");
it("stores the original voice bytes on the target and retains transcript metadata in history refs", async () => {
  const executor = { exec: vi.fn(async () => ({ stdout: "" })), writeFile: vi.fn(async () => {}) } as unknown as Executor;
  const recording = { name: "audio.webm", mimeType: "audio/webm", dataBase64: "YXVkaW8=", voice: { transcript: "Hola" } };
  const [ref] = await attachmentsRepository.storeMany(executor, "conv-voice", [recording]);
  expect(ref?.voice).toEqual({ transcript: "Hola" });
  expect(JSON.stringify(ref)).not.toContain("YXVkaW8=");
  const stored = await attachmentsRepository.get(executor, ref!.id);
  expect(stored?.convId).toBe("conv-voice");
  expect(executor.writeFile).toHaveBeenCalledWith(stored?.path, Buffer.from("audio"));
});
