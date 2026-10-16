// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ReactBits-inspired UI/UX kit — shared, panel-wide micro-interactions.
 * Subtle and admin-appropriate; all effects honor prefers-reduced-motion and
 * are cheap (one delegated pointer listener, one click-driven canvas, one
 * IntersectionObserver). Wired once from PanelLayout so every module benefits
 * consistently.
 *
 * Effects, based on reactbits.dev (MIT) components, re-implemented dependency-free:
 *   - SpotlightCard  → `.lxp-card-glow` cards track the cursor (CSS radial glow).
 *   - ClickSpark     → a fixed canvas draws a quick spark burst on click.
 *   - CountUp        → `[data-countup]` numbers animate from 0 into view once.
 */

import { initClickSparks } from "./click-sparks";

const REDUCED = typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── SpotlightCard: cursor-follow glow on card surfaces ──────────────────────
const CARD_SELECTOR = ".rounded-xl.border.bg-card, .rounded-2xl.border.bg-card";

function tagCards(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((el) => {
    // Skip tiny/utility cards and anything already tagged or explicitly opted out.
    if (el.classList.contains("lxp-card-glow") || el.hasAttribute("data-no-glow")) return;
    if (el.offsetWidth < 160 || el.offsetHeight < 60) return;
    el.classList.add("lxp-card-glow");
  });
}

let pointerBound = false;
function bindPointer() {
  if (pointerBound || REDUCED) return;
  pointerBound = true;
  // One delegated listener; updates CSS vars only for the hovered card.
  document.addEventListener(
    "pointermove",
    (ev) => {
      const target = (ev.target as Element | null)?.closest<HTMLElement>(".lxp-card-glow");
      if (!target) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty("--lxp-mx", `${((ev.clientX - r.left) / r.width) * 100}%`);
      target.style.setProperty("--lxp-my", `${((ev.clientY - r.top) / r.height) * 100}%`);
    },
    { passive: true },
  );
}

// ── CountUp: animate [data-countup] numbers into view ───────────────────────
function parseNumber(text: string): { value: number; prefix: string; suffix: string; decimals: number } | null {
  const m = text.match(/^(\D*?)(-?[\d.,]+)(.*)$/s);
  if (!m) return null;
  const rawNum = m[2];
  // Normalize: drop thousands separators, keep the decimal separator.
  const normalized = rawNum.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const dot = rawNum.match(/[.,](\d+)$/);
  const decimals = dot ? dot[1].length : 0;
  return { value, prefix: m[1] ?? "", suffix: m[3] ?? "", decimals };
}

function animateCount(el: HTMLElement) {
  if (el.dataset.countupDone) return;
  const parsed = parseNumber((el.dataset.countupTo ?? el.textContent ?? "").trim());
  if (!parsed) return;
  el.dataset.countupDone = "1";
  if (REDUCED || parsed.value === 0) return;
  const { value, prefix, suffix, decimals } = parsed;
  const DURATION = 900;
  const start = performance.now();
  const fmt = (n: number) =>
    `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  function step(now: number) {
    const t = Math.min(1, (now - start) / DURATION);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(value * ease);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = fmt(value);
  }
  requestAnimationFrame(step);
}

let countObserver: IntersectionObserver | null = null;
function initCountUp(root: ParentNode = document) {
  const targets = root.querySelectorAll<HTMLElement>("[data-countup]");
  if (targets.length === 0) return;
  if (!("IntersectionObserver" in window)) {
    targets.forEach(animateCount);
    return;
  }
  if (!countObserver) {
    countObserver = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            animateCount(e.target as HTMLElement);
            obs.unobserve(e.target);
          }
        }
      },
      { threshold: 0.2 },
    );
  }
  targets.forEach((el) => {
    if (!el.dataset.countupDone) countObserver!.observe(el);
  });
}

// ── Boot ────────────────────────────────────────────────────────────────────
export function initReactBitsKit() {
  try {
    tagCards();
    bindPointer();
    initClickSparks();
    initCountUp();
  } catch {
    /* never break the panel over a flourish */
  }
}

// Re-tag/re-scan on SPA navigation (Astro ClientRouter) and after late content.
function boot() {
  initReactBitsKit();
  document.addEventListener("astro:page-load", () => {
    initClickSparks();
    tagCards();
    initCountUp();
  });
  document.addEventListener("astro:after-swap", () => {
    initClickSparks();
    tagCards();
    initCountUp();
  });
  // Catch cards/numbers that render slightly after first paint (client islands,
  // vanilla fetches) — a couple of cheap re-scans, then stop.
  let n = 0;
  const iv = window.setInterval(() => {
    tagCards();
    initCountUp();
    if (++n >= 4) window.clearInterval(iv);
  }, 700);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
