// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PromptBar from "./PromptBar";

it("keeps the live microphone in the same slot and rejects Enter and queue with a draft", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const onSend = vi.fn(), onQueue = vi.fn(), toggle = vi.fn();
  await act(async () => root.render(createElement(PromptBar, {
    value: "borrador privado", busy: true, onSend, onQueue, realtime: { active: true, toggle }, models: [], efforts: [],
  })));
  expect(host.querySelectorAll(".prompt-bar__send")).toHaveLength(1);
  expect(host.querySelector('[aria-label="Send"]')).toBeNull();
  expect(host.querySelector('[aria-label="Queue message"]')).toBeNull();
  await act(async () => host.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(onSend).not.toHaveBeenCalled();
  await act(async () => (host.querySelector(".prompt-bar__send") as HTMLButtonElement).click());
  expect(toggle).toHaveBeenCalledOnce();
  await act(async () => root.render(createElement(PromptBar, { value: "borrador privado", onSend, realtime: { active: false, toggle }, models: [], efforts: [] })));
  await act(async () => (host.querySelector('[aria-label="Send"]') as HTMLButtonElement).click());
  expect(onSend).toHaveBeenCalledWith("borrador privado", expect.anything());
  await act(async () => root.unmount()); host.remove();
});

it("does not combine a draft with a recording and keeps text locked through audio submission", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  let finish!: (v: any) => void; let accepted!: () => void;
  const onDictate = () => new Promise<any>(r => { finish = r; });
  const onSend = vi.fn(() => new Promise<void>(r => { accepted = r; }));
  const onChange = vi.fn(), onAudioPhaseChange = vi.fn();
  const props = { onDictate, onSend, onChange, onAudioPhaseChange, models: [], efforts: [] };
  await act(async () => root.render(createElement(PromptBar, { ...props, value: "" })));
  await act(async () => (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click());
  await act(async () => root.render(createElement(PromptBar, { ...props, value: "no enviar esto" })));
  await act(async () => host.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(onSend).not.toHaveBeenCalled();
  await act(async () => finish({ text: "revisa nginx", recording: { name: "voice.webm", voice: {} } }));
  expect(onSend).toHaveBeenCalledWith("revisa nginx", expect.objectContaining({ attachments: [] }));
  expect(onAudioPhaseChange).toHaveBeenLastCalledWith(true);
  expect(onChange).not.toHaveBeenCalledWith("");
  await act(async () => accepted());
  expect(onAudioPhaseChange).toHaveBeenLastCalledWith(false);
  expect(host.querySelector("textarea")!.value).toBe("no enviar esto");
  await act(async () => root.unmount()); host.remove();
});
