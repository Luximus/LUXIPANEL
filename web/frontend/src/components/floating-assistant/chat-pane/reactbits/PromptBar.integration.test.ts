// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import PromptBar from "./PromptBar";

afterEach(() => document.body.replaceChildren());

it("places mobile sources and send beside the draft and restores desktop controls without losing it", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSend = vi.fn();
  const props = { value: "Revisa el proyecto", onSend, models: [{ key: "", name: "Auto" }], efforts: ["Auto", "High"], inputLeading: createElement("a", { className: "test-profile" }, "JW") };
  await act(async () => root.render(createElement(PromptBar, { ...props, mobileLayout: true })));
  const row = host.querySelector('.prompt-bar__input-row')!;
  const input = row.querySelector('textarea')!;
  expect(row.querySelector('[data-search-target="chat-prompt-plus"]')).not.toBeNull();
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

it("keeps mobile dictation, queue and stop in the writing row with their original callbacks", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onQueue = vi.fn(), onStop = vi.fn();
  await act(async () => root.render(createElement(PromptBar, { mobileLayout:true, value:"Siguiente instrucción", busy:true, onQueue, onStop, onDictate:vi.fn(), models:[], efforts:[] })));
  const row=host.querySelector('.prompt-bar__input-row')!;
  expect(row.querySelector('[aria-label="Dictate"]')).not.toBeNull();
  const queue=row.querySelector('[aria-label="Queue message"]') as HTMLButtonElement;
  const stop=row.querySelector('[aria-label="Stop"]') as HTMLButtonElement;
  expect(queue.nextElementSibling).toBe(stop);
  await act(async () => queue.click());
  await act(async () => stop.click());
  expect(onQueue).toHaveBeenCalledOnce();expect(onStop).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it("connects the original send tile and microphone to a controlled chat draft", async () => {
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
  await act(async () => { (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click(); });
  expect(onChange).toHaveBeenCalledWith("Revisa el proyecto por favor");
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

it("opens source actions without changing the draft", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onSelect = vi.fn();
  const onChange = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      value: "Texto pendiente",
      onChange,
      sources: [{ key: "terminal", name: "Terminal", icon: createElement("span", null, ">"), onSelect }],
      models: [],
      efforts: [],
    }));
  });
  await act(async () => { (host.querySelector('[aria-label="Add files and sources"]') as HTMLButtonElement).click(); });
  expect(host.querySelector('[role="menu"]')).not.toBeNull();
  await act(async () => { (host.querySelector('[role="menuitem"]') as HTMLButtonElement).click(); });
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => { root.unmount(); });
});

it("runs creation actions in the source menu footer", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onNewProject = vi.fn();
  const onNewChat = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      sources: [],
      sourceMenuFooter: createElement("div", null,
        createElement("button", { type: "button", "data-prompt-footer-action": "", onClick: onNewProject }, "Nuevo proyecto"),
        createElement("button", { type: "button", "data-prompt-footer-action": "", onClick: onNewChat }, "Nueva conversación"),
      ),
      models: [],
      efforts: [],
    }));
  });
  await act(async () => { (host.querySelector('[aria-label="Add files and sources"]') as HTMLButtonElement).click(); });
  await act(async () => { (Array.from(host.querySelectorAll('[data-prompt-footer-action]')).find(node => node.textContent === "Nuevo proyecto") as HTMLButtonElement).click(); });
  expect(onNewProject).toHaveBeenCalledOnce();
  await act(async () => { (host.querySelector('[aria-label="Add files and sources"]') as HTMLButtonElement).click(); });
  await act(async () => { (Array.from(host.querySelectorAll('[data-prompt-footer-action]')).find(node => node.textContent === "Nueva conversación") as HTMLButtonElement).click(); });
  expect(onNewChat).toHaveBeenCalledOnce();
  await act(async () => { root.unmount(); });
});

it("keeps the transcribed text when dictation is stopped", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let finish: ((text: string) => void) | undefined;
  const onChange = vi.fn();
  await act(async () => {
    root.render(createElement(PromptBar, {
      value: "",
      onChange,
      onDictate: () => new Promise<string>(resolve => { finish = resolve; }),
      onStopDictation: () => finish?.("Texto dictado"),
      models: [],
      efforts: [],
    }));
  });
  await act(async () => { (host.querySelector('[aria-label="Dictate"]') as HTMLButtonElement).click(); });
  await act(async () => { (host.querySelector('[aria-label="Stop dictation"]') as HTMLButtonElement).click(); });
  expect(onChange).toHaveBeenCalledWith("Texto dictado");
  await act(async () => { root.unmount(); });
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
