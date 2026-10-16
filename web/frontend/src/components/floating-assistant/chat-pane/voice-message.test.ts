// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { RecordedAudio, VoiceMessage } from "./voice-message";
import { historyTurn } from "../chat-engine/history";

vi.mock("@/lib/api-client", () => ({ resolvePanelApiPath: (path: string) => path, scopeHeaders: () => ({ "X-Bridge-Session-Id": "selected-session" }), resolveTargetScope: () => "selected-target" }));
const recording = { name: "audio.webm", mimeType: "audio/webm", url: "data:audio/webm;base64,YXVkaW8=", voice: { transcript: "Hola" } };
let root: ReturnType<typeof createRoot>;
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render(node: ReturnType<typeof createElement>) {
  const host = document.createElement("div");document.body.append(host); root = createRoot(host);
  await act(async () => root.render(node));return host;
}
it("renders a player followed by collapsed transcript and forwarded text", async () => {
  const host = await render(createElement(VoiceMessage, { recordings: [recording], forwardedText: "Hello" }));
  expect(host.querySelector("audio")?.src).toBe(recording.url);
  const details = [...host.querySelectorAll("details")];
  expect(details).toHaveLength(2);
  expect(details.every(d => !d.open)).toBe(true);
  expect(details[0]?.textContent).toContain("Hola");
  expect(details[1]?.textContent).toContain("Hello");
});
it("preserves audio and both text variants when restoring history", () => {
  const turn = historyTurn({ role: "user", content: "Hello", textOriginal: "Hola", ts: "", attachments: [{ id: "clip", name: recording.name, mimeType: recording.mimeType, voice: recording.voice }] });
  expect(turn.text).toBe("Hola");expect(turn.raw).toBe("Hello");
  expect(turn.attachments?.[0]).toEqual({ ...recording, url: "/api/ai/attachments/clip" });
});
it("loads saved audio with the selected session and revokes the playback URL", async () => {
  const fetchMock = vi.fn(async () => new Response(new Blob(["audio"], { type: "audio/webm" })));
  vi.stubGlobal("fetch", fetchMock);
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recording");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const host = await render(createElement(RecordedAudio, { recording: { ...recording, url: "/api/ai/attachments/clip" } }));
  expect(fetchMock).toHaveBeenCalledWith("/api/ai/attachments/clip", expect.objectContaining({ credentials: "include", headers: { "X-Bridge-Session-Id": "selected-session" } }));
  expect(create).toHaveBeenCalledOnce();expect(host.querySelector("audio")?.src).toBe("blob:recording");
  await act(async () => root.unmount());expect(revoke).toHaveBeenCalledWith("blob:recording");
});
it("does not publish a delayed audio fetch after changing servers", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  const create = vi.spyOn(URL, "createObjectURL");
  const host = await render(createElement(RecordedAudio, { recording: { ...recording, url: "/api/ai/attachments/clip" } }));
  await act(async () => { window.dispatchEvent(new Event("luxipanel:target-changed")); finish(new Response("audio")); });
  expect(create).not.toHaveBeenCalled();expect(host.querySelector("audio")).toBeNull();
});
