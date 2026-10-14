// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Credentials tab — DOM binding for all card variants (token / managed /
// storage / connector) and per-card Configurar/Ayuda sub-tabs.
import { highlightBorderTabs, setPaneVisibilityByData, tabDirectionOf } from "/scripts/extracted/lib/tabs.js";
import { clearTokenCard, saveTokenCard, testTokenCard, wireManagedCard } from "./cred-token-cards";
import { clearStorageCard, connectConnector, disconnectConnector, saveStorageCard } from "./cred-provider-cards";

// ── binding + carga perezosa ─────────────────────────────────────────────────
// E-03: mismo cuerpo que `setHostingTab` (hosting/index-script1); compartido en
// /scripts/extracted/lib/tabs.js.
function setActiveTab(card: HTMLElement, pane: string) {
  const prev = card.dataset.credActiveTab ?? "config";
  const direction = tabDirectionOf(card.querySelectorAll<HTMLButtonElement>(".cred-tab"), (b) => b.dataset.credTab === prev, (b) => b.dataset.credTab === pane);
  card.dataset.credActiveTab = pane;
  highlightBorderTabs(".cred-tab", (btn) => btn.dataset.credTab === pane, card);
  setPaneVisibilityByData(".cred-pane", "pane", pane, card, direction);
}

export function bindCards() {
  const root = document.getElementById("panel-credentials");
  if (!root) return;
  // Sub-tabs Configurar / Ayuda dentro de cada tarjeta.
  root.querySelectorAll<HTMLElement>(".cred-card").forEach((card) => {
    if (!card.querySelector(".cred-tabs") || card.dataset.credTabsBound === "1") return;
    card.dataset.credTabsBound = "1";
    card.querySelectorAll<HTMLButtonElement>(".cred-tab").forEach((btn) => {
      btn.addEventListener("click", () => setActiveTab(card, btn.dataset.credTab ?? "config"));
    });
  });
  root.querySelectorAll<HTMLElement>("[data-cred-card]").forEach((card) => {
    if (card.dataset.credBound === "1") return;
    card.dataset.credBound = "1";
    card.querySelector<HTMLButtonElement>(".cred-save")?.addEventListener("click", () => void saveTokenCard(card));
    card.querySelector<HTMLButtonElement>(".cred-test")?.addEventListener("click", () => void testTokenCard(card));
    card.querySelector<HTMLButtonElement>(".cred-clear")?.addEventListener("click", () => void clearTokenCard(card));
    const toggle = card.querySelector<HTMLButtonElement>(".cred-toggle");
    const input = card.querySelector<HTMLInputElement>(".cred-input");
    if (toggle && input) {
      toggle.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        const icon = toggle.querySelector("i");
        if (icon) icon.className = `ti ${show ? "ti-eye-off" : "ti-eye"} text-base`;
      });
    }
    // Enter en el input = guardar.
    input?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void saveTokenCard(card);
      }
    });
  });
  root.querySelectorAll<HTMLElement>("[data-cred-managed]").forEach((card) => {
    if (card.dataset.credBound === "1") return;
    card.dataset.credBound = "1";
    wireManagedCard(card);
  });
  // Storage provider cards (R2 / S3).
  root.querySelectorAll<HTMLElement>("[data-cred-storage]").forEach((card) => {
    if (card.dataset.credBound === "1") return;
    card.dataset.credBound = "1";
    card.querySelector<HTMLButtonElement>(".cred-save")?.addEventListener("click", () => void saveStorageCard(card));
    card.querySelector<HTMLButtonElement>(".cred-clear")?.addEventListener("click", () => void clearStorageCard(card));
    const toggle = card.querySelector<HTMLButtonElement>(".cred-toggle");
    const secret = card.querySelector<HTMLInputElement>(".cred-secret");
    if (toggle && secret) {
      toggle.addEventListener("click", () => {
        const show = secret.type === "password";
        secret.type = show ? "text" : "password";
        const icon = toggle.querySelector("i");
        if (icon) icon.className = `ti ${show ? "ti-eye-off" : "ti-eye"} text-base`;
      });
    }
  });
  // Office connector cards (Google Drive / OneDrive / Dropbox / Notion).
  root.querySelectorAll<HTMLElement>("[data-cred-connector]").forEach((card) => {
    if (card.dataset.credBound === "1") return;
    card.dataset.credBound = "1";
    card.querySelector<HTMLButtonElement>(".cred-connect")?.addEventListener("click", () => void connectConnector(card));
    card.querySelector<HTMLButtonElement>(".cred-disconnect")?.addEventListener("click", () => void disconnectConnector(card));
  });
}
