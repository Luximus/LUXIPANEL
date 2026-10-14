// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AskView } from "./ask-permission";

afterEach(() => document.body.replaceChildren());

const planQuestion = [{
  id: "plan",
  type: "single" as const,
  text: "¿Apruebas este plan?",
  options: ["Aprobar plan", "Pedir cambios"],
}];

it("envía la aprobación al pulsar la primera opción, sin otro clic", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onAnswer = vi.fn(async () => {});

  await act(async () => root.render(createElement(AskView, {
    questions: planQuestion, kind: "plan-approval", interactive: true, onAnswer,
  })));
  const approve = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Aprobar plan");
  expect(approve).toBeTruthy();
  await act(async () => approve!.click());
  expect(onAnswer).toHaveBeenCalledExactlyOnceWith("Aprobar plan", { planDecision: "approve" });
  await act(async () => root.unmount());
});

it("permite reintentar si falla el cambio de modo antes del envío", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onAnswer = vi.fn().mockRejectedValueOnce(new Error("config error")).mockResolvedValueOnce(undefined);

  await act(async () => root.render(createElement(AskView, {
    questions: planQuestion, kind: "plan-approval", interactive: true, onAnswer,
  })));
  const approve = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Aprobar plan");
  await act(async () => approve!.click());
  expect(host.querySelector("[role=alert]")).not.toBeNull();
  await act(async () => approve!.click());
  expect(onAnswer).toHaveBeenCalledTimes(2);
  expect(host.querySelector("[role=alert]")).toBeNull();
  await act(async () => root.unmount());
});
