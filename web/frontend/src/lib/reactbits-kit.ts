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

// ── ClickSpark: quick spark burst on click ──────────────────────────────────
function initClickSpark() {
  if (REDUCED) return;
  let canvas = document.querySelector<HTMLCanvasElement>("canvas.lxp-spark-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "lxp-spark-canvas";
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    canvas!.width = Math.floor(window.innerWidth * dpr);
    canvas!.height = Math.floor(window.innerHeight * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  const brand = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--brand")
      || getComputedStyle(document.documentElement).getPropertyValue("--primary");
    return v.trim() || "oklch(0.62 0.2 265)";
  };

  interface Spark { x: number; y: number; angle: number; start: number; }
  let sparks: Spark[] = [];
  const COUNT = 8;
  const DIST = 15;
  const LIFE = 380;
  let raf = 0;

  function frame(now: number) {
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.strokeStyle = brand();
    ctx!.lineWidth = 2;
    ctx!.lineCap = "round";
    sparks = sparks.filter((s) => {
      const t = (now - s.start) / LIFE;
      if (t >= 1) return false;
      const ease = t * (2 - t); // easeOut
      const d = ease * DIST;
      const len = 8 * (1 - t);
      const x1 = s.x + Math.cos(s.angle) * d;
      const y1 = s.y + Math.sin(s.angle) * d;
      const x2 = s.x + Math.cos(s.angle) * (d + len);
      const y2 = s.y + Math.sin(s.angle) * (d + len);
      ctx!.globalAlpha = 1 - t;
      ctx!.beginPath();
      ctx!.moveTo(x1, y1);
      ctx!.lineTo(x2, y2);
      ctx!.stroke();
      return true;
    });
    ctx!.globalAlpha = 1;
    if (sparks.length > 0) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
    }
  }

  document.addEventListener("click", (ev) => {
    // Skip form controls where a flourish would feel noisy.
    const el = ev.target as Element | null;
    if (el?.closest("input, textarea, select, [contenteditable='true']")) return;
    const now = performance.now();
    for (let i = 0; i < COUNT; i++) {
      sparks.push({ x: ev.clientX, y: ev.clientY, angle: (2 * Math.PI * i) / COUNT, start: now });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  });
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
    initClickSpark();
    initCountUp();
  } catch {
    /* never break the panel over a flourish */
  }
}

// Re-tag/re-scan on SPA navigation (Astro ClientRouter) and after late content.
function boot() {
  initReactBitsKit();
  document.addEventListener("astro:page-load", () => {
    tagCards();
    initCountUp();
  });
  document.addEventListener("astro:after-swap", () => {
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
