// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../assistant-api", () => ({ voiceApi: { transcribe: vi.fn(async () => "hola") } }));

import { voiceApi } from "../assistant-api";
import { usePromptDictation } from "./use-prompt-dictation";

type Controls = ReturnType<typeof usePromptDictation>;

class FakeRecorder {
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

let root: ReturnType<typeof createRoot>;
let host: HTMLElement;
let controls: Controls;
const trackStop = vi.fn();

function Harness() {
  const next = usePromptDictation();
  useEffect(() => { controls = next; }, [next]);
  return null;
}

beforeEach(async () => {
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(Harness)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  trackStop.mockClear();
  vi.mocked(voiceApi.transcribe).mockClear();
  vi.unstubAllGlobals();
});

it("does not upload a recording cancelled with X", async () => {
  const recording = controls.dictate();
  await act(async () => { await Promise.resolve(); });
  controls.cancel();
  expect(await recording).toBeUndefined();
  expect(voiceApi.transcribe).not.toHaveBeenCalled();
  expect(trackStop).toHaveBeenCalled();
});

it("transcribes a recording when the user presses stop", async () => {
  const recording = controls.dictate();
  await act(async () => { await Promise.resolve(); });
  controls.stop();
  expect(await recording).toEqual({ text: "hola", recording: { name: "audio.webm", mimeType: "audio/webm", dataBase64: "YXVkaW8=", voice: { transcript: "hola" } } });
  expect(voiceApi.transcribe).toHaveBeenCalledOnce();
  expect(trackStop).toHaveBeenCalled();
});

it("aborts transcription when cancelled after pressing stop", async () => {
  vi.mocked(voiceApi.transcribe).mockImplementationOnce((_audio, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const recording = controls.dictate();
  await act(async () => { await Promise.resolve(); });
  controls.stop();
  controls.cancel();
  expect(await recording).toBeUndefined();
  expect(voiceApi.transcribe).toHaveBeenCalledOnce();
});

it("cancels a recording when the selected server changes", async () => {
  const recording = controls.dictate();
  await act(async () => { await Promise.resolve(); });
  window.dispatchEvent(new Event("luxipanel:target-changed"));
  expect(await recording).toBeUndefined();
  expect(voiceApi.transcribe).not.toHaveBeenCalled();
});
