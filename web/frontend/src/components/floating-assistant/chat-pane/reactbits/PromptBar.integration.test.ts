// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import PromptBar from "./PromptBar";

afterEach(() => document.body.replaceChildren());

it("preserves historical drafts while disabling send and queue and allowing navigation", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const onSend = vi.fn(), onQueue = vi.fn(), onChange = vi.fn();
  try {
    await act(async () => root.render(createElement(PromptBar, { value: "Borrador histórico", readOnly: true, onSend, onQueue, onChange, sources: [], models: [], efforts: [], toolbarPickers: [{ key: "agent", label: "Agente", value: "old", options: [{ key: "old", name: "Histórico" }], onChange: vi.fn() }] })));
    const input = host.querySelector("textarea")!;
    expect(input.readOnly).toBe(true); expect(input.value).toBe("Borrador histórico");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Send"]')?.disabled).toBe(true);
    expect(host.querySelector('[data-picker="agent"]')).not.toBeNull();
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onSend).not.toHaveBeenCalled(); expect(onQueue).not.toHaveBeenCalled(); expect(input.value).toBe("Borrador histórico");
  } finally { await act(async () => root.unmount()); }
});

it("places mobile settings and send beside the draft and restores desktop controls without losing it", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSend = vi.fn();
  const props = { value: "Revisa el proyecto", onSend, onOpenSettings: vi.fn(), models: [{ key: "", name: "Auto" }], efforts: ["Auto", "High"], inputLeading: createElement("a", { className: "test-profile" }, "JW") };
  await act(async () => root.render(createElement(PromptBar, { ...props, mobileLayout: true })));
  const row = host.querySelector('.prompt-bar__input-row')!;
  const input = row.querySelector('textarea')!;
  expect(row.querySelector('[data-search-target="chat-prompt-settings"]')).not.toBeNull();
  expect(row.querySelector('[aria-label="Send"]')).not.toBeNull();
  expect(row.querySelector('.test-profile')).toBeNull();
  expect(host.querySelectorAll('[aria-label="Send"]')).toHaveLength(1);
  await act(async () => (row.querySelector('[aria-label="Send"]') as HTMLButtonElement).click());
  expect(onSend).toHaveBeenCalledWith(props.value, expect.objectContaining({ effort: "Auto" }));
  await act(async () => root.render(createElement(PromptBar, { ...props, mobileLayout: false })));
  expect(host.querySelector('.prompt-bar__input-row textarea')).toBe(input);
  expect(input.value).toBe(props.value);
  expect(host.querySelector('.prompt-bar__input-row .test-profile')).not.toBeNull();
  expect(host.querySelector('.prompt-bar__bar [aria-label="Send"]')).not.toBeNull();
  await act(async () => root.unmount());
});

it("keeps queue and stop in the mobile writing row while a run is active", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onQueue = vi.fn(), onStop = vi.fn();
  await act(async () => root.render(createElement(PromptBar, { mobileLayout:true, value:"Siguiente instrucción", busy:true, onQueue, onStop, onDictate:vi.fn(), models:[], efforts:[] })));
  const row=host.querySelector('.prompt-bar__input-row')!;
  expect(row.querySelector('[aria-label="Dictate"]')).toBeNull();
  const queue=row.querySelector('[aria-label="Queue message"]') as HTMLButtonElement;
  const stop=row.querySelector('[aria-label="Stop"]') as HTMLButtonElement;
  expect(queue.nextElementSibling).toBe(stop);
  await act(async () => queue.click());
  await act(async () => stop.click());
  expect(onQueue).toHaveBeenCalledOnce();expect(onStop).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it("uses the send button for a written draft", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSend = vi.fn();
  const onChange = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      value: "Revisa el proyecto",
      onChange,
      onSend,
      onDictate: async () => "por favor",
      models: [{ key: "", name: "Auto" }],
      efforts: ["Auto", "Low", "High"],
      defaultEffort: "Auto",
    }));
  });
  expect(host.querySelector('[aria-label="Dictate"]')).toBeNull();
  await act(async () => { (host.querySelector('[aria-label="Send"]') as HTMLButtonElement).click(); });
  expect(onSend).toHaveBeenCalledWith("Revisa el proyecto", expect.objectContaining({ effort: "Auto" }));
  await act(async () => { root.unmount(); });
});

it("queues a drafted follow-up beside Stop while a response is active", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onQueue = vi.fn();
  const onStop = vi.fn();
  const render = async (value: string, busy: boolean) => {
    await act(async () => {
      root.render(createElement(PromptBar, {
        value, busy, onQueue, onStop, queueLabel: "Encolar mensaje",
        models: [], efforts: [],
      }));
    });
  };
  await render("Siguiente instrucción", true);
  const queue = host.querySelector('[aria-label="Encolar mensaje"]') as HTMLButtonElement;
  const stop = host.querySelector('[aria-label="Stop"]') as HTMLButtonElement;
  expect(queue.title).toBe("Encolar mensaje");
  expect(queue.textContent).toBe("");
  expect(queue.nextElementSibling).toBe(stop);
  await act(async () => { queue.click(); });
  expect(onQueue).toHaveBeenCalledOnce();
  expect(onStop).not.toHaveBeenCalled();
  await render("", true);
  expect(host.querySelector('[aria-label="Encolar mensaje"]')).toBeNull();
  await render("Siguiente instrucción", false);
  expect(host.querySelector('[aria-label="Encolar mensaje"]')).toBeNull();
  await act(async () => { root.unmount(); });
});

it("opens advanced settings directly without changing the draft", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onOpenSettings = vi.fn();
  const onChange = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      value: "Texto pendiente",
      onChange,
      onOpenSettings,
      settingsLabel: "Configuración avanzada",
      sources: [],
      models: [],
      efforts: [],
    }));
  });
  const settings = host.querySelector('[aria-label="Configuración avanzada"]') as HTMLButtonElement;
  expect(settings.querySelector('.ti-settings')).not.toBeNull();
  expect(settings.title).toBe("Configuración avanzada");
  await act(async () => settings.click());
  expect(host.querySelector('[role="menu"]')).toBeNull();
  expect(host.querySelector('.prompt-bar__menu')).toBeNull();
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => { root.unmount(); });
});

it("places mobile settings before History and opens them directly", async () => {
  const nav = document.createElement("header");
  nav.innerHTML = '<span id="workspace-chat-plus-control"></span><button id="workspace-history-toggle">Historial</button>';
  const host = document.createElement("div");
  document.body.append(nav, host);
  const root = createRoot(host);
  const onOpenSettings = vi.fn();
  await act(async () => root.render(createElement(PromptBar, {
    mobileLayout: true,
    onOpenSettings,
    sources: [],
    models: [], efforts: [],
  })));
  const settings = nav.querySelector<HTMLButtonElement>('[data-search-target="chat-prompt-settings"]')!;
  expect(settings.closest('#workspace-chat-plus-control')?.nextElementSibling?.id).toBe('workspace-history-toggle');
  expect(host.querySelector('.prompt-bar__input-row [data-search-target="chat-prompt-settings"]')).toBeNull();
  await act(async () => settings.click());
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(document.body.querySelector('[role="menu"]')).toBeNull();
  await act(async () => root.unmount());
});

it("closes the model picker before opening settings", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onOpenSettings = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      sources: [],
      onOpenSettings,
      models: [{ key: "auto", name: "Auto" }],
      efforts: [],
    }));
  });
  await act(async () => { (host.querySelector('[aria-label="Choose model"]') as HTMLButtonElement).click(); });
  expect(host.querySelector('[role="listbox"]')).not.toBeNull();
  await act(async () => { (host.querySelector('[aria-label="Configuración avanzada"]') as HTMLButtonElement).click(); });
  expect(onOpenSettings).toHaveBeenCalledOnce();
  expect(host.querySelector('[role="listbox"]')).toBeNull();
  await act(async () => { root.unmount(); });
});

it("transcribes and sends voice from the empty composer", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let finish: ((text: string) => void) | undefined;
  const onSend = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      value: "",
      onSend,
      onDictate: () => new Promise<string>(resolve => { finish = resolve; }),
      onStopDictation: () => finish?.("Texto dictado"),
      models: [],
      efforts: [],
    }));
  });
  await act(async () => { (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click(); });
  await act(async () => { (host.querySelector('[aria-label="Stop dictation"]') as HTMLButtonElement).click(); });
  expect(onSend).toHaveBeenCalledWith("Texto dictado", expect.any(Object));
  await act(async () => { root.unmount(); });
});

it("cancels a recording with X without sending its eventual transcript", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let finish: ((text: string) => void) | undefined;
  const onSend = vi.fn();
  const onCancelDictation = vi.fn();
  await act(async () => root.render(createElement(PromptBar, {
    mobileLayout: true, value: "", onSend, onCancelDictation,
    onDictate: () => new Promise<string>(resolve => { finish = resolve; }),
    models: [], efforts: [],
  })));
  await act(async () => (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click());
  const cancel = host.querySelector('[aria-label="Cancelar audio"]') as HTMLButtonElement;
  expect(cancel).not.toBeNull();
  await act(async () => { cancel.click(); finish?.("texto cancelado"); });
  expect(onCancelDictation).toHaveBeenCalledOnce();
  expect(onSend).not.toHaveBeenCalled();
  expect(host.querySelector('[aria-label="Dictate"]')).not.toBeNull();
  await act(async () => root.unmount());
});

it("shows the specific message when OpenAI rejects the dictation key", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const message = "OpenAI rechazó la clave API guardada. Sustitúyela en Ajustes → Agentes IA → OpenAI y pulsa Probar. La sesión de Codex CLI es independiente del audio.";
  await act(async () => root.render(createElement(PromptBar, {
    mobileLayout: true, value: "", onDictate: async () => { throw new Error(message); },
    models: [], efforts: [],
  })));
  await act(async () => (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe(message);
  await act(async () => root.unmount());
});

it("shows the missing OpenAI credential instead of a generic transcription error", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(PromptBar, {
    value: "", onDictate: async () => { throw new Error("Configura una clave API de OpenAI en Ajustes → Agentes IA → OpenAI para transcribir audio."); },
    models: [], efforts: [],
  })));
  await act(async () => (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Ajustes → Agentes IA → OpenAI");
  await act(async () => root.unmount());
});

it("swaps the send control between microphone and text send on mobile and tablet layouts", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const props = { onDictate: vi.fn(async () => "hola"), onSend: vi.fn(), models: [], efforts: [] };
  for (const mobileLayout of [true, false]) {
    await act(async () => root.render(createElement(PromptBar, { ...props, mobileLayout, value: "" })));
    expect(host.querySelector('[aria-label="Dictate"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Send"]')).toBeNull();
    await act(async () => root.render(createElement(PromptBar, { ...props, mobileLayout, value: "mensaje" })));
    expect(host.querySelector('[aria-label="Send"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Dictate"]')).toBeNull();
    await act(async () => root.render(createElement(PromptBar, { ...props, mobileLayout, value: "" })));
    expect(host.querySelector('[aria-label="Dictate"]')).not.toBeNull();
  }
  await act(async () => root.unmount());
});

it("keeps Auto as the first reasoning level and sends explicit changes", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onEffortChange = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      efforts: ["Auto", "Low", "Medium"],
      effortLabels: { Low: "Bajo", Medium: "Medio" },
      defaultEffort: "Auto",
      onEffortChange,
      models: [{ key: "", name: "Auto" }],
    }));
  });
  await act(async () => { (host.querySelector('[aria-label$=" · Effort"]') as HTMLButtonElement).click(); });
  const slider = host.querySelector('[role="slider"]') as HTMLElement;
  expect(slider.getAttribute("aria-valuetext")).toBe("Auto");
  await act(async () => { slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
  expect(onEffortChange).toHaveBeenCalledWith("Low");
  expect(slider.getAttribute("aria-valuetext")).toBe("Bajo");
  await act(async () => { root.unmount(); });
});

it("shows and selects a model alongside the reasoning control", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onModelChange = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      models: [{ key: "", name: "Agente · gpt-6-sol" }, { key: "gpt-6-astra", name: "gpt-6-astra" }],
      efforts: ["Auto", "High"],
      onModelChange,
    }));
  });
  expect(host.querySelector('[aria-label="Choose model"]')?.textContent).toContain("gpt-6-sol");
  expect(host.querySelector('[aria-label$=" · Effort"]')).not.toBeNull();
  await act(async () => { (host.querySelector('[aria-label="Choose model"]') as HTMLButtonElement).click(); });
  await act(async () => { (Array.from(host.querySelectorAll('[role="option"]')).find(node => node.textContent?.includes("gpt-6-astra")) as HTMLButtonElement).click(); });
  expect(onModelChange).toHaveBeenCalledWith("gpt-6-astra");
  await act(async () => { root.unmount(); });
});

it("sends the original recording with its hidden transcript instead of losing the audio", async () => {
  const host = document.createElement("div");document.body.append(host);const root = createRoot(host);
  const recording = { name: "audio.webm", mimeType: "audio/webm", dataBase64: "YXVkaW8=", voice: { transcript: "Mensaje de voz" } };
  const onSend = vi.fn();
  await act(async () => root.render(createElement(PromptBar, { value: "", onSend, onDictate: async () => ({ text: "Mensaje de voz", recording }), models: [], efforts: [] })));
  await act(async () => (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click());
  expect(onSend).toHaveBeenCalledWith("Mensaje de voz", expect.objectContaining({ recording }));
  expect(host.querySelector("textarea")?.value).toBe("");
  await act(async () => root.unmount());
});
