// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import PromptBar from "./PromptBar";

it.each([
  { value: "", mobileLayout: false }, { value: "borrador pendiente", mobileLayout: false },
  { value: "", mobileLayout: true }, { value: "borrador pendiente", mobileLayout: true },
])("keeps Stop available during a run with idle realtime voice ($mobileLayout, $value)", async ({ value, mobileLayout }) => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const onStop = vi.fn(), toggle = vi.fn();
  const props = { value, mobileLayout, onStop, realtime: { active: false, toggle }, models: [], efforts: [] };
  try {
    await act(async () => root.render(createElement(PromptBar, { ...props, busy: true })));
    const stop = host.querySelector<HTMLButtonElement>('[aria-label="Stop"]');
    expect(stop).not.toBeNull();
    expect(stop!.disabled).toBe(false);
    expect(host.querySelector('[aria-label="Iniciar voz en tiempo real"]')).toBeNull();
    await act(async () => stop!.click());
    expect(onStop).toHaveBeenCalledOnce();
    expect(toggle).not.toHaveBeenCalled();
    await act(async () => root.render(createElement(PromptBar, { ...props, value: "", busy: false })));
    expect(host.querySelector('[aria-label="Stop"]')).toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Iniciar voz en tiempo real"]')!.click());
    expect(toggle).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

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
  expect(host.querySelector('[data-voice-state="recording"]')).not.toBeNull();
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

it("shows NAVAI voice feedback without replacing the realtime stop action", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const toggle = vi.fn();
  try {
    await act(async () => root.render(createElement(PromptBar, {
      realtime: { active: true, phase: "live", agentSpeaking: true, toggle }, models: [], efforts: [],
    })));
    const button = host.querySelector<HTMLButtonElement>('[data-voice-state="speaking"]');
    expect(button?.getAttribute("aria-label")).toBe("Terminar voz en tiempo real");
    expect(host.querySelector("textarea")?.placeholder).toContain("El agente está hablando");
    await act(async () => button!.click());
    expect(toggle).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
