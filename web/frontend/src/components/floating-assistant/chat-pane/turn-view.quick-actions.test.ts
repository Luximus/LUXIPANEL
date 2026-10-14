// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TurnView } from "./turn-view";
import type { ChatTurn } from "../chat-engine";

afterEach(() => document.body.replaceChildren());

it("runs each quick action and retries the original request through its callback", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onAnswer = vi.fn();
  const onRetry = vi.fn();
  const turn: ChatTurn = { role: "assistant", text: "Respuesta terminada", tools: [] };

  await act(async () => {
    root.render(createElement(TurnView, { turn, provider: "codex", isLast: true, onAnswer, onRetry }));
  });

  const click = async (label: string) => {
    const button = Array.from(host.querySelectorAll("button")).find(node => node.textContent?.trim() === label);
    expect(button, `${label} should be visible`).toBeTruthy();
    await act(async () => { button!.click(); });
  };

  await click("Reescribe");
  await click("Resúmelo");
  await click("Continúa");
  await click("Revisar");
  expect(onAnswer).toHaveBeenCalledTimes(4);
  expect(onAnswer.mock.calls.map(([text]) => text)).toEqual([
    "Reescribe la respuesta", "Resume más la respuesta", "Continuar", "Revisar últimos cambios",
  ]);

  await click("Reintentar");
  expect(onRetry).toHaveBeenCalledOnce();
  expect(onAnswer).toHaveBeenCalledTimes(4);
  await act(async () => { root.unmount(); });
});
