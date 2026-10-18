// SPDX-License-Identifier: AGPL-3.0-only
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TurnView } from "./turn-view";
import { historyTurn } from "../chat-engine/history";

vi.hoisted(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, items: [] }), {
    headers: { "Content-Type": "application/json" },
  })));
});
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
function visibleText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLDetailsElement && !node.open) return node.querySelector(":scope > summary")?.textContent ?? "";
  if (node instanceof HTMLElement && (node.hidden || node.getAttribute("aria-hidden") === "true")) return "";
  return Array.from(node.childNodes).map(visibleText).join(" ").replace(/\s+/g, " ");
}

it.each([false, true])("keeps a persisted pending notice readable with its waiting status: cli=%s", async cli => {
  const body = "El resultado sigue pendiente.\n\nNo se pudo verificar el servicio; revisa su estado antes de repetir la operación.";
  const turn = historyTurn({ role: "assistant", content: body, ts: "", cli, pending: true,
    messageId: "pending-a", presentation: "summary", displaySummary: "Operación finalizada." });
  await act(async () => root.render(createElement(TurnView, { turn, provider: "codex" })));
  const answer = host.querySelector('[data-message-section="answer"]');
  expect(answer).not.toBeNull();
  expect(visibleText(answer!)).toContain("El resultado sigue pendiente.");
  expect(visibleText(answer!)).toContain("revisa su estado antes de repetir la operación.");
  expect(visibleText(host)).toContain("En espera");
  expect(visibleText(host)).not.toContain("Operación finalizada.");
  expect(answer!.querySelector("[data-compact-answer]")).toBeNull();
});

it.each([undefined, "full"] as const)("shows the entire translated document despite displaySummary: presentation=%s", async presentation => {
  const translated = "Document complet demandé.\n\n" + "Tous les détails restent visibles. ".repeat(20) + "\n\nDernière section conservée.";
  const message = { role: "assistant" as const, content: "Canonical source", textTranslated: translated, ts: "",
    messageId: "document-a", presentation, displaySummary: "Résumé bref." };
  await act(async () => root.render(createElement(TurnView, { turn: historyTurn(message), provider: "codex" })));
  const answer = host.querySelector('[data-message-section="answer"]')!;
  expect(visibleText(answer)).toContain("Dernière section conservée.");
  expect(visibleText(answer)).not.toContain("Résumé bref.");
  expect(answer.querySelector("[data-compact-answer]")).toBeNull();
  expect(message.content).toBe("Canonical source");
  expect(message.textTranslated).toBe(translated);
});
