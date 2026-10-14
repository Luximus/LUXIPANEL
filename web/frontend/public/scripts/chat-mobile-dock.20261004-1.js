// Keep the entire mobile composing surface above the visual viewport's keyboard.
// The workspace island survives Astro swaps, so these listeners are installed once.
const root = document.documentElement;
const mobile = window.matchMedia('(max-width: 1024px)');
const viewport = window.visualViewport;
function syncDockViewport() {
  const active = mobile.matches && document.querySelector('[data-workspace-shell] [data-assistant-topbar]');
  if (!active || !viewport || Math.abs(viewport.scale - 1) > .05) {
    root.style.removeProperty('--lxp-chat-visible-bottom');
    root.style.removeProperty('--lxp-chat-viewport-inset');
    return;
  }
  const bottom = Math.round(viewport.height + viewport.offsetTop);
  root.style.setProperty('--lxp-chat-visible-bottom', `${bottom}px`);
  root.style.setProperty('--lxp-chat-viewport-inset', `${Math.max(0, window.innerHeight - bottom)}px`);
}
viewport?.addEventListener('resize', syncDockViewport);
viewport?.addEventListener('scroll', syncDockViewport);
mobile.addEventListener('change', syncDockViewport);
window.addEventListener('resize', syncDockViewport);
document.addEventListener('astro:after-swap', syncDockViewport);
document.addEventListener('astro:page-load', syncDockViewport);
syncDockViewport();
