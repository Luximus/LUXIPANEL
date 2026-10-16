import { expect, it } from "vitest";
import { chatAttachmentSchema, modelAttachments } from "./chat-attachment.js";

const recording = { name: "audio.webm", mimeType: "audio/webm;codecs=opus", dataBase64: "YXVkaW8=", voice: { transcript: "Revisa el servidor" } };
it("retains the original recording and its transcript in validated requests", () => {
  expect(chatAttachmentSchema.parse(recording)).toEqual(recording);
});
it.each(["text/html", "image/svg+xml", "application/javascript"])("rejects a voice marker on %s", mimeType => {
  expect(chatAttachmentSchema.safeParse({ ...recording, mimeType }).success).toBe(false);
});
it("requires a nonempty transcript for recorded audio", () => {
  expect(chatAttachmentSchema.safeParse({ ...recording, voice: { transcript: " " } }).success).toBe(false);
});
it("keeps ordinary files but never forwards voice bytes to the model or CLI", () => {
  const file = { name: "photo.png", mimeType: "image/png", dataBase64: "image" };
  expect(modelAttachments([recording, file])).toEqual([file]);
  expect(modelAttachments([recording])).toEqual([]);
});
