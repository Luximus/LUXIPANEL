// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const speak = vi.hoisted(() => vi.fn(async () => "/api/ai/audio/clip"));
vi.mock("../assistant-api", () => ({ voiceApi: { speak } }));
vi.mock("../i18n", () => ({ useAssistantI18n: () => ({ chatTab: {} }) }));

import { SpeakButton } from "./voice-controls";

const played: Array<{ play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }> = [];

afterEach(() => { vi.unstubAllGlobals(); speak.mockClear(); played.length = 0; });

it("plays, stops and replays the same agent clip with visible voice states", async () => {
  vi.stubGlobal("Audio", class {
    play = vi.fn(async () => {});
    pause = vi.fn();
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public src: string) { played.push(this); }
  });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(SpeakButton, { text: "Respuesta", conversationId: "chat" })));
    const button = () => host.querySelector<HTMLButtonElement>("button")!;
    expect(button().dataset.voiceState).toBe("idle");
    await act(async () => button().click());
    expect(button().dataset.voiceState).toBe("playing");
    expect(button().getAttribute("aria-pressed")).toBe("true");
    await act(async () => button().click());
    expect(button().dataset.voiceState).toBe("idle");
    expect(played[0].pause).toHaveBeenCalledOnce();
    await act(async () => button().click());
    expect(button().dataset.voiceState).toBe("playing");
    expect(speak).toHaveBeenCalledOnce();
    expect(played).toHaveLength(2);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
