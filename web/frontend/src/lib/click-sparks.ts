// SPDX-License-Identifier: AGPL-3.0-only
/** A finite click flourish: clearing must not depend on the next animation frame. */
let current: HTMLCanvasElement | null = null;
let dispose: (() => void) | undefined;
export function initClickSparks(): void {
  if (current?.isConnected) return;
  dispose?.();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "lxp-spark-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.hidden = true;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  document.body.appendChild(canvas);
  current = canvas;
  const LIFE = 380;
  let sparks: {x:number;y:number;angle:number;start:number}[] = [];
  let raf: number | null = null;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  function erase() {
    // Canvas dimensions are backing pixels, while drawing uses CSS pixels.
    // Clearing under the DPR transform misses the bottom/right at zoom < 100%.
    ctx!.save();
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.restore();
  }
  function clear() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    clearTimeout(deadline);
    deadline = undefined;
    sparks = [];
    erase();
    canvas.hidden = true;
  }
  function resize() {
    clear();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame() {
    raf = null;
    const now = performance.now();
    erase();
    const styles = getComputedStyle(document.documentElement);
    ctx!.strokeStyle = styles.getPropertyValue("--brand").trim() || styles.getPropertyValue("--primary").trim() || "#64d8b4";
    ctx!.lineWidth = 2;
    ctx!.lineCap = "round";
    sparks = sparks.filter(s => {
      const t = Math.max(0, (now - s.start) / LIFE);
      if (t >= 1) return false;
      const d = t * (2 - t) * 15, len = 8 * (1 - t);
      ctx!.globalAlpha = 1 - t;
      ctx!.beginPath();
      ctx!.moveTo(s.x + Math.cos(s.angle) * d, s.y + Math.sin(s.angle) * d);
      ctx!.lineTo(s.x + Math.cos(s.angle) * (d + len), s.y + Math.sin(s.angle) * (d + len));
      ctx!.stroke();
      return true;
    });
    ctx!.globalAlpha = 1;
    if (sparks.length) raf = requestAnimationFrame(frame);
    else clear();
  }
  function click(ev: MouseEvent) {
    const el = ev.target instanceof Element ? ev.target : null;
    if (el?.closest("input, textarea, select, [contenteditable='true']") || !ev.detail) return;
    const now = performance.now();
    sparks = sparks.filter(s => now - s.start < LIFE).slice(-120);
    for (let i = 0; i < 8; i++) sparks.push({x:ev.clientX,y:ev.clientY,angle:2*Math.PI*i/8,start:now});
    canvas.hidden = false;
    // Also clear when frames stop (focus change, throttling or interrupted rendering).
    clearTimeout(deadline);
    deadline = setTimeout(clear, LIFE + 60);
    if (raf === null) raf = requestAnimationFrame(frame);
  }
  const visibility = () => { if (document.hidden) clear(); };
  const cleanup = () => {
    clear();
    document.removeEventListener("click", click);
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("astro:before-swap", cleanup);
    window.removeEventListener("resize", resize);
    window.removeEventListener("blur", clear);
    window.removeEventListener("pagehide", clear);
    canvas.remove();
    if (current === canvas) { current = null; dispose = undefined; }
  };
  dispose = cleanup;
  resize();
  document.addEventListener("click", click);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("astro:before-swap", cleanup, {once:true});
  window.addEventListener("resize", resize, {passive:true});
  window.addEventListener("blur", clear);
  window.addEventListener("pagehide", clear);
}
